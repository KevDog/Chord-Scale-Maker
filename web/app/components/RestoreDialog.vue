<template>
  <UiDialog :open="restoring !== null" size="2xl" @close="emit('close')">
    <form v-if="plan && !result" @submit.prevent="run">
      <UiDialogTitle>Restore from backup</UiDialogTitle>
      <UiDialogDescription>{{ exported }}Nothing here is changed until you choose Restore.</UiDialogDescription>
      <UiDialogBody class="space-y-6">
        <ul class="list-disc space-y-1 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li v-for="line in summary" :key="line">{{ line }}</li>
        </ul>
        <UiText v-if="restoring && restoring.dropped">{{ droppedText }}</UiText>
        <UiText v-if="!work">Everything in this backup is already here.</UiText>

        <div v-if="chartConflicts.length" class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <UiSubheading :level="3">Charts that differ from yours</UiSubheading>
            <UiSelect v-if="chartConflicts.length > 1" v-model="all" aria-label="Apply to all" class="w-48" @change="applyAll">
              <option value="" disabled>Apply to all…</option>
              <option v-for="o in CHART_CHOICES" :key="o.value" :value="o.value">{{ o.label }}</option>
            </UiSelect>
          </div>
          <ul class="divide-y divide-zinc-950/5 dark:divide-white/5">
            <li v-for="c in chartConflicts" :key="c.incoming.meta.id" class="flex flex-wrap items-center justify-between gap-3 py-2">
              <div class="min-w-0 text-base/6 sm:text-sm/6">
                <p class="font-medium text-zinc-950 dark:text-white">{{ c.incoming.meta.title }} <span class="font-normal text-zinc-500 dark:text-zinc-400">· backup, {{ when(c.incoming.meta.updatedAt) }}</span></p>
                <p class="text-zinc-500 dark:text-zinc-400">Yours: {{ c.local?.meta.title }}, {{ when(c.local?.meta.updatedAt ?? 0) }}</p>
              </div>
              <UiSelect v-model="chartChoices[c.incoming.meta.id]" :aria-label="`What to do with ${c.incoming.meta.title}`" class="w-48">
                <option v-for="o in CHART_CHOICES" :key="o.value" :value="o.value">{{ o.label }}</option>
              </UiSelect>
            </li>
          </ul>
        </div>

        <div v-if="libraryConflicts.length" class="space-y-3">
          <UiSubheading :level="3">Library tunes whose picks and level differ</UiSubheading>
          <ul class="divide-y divide-zinc-950/5 dark:divide-white/5">
            <li v-for="l in libraryConflicts" :key="l.slug" class="flex flex-wrap items-center justify-between gap-3 py-2">
              <p class="min-w-0 text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white">{{ tuneTitle(l.slug) }}</p>
              <UiSelect v-model="libraryChoices[l.slug]" :aria-label="`What to do with ${tuneTitle(l.slug)}’s picks`" class="w-48">
                <option value="mine">Keep mine</option>
                <option value="imported">Use imported</option>
              </UiSelect>
            </li>
          </ul>
        </div>

        <UiCheckbox v-if="prefsOffered" v-model="usePrefs">Use the backup’s preferences (instrument, range, theme, how the sheets look)</UiCheckbox>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton plain @click="emit('close')">Cancel</UiButton>
        <UiButton type="submit" color="note" :disabled="!work">Restore</UiButton>
      </UiDialogActions>
    </form>

    <template v-else-if="result">
      <UiDialogTitle>{{ result.ok ? 'Restored' : result.reason === 'tooMany' ? 'Too many charts' : 'Only part of it was restored' }}</UiDialogTitle>
      <UiDialogBody class="space-y-3">
        <UiText v-if="result.ok">{{ countOf(result.written.length, 'item') }} restored.</UiText>
        <UiText v-else-if="result.reason === 'tooMany'">
          That would make more than {{ MY_CHARTS_MAX }} charts in My charts, so nothing was changed. Delete some first, or choose Keep mine for some.
        </UiText>
        <template v-else>
          <UiText>This browser’s storage filled up. Restored: {{ result.written.join(', ') || 'nothing' }}.</UiText>
          <UiText>Not restored: {{ result.notWritten.join(', ') }}.</UiText>
        </template>
        <UiText v-if="prefsWritten">Reload the page to use the restored preferences.</UiText>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton :plain="prefsWritten" :color="prefsWritten ? undefined : 'note'" @click="emit('close')">Close</UiButton>
        <UiButton v-if="prefsWritten" color="note" @click="reload">Reload</UiButton>
      </UiDialogActions>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import type { Backup, ChartChoice, ImportPlan, ImportStatus } from '@chord-scale-maker/engine'
import type { RestoreResult } from '~/utils/backup'

/**
 * Restore from backup… (#466): what the file holds against this browser, a choice for each chart or library tune
 * that differs (DECISIONS backup.*), then the restore and what landed. restoring: the file, from useOpenChart.
 */
const props = defineProps<{ restoring: Readonly<{ backup: Backup; dropped: number }> | null }>()
const emit = defineEmits<{ close: [] }>()

const CHART_CHOICES: readonly { value: ChartChoice; label: string }[] = [
  { value: 'both', label: 'Keep both' },
  { value: 'mine', label: 'Keep mine' },
  { value: 'imported', label: 'Use imported' },
]

const plan = shallowRef<ImportPlan | null>(null)
const chartChoices = ref<Record<string, ChartChoice>>({})
const libraryChoices = ref<Record<string, 'mine' | 'imported'>>({})
const usePrefs = ref(false)
const all = ref<ChartChoice | ''>('')
const result = shallowRef<RestoreResult | null>(null)

// a new file: plan it against this browser as it is now, every choice at its default
watch(
  () => props.restoring,
  (r) => {
    result.value = null
    all.value = ''
    plan.value = r ? planRestore(r.backup) : null
    const p = plan.value
    chartChoices.value = Object.fromEntries((p?.charts ?? []).filter((c) => c.status === 'conflict').map((c) => [c.incoming.meta.id, 'both']))
    libraryChoices.value = Object.fromEntries((p?.library ?? []).filter((l) => l.status === 'conflict').map((l) => [l.slug, 'mine']))
    usePrefs.value = p?.preferences.apply ?? false
  },
  { immediate: true },
)

const chartConflicts = computed(() => plan.value?.charts.filter((c) => c.status === 'conflict') ?? [])
const libraryConflicts = computed(() => plan.value?.library.filter((l) => l.status === 'conflict') ?? [])
const prefsOffered = computed(() => plan.value?.preferences.status === 'new' || plan.value?.preferences.status === 'conflict')
const work = computed(() => !!plan.value && (plan.value.charts.some((c) => c.status !== 'identical') || plan.value.library.some((l) => l.status !== 'identical') || prefsOffered.value))

const countOf = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`
const tally = (statuses: readonly ImportStatus[], noun: string, plural = `${noun}s`): string | null => {
  const n = (s: ImportStatus): number => statuses.filter((x) => x === s).length
  if (!statuses.length) return null
  const parts = [n('new') && `${n('new')} new ${n('new') === 1 ? noun : plural}`, n('identical') && `${n('identical')} already here`, n('conflict') && `${n('conflict')} ${n('conflict') === 1 ? 'differs' : 'differ'} from yours`]
  return parts.filter(Boolean).join(', ')
}
const summary = computed((): string[] => {
  const p = plan.value
  if (!p) return []
  const charts = tally(p.charts.map((c) => c.status), 'chart')
  const library = tally(p.library.map((l) => l.status), 'library tune’s picks and level', 'library tunes’ picks and levels')
  const prefs = { none: null, identical: 'Preferences: the same as yours', new: 'Preferences', conflict: 'Preferences: different from yours' }[p.preferences.status]
  return [charts && `Charts: ${charts}`, library && `Library tunes: ${library}`, prefs].filter((x): x is string => !!x)
})
const droppedText = computed(() => {
  const n = props.restoring?.dropped ?? 0
  return `${n} ${n === 1 ? 'entry' : 'entries'} in the file couldn’t be read and ${n === 1 ? 'is' : 'are'} left out.`
})
const exported = computed(() => {
  const at = Date.parse(props.restoring?.backup.exportedAt ?? '')
  return Number.isNaN(at) ? '' : `Backed up ${when(at)}. `
})
const when = (at: number): string => new Date(at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const tuneTitle = (slug: string): string => findChart(slug)?.title ?? slug

function applyAll(): void {
  const choice = all.value
  if (choice) chartChoices.value = Object.fromEntries(Object.keys(chartChoices.value).map((id) => [id, choice]))
}

const prefsWritten = computed(() => !!result.value && result.value.written.includes('Preferences'))

function run(): void {
  if (!plan.value || !work.value) return
  result.value = restore(plan.value, { charts: chartChoices.value, library: libraryChoices.value, preferences: usePrefs.value })
}

function reload(): void {
  location.reload()
}
</script>

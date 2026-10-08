<template>
  <div class="space-y-10">
    <div class="min-w-0 print:hidden">
      <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
      <UiText v-if="editor.meta.value.subtitle" class="mt-1">{{ editor.meta.value.subtitle }}</UiText>
      <!-- My charts: where this chart is saved, and what you can do with it -->
      <div v-if="saved" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <UiText role="status" :class="['text-sm/6!', saved.status.value.state === 'failed' && 'text-red-700! dark:text-red-400!']">{{ saveText }}</UiText>
        <UiButton v-if="saved.edited.value" plain @click="revertOpen = true"><ArrowUturnLeftIcon data-slot="icon" />Revert to library version</UiButton>
        <UiButton outline :disabled="editor.fatal.value" @click="saveCopy"><DocumentDuplicateIcon data-slot="icon" />Save as a copy</UiButton>
        <UiButton outline @click="download"><ArrowDownTrayIcon data-slot="icon" />Download</UiButton>
      </div>
      <UiText v-if="copyError" role="alert" class="mt-2 text-sm/6! text-red-700! dark:text-red-400!">{{ copyError }}</UiText>
    </div>

    <UiDialog :open="revertOpen" size="md" @close="revertOpen = false">
      <UiDialogTitle>Revert to the library version?</UiDialogTitle>
      <UiDialogDescription>Your edits to {{ libraryTitle }} are removed from this browser. To keep them as well, Save as a copy first.</UiDialogDescription>
      <UiDialogActions>
        <UiButton plain @click="revertOpen = false">Cancel</UiButton>
        <UiButton color="note" @click="revert">Revert</UiButton>
      </UiDialogActions>
    </UiDialog>

    <div class="grid gap-8 print:hidden lg:grid-cols-2">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <UiSubheading id="grid-heading" class="mb-3">Chart</UiSubheading>
        <div v-if="editor.fatal.value" class="rounded-lg bg-red-500/10 p-4 text-sm/6 text-red-700 dark:text-red-400">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </div>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </div>
      </section>
      <section aria-labelledby="text-heading" class="min-w-0">
        <div class="mb-3 flex items-center gap-2">
          <UiSubheading id="text-heading">Text</UiSubheading>
          <HelpTip label="How the text editor works">
            <span class="block">One line per chord: <code class="font-mono text-xs whitespace-nowrap">section | bar | chord | scale</code>, in concert pitch. Leave the scale out to use the chord's default.</span>
            <span class="mt-2 block"><code class="font-mono text-xs">title:</code> and <code class="font-mono text-xs">subtitle:</code> set the heading, lines starting with <code class="font-mono text-xs">#</code> are comments, and <code class="font-mono text-xs">@copy A B 8</code> repeats section A as B, 8 bars later.</span>
            <span class="mt-2 block">The text and the grid stay in sync: edit either one. Problems are listed under the text.</span>
          </HelpTip>
        </div>
        <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
      </section>
    </div>

    <!-- focus mode: this section alone, over the whole page (and printed as usual) -->
    <section
      v-bind="focus.on.value ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Focus mode' } : { 'aria-labelledby': 'preview-heading' }"
      :class="[
        'space-y-6',
        focus.on.value && 'fixed inset-0 z-50 overflow-y-auto bg-zinc-100 px-4 pb-8 dark:bg-zinc-900 print:static print:overflow-visible print:bg-white print:p-0',
      ]"
    >
      <div v-if="focus.on.value" ref="focusBar" class="sticky top-0 z-10 -mx-4 flex justify-end bg-zinc-100/90 px-4 py-3 backdrop-blur-sm dark:bg-zinc-900/90 print:hidden">
        <UiButton outline @click="focus.exit"><XMarkIcon data-slot="icon" />Exit focus<kbd class="ml-1 font-sans text-xs text-zinc-500 dark:text-zinc-400">Esc</kbd></UiButton>
      </div>
      <div v-show="!focus.on.value" class="space-y-4 print:hidden">
        <UiSubheading id="preview-heading">Preview</UiSubheading>
        <PreviewControls
          v-model:sheet="sheet"
          v-model:instrument="prefs.instrument.value"
          v-model:mode="mode"
          v-model:start="prefs.start.value"
          v-model:intervals="prefs.intervals.value"
        >
          <!-- the chart's actions, after Intervals (none while the chart is over a size limit) -->
          <template v-if="!editor.fatal.value" #actions>
            <ChartTranspose :current="currentDoc" @update:doc="editor.setDoc" @transposed="transposed = $event" />
            <UiButton outline title="Show only the sheet music (Esc to leave)" @click="enterFocus"><ArrowsPointingOutIcon data-slot="icon" />Focus</UiButton>
            <UiButton color="note" @click="print"><PrinterIcon data-slot="icon" />Print / Save PDF</UiButton>
          </template>
        </PreviewControls>
        <UiText v-if="transposed" role="status">{{ transposed }}</UiText>
        <PracticePanel
          v-if="practiceOn && sheet === 'scales' && !editor.fatal.value"
          :mode="mode"
          :start-text="prefs.start.value"
          :boxes="practiceBoxesNow"
          :selection="selection"
          :lit="litNow"
          @update:selection="practice.setSelection(mode, $event)"
        />
      </div>

      <div :class="focus.on.value && 'mx-auto max-w-6xl print:max-w-none'">
        <UiText v-if="editor.fatal.value" class="text-red-600! dark:text-red-400!">Preview paused: the chart is over a size limit.</UiText>
        <GuideToneSheet
          v-else-if="sheet === 'guideTones'"
          :rows="editor.rows.value"
          :title="editor.meta.value.title"
          :subtitle="editor.meta.value.subtitle"
          :part="part"
          :instrument-label="instrumentLabel(prefs.instrument.value)"
          :intervals="prefs.intervals.value"
        />
        <ScaleSheet
          v-else
          :rows="editor.rows.value"
          :title="editor.meta.value.title"
          :subtitle="editor.meta.value.subtitle"
          :part="part"
          :instrument-label="instrumentLabel(prefs.instrument.value)"
          :start="prefs.start.value"
          :mode="mode"
          :per-page="PER_PAGE"
          :intervals="prefs.intervals.value"
          :practice="selection"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowsPointingOutIcon, ArrowUturnLeftIcon, DocumentDuplicateIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { buildSheet, type ChartDoc, instrumentLabel, LIMITS, litKeys, type Mode, partFor, practiceBoxes, serializeChart, setMeta } from '~~/engine'
import type { SaveTarget } from '~/composables/useSavedChart'
import type { SheetKind } from '~/utils/sheets'

/**
 * practiceKey: what practice selections are remembered under (a library slug, or mine:<id>); none for the visit only.
 * saveTarget: where edits save (My charts); none when the feature is off. libraryTitle: the library chart's title.
 */
const props = defineProps<{ initialText: string; practiceKey?: string; saveTarget?: SaveTarget; libraryTitle?: string }>()
const emit = defineEmits<{ created: [id: string]; reload: [] }>()

const PER_PAGE = 12

const editor = useChartEditor(props.initialText)
const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** one spelling at a time: every scale from the Start on note, or each from its own root */
const mode = ref<Mode>('root')
const sheet = ref<SheetKind>('scales')
const practiceOn = useFeature('practice')
const practice = usePractice(props.practiceKey)
const selection = computed(() => (practiceOn ? practice.selection(mode.value) : null))
// every staff with its practice keys, for the panel's boxes and what the selection lights
const practiceStaves = computed(() =>
  practiceOn ? buildSheet(editor.rows.value, part.value, mode.value, prefs.start.value, LIMITS.maxExpandedRows, selection.value).flatMap((p) => p.pages.flat()) : [],
)
const practiceBoxesNow = computed(() => practiceBoxes(practiceStaves.value, mode.value, prefs.start.value))
const litNow = computed(() => litKeys(practiceStaves.value))
const transposed = ref('')
const focus = useFocusMode()
const focusBar = ref<HTMLElement | null>(null)

const saved = props.saveTarget ? useSavedChart(editor.text, props.saveTarget, (id) => emit('created', id)) : null
const revertOpen = ref(false)
const copyError = ref('')

const timeText = (at: number): string => {
  const d = new Date(at)
  const today = d.toDateString() === new Date().toDateString()
  return today ? `at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `on ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}
const saveText = computed((): string => {
  const s = saved?.status.value
  if (!s) return ''
  if (s.state === 'pending') return 'Saving…'
  if (s.state === 'failed')
    return s.reason === 'tooLong'
      ? `Not saved: it's over ${LIMITS.maxChars.toLocaleString()} characters.`
      : "Not saved: this browser's storage is full, or My charts is at its limit. Delete a chart you don't need."
  if (s.state === 'saved')
    return props.libraryTitle ? `Your edited version of ${props.libraryTitle}, saved in this browser ${timeText(s.at)}.` : `Saved in this browser ${timeText(s.at)}.`
  return props.saveTarget?.kind === 'library' ? 'Edits are saved in this browser as your version.' : 'Saved in this browser once you start editing.'
})

/** a copy of the chart as it is now, opened in its place */
function saveCopy(): void {
  editor.flush()
  saved?.flush()
  const doc = setMeta(editor.doc.value, 'title', `${editor.meta.value.title || 'Untitled'} (copy)`)
  const target = props.saveTarget
  const basedOn = target?.kind === 'library' ? target.slug : target?.kind === 'mine' ? loadChart(target.id)?.meta.basedOn : undefined
  const id = newChartId()
  const result = saveChart({ id, text: serializeChart(doc), kind: 'copy', ...(basedOn ? { basedOn } : {}) })
  copyError.value = result.ok ? '' : "Couldn't save a copy: this browser's storage is full, or My charts is at its limit."
  if (result.ok) navigateTo({ path: '/editor', query: { mine: id } })
}

/** the chart as a .txt file, as it is now */
function download(): void {
  editor.flush()
  saved?.flush()
  downloadText(filenameFor(editor.meta.value.title || 'Untitled'), editor.text.value)
}

function revert(): void {
  revertOpen.value = false
  const id = saved?.id()
  if (id) deleteChart(id)
  saved?.forget()
  emit('reload')
}

/** the doc with anything typed in the last moment parsed in */
function currentDoc(): ChartDoc {
  editor.flush()
  return editor.doc.value
}

/** focus mode, with keyboard focus on its exit button */
function enterFocus(): void {
  editor.flush()
  focus.enter()
  nextTick(() => focusBar.value?.querySelector('button')?.focus())
}

function print(): void {
  editor.flush() // include anything typed in the last moment
  nextTick(() => window.print())
}
</script>

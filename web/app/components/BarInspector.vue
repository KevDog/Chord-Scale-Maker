<template>
  <aside aria-labelledby="inspector-heading" class="space-y-6 rounded-xl bg-white p-4 ring-1 ring-note-200 dark:bg-zinc-900 dark:ring-white/10">
    <div>
      <UiText id="inspector-heading" class="text-xs/5!">{{ place }}</UiText>
      <p class="mt-1 text-2xl/8 font-semibold text-zinc-950 dark:text-white">{{ chord?.chord ?? '—' }}</p>
      <UiText v-if="!chord" class="mt-2">This bar holds the chord before it. Type a chord to give it its own.</UiText>
      <p v-else-if="!choices.known" role="note" class="mt-2 rounded-lg bg-amber-500/10 p-3 text-sm/6 text-amber-800 dark:text-amber-400">
        “{{ chord.chord }}” isn’t a chord I know. Check the spelling (Cm7, F7♯9 is F7#9, B♭maj7 is Bbmaj7), or pick a scale for it below.
      </p>
    </div>

    <ChordChoices v-if="chord" collapsible :doc="doc" :line="chord.line" @update:doc="emit('update:doc', $event)" @said="emit('said', $event)" />

    <section aria-labelledby="bar-heading" class="space-y-3 border-t border-zinc-950/5 pt-4 dark:border-white/5">
      <UiSubheading id="bar-heading" :level="3">Bar {{ bar }}</UiSubheading>
      <UiText v-if="cell.kind === 'implied'" class="text-sm/6!">This bar rounds the part out to a whole phrase. Type a chord here to make it the chart’s own.</UiText>
      <template v-else>
        <div class="flex flex-wrap gap-2">
          <UiButton outline @click="change(insertHeldBar(doc, section, bar), `Bar ${bar} added`, 'A section can’t start with a held bar.')"><PlusIcon data-slot="icon" />Bar before</UiButton>
          <UiButton outline @click="change(insertHeldBar(doc, section, bar + 1), `Bar ${bar + 1} added`, 'No bar can go there.', bar + 1)"><PlusIcon data-slot="icon" />Bar after</UiButton>
          <UiButton outline @click="change(deleteBar(doc, section, bar), `Bar ${bar} deleted`, 'A section can’t start with a held bar: give the next bar a chord first.')"><TrashIcon data-slot="icon" />Delete bar</UiButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-for="n in ENDINGS" :key="n" :outline="ending !== n" :color="ending === n ? 'note' : undefined" :aria-pressed="ending === n" @click="change(toggleEnding(doc, section, n, bar), `${n === 1 ? '1st' : '2nd'} ending ${ending === n ? 'off' : 'on'}`, 'An ending can’t go over the other one.')">
            {{ n === 1 ? '1st' : '2nd' }} ending
          </UiButton>
          <UiButton v-for="m in MARKS" :key="m" :outline="!hasMark(m)" :color="hasMark(m) ? 'note' : undefined" :aria-pressed="hasMark(m)" @click="change(setMark(doc, section, bar, m, !hasMark(m)), `${MARK_LABELS[m]} ${hasMark(m) ? 'off' : 'on'}`, '')">
            {{ MARK_LABELS[m] }}
          </UiButton>
        </div>
        <UiField>
          <UiLabel>Jump at the end of the bar</UiLabel>
          <UiSelect :model-value="navText" @update:model-value="(v) => change(setNav(doc, section, bar, String(v)), String(v) || 'No jump', '')">
            <option value="">None</option>
            <option v-for="t in navOptions" :key="t" :value="t">{{ t }}</option>
          </UiSelect>
        </UiField>
        <div class="flex flex-wrap gap-2">
          <UiButton outline @click="emit('split')">New section here…</UiButton>
          <UiButton v-if="functionsOn && chord" outline @click="emit('update:doc', insertKeyChange(doc, chord.line))"><KeyIcon data-slot="icon" />Key change here</UiButton>
        </div>
      </template>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { KeyIcon, PlusIcon, TrashIcon } from '@heroicons/vue/16/solid'
import { type BarChord, type ChartBar, type ChartDoc, deleteBar, insertHeldBar, insertKeyChange, setMark, setNav, toggleEnding } from '@chord-scale-maker/engine'
import ChordChoices from './ChordChoices.vue'

/**
 * The bar editor's inspector (docs/superpowers/proposals/editor-ux/README.md §3 B): the selected chord's scale,
 * function and why (ChordChoices); then the bar's own actions: bars in and out, endings, marks, a jump and a new
 * section. A change the chart can't take is refused with why.
 */
const props = defineProps<{ doc: ChartDoc; section: string; bar: number; index: number; chord: BarChord | null; count: number; cell: ChartBar }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string]; refused: [text: string]; select: [bar: number]; split: [] }>()

const functionsOn = useFeature('functions')
const ORDINALS = ['1st', '2nd', '3rd', '4th']
const place = computed(() => [props.section, `bar ${props.bar}`, props.count > 1 ? `${ORDINALS[props.index] ?? `${props.index + 1}th`} chord` : ''].filter(Boolean).join(' · '))
const choices = computed(() => scaleChoices(props.chord?.chord ?? ''))

const ENDINGS = [1, 2] as const
const MARKS = ['segno', 'coda'] as const
const MARK_LABELS = { segno: 'Segno', coda: 'Coda' } as const
const NAVS = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
const ending = computed(() => props.cell.ending?.n ?? null)
const hasMark = (m: 'segno' | 'coda'): boolean => props.cell.marks.some((x) => x.mark === m)
const navText = computed(() => props.cell.nav[0]?.text ?? '')
const navOptions = computed(() => (navText.value && !NAVS.includes(navText.value) ? [...NAVS, navText.value] : NAVS))

/** a bar action's new doc: the same doc means the chart can't take it, and why is said */
function change(next: ChartDoc, said: string, refused: string, select?: number): void {
  if (next === props.doc) return emit('refused', refused || 'The chart can’t take that here.')
  emit('update:doc', next)
  emit('said', `${props.section}: ${said}`)
  if (select !== undefined) emit('select', select)
}
</script>

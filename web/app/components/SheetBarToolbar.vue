<template>
  <div v-if="!repeatOf || shows('form-editing')" class="print:hidden">
    <div
      role="toolbar"
      :aria-label="`Bar ${bar} of ${section}`"
      class="flex items-center gap-0.5 rounded-lg bg-white p-0.5 text-xs font-semibold text-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10"
    >
      <template v-if="repeatOf">
        <button type="button" :class="ITEM" :aria-label="`Write out ${section}, which repeats ${repeatOf}`" @click="change(writeOutCopy(doc, section), `${section} written out`, `${section} can’t be written out.`)">Write out</button>
      </template>
      <template v-else>
        <button type="button" :class="ITEM" :aria-label="`Insert a held bar before ${section} bar ${bar}`" @click="change(insertHeldBar(doc, section, bar), `bar ${bar} added`, 'A section can’t start with a held bar.')">+ before</button>
        <button type="button" :class="ITEM" :aria-label="`Insert a held bar after ${section} bar ${bar}`" @click="change(insertHeldBar(doc, section, bar + 1), `bar ${bar + 1} added`, 'No bar can go there.')">+ after</button>
        <button type="button" :class="ITEM" :aria-label="`Split ${section} bar ${bar}`" @click="split">Split</button>
        <button type="button" :class="ITEM" :aria-label="`Delete ${section} bar ${bar}`" @click="change(deleteBar(doc, section, bar), `bar ${bar} deleted`, 'A section can’t start with a held bar: give the next bar a chord first.')">Delete</button>
        <UiDropdown v-if="shows('form-editing') || (chordLine !== null && shows('key-change'))">
          <UiDropdownButton plain :class="[ITEM, 'py-0.5! text-xs!']" :aria-label="`More actions for ${section} bar ${bar}`">⋯</UiDropdownButton>
          <UiDropdownMenu anchor="start">
            <UiDropdownItem v-if="chordLine !== null && shows('key-change')" @click="change(insertKeyChange(doc, chordLine), 'key change added', 'A key change can’t go here.')">Key change here</UiDropdownItem>
            <template v-if="shows('form-editing')">
              <UiDropdownItem v-for="n in ENDINGS" :key="n" @click="change(toggleEnding(doc, section, n, bar), `${n === 1 ? '1st' : '2nd'} ending ${ending === n ? 'off' : 'on'}`, 'An ending can’t go over the other one.')">{{ n === 1 ? '1st' : '2nd' }} ending</UiDropdownItem>
              <UiDropdownItem v-for="m in MARKS" :key="m" @click="change(setMark(doc, section, bar, m, !hasMark(m)), `${MARK_LABELS[m]} ${hasMark(m) ? 'off' : 'on'}`, '')">{{ MARK_LABELS[m] }}</UiDropdownItem>
              <UiDropdownItem @click="emit('dialog', 'nav', section, bar)">Jump…</UiDropdownItem>
              <UiDropdownItem @click="emit('dialog', 'split', section, bar)">New section here…</UiDropdownItem>
              <UiDropdownItem @click="emit('dialog', 'paste', section, bar)">Paste bars…</UiDropdownItem>
            </template>
          </UiDropdownMenu>
        </UiDropdown>
      </template>
    </div>
    <!-- a refused change, shown as well as announced -->
    <p v-if="why" role="alert" class="mt-1 max-w-72 rounded-md bg-white px-2 py-1 text-xs/5 font-normal whitespace-normal text-red-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-red-400 dark:ring-white/10">{{ why }}</p>
  </div>
</template>

<script setup lang="ts">
import { barView, type ChartDoc, deleteBar, insertHeldBar, insertKeyChange, setBarChords, setMark, toggleEnding, writeOutCopy } from '@chord-scale-maker/engine'
import { barFull, CANT_TAKE } from '~/utils/refusals'

/**
 * The lead-sheet editor's bar toolbar (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.4): the
 * inspector's bar actions by name, for the bar under the pointer. A change the chart can't take is refused with why.
 * On a repeat's bar (a written-out @copy), Write out alone: its chords are the source section's. The jump, the new
 * section and pasted bars need a dialog (`dialog`), which the editor opens.
 */
const props = defineProps<{ doc: ChartDoc; section: string; bar: number; repeatOf: string | null }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string]; refused: [text: string]; dialog: [kind: 'split' | 'nav' | 'paste', section: string, bar: number] }>()

const { shows } = useInterface()
const ITEM = 'rounded px-2 py-1 hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10'
const ENDINGS = [1, 2] as const
const MARKS = ['segno', 'coda'] as const
const MARK_LABELS = { segno: 'Segno', coda: 'Coda' } as const
const cell = computed(() => barView(props.doc).sections.find((s) => s.name === props.section)?.bars.find((b) => b.bar === props.bar) ?? null)
const chordLine = computed(() => cell.value?.chords[0]?.line ?? null)
const ending = computed(() => cell.value?.ending?.n ?? null)
const hasMark = (m: 'segno' | 'coda'): boolean => !!cell.value?.marks.some((x) => x.mark === m)
/** the last refusal, shown under the toolbar until the next action */
const why = ref('')

/** a bar action's new doc: the same doc means the chart can't take it, and why is shown and said */
function change(next: ChartDoc, said: string, refused: string): void {
  if (next === props.doc) {
    why.value = refused || CANT_TAKE
    return emit('refused', why.value)
  }
  why.value = ''
  emit('update:doc', next)
  emit('said', `${props.section}: ${said}`)
}
/** the bar's chord twice, so the second half can be typed */
function split(): void {
  const chords = cell.value?.chords.map((c) => c.chord) ?? []
  const last = chords.at(-1)
  if (last === undefined) {
    why.value = 'A held bar has no chord to split.'
    return emit('refused', why.value)
  }
  change(setBarChords(props.doc, props.section, props.bar, [...chords, last]), `bar ${props.bar} split`, barFull(barView(props.doc).beats))
}
</script>

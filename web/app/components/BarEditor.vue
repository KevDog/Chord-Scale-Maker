<template>
  <div ref="root" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="min-w-0 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UiText class="text-sm/6!">Type a chord into a bar; <UiCode>Space</UiCode> adds one, <UiCode>Tab</UiCode> goes on.</UiText>
        <UiButton v-if="functionsOn" plain :aria-pressed="notes" @click="notes = !notes">Numerals &amp; scales</UiButton>
      </div>

      <template v-for="s in view.sections" :key="s.name">
        <!-- a repeat: one line, its bars shown on request; it changes through the section it repeats -->
        <div v-if="s.copy" class="rounded-lg border border-dashed border-note-300 px-3 py-2 dark:border-white/15">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/6 text-zinc-700 dark:text-zinc-300">
            <button type="button" :aria-label="`Rename section ${s.name}`" title="Rename" @click="openDialog('rename', s.name)"><UiBadge color="zinc">{{ s.name }}</UiBadge></button>
            <span>repeats <UiStrong>{{ s.copy.of }}</UiStrong> · bars {{ span(s.bars) }}</span>
            <span class="ml-auto flex gap-1">
              <UiButton plain :aria-expanded="openCopies.has(s.name)" @click="toggleCopy(s.name)">{{ openCopies.has(s.name) ? 'Hide bars' : 'Show bars' }}</UiButton>
              <UiButton plain :aria-label="`Write out ${s.name}`" title="Write the repeat’s bars into the chart, to change them" @click="writeOut(s.name)">Write out</UiButton>
            </span>
          </div>
          <div v-if="openCopies.has(s.name)" class="mt-2 grid grid-cols-4 gap-px text-sm/6 text-zinc-600 dark:text-zinc-400">
            <span v-for="b in s.bars" :key="b.bar" class="truncate px-2 py-1">{{ b.chords.map((c) => c.chord).join(' ') || '%' }}</span>
          </div>
        </div>

        <div v-else>
          <div :id="headingId(s.name)" class="mb-1 flex items-baseline gap-2 text-xs/5 text-zinc-600 dark:text-zinc-400">
            <button type="button" :aria-label="`Rename section ${s.name}`" title="Rename" @click="openDialog('rename', s.name)"><UiBadge color="zinc">{{ s.name }}</UiBadge></button>
            <span v-if="sectionKey(s)" class="italic">{{ sectionKey(s) }}</span>
            <span>bars {{ span(s.bars) }}</span>
          </div>
          <div role="grid" :aria-labelledby="headingId(s.name)" class="overflow-hidden rounded-lg ring-1 ring-zinc-950/10 dark:ring-white/10">
            <div v-for="(line, li) in linesOf(s.name)" :key="li" role="row" class="grid grid-cols-4 divide-x divide-zinc-950/10 border-zinc-950/10 not-first:border-t dark:divide-white/10 dark:border-white/10">
              <div
                v-for="b in line.bars"
                :key="b.bar"
                :ref="(el) => setCell(s.name, b.bar, el)"
                role="gridcell"
                :tabindex="isSelectedBar(s.name, b.bar) ? 0 : -1"
                :aria-selected="isSelectedBar(s.name, b.bar)"
                :aria-label="cellLabel(s.name, b)"
                :class="[
                  'relative min-h-14 min-w-0 cursor-default bg-white px-2 py-1.5 focus:outline-hidden dark:bg-zinc-900',
                  isSelectedBar(s.name, b.bar) && 'z-10 ring-2 ring-note-600 ring-inset dark:ring-note-400',
                  b.kind === 'implied' && 'bg-zinc-50 dark:bg-zinc-900/60',
                ]"
                @keydown="onCellKey($event)"
                @click="select({ section: s.name, bar: b.bar, chord: 0 })"
              >
                <span v-if="b.key" class="absolute top-0.5 right-1 text-[0.65rem]/4 text-zinc-600 italic dark:text-zinc-400">{{ keyLabel(b.key.key) }}</span>
                <!-- the bar split evenly between its chords, as the format means it (two chords: 2 + 2) -->
                <div class="grid min-w-0 items-start gap-x-1" :style="{ gridTemplateColumns: `repeat(${Math.max(1, shownChords(s.name, b).length)}, minmax(0, 1fr))` }">
                  <template v-for="(c, k) in shownChords(s.name, b)" :key="k">
                    <UiInput
                      v-if="c.editing"
                      v-model="draft"
                      aria-label="Chord"
                      :data-draft="session"
                      :invalid="!!draftError"
                      :title="draftError ?? undefined"
                      class="w-full min-w-16 [&_input]:py-0.5! [&_input]:text-sm/5!"
                      @keydown.stop="onDraftKey"
                      @blur="onDraftBlur"
                    />
                    <button
                      v-else
                      type="button"
                      tabindex="-1"
                      :class="[
                        'min-w-0 rounded px-1 text-left',
                        isSelected(s.name, b.bar, k) && 'bg-note-600 text-white dark:bg-note-500',
                        !c.known && 'underline decoration-amber-500 decoration-wavy decoration-2 underline-offset-4',
                      ]"
                      :title="c.known ? undefined : 'Not a chord the app knows'"
                      @click.stop="select({ section: s.name, bar: b.bar, chord: k })"
                    >
                      <span class="block truncate text-base/6 font-semibold sm:text-sm/6">{{ c.chord }}</span>
                      <span v-if="notes && functionsOn" :class="['block truncate text-[0.7rem]/4', isSelected(s.name, b.bar, k) ? 'text-white/90' : 'text-zinc-600 dark:text-zinc-400']">
                        {{ c.numeral || ' ' }}<br><span :class="c.proposed && (isSelected(s.name, b.bar, k) ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500')" :aria-description="c.proposed ? 'proposed' : undefined">{{ c.scale || ' ' }}</span>
                      </span>
                    </button>
                  </template>
                  <span v-if="b.kind === 'held' && !editingHere(s.name, b.bar)" class="px-1 text-zinc-500 dark:text-zinc-400" aria-hidden="true">%</span>
                </div>
                <span v-if="b.ending" :class="['absolute inset-x-0 top-0 border-t-2 border-zinc-500 dark:border-zinc-400', b.ending.first && 'left-1 border-l-2']" aria-hidden="true" />
                <div v-if="marksOf(b).length" class="flex flex-wrap gap-x-1.5 px-1 text-[0.65rem]/4 text-zinc-600 italic dark:text-zinc-400" aria-hidden="true">
                  <span v-for="m in marksOf(b)" :key="m">{{ m }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <UiText v-if="!view.sections.length">No bars yet. Add a section, or write the chart’s first chords in the Source.</UiText>
      <div role="group" aria-label="Structure" class="flex flex-wrap gap-2">
        <UiButton outline :disabled="!pos" aria-label="Add bar" @click="addBar"><PlusIcon data-slot="icon" />Bar</UiButton>
        <UiButton outline aria-label="Add section…" @click="openDialog('section')"><PlusIcon data-slot="icon" />Section…</UiButton>
        <UiButton outline :disabled="!view.sections.length" @click="openDialog('repeat')"><Square2StackIcon data-slot="icon" />Repeat a section…</UiButton>
        <UiButton outline :disabled="!pos" @click="openDialog('paste')"><ClipboardDocumentIcon data-slot="icon" />Paste bars…</UiButton>
      </div>
      <div v-if="view.unplaced.length" role="note" class="rounded-lg bg-amber-500/10 p-3 text-sm/6 text-amber-800 dark:text-amber-400">
        <p>{{ view.unplaced.length === 1 ? 'A line of the chart isn’t' : `${view.unplaced.length} lines of the chart aren’t` }} on the grid. Edit {{ view.unplaced.length === 1 ? 'it' : 'them' }} in the Source.</p>
        <ul class="mt-1 list-disc pl-5">
          <li v-for="u in view.unplaced" :key="u.line">Line {{ u.line + 1 }}: {{ u.reason }}</li>
        </ul>
        <UiButton plain class="mt-1" @click="emit('source')">Show source</UiButton>
      </div>

      <p class="sr-only" aria-live="polite">{{ said }}</p>
      <UiText v-if="refused" role="alert" class="text-sm/6! text-amber-800! dark:text-amber-400!">{{ refused }}</UiText>

      <dl class="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-white/60 px-3 py-2 text-xs/5 text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
        <div v-for="k in KEYS" :key="k[0]" class="flex items-center gap-1"><dt><kbd class="rounded border border-zinc-950/10 px-1 font-sans dark:border-white/15">{{ k[0] }}</kbd></dt><dd>{{ k[1] }}</dd></div>
      </dl>
    </div>

    <BarInspector
      v-if="selected"
      class="self-start lg:sticky lg:top-4"
      :doc="doc"
      :section="selected.pos.section"
      :bar="selected.pos.bar"
      :index="selected.pos.chord"
      :chord="selected.chord"
      :count="selected.count"
      :cell="selected.cell"
      @update:doc="emitDoc"
      @said="said = $event"
      @refused="refused = $event"
      @select="(bar) => selected && select({ section: selected.pos.section, bar, chord: 0 })"
      @split="openDialog('split')"
    />

    <BarDialog
      :kind="dialog?.kind ?? null"
      :sections="view.sections.filter((x) => !x.copy).map((x) => x.name)"
      :section="dialog?.section ?? ''"
      :bar="pos?.bar ?? 0"
      :beats="view.beats"
      :error="dialogError"
      @close="closeDialog"
      @submit="applyDialog"
    />
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import {
  type BarSection,
  barView,
  cellError,
  type ChartBar,
  type ChartDoc,
  chordsAfterTyping,
  firstPos,
  gridLines,
  type GridMove,
  type GridPos,
  keyLabel,
  moveInGrid,
  placePos,
  posOfLine,
  addSection,
  insertBars,
  insertHeldBar,
  renameSection,
  repeatSection,
  type RowNote,
  rowNotes,
  setBarChords,
  splitSection,
  writeOutCopy,
} from '@chord-scale-maker/engine'
import { ClipboardDocumentIcon, PlusIcon, Square2StackIcon } from '@heroicons/vue/16/solid'
import BarDialog, { type BarDialogKind, type BarDialogSubmit } from './BarDialog.vue'
import BarInspector from './BarInspector.vue'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'

/**
 * The bar editor (docs/superpowers/proposals/editor-ux/README.md §3 B): the chart as bars, four to a line, each
 * written section its own grid. One bar is selected and one chord in it; typing replaces that chord, Space adds one,
 * Tab or the arrows move. The chart is in concert pitch. Every change is a new doc for the editor (useChartEditor),
 * so undo and the text follow.
 */
const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; source: []; selected: [line: number | null] }>()

const functionsOn = useFeature('functions')
const proposedOn = useFeature('proposedScales') // a blank cell's scale is the analysis's, shown greyed until pinned
const { notes } = usePreferences() // the numerals and scales under each chord: off until shown

const KEYS: readonly (readonly [string, string])[] = [
  ['type', 'replaces the chord'],
  ['Space', 'another chord in the bar'],
  ['Tab / →', 'next chord'],
  ['↑ ↓', 'line above / below'],
  ['Enter', 'edit · confirm'],
  ['⌫', 'clear'],
  ['%', 'same as the bar before'],
  ['⌘Z', 'undo'],
]

const view = computed(() => barView(props.doc))
const lines = computed(() => gridLines(view.value))
const linesOf = (section: string) => lines.value.filter((l) => l.section === section)
const scaleView = inject(SCALE_VIEW, shallowRef(DEFAULT_VIEW))
const noteByLine = computed((): ReadonlyMap<number, RowNote> => (functionsOn ? rowNotes(props.doc, scaleView.value) : new Map()))
const span = (bars: readonly ChartBar[]): string => `${bars[0]?.bar ?? ''}–${bars.at(-1)?.bar ?? ''}`
const headingId = (section: string): string => `bars-${section.replace(/[^\w-]/g, '_')}`
/** the key the section starts in, from the analysis */
const sectionKey = (s: BarSection): string => {
  const line = s.bars.find((b) => b.chords.length)?.chords[0]?.line
  const key = line === undefined ? '' : (noteByLine.value.get(line)?.key ?? '')
  return key ? keyLabel(key) : ''
}

const pos = ref<GridPos | null>(firstPos(view.value))
watch(view, (v) => {
  if (editing.value?.insert) return // the new chord's place is past the bar's chords until it's written
  if (pos.value) pos.value = placePos(v, pos.value)
  else pos.value = firstPos(v)
})
const barAt = (section: string, bar: number): ChartBar | undefined => view.value.sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
const selected = computed(() => {
  const p = pos.value
  const b = p ? barAt(p.section, p.bar) : undefined
  if (!p || !b) return null
  return { pos: p, chord: b.chords[p.chord] ?? null, count: b.chords.length, cell: b }
})
// the selected chord's chart line, for the Changes sheet to outline
watch(() => selected.value?.chord?.line ?? null, (line) => emit('selected', line), { immediate: true })
/** select the chord written on a chart line (tapped on the Changes sheet), leaving focus where it is */
function selectLine(line: number): void {
  const p = posOfLine(view.value, line)
  if (!p) return
  editing.value = null
  pos.value = p
  refused.value = ''
}
defineExpose({ selectLine })
const isSelectedBar = (section: string, bar: number): boolean => pos.value?.section === section && pos.value.bar === bar
const isSelected = (section: string, bar: number, k: number): boolean => isSelectedBar(section, bar) && pos.value?.chord === k && !editing.value

const openCopies = ref(new Set<string>())
function toggleCopy(name: string): void {
  const next = new Set(openCopies.value)
  if (!next.delete(name)) next.add(name)
  openCopies.value = next
}

/** a chord as the cell shows it: the draft in its place while it's being typed */
type ShownChord = Readonly<{ chord: string; known: boolean; numeral: string; scale: string; proposed: boolean; editing: boolean }>
function shownChords(section: string, b: ChartBar): ShownChord[] {
  const shown = b.chords.map((c): ShownChord => {
    const n = noteByLine.value.get(c.line)
    return { chord: c.chord, known: scaleChoices(c.chord).known, numeral: n?.numeral ?? '', scale: n?.scale ?? '', proposed: proposedOn && !!n?.scale && n.source !== 'written', editing: false }
  })
  const e = editing.value
  if (!e || !isSelectedBar(section, b.bar)) return shown
  const k = pos.value?.chord ?? 0
  const draftChord: ShownChord = { chord: draft.value, known: true, numeral: '', scale: '', proposed: false, editing: true }
  return e.insert ? [...shown.slice(0, k), draftChord, ...shown.slice(k)] : [...shown.slice(0, k), draftChord, ...shown.slice(k + 1)]
}
const editingHere = (section: string, bar: number): boolean => !!editing.value && isSelectedBar(section, bar)

const ORDINAL = ['1st', '2nd', '3rd', '4th']
/** what's written on a bar besides its chords: its ending, segno or coda, and jump */
function marksOf(b: ChartBar): string[] {
  const ending = b.ending ? [`${ORDINAL[b.ending.n - 1] ?? b.ending.n} ending`] : []
  return [...ending, ...b.marks.map((m) => (m.mark === 'segno' ? 'Segno' : 'Coda')), ...b.nav.map((n) => n.text)]
}
function cellLabel(section: string, b: ChartBar): string {
  const chords = b.chords.map((c) => c.chord).join(', ')
  const what = chords || (b.kind === 'held' ? 'held' : 'empty')
  const sel = isSelectedBar(section, b.bar) && b.chords.length > 1 ? ` (${ORDINAL[pos.value?.chord ?? 0] ?? ''} chord selected)` : ''
  const marks = marksOf(b).map((m) => `; ${m}`).join('')
  return `${section}, bar ${b.bar}: ${what}${marks}${sel}`
}

// the cells by section and bar, to move focus with the selection
const cells = new Map<string, HTMLElement>()
function setCell(section: string, bar: number, el: Element | ComponentPublicInstance | null): void {
  const id = `${section}|${bar}`
  if (el instanceof HTMLElement) cells.set(id, el)
  else cells.delete(id)
}
function focusCell(): void {
  nextTick(() => {
    const p = pos.value
    if (p) cells.get(`${p.section}|${p.bar}`)?.focus()
  })
}
function select(p: GridPos): void {
  pos.value = p
  refused.value = ''
  focusCell()
}

const said = ref('')
const refused = ref('')

/** the chord being typed: in place of the selected one, or a new one there (insert) */
const editing = ref<{ insert: boolean } | null>(null)
const draft = ref('')
const root = ref<HTMLElement | null>(null)
const draftError = computed(() => (draft.value.trim() ? cellError(draft.value.trim()) : null))

/** counts drafts, so a blur from an earlier one's input is told apart */
const session = ref(0)
function startEditing(text: string, insert = false): void {
  session.value++
  editing.value = { insert }
  draft.value = text
  refused.value = ''
  nextTick(() => {
    const input = root.value?.querySelector<HTMLInputElement>('input[aria-label=Chord]') ?? null
    input?.focus()
    input?.setSelectionRange(text.length, text.length)
  })
}

/** write the draft into its bar; false (and the draft stays) when the chart can't take it */
function commit(): boolean {
  const e = editing.value
  const p = pos.value
  if (!e || !p) return true
  const chords = chordsAfterTyping(view.value, p, draft.value, e.insert)
  const before = barAt(p.section, p.bar)?.chords.map((c) => c.chord) ?? []
  editing.value = null
  if (chords.length === before.length && chords.every((c, k) => c === before[k])) {
    pos.value = placePos(view.value, p) // an empty new chord: back onto the bar's chords
    return true
  }
  const next = setBarChords(props.doc, p.section, p.bar, chords)
  if (next === props.doc) {
    refused.value = !chords.length
      ? `A section’s first bar needs a chord.`
      : `“${draft.value.trim()}” can’t go in a chart: ${draftError.value ?? 'it’s not a chord'}.`
    editing.value = e
    return false
  }
  emitDoc(next)
  said.value = `${p.section}, bar ${p.bar}: ${chords.join(', ') || 'held'}`
  if (chords.length < before.length + (e.insert ? 1 : 0)) pos.value = { ...p, chord: Math.max(0, Math.min(p.chord, chords.length - 1)) }
  return true
}

function cancel(): void {
  editing.value = null
  if (pos.value) pos.value = placePos(view.value, pos.value)
  refused.value = ''
  focusCell()
}

function move(m: GridMove): boolean {
  if (!pos.value) return false
  const next = moveInGrid(view.value, pos.value, m)
  if (!next) return false
  select(next)
  return true
}

const MOVES: Readonly<Record<string, GridMove>> = { ArrowRight: 'next', ArrowLeft: 'prev', ArrowUp: 'up', ArrowDown: 'down' }

function onCellKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return // ⌘Z and the browser's own keys
  const p = pos.value
  if (!p) return
  const b = barAt(p.section, p.bar)
  if (e.key === 'Tab') {
    if (move(e.shiftKey ? 'prev' : 'next')) e.preventDefault() // at either end, Tab leaves the grid
  } else if (MOVES[e.key]) {
    e.preventDefault()
    move(MOVES[e.key] as GridMove)
  } else if (e.key === 'Enter' || e.key === 'F2') {
    e.preventDefault()
    startEditing(b?.chords[p.chord]?.chord ?? '')
  } else if (e.key === ' ') {
    e.preventDefault()
    if (!b?.chords.length) return startEditing('')
    if (b.chords.length >= view.value.beats) return void (refused.value = `A bar holds at most ${view.value.beats} chords.`)
    pos.value = { ...p, chord: p.chord + 1 }
    startEditing('', true)
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    if (!b?.chords.length) return
    editing.value = { insert: false }
    draft.value = ''
    if (!commit()) editing.value = null // the bar keeps its chord; the message says why
  } else if (e.key.length === 1) {
    e.preventDefault()
    startEditing(e.key)
  }
}

function onDraftKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') return // the input's own undo
  if (e.key === 'Escape') {
    e.preventDefault()
    return cancel()
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (commit()) focusCell()
    return
  }
  if (e.key === ' ') {
    e.preventDefault()
    if (!draft.value.trim()) return
    const p = pos.value
    const count = (barAt(p?.section ?? '', p?.bar ?? 0)?.chords.length ?? 0) + (editing.value?.insert ? 1 : 0)
    if (count >= view.value.beats) return void (refused.value = `A bar holds at most ${view.value.beats} chords.`)
    if (!commit() || !p) return
    pos.value = { ...p, chord: p.chord + 1 }
    startEditing('', true)
    return
  }
  if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const m: GridMove = e.key === 'Tab' ? (e.shiftKey ? 'prev' : 'next') : MOVES[e.key] as GridMove
    e.preventDefault()
    const whole = draft.value.trim() === '%' // the bar before, all of it: going on means the next bar
    if (!commit()) return
    // after the doc has changed, from the bar as it is now
    nextTick(() => {
      if (whole && m === 'next' && pos.value) pos.value = placePos(view.value, { ...pos.value, chord: view.value.beats })
      if (!move(m)) focusCell()
    })
  }
}

/** leaving the draft writes it; the input of an earlier draft, taken out as the next one starts (Space), isn't leaving */
function onDraftBlur(e: FocusEvent): void {
  if (editing.value && (e.target as HTMLElement | null)?.dataset.draft === String(session.value)) commit()
}

const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)

/** a bar after the selected section's last (before a part's rounding-out bars) */
function addBar(): void {
  const p = pos.value
  const s = view.value.sections.find((x) => x.name === p?.section)
  const last = s?.bars.findLast((b) => b.kind !== 'implied')?.bar
  if (!p || last === undefined) return
  const next = insertHeldBar(props.doc, p.section, last + 1)
  if (next === props.doc) return void (refused.value = 'No bar can go there.')
  emitDoc(next)
  said.value = `${p.section}: bar ${last + 1} added`
  select({ section: p.section, bar: last + 1, chord: 0 })
}

function writeOut(section: string): void {
  const next = writeOutCopy(props.doc, section)
  if (next === props.doc) return void (refused.value = `${section} can’t be written out.`)
  emitDoc(next)
  said.value = `${section} written out`
}

const dialog = ref<{ kind: BarDialogKind; section: string } | null>(null)
const dialogError = ref('')
function openDialog(kind: BarDialogKind, section = pos.value?.section ?? ''): void {
  dialog.value = { kind, section }
  dialogError.value = ''
}
function closeDialog(): void {
  dialog.value = null
  focusCell()
}

const NAME_RULE = 'a name without spaces that no other section has'
/** the dialog's change, and the selection after it; or why the chart can't take it */
function dialogChange(v: BarDialogSubmit, d: ChartDoc, p: GridPos | null, section: string) {
  switch (v.kind) {
    case 'section': {
      const next = addSection(d, v.name, v.chords)
      const bar = barView(next).sections.find((x) => x.name === v.name)?.bars[0]?.bar ?? 0
      return { next, at: { section: v.name, bar, chord: 0 }, said: `${v.name} added`, why: `A new section needs ${NAME_RULE}, and a chord or more.` }
    }
    case 'repeat':
      return { next: repeatSection(d, v.src, v.name), at: p, said: `${v.name} repeats ${v.src}`, why: `A repeat needs ${NAME_RULE}, in the same part as ${v.src}.` }
    case 'rename':
      return {
        next: renameSection(d, section, v.name),
        at: p?.section === section ? { ...p, section: v.name } : p,
        said: `${section} is now ${v.name}`,
        why: `A section needs ${NAME_RULE}, and stays in or out of the form.`,
      }
    case 'split':
      return {
        next: p ? splitSection(d, p.section, p.bar, v.name) : d,
        at: p ? { section: v.name, bar: p.bar, chord: 0 } : p,
        said: `${v.name} starts at bar ${p?.bar}`,
        why: `A new section needs ${NAME_RULE}, and starts on a bar with a chord, after the first, not inside an ending, and not in a section that’s repeated.`,
      }
    case 'paste': {
      const bar = (p?.bar ?? 0) + (v.before ? 0 : 1)
      return {
        next: p ? insertBars(d, p.section, bar, v.bars) : d,
        at: p ? { section: p.section, bar, chord: 0 } : p,
        said: `${v.bars.length} bars added`,
        why: v.before ? 'Those bars can’t go there: a section can’t start with a held bar.' : 'Those bars can’t go there.',
      }
    }
  }
}
function applyDialog(v: BarDialogSubmit): void {
  const { next, at, said: text, why } = dialogChange(v, props.doc, pos.value, dialog.value?.section ?? '')
  if (next === props.doc) return void (dialogError.value = why)
  editing.value = null
  emitDoc(next)
  said.value = text
  dialog.value = null
  if (at) select(at)
}
</script>

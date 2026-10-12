<template>
  <div ref="root" data-slot="system" class="relative break-inside-avoid" @pointerleave="leaveBar" @focusout="leaveBar">
    <!-- section markers and key areas, then chord symbols, over their beats -->
    <div class="relative h-12 print:h-7">
      <template v-for="m in marks" :key="m.key">
        <div
          :data-name="m.slot ? undefined : m.key"
          class="absolute bottom-0 origin-bottom-left whitespace-nowrap"
          :style="{ left: `${m.x * 100}%`, transform: shrunk(m) === 1 ? undefined : `scale(${shrunk(m)})` }"
          @pointerenter="enterBar(m.barIndex)" @focusin="enterBar(m.barIndex)">
          <ChangesMarks v-if="m.segno || m.coda || m.nav" :segno="m.segno" :coda="m.coda" :nav="m.nav" />
          <div v-if="m.marker || m.keyArea" class="flex items-baseline gap-2 text-[0.65rem] print:text-[0.55rem]/3">
            <!-- the sheet as the editor: the section's marker opens its rename -->
            <button
              v-if="m.marker && editing !== undefined && m.row.section"
              type="button"
              :class="[MARKER, 'cursor-pointer hover:border-note-600 hover:text-note-800 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:border-note-400 dark:hover:text-note-300']"
              :aria-label="`Rename ${m.row.section}`"
              @click="emit('dialog', 'rename', m.row.section, Number(m.row.bar))"
            >
              {{ m.marker }}
            </button>
            <span v-else-if="m.marker" :class="MARKER">{{ m.marker }}</span>
            <span v-if="m.keyArea" class="text-note-800 italic dark:text-note-300 print:text-neutral-700">{{ m.keyArea }}</span>
          </div>
          <!-- the sheet as the editor (from md up): each chord a SheetChord, a button or the field in its place -->
          <SheetChord
            v-if="editing !== undefined && doc && m.line >= 0"
            :doc="doc"
            :line="m.line"
            :section="m.row.section"
            :bar="m.row.bar"
            :text="m.text"
            :tokens="m.tokens"
            :label="editLabel(m)"
            :editing="editing"
            :adding="m.slot"
            :selected="m.line === selectedLine"
            :focus-at="focusAt"
            @edit="emit('edit', $event)"
            @update:doc="emit('update:doc', $event)"
            @said="emit('said', $event)"
            @preview="emit('preview', $event)"
            @done="(then, taken) => emit('done', then, taken)"
          />
          <div v-else class="text-base font-semibold print:text-sm/4">
            <!-- the chord as a button while editing below md: it opens the chord editor's bottom sheet (EditorView) -->
            <button
              v-if="editable && m.line >= 0"
              type="button"
              :aria-label="editLabel(m)"
              :class="['relative -mx-1 cursor-pointer rounded px-1 hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10', m.line === selectedLine && 'ring-2 ring-note-600 max-md:ring-0 dark:ring-note-400']"
              @click="emit('tap', { line: m.line, section: m.row.section, bar: m.row.bar })"
            >
              <UiTouchTarget><ChordSymbol v-if="m.tokens" :tokens="m.tokens" /><span v-else>{{ m.text }}</span></UiTouchTarget>
            </button>
            <template v-else><ChordSymbol v-if="m.tokens" :tokens="m.tokens" /><span v-else>{{ m.text }}</span></template>
          </div>
        </div>
        <!-- the bar toolbar (the sheet as the editor), for the bar under the pointer or with focus: right after the bar's
             last chord in the Tab order, above the bar's first beat (from the line's right edge for a bar past the middle) -->
        <SheetBarToolbar
          v-if="toolbarBar && m.barIndex === toolbarBar.index && m.lastInBar"
          :key="toolbarBar.key"
          :doc="doc!"
          :section="toolbarBar.section"
          :bar="toolbarBar.bar"
          :repeat-of="toolbarBar.repeatOf"
          class="absolute top-0 z-20 -translate-y-full whitespace-nowrap"
          :style="toolbarBar.x > 0.6 ? { right: 0 } : { left: `${toolbarBar.x * 100}%` }"
          @pointerenter="holdBar"
          @focusin="holdBar"
          @update:doc="emit('update:doc', $event)"
          @said="emit('said', $event)"
          @refused="emit('refused', $event)"
          @dialog="(kind, section, bar) => emit('dialog', kind, section, bar)"
        />
      </template>
      <span v-for="r in repeats" :key="`r${r.key}`" class="absolute bottom-0 -translate-x-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 print:text-black" :style="{ left: `${r.x * 100}%` }">×{{ r.times }}</span>
    </div>
    <div class="relative">
      <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
      <!-- the sheet as the editor: each bar's strip over the staff tells which bar the pointer is on -->
      <template v-if="editing !== undefined">
        <div v-for="(b, i) in line.bars" :key="`h${i}`" :data-bar="i" class="absolute inset-y-0 print:hidden" :style="{ left: `${barLeft(i) * 100}%`, width: `${(barLeft(i + 1) - barLeft(i)) * 100}%` }" @pointerenter="enterBar(i)" />
        <!-- the ghost bar at the end of a section with room on its last line: the next bar's slot, to add -->
        <button
          v-if="ghost && !ghost.full"
          type="button"
          :class="[GHOST, 'absolute top-2 h-9']"
          :style="ghost.style"
          :aria-label="`Add a bar at the end of ${ghost.section}`"
          @click="emit('addBar', ghost.section)"
        >
          + bar
        </button>
      </template>
    </div>
    <!-- with a guide tone line on: each chord's label (3, 7; 4 on a sus chord, 1 on a triad, 6 on a 6 chord) -->
    <div v-if="hasGuideLine" data-slot="guides" aria-hidden="true" class="relative h-4 print:h-3">
      <span
        v-for="m in marks"
        :key="`g${m.key}`"
        class="absolute text-xs/3.5 font-medium text-zinc-600 tabular-nums dark:text-zinc-400 print:text-[0.6rem]/2.5 print:text-black"
        :style="{ left: `${m.x * 100}%` }"
      >{{ m.guide }}</span>
    </div>
    <!-- the analysis under each chord: its numeral, then its scale -->
    <div v-if="numerals" class="relative h-5 print:h-3.5">
      <span
        v-for="m in marks"
        :key="`n${m.key}`"
        data-slot="numeral"
        :data-draft="drafted(m) ? '' : undefined"
        :class="['absolute text-sm font-medium print:text-xs/3.5 print:text-black', drafted(m) ? 'text-zinc-500 italic dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200', !(notesOn && m.reason) && 'truncate']"
        :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }"
        :title="notesOn && m.reason ? undefined : m.numeral"
      >
        <template v-if="drafted(m)">{{ preview?.readable ? preview.numeral : '' }}</template>
        <SheetLabelPicker v-else-if="editing !== undefined && doc && m.line >= 0 && !m.slot" :doc="doc" :line="m.line" kind="numeral" :chord="m.text" :fallback="m.fallback" :pinned="false" :blank="!m.numeral" @update:doc="emit('update:doc', $event)" @said="emit('said', $event)">{{ m.numeral }}<span v-if="m.problem" class="ml-0.5 text-amber-700 no-underline dark:text-amber-400 print:hidden" aria-hidden="true">⚠</span></SheetLabelPicker>
        <ChangesNote v-else-if="notesOn && m.reason && m.numeral" :reason="m.reason" :heard-in="m.heardIn" :key-from="m.keyFrom" :rule="m.rule" :fallback="m.fallback" :chord="m.written" :concert="m.text" :numeral="m.numeral" :scale="m.scale" :at="m.row" :problem="m.problem">{{ m.numeral }}<span v-if="m.problem" class="ml-0.5 text-amber-700 no-underline dark:text-amber-400 print:hidden" aria-hidden="true">⚠</span></ChangesNote>
        <template v-else>{{ m.numeral }}<span v-if="m.problem" class="ml-0.5 text-amber-700 dark:text-amber-400 print:hidden" :title="m.problem">⚠</span></template>
      </span>
    </div>
    <div v-if="scales" class="relative h-8 print:h-6">
      <span
        v-for="m in marks"
        :key="`s${m.key}`"
        data-slot="scale"
        :data-draft="drafted(m) ? '' : undefined"
        :class="['absolute pr-1 text-[0.7rem]/3.5 print:text-[0.6rem]/3 print:text-neutral-700', drafted(m) ? 'text-zinc-500 italic dark:text-zinc-400' : 'text-zinc-600 dark:text-zinc-400']"
        :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }"
      >
        <template v-if="drafted(m)">{{ preview?.readable ? sheetScale(CONCERT, preview.scale) : '' }}</template>
        <SheetLabelPicker v-else-if="editing !== undefined && doc && m.line >= 0 && !m.slot" :doc="doc" :line="m.line" kind="scale" :chord="m.text" :fallback="false" :blank="!m.scale" :pinned="notes?.get(m.line)?.source === 'written'" @update:doc="emit('update:doc', $event)" @said="emit('said', $event)">{{ m.scale }}</SheetLabelPicker>
        <ChangesNote v-else-if="notesOn && m.reason && m.scale" :reason="m.reason" :heard-in="m.heardIn" :key-from="m.keyFrom" :rule="m.rule" :fallback="m.fallback" :chord="m.written" :concert="m.text" :numeral="m.numeral" :scale="m.scale" :at="m.row" :problem="m.problem" wrap>{{ m.scale }}</ChangesNote>
        <template v-else>{{ m.scale }}</template>
      </span>
    </div>
    <!-- a full last line: the ghost bar as a pill under it -->
    <div v-if="editing !== undefined && ghost?.full" data-slot="after" class="flex justify-end pt-1 print:hidden">
      <button type="button" :class="[GHOST, 'h-6 px-2']" :aria-label="`Add a bar at the end of ${ghost.section}`" @click="emit('addBar', ghost.section)">+ bar</button>
    </div>
    <p v-if="drawError" class="rounded border border-dashed border-amber-500 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{{ drawError }}</p>
  </div>
</template>

<script setup lang="ts">
import { barKey, type ChangesLine, type ChartDoc, type ChordPreview, CONCERT, type GridPos, rowNotes, sheetScale } from '@chord-scale-maker/engine'
import { drawChangesLine, type NamedBeat } from '~/utils/changesDrawing'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'
import type { SheetChordEdit, SheetDone, SheetEdit, SheetFocus } from '~/utils/sheetChordEdit'

/**
 * one line of the Changes sheet: slashes (or guide tones), the chords over them, guide tone labels and the analysis
 * under them. With `editing` given (the lead-sheet editor, docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md)
 * each chord is a SheetChord: a button, or the field in its place, with the draft's reading under it.
 */
const props = defineProps<{
  line: ChangesLine
  first: boolean // gets the time signature
  beats: 2 | 3 | 4
  barsPerLine: number
  numerals: boolean
  scales: boolean
  clef?: 'treble' | 'bass' // with key signatures or a guide tone on: the part's clef, drawn (with any signature) on the first line only
  arpeggio?: boolean // the voice is an arpeggio line: beamed, no label row
  editable?: boolean // each chord a button that asks to edit it
  selectedLine?: number | null // the chart line of the chord the editor is on, outlined
  doc?: ChartDoc // the chart, for the sheet editor's field
  editing?: SheetEdit | null // the sheet is the editor: what it's editing (null: nothing yet); undefined: the chord editor dialog instead
  preview?: ChordPreview | null // the reading of the draft in the open field, shown under its chord
  focusAt?: SheetFocus | null // a chord the editor wants focus on (its field closed with nowhere to go)
}>()
const emit = defineEmits<{
  tap: [chord: SheetChordEdit] // a chord tapped, for the chord editor dialog
  edit: [edit: SheetEdit]
  'update:doc': [doc: ChartDoc]
  said: [text: string]
  preview: [preview: ChordPreview | null]
  done: [then: SheetDone, taken?: GridPos]
  refused: [text: string]
  dialog: [kind: 'split' | 'nav' | 'paste' | 'rename', section: string, bar: number]
  addBar: [section: string]
  overfull: [at: string] // the names don't fit the line: break it before this bar (barKey)
}>()

const root = ref<HTMLElement | null>(null)
const el = ref<HTMLElement | null>(null)
const xs = ref<readonly (readonly number[])[]>([])
const ends = ref<readonly number[]>([]) // each bar's right edge
const nameScales = ref<readonly (readonly number[])[]>([]) // each chord name's scale, where the line can't fit it
const drawError = ref<string | null>(null)
const rendering = useRendering()
const notesOn = useFeature('functions')

/**
 * each chord over the slash of its beat (markers and key areas ride on a bar's first chord, or its first beat), with
 * the room up to the next one, which its numeral and scale wrap within
 */
const marks = computed(() => {
  const all = props.line.bars.flatMap((bar, b) => {
    const at = (beat: number): number => Math.max(0, (xs.value[b]?.[beat] ?? 0) - 0.012)
    const chords = bar.chords.map((c, k) => ({ key: `${b}-${k}`, barIndex: b, k, beat: c.beat, lastInBar: k === bar.chords.length - 1, line: c.line, slot: false, x: at(c.beat), tokens: c.tokens, text: c.text, written: c.written, row: c.at, numeral: c.numeral, scale: c.scale, reason: c.reason, problem: c.problem, rule: c.rule, fallback: c.fallback, heardIn: c.heardIn, keyFrom: c.keyFrom, guide: c.guide, marker: k === 0 ? bar.marker : '', keyArea: k === 0 ? bar.keyArea : '', segno: k === 0 && bar.segno, coda: k === 0 && bar.coda, nav: k === 0 ? bar.nav : '' }))
    if (!chords.length && (bar.marker || bar.keyArea || bar.segno || bar.coda || bar.nav)) return [{ key: `${b}-m`, barIndex: b, k: 0, beat: 0, lastInBar: true, line: -1, slot: false, x: at(0), tokens: null, text: '', written: '', row: { section: '', bar: '' }, numeral: '', scale: null, reason: '', problem: '', rule: '', fallback: false, heardIn: '', keyFrom: 'found' as const, guide: '', marker: bar.marker, keyArea: bar.keyArea, segno: bar.segno, coda: bar.coda, nav: bar.nav }]
    // the new chord slot after a bar's chords (Space in the field), on the beat after the last chord's
    const e = props.editing
    const last = bar.chords.at(-1)
    if (e?.kind === 'slot' && last && last.at.section === e.section && last.at.bar === e.bar) {
      const prev = chords.at(-1)
      if (prev) prev.lastInBar = false
      chords.push({ key: `${b}-slot`, barIndex: b, k: -1, beat: last.beat + 1, lastInBar: true, line: last.line, slot: true, x: at(Math.min(last.beat + 1, props.beats - 1)), tokens: null, text: '', written: '', row: last.at, numeral: '', scale: null, reason: '', problem: '', rule: '', fallback: false, heardIn: '', keyFrom: 'found' as const, guide: '', marker: '', keyArea: '', segno: false, coda: false, nav: '' })
    }
    return chords
  })
  return all.map((m, i) => ({ ...m, room: Math.max(0.05, (all[i + 1]?.x ?? 1) - m.x) }))
})
/** each row's notes while the sheet is the editor: a written scale shows its pin on the label */
const scaleView = inject(SCALE_VIEW, shallowRef(DEFAULT_VIEW))
const notes = computed(() => (props.doc && props.editing !== undefined ? rowNotes(props.doc, scaleView.value) : null))
/** the bar under the pointer or with focus (the sheet as the editor), kept while the pointer or focus is on its toolbar */
const hoverBar = ref<number | null>(null)
let leaving: ReturnType<typeof setTimeout> | undefined
function enterBar(i: number): void {
  clearTimeout(leaving)
  if (props.editing !== undefined) hoverBar.value = i
}
function holdBar(): void {
  clearTimeout(leaving)
}
function leaveBar(): void {
  clearTimeout(leaving)
  leaving = setTimeout(() => (hoverBar.value = null), 200)
}
onBeforeUnmount(() => clearTimeout(leaving))
/** where a bar starts, as a fraction of the width: its first beat, a little left; the end of the line for one past the last */
const barLeft = (i: number): number => (i >= props.line.bars.length ? 1 : Math.max(0, (xs.value[i]?.[0] ?? i / props.barsPerLine) - 0.03))
const toolbarBar = computed(() => {
  const i = hoverBar.value
  const bar = i === null ? undefined : props.line.bars[i]
  if (i === null || !bar || !props.doc) return null
  return { key: `${bar.at.section}-${bar.at.bar}`, index: i, section: bar.at.section, bar: Number(bar.at.bar), repeatOf: bar.repeatOf, x: Math.max(0, (xs.value[i]?.[0] ?? i / props.barsPerLine) - 0.012) }
})
const MARKER = 'rounded-sm border border-zinc-400 px-1 font-semibold text-zinc-700 dark:border-zinc-500 dark:text-zinc-300 print:border-neutral-600 print:text-black'
const GHOST = 'rounded-md border border-dashed border-zinc-400 text-xs font-semibold text-zinc-500 hover:border-note-500 hover:text-note-700 focus-visible:border-note-500 focus-visible:outline-none dark:border-zinc-500 dark:text-zinc-400 dark:hover:border-note-400 dark:hover:text-note-300 print:hidden'
/**
 * the ghost bar (a section's last line, the sheet as the editor): the next bar's slot when the line has room, else a pill
 * under the line; none after a written-out copy, whose bars are the section it repeats
 */
const ghost = computed(() => {
  const last = props.line.bars.at(-1)
  if (!last || !props.line.sectionEnd || last.repeatOf) return null
  const n = props.line.bars.length
  const full = n >= props.barsPerLine
  const left = ends.value[n - 1] ?? n / props.barsPerLine
  return { section: last.at.section, full, style: { left: `${left * 100}%`, width: `${Math.min(1 / props.barsPerLine, 1 - left) * 100}%` } }
})
/** a chord name's scale: shrunk where its bar can't be widened enough, but never the chord being edited */
const shrunk = (m: { barIndex: number; k: number; line: number }): number =>
  props.editing?.kind === 'chord' && props.editing.line === m.line ? 1 : (nameScales.value[m.barIndex]?.[m.k] ?? 1)
/** whether the mark is the chord in the open field, whose labels show the draft's reading */
const drafted = (m: { line: number; slot: boolean }): boolean => props.preview !== undefined && props.editing?.kind === 'chord' && !m.slot && m.line === props.editing.line
/** "Edit Dm7, A bar 3"; a transposed part's chord says its concert pitch too, as the editor shows it */
const editLabel = (m: { written: string; text: string; row: { section: string; bar: string } }): string =>
  `Edit ${m.written}${m.written === m.text ? '' : ` (concert ${m.text})`}, ${m.row.section} bar ${m.row.bar}`
/** "×3" over a repeat that plays more than twice */
const repeats = computed(() =>
  props.line.bars.flatMap((bar, b) => (bar.repeatEnd > 2 ? [{ key: b, x: Math.min(1, (xs.value[b]?.at(-1) ?? 1) + 0.03), times: bar.repeatEnd }] : [])),
)
/** whether the line draws a guide tone line (else slashes, or an arpeggio line, which has no label row), and so its label row */
const hasGuideLine = computed(() => !props.arpeggio && props.line.bars.some((b) => b.voice.length > 0))

/**
 * each bar's chord names (and the marker or key area over its first), their widths as fractions of the line, which
 * widen the bars they crowd: measured at their full size, against the line as drawn or as printed (narrower, at
 * PRINT_LINE px with screen-size names), whichever is tighter; undefined while the line isn't laid out
 */
function measureNames(): NamedBeat[][] | undefined {
  const width = Math.min(el.value?.clientWidth ?? 0, PRINT_LINE)
  if (!width || !root.value) return undefined
  const px = new Map(Array.from(root.value.querySelectorAll<HTMLElement>('[data-name]'), (n) => [n.dataset.name, n.offsetWidth]))
  return props.line.bars.map((_, b) => marks.value.filter((m) => m.barIndex === b && !m.slot).map((m) => ({ beat: m.beat, width: ((px.get(m.key) ?? 0) + NAME_GAP) / width })))
}
const PRINT_LINE = 800 // a printed line (about 700px) with the print's smaller names (text-sm: 14/16), in screen px
const NAME_GAP = 8 // px between a name and the next
const key = (names: readonly (readonly NamedBeat[])[] | undefined): string => JSON.stringify(names?.map((b) => b.map((c) => [c.beat, +c.width.toFixed(3)])))
let drawn = ''

async function draw(): Promise<void> {
  if (!el.value) return
  const done = rendering.begin()
  try {
    const vf = await loadVexFlow()
    await document.fonts?.ready // names measured in their own font
    const names = measureNames()
    drawn = key(names)
    const layout = drawChangesLine(vf, el.value, props.line, { timeSignature: props.first, beats: props.beats, barsPerLine: props.barsPerLine, ...(props.clef ? { clef: props.clef } : {}), ...(props.arpeggio ? { arpeggio: true } : {}), ...(names ? { names } : {}) })
    xs.value = layout.xs
    ends.value = layout.ends
    nameScales.value = layout.scales
    const breakAt = props.line.bars[layout.fits]
    if (breakAt) emit('overfull', barKey(breakAt.at))
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw these bars (${e instanceof Error ? e.message : String(e)})`
  } finally {
    done()
  }
}

/** a resize that changes how much of the line the names take redraws it (not wider than PRINT_LINE: they don't) */
let resized: ReturnType<typeof setTimeout> | undefined
const observer = import.meta.client && 'ResizeObserver' in window ? new ResizeObserver(() => {
  clearTimeout(resized)
  resized = setTimeout(() => {
    if (key(measureNames()) !== drawn) void draw()
  }, 100)
}) : null
onMounted(() => {
  if (el.value) observer?.observe(el.value)
  void draw()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(resized)
})
watch(() => [props.line, props.first, props.beats, props.barsPerLine, props.clef, props.arpeggio], () => nextTick(draw))
</script>

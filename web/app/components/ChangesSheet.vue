<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" :heading-level="headingLevel" compact>
      <template v-if="$slots.status" #status><slot name="status" /></template>
      <!-- the sheet as the editor: the heading edited where it prints -->
      <template v-if="editing !== undefined" #heading>
        <SheetHeading :doc="source ?? doc" :level="headingLevel" @update:doc="emit('update:doc', $event)" />
        <!-- the heading replaces the subtitle on screen, so the path a preset plays shows under it (print has it in the subtitle) -->
        <p v-if="built.pentatonicCaption" data-slot="pent-caption" class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{{ built.pentatonicCaption }}</p>
        <p v-if="built.rhythmCaption" data-slot="rhythm-caption" class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{{ built.rhythmCaption }}</p>
      </template>
      <template #default="{ page }">
        <div class="space-y-4 print:space-y-0">
          <!-- with the Line off the sheet is a lead sheet, its rhythm a card over the first line (#573) -->
          <RhythmCard v-if="rhythmCard && page.lines[0]?.index === 0" :rhythm="rhythmCard" :beats="built.beats" />
          <ChangesSystem
            v-for="l in page.lines"
            :key="l.index"
            :line="l.line"
            :first="l.index === 0"
            :bars-per-line="barsPerLine"
            :numerals="numerals"
            :scales="scales"
            :arpeggio="arpeggio"
            :line-name="lineName"
            :rhythm-caption="built.rhythmCaption"
            :from-bar="l.fromBar"
            :feel="feel"
            :clef="part.clef"
            :part="part"
            :editable="editable"
            :selected-line="selectedLine"
            :doc="doc"
            :source="source"
            :set="set"
            :editing="editing"
            :preview="preview"
            :focus-at="focusAt"
            :overlay="overlay"
            :counted="counted"
            :others="others"
            :alt-editing="altEditing"
            :other-screen-only="otherScreenOnly"
            :alt-open="altOpen"
            :alt-focus="altFocus"
            @tap="emit('tap', $event)"
            @pick="(kind, run, value) => emit('pick', kind, run, value)"
            @edit="emit('edit', $event)"
            @update:doc="emit('update:doc', $event)"
            @said="emit('said', $event)"
            @preview="emit('preview', $event)"
            @done="(then, taken) => emit('done', then, taken)"
            @refused="emit('refused', $event)"
            @dialog="(kind, section, bar) => emit('dialog', kind, section, bar)"
            @add-bar="emit('addBar', $event)"
            @overfull="breakAt"
            @crowded="(at) => at.forEach(breakAt)"
            @alt="onAlt"
          />
        </div>
      </template>
    </SheetPages>
    <!-- the sheet as the editor: a new section after the last, or a repeat of one -->
    <div v-if="editing !== undefined" class="flex justify-end gap-2 print:hidden">
      <UiButton v-if="shows('form-editing')" outline @click="emit('repeatSection')"><Square2StackIcon data-slot="icon" />Repeat a section…</UiButton>
      <UiButton outline aria-label="Add a section" @click="emit('addSection')"><PlusIcon data-slot="icon" />Section</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SHEET_PAGED } from '~/utils/sheetPaged'
import { CLICK } from '~/composables/useClick'
import { PlusIcon, Square2StackIcon } from '@heroicons/vue/16/solid'
import type { SheetChordEdit, SheetDone, SheetEdit, SheetFocus } from '~/utils/sheetChordEdit'
import { type Approach, barKey, type Feel, type RhythmId, type RhythmPath, type RhythmStart, breakLines, buildChanges, otherChords, changesLinesPerPage, drawsTuplets, type ChangesSet, type ChartDoc, type ChordAt, type ChordPreview, chunk, type GridPos, isArpeggioPattern, pageSubtitle, type OverlayPlan, type Part, type PentatonicPlan, type PickKind, type ScaleView, showHexatonics, showPentatonics, showQuartals, type ChangesLineChoice, playOrder, rhythmHits, voiceNotes } from '@chord-scale-maker/engine'

/** the Changes sheet (docs/plan-changes.md): the chart as a study lead sheet, 4 bars a line (2 on phones), fewer where the chords' names don't fit */
const { shows } = useInterface()
const props = defineProps<{
  doc: ChartDoc
  title: string
  subtitle: string
  composer?: string
  headingLevel?: 1 | 2 // the title as the page's h1 (SheetPages)
  part: Part
  instrumentLabel: string // '' while editing in concert pitch
  numerals: boolean
  scales: boolean
  approach?: Approach // the figure into each guide tone of the guide tone line (#298); undefined: none
  rhythm?: RhythmId // with the Line off, a card over the first line, the bars plain (#573); else poured into a Line that takes it (rhythm-on-lines spec §1); undefined: off
  targets?: boolean // a dot over each bar's target beats (rhythm spec §7)
  rhythmStart?: RhythmStart // a Line's pick-ups into each chord under the rhythm (rhythm-on-lines spec §3); undefined: on the beat
  anticipate?: number // its Timing: beats each chord arrives early (negative: late) (§2); undefined: 0
  restate?: boolean // the guide tone line restates each guide tone in the rhythm (§5)
  feel?: Feel // in 4, 2 or 1 (Phase 4 spec §4): the plain slashes, the target beats and the beat-grouped beams, and its mark over the first bar; undefined: in 4
  rhythmPath?: RhythmPath // the Groups and Gears paths the rhythm steps through, with their marks (Phase 4 spec §3); undefined: none
  line?: ChangesLineChoice // a guide tone, arpeggio or Pentatonic line, as notes in place of the slashes (the clef then always starts line 1)
  editable?: boolean // tap a chord to edit it
  selectedLine?: number | null // the chart line of the chord the editor is on
  view?: ScaleView // the level blank cells play at; undefined: Standard
  editing?: SheetEdit | null // the sheet is the editor (from md up): what it's editing; undefined: tap opens the chord editor's bottom sheet
  preview?: ChordPreview | null // the open field's draft, read in its bar
  focusAt?: SheetFocus | null // a chord the editor wants focus on
  overlay?: OverlayPlan | null // the row under the chords: the Pentatonic overlay's rungs, the Hexatonic or the Quartal; null: off
  source?: ChartDoc // the chart the editor writes, with its alt rows, line for line doc (#469); undefined: doc
  set?: ChangesSet // the set doc plays; undefined: standard
  otherDoc?: ChartDoc | null // the other set of a chart with alternates (#215), its chords drawn small above the bars; null: none
  altEditing?: boolean // the sheet editor in Standard (#469): each written bar's alternate is typed on the small line
  otherScreenOnly?: boolean // otherDoc is there only to type alternates (Other changes off): its line isn't printed
}>()
const emit = defineEmits<{
  tap: [chord: SheetChordEdit]
  pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] // a chord pick, concert (#303)
  edit: [edit: SheetEdit]
  'update:doc': [doc: ChartDoc]
  said: [text: string]
  preview: [preview: ChordPreview | null]
  done: [then: SheetDone, taken?: GridPos]
  refused: [text: string]
  dialog: [kind: 'split' | 'nav' | 'paste' | 'rename', section: string, bar: number]
  addBar: [section: string]
  addSection: []
  repeatSection: []
}>()

const wide = useMediaQuery('(min-width: 640px), print')
const paged = inject(SHEET_PAGED, ref(false)) // focus mode's pages are a printed page wide, whatever the window
const barsPerLine = computed(() => (wide.value || paged.value ? 4 : 2))

const line = computed((): ChangesLineChoice => props.line ?? 'off')
/** an arpeggio, Pentatonic, Triad pair or Cells line: beamed cells, no label row; lineName: the latter three's, for the aria-label */
const lineName = computed(() => (typeof line.value === 'object' ? ({ pentatonic: 'pentatonic', 'triad-pair': 'triad pair', quartal: 'quartal', cells: 'cells' } as const)[line.value.kind] : undefined))
const arpeggio = computed(() => !!lineName.value || isArpeggioPattern(line.value))
const built = computed(() => buildChanges(props.doc, props.part, barsPerLine.value, true, line.value, props.view, props.overlay ?? null, props.approach ?? 'none', { rhythm: props.rhythm ?? 'off', targets: props.targets ?? false, start: props.rhythmStart ?? 'beat', anticipate: props.anticipate ?? 0, restate: props.restate ?? false, rhythmPath: props.rhythmPath, feel: props.feel ?? 4 }))
/** the rhythm to show on its card: the Line off, a rhythm on */
const rhythmCard = computed((): RhythmId | null => (line.value === 'off' && props.rhythm && props.rhythm !== 'off' ? props.rhythm : null))
// Hear line (#507) and Hear rhythm (#521): the drawn Line and rhythm, for the click to sound, in the form's order (#559) (none on a page without a click)
const click = inject(CLICK, null)
if (click && useFeature('hearLine')) {
  watchEffect(() => {
    const bars = built.value.lines.flatMap((l) => l.bars)
    click.setLine({ notes: voiceNotes(bars, props.part.trans), bars: bars.length })
    click.setRhythm({ hits: rhythmHits(bars), bars: bars.length })
    click.setForm({ order: playOrder(bars), beats: bars.map((b) => b.beats) })
  })
  onBeforeUnmount(() => {
    click.setLine(null)
    click.setRhythm(null)
    click.setForm(null)
  })
}
/** the other set's chords in each bar where they differ (#215), written for the part and spelled at the level as the main set's are */
const others = computed(() => (props.otherDoc ? otherChords(built.value, buildChanges(props.otherDoc, props.part, barsPerLine.value, true, 'off', props.view)) : null))
/**
 * the bars that start a line because the names before them didn't fit, or the notes (Task 3.2: the line splits
 * balanced, 2 2 not 3 1; ChangesSystem measures): until the sheet changes. Only the crowded lines split
 */
const breaks = shallowRef<ReadonlySet<string>>(new Set())
watch(built, () => (breaks.value = new Set()))
function breakAt(at: string): void {
  if (!breaks.value.has(at)) breaks.value = new Set([...breaks.value, at])
}
const sheet = computed(() => ({ ...built.value, lines: showQuartals(showHexatonics(showPentatonics(breakLines(built.value.lines, breaks.value)))) }))
/**
 * the alternate line while editing in Standard (#469): one bar's field open at a time; Tab and ⇧Tab go along the
 * written bars (a copy: section's have none), off either end the field closes with focus on its button
 */
const altOpen = ref<string | null>(null)
const altFocus = ref<{ key: string; n: number } | null>(null)
const altKeys = computed(() => (props.altEditing ? [...new Set(sheet.value.lines.flatMap((l) => l.bars).filter((b) => !b.repeatOf).map((b) => barKey(b.at)))] : []))
watch(() => props.altEditing, (on) => on || (altOpen.value = null))
function onAlt(key: string, then: 'edit' | 'next' | 'prev' | 'close'): void {
  if (then === 'edit') return void (altOpen.value = key)
  if (altOpen.value !== key) return // a field closing as another opens
  const to = then === 'close' ? undefined : altKeys.value[altKeys.value.indexOf(key) + (then === 'next' ? 1 : -1)]
  altOpen.value = to ?? null
  if (!to && then !== 'close') altFocus.value = { key, n: (altFocus.value?.n ?? 0) + 1 }
}
/** the plan counts: a path, the chord basis or a pick (the engine's post-pass rule) */
const pentatonic = computed((): PentatonicPlan | null => (props.overlay?.kind === 'pentatonic' ? props.overlay : null))
const counted = computed(() => !!pentatonic.value && (pentatonic.value.counts || pentatonic.value.basis === 'chord' || built.value.lines.some((l) => l.bars.some((b) => b.chords.some((c) => c.pentatonic?.picked)))))
// 8 lines with slashes (a 32-bar AABA, one section a line pair); fewer with a guide tone line, whose notes and labels are taller, and its tuplets (Task 3.2), and one fewer for a rhythm's card (#573)
const linesPerPage = computed(() => changesLinesPerPage(line.value, { numerals: props.numerals, scales: props.scales, pentatonics: props.overlay?.kind === 'pentatonic', hexatonics: props.overlay?.kind === 'hexatonic', quartals: props.overlay?.kind === 'quartal' }, !!built.value.rhythmCaption, line.value !== 'off' && !!built.value.rhythmCaption, drawsTuplets(built.value.lines)))
const subtitleText = computed(() => [pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'), built.value.pentatonicCaption, built.value.rhythmCaption].filter(Boolean).join(' · '))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index, all) => ({ line, index, fromBar: 1 + all.slice(0, index).reduce((n, l) => n + l.bars.length, 0) })), // fromBar: its first bar, from the sheet's first
    linesPerPage.value,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>

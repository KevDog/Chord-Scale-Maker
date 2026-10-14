<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" :heading-level="headingLevel" compact>
      <template v-if="$slots.status" #status><slot name="status" /></template>
      <!-- the sheet as the editor: the heading edited where it prints -->
      <template v-if="editing !== undefined" #heading>
        <SheetHeading :doc="doc" :level="headingLevel" @update:doc="emit('update:doc', $event)" />
      </template>
      <template #default="{ page }">
        <div :class="['space-y-4', signatures || lineOn ? 'print:space-y-0' : 'print:space-y-1']">
          <ChangesSystem
            v-for="l in page.lines"
            :key="l.index"
            :line="l.line"
            :first="l.index === 0"
            :beats="sheet.beats"
            :bars-per-line="barsPerLine"
            :numerals="numerals"
            :scales="scales"
            :arpeggio="arpeggio"
            :clef="signatures || lineOn ? part.clef : undefined"
            :editable="editable"
            :selected-line="selectedLine"
            :doc="doc"
            :editing="editing"
            :preview="preview"
            :focus-at="focusAt"
            :pentatonic="pentatonic"
            :contour="contour?.[l.index] ?? null"
            @tap="emit('tap', $event)"
            @pentatonic="(s, v) => emit('pentatonic', s, v)"
            @edit="emit('edit', $event)"
            @update:doc="emit('update:doc', $event)"
            @said="emit('said', $event)"
            @preview="emit('preview', $event)"
            @done="(then, taken) => emit('done', then, taken)"
            @refused="emit('refused', $event)"
            @dialog="(kind, section, bar) => emit('dialog', kind, section, bar)"
            @add-bar="emit('addBar', $event)"
            @overfull="breakAt"
          />
        </div>
      </template>
    </SheetPages>
    <!-- the sheet as the editor: a new section after the last, or a repeat of one -->
    <div v-if="editing !== undefined" class="flex justify-end gap-2 print:hidden">
      <UiButton outline @click="emit('repeatSection')"><Square2StackIcon data-slot="icon" />Repeat a section…</UiButton>
      <UiButton outline aria-label="Add a section" @click="emit('addSection')"><PlusIcon data-slot="icon" />Section</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SHEET_PAGED } from '~/utils/sheetPaged'
import { PlusIcon, Square2StackIcon } from '@heroicons/vue/16/solid'
import type { SheetChordEdit, SheetDone, SheetEdit, SheetFocus } from '~/utils/sheetChordEdit'
import { breakLines, buildChanges, changesLinesPerPage, type ChartDoc, type ChordPreview, chunk, type GridPos, isArpeggioPattern, pageSubtitle, type Part, type PentatonicPlan, pentatonicContour, type PentatonicView, type ScaleView, showPentatonics, type SheetLine } from '@chord-scale-maker/engine'

/** the Changes sheet (docs/plan-changes.md): the chart as a study lead sheet, 4 bars a line (2 on phones), fewer where the chords' names don't fit */
const props = defineProps<{
  doc: ChartDoc
  title: string
  subtitle: string
  composer?: string
  headingLevel?: 1 | 2 // the title as the page's h1 (SheetPages)
  part: Part
  instrumentLabel: string // '' for concert
  numerals: boolean
  scales: boolean
  signatures?: boolean // the part's clef and the chart's key signature, once, at the start of the first line
  line?: SheetLine // a guide tone or arpeggio line, as notes in place of the slashes (the clef then always starts line 1)
  editable?: boolean // tap a chord to edit it
  selectedLine?: number | null // the chart line of the chord the editor is on
  view?: ScaleView // the level blank cells play at; undefined: Standard
  editing?: SheetEdit | null // the sheet is the editor (from md up): what it's editing; undefined: tap opens the chord editor's bottom sheet
  preview?: ChordPreview | null // the open field's draft, read in its bar
  focusAt?: SheetFocus | null // a chord the editor wants focus on
  pentatonic?: PentatonicPlan | null // the Pentatonics row's rungs; null: off
}>()
const emit = defineEmits<{
  tap: [chord: SheetChordEdit]
  pentatonic: [section: string, view: PentatonicView]
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

const line = computed((): SheetLine => props.line ?? 'off')
const lineOn = computed(() => line.value !== 'off')
const arpeggio = computed(() => isArpeggioPattern(line.value))
const built = computed(() => buildChanges(props.doc, props.part, barsPerLine.value, props.signatures, line.value, props.view, props.pentatonic ?? null))
/** the bars that start a line because the names before them didn't fit (ChangesSystem measures): until the sheet changes */
const breaks = shallowRef<ReadonlySet<string>>(new Set())
watch(built, () => (breaks.value = new Set()))
function breakAt(at: string): void {
  if (!breaks.value.has(at)) breaks.value = new Set([...breaks.value, at])
}
const sheet = computed(() => ({ ...built.value, lines: showPentatonics(breakLines(built.value.lines, breaks.value)) }))
/** the tension contour (#265), over the lines as drawn, with a path that varies by section */
const contour = computed(() => (props.pentatonic?.counts ? pentatonicContour(sheet.value.lines) : null))
// 8 lines with slashes (a 32-bar AABA, one section a line pair); fewer with a guide tone line, whose notes and labels are taller
const linesPerPage = computed(() => changesLinesPerPage(line.value, { numerals: props.numerals, scales: props.scales, pentatonics: !!props.pentatonic }))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index) => ({ line, index })),
    linesPerPage.value,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>

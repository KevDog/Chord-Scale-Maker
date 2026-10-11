<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" compact>
      <template #default="{ page }">
        <div :class="['space-y-4', signatures || guideOn ? 'print:space-y-0' : 'print:space-y-1']">
          <ChangesSystem
            v-for="l in page.lines"
            :key="l.index"
            :line="l.line"
            :first="l.index === 0"
            :beats="sheet.beats"
            :bars-per-line="barsPerLine"
            :numerals="numerals"
            :scales="scales"
            :clef="signatures || guideOn ? part.clef : undefined"
            :editable="editable"
            :selected-line="selectedLine"
            @edit="emit('edit', $event)"
          />
        </div>
      </template>
    </SheetPages>
  </div>
</template>

<script setup lang="ts">
import type { SheetChordEdit } from '~/utils/sheetChordEdit'
import { buildChanges, changesLinesPerPage, type ChartDoc, chunk, type GuideLine, pageSubtitle, type Part } from '@chord-scale-maker/engine'

/** the Changes sheet (docs/plan-changes.md): the chart as a study lead sheet, 4 bars a line (2 on phones) */
const props = defineProps<{
  doc: ChartDoc
  title: string
  subtitle: string
  composer?: string
  part: Part
  instrumentLabel: string // '' for concert
  numerals: boolean
  scales: boolean
  signatures?: boolean // the part's clef and the chart's key signature, once, at the start of the first line
  guideLine?: GuideLine // a guide tone line, from the 3rd or the 7th, as notes in place of the slashes (the clef then always starts line 1)
  editable?: boolean // tap a chord to edit it
  selectedLine?: number | null // the chart line of the chord selected in the bar editor
}>()
const emit = defineEmits<{ edit: [chord: SheetChordEdit] }>()

const wide = useMediaQuery('(min-width: 640px), print')
const barsPerLine = computed(() => (wide.value ? 4 : 2))

const line = computed((): GuideLine => props.guideLine ?? 'off')
const guideOn = computed(() => line.value !== 'off')
const sheet = computed(() => buildChanges(props.doc, props.part, barsPerLine.value, props.signatures, line.value))
// 8 lines with slashes (a 32-bar AABA, one section a line pair); fewer with a guide tone line, whose notes and labels are taller
const linesPerPage = computed(() => changesLinesPerPage(line.value, { numerals: props.numerals, scales: props.scales }))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index) => ({ line, index })),
    linesPerPage.value,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>

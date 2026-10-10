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
          />
        </div>
      </template>
    </SheetPages>
  </div>
</template>

<script setup lang="ts">
import { buildChanges, changesLinesPerPage, type ChartDoc, chunk, type GuideShow, guidesOn, NO_GUIDES, pageSubtitle, type Part } from '~~/engine'

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
  guides?: GuideShow // each chord's 3rd and/or 7th as notes in place of the slashes (the clef then always starts line 1)
}>()

const wide = useMediaQuery('(min-width: 640px), print')
const barsPerLine = computed(() => (wide.value ? 4 : 2))

const show = computed((): GuideShow => props.guides ?? NO_GUIDES)
const guideOn = computed(() => guidesOn(show.value) > 0)
const sheet = computed(() => buildChanges(props.doc, props.part, barsPerLine.value, props.signatures, show.value))
// 8 lines with slashes (a 32-bar AABA, one section a line pair); fewer with guide tones, whose notes and labels are taller
const linesPerPage = computed(() => changesLinesPerPage(show.value, { numerals: props.numerals, scales: props.scales }))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index) => ({ line, index })),
    linesPerPage.value,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>

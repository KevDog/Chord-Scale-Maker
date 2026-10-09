<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" compact>
      <template #default="{ page }">
        <div class="space-y-4 print:space-y-1">
          <ChangesSystem
            v-for="l in page.lines"
            :key="l.index"
            :line="l.line"
            :first="l.index === 0"
            :beats="sheet.beats"
            :bars-per-line="barsPerLine"
            :numerals="numerals"
            :scales="scales"
          />
        </div>
      </template>
    </SheetPages>
  </div>
</template>

<script setup lang="ts">
import { buildChanges, type ChartDoc, chunk, pageSubtitle, type Part } from '~~/engine'

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
}>()

const LINES_PER_PAGE = 8 // a 32-bar AABA, one section a line pair, with its numerals and scales

const wide = useMediaQuery('(min-width: 640px), print')
const barsPerLine = computed(() => (wide.value ? 4 : 2))

const sheet = computed(() => buildChanges(props.doc, props.part, barsPerLine.value))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index) => ({ line, index })),
    LINES_PER_PAGE,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>

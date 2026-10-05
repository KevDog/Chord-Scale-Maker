<template>
  <div class="space-y-8 print:space-y-0">
    <SheetPage v-for="(page, p) in pages" :key="`${page.mode}-${p}`" :title="title" :subtitle="page.subtitle" :number="page.number" :total="pages.length">
      <div class="space-y-1 print:space-y-2">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" />
      </div>
    </SheetPage>
  </div>
</template>

<script setup lang="ts">
import { buildSheet, type ModeChoice, type Part, pageSubtitle, type Row } from '~~/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  part: Part
  instrumentLabel: string // e.g. "Tenor Sax (Bb)"; '' for concert
  start: string // written start note for the "from" part
  mode: ModeChoice
  perPage: number
  intervals?: boolean // label notes against the chord root, on screen only
}>()

/** every printed page, in order, with its own heading (the CLI's bookparts flattened) */
const pages = computed(() =>
  buildSheet(props.rows, props.part, props.mode, props.start, props.perPage)
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheetPart.heading),
      })),
    )
    .map((page, i) => ({ ...page, number: i + 1 })),
)
</script>

<template>
  <SheetPages :title="title" :pages="pages">
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { buildSheet, type ModeChoice, type Part, pageSubtitle, type PracticeSelection, type Row } from '~~/engine'

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
  practice?: PracticeSelection | null // highlight these notes, dim the rest
}>()

/** every printed page, in order, with its own heading */
const pages = computed(() =>
  buildSheet(props.rows, props.part, props.mode, props.start, props.perPage, props.practice ?? null)
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheetPart.heading),
      })),
    ),
)
</script>

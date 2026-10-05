<template>
  <div class="space-y-8 print:space-y-0">
    <section
      v-for="(page, p) in pages"
      :key="`${page.mode}-${p}`"
      class="rounded-xl bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10 print:break-after-page print:last:break-after-auto print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0"
    >
      <header class="mb-4 text-center">
        <h2 class="text-xl/8 font-semibold text-zinc-950 dark:text-white print:text-black">{{ title }}</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-zinc-700">{{ page.subtitle }}</p>
      </header>
      <div class="space-y-1 print:space-y-2">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" />
      </div>
      <p class="mt-3 text-right text-xs text-zinc-500 print:hidden dark:text-zinc-400">Page {{ page.number }} of {{ pages.length }}</p>
    </section>
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

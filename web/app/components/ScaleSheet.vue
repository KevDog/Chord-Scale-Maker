<template>
  <div class="space-y-8 print:space-y-0">
    <section
      v-for="(page, p) in pages"
      :key="`${page.mode}-${p}`"
      class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:break-after-page print:last:break-after-auto print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
    >
      <header class="mb-4 text-center">
        <h2 class="text-xl font-semibold">{{ title }}</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">{{ page.subtitle }}</p>
      </header>
      <div class="space-y-1 print:space-y-0">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="clef" />
      </div>
      <p class="mt-3 text-right text-xs text-slate-400 print:hidden">Page {{ page.number }} of {{ pages.length }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { buildSheet, CONCERT, type ModeChoice, type Row } from '~~/engine'

const props = defineProps<{ rows: readonly Row[]; title: string; subtitle: string; mode: ModeChoice; perPage: number }>()

const part = CONCERT // phase 3 adds the instrument picker
const clef = part.clef

/** every printed page, in order, with its own heading (the CLI's bookparts flattened) */
const pages = computed(() =>
  buildSheet(props.rows, part, props.mode, 'C', props.perPage)
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: [props.subtitle, `(${sheetPart.heading})`].filter(Boolean).join(' '),
      })),
    )
    .map((page, i) => ({ ...page, number: i + 1 })),
)
</script>

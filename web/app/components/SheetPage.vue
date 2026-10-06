<template>
  <!-- a card on screen; in print, a bare letter page that breaks after itself -->
  <section
    class="rounded-xl bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10 print:break-after-page print:last:break-after-auto print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0"
  >
    <header :class="['mb-4 text-center', compact && 'print:mb-1']">
      <h2 class="font-display text-2xl/8 font-bold tracking-tight text-zinc-950 dark:text-white print:text-black">{{ title }}</h2>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-neutral-700">{{ subtitle }}</p>
    </header>
    <slot />
    <p class="mt-3 text-right text-xs text-zinc-500 print:hidden dark:text-zinc-400">Page {{ number }} of {{ total }}</p>
  </section>
</template>

<script setup lang="ts">
/** one printed page of a sheet: the chart's title and this page's subtitle over the content */
defineProps<{
  title: string
  subtitle: string
  number: number
  total: number
  compact?: boolean // less space under the header in print (guide tones fit 8 systems a page)
}>()
</script>

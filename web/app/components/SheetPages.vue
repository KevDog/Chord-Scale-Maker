<template>
  <!-- on screen: one continuous card, with a dashed divider where each printed page starts;
       in print: bare letter pages, each breaking after itself under its own header -->
  <div
    class="rounded-xl bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10 print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0"
  >
    <section v-for="(page, i) in pages" :key="i" class="print:break-after-page print:last:break-after-auto">
      <div v-if="i > 0" role="separator" :aria-label="`Printed page ${i + 1} starts here`" class="my-6 flex items-center gap-3 text-xs text-zinc-500 print:hidden dark:text-zinc-400">
        <span class="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
        <span aria-hidden="true">Page {{ i + 1 }}</span>
        <span class="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
      </div>
      <!-- every printed page repeats the header; on screen only where the subtitle changes (the first page) -->
      <header :class="['mb-4 text-center', compact && 'print:mb-1', !headerOnScreen(i) && 'hidden print:block']">
        <h2 class="font-display text-2xl/8 font-bold tracking-tight text-zinc-950 dark:text-white print:text-black">{{ title }}</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-neutral-700">{{ page.subtitle }}</p>
        <!-- the composer, right-aligned under the heading as on a lead sheet: the first page only -->
        <p v-if="composer && i === 0" class="mt-1 text-right text-sm text-zinc-600 italic dark:text-zinc-400 print:text-neutral-700">{{ composer }}</p>
      </header>
      <slot :page="page" :index="i" />
    </section>
  </div>
</template>

<script setup lang="ts" generic="T extends { subtitle: string }">
/** a sheet's printed pages: continuous on screen, one letter page each in print */
const props = defineProps<{
  title: string
  composer?: string
  pages: readonly T[]
  compact?: boolean // less space under the header in print (guide tones fit 8 systems a page)
}>()

const headerOnScreen = (i: number): boolean => i === 0 || props.pages[i]?.subtitle !== props.pages[i - 1]?.subtitle
</script>

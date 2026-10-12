<template>
  <!-- on screen: one continuous paper; in print: bare letter pages, each breaking after itself under its own header -->
  <div
    data-slot="paper"
    class="rounded-paper bg-paper p-4 shadow-paper sm:p-6 print:rounded-none print:bg-white print:p-0 print:shadow-none"
  >
    <!-- a chart with nothing to draw still shows its heading (and the status under it) -->
    <section v-for="(page, i) in shown" :key="i" class="print:break-after-page print:last:break-after-auto">
      <!-- every printed page repeats the header; on screen only where the subtitle changes (the first page). With a
           #heading slot (the sheet as the editor), the first page shows it on screen instead, and prints the heading -->
      <header :class="['mb-4 text-center', compact && 'print:mb-1', !headerOnScreen(i) && 'hidden print:block']">
        <div v-if="$slots.heading && i === 0" class="print:hidden"><slot name="heading" /></div>
        <div :class="$slots.heading && i === 0 && 'hidden print:block'">
          <component :is="i === 0 && headingLevel === 1 ? 'h1' : 'h2'" class="font-display text-2xl/8 font-bold tracking-tight text-balance text-zinc-950 dark:text-white print:text-black">{{ title }}</component>
          <!-- with a composer, print lays the line out as a lead sheet does: the style at left, the composer at right (first
               page only), on one line so a page holds as much music as without; on screen the composer goes under it -->
          <div :class="composer && 'print:flex print:items-baseline print:justify-between print:gap-6 print:text-left'">
            <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-neutral-700">{{ page?.subtitle }}</p>
            <p v-if="composer && i === 0" class="mt-1 text-right text-sm text-zinc-600 italic dark:text-zinc-400 print:mt-0 print:shrink-0 print:text-neutral-700">{{ composer }}</p>
          </div>
        </div>
        <div v-if="$slots.status && i === 0" class="mt-2 print:hidden"><slot name="status" /></div>
      </header>
      <slot v-if="page" :page="page" :index="i" />
    </section>
  </div>
</template>

<script setup lang="ts" generic="T extends { subtitle: string }">
/** a sheet's printed pages: continuous on screen, one letter page each in print */
const props = defineProps<{
  title: string
  composer?: string
  pages: readonly T[]
  compact?: boolean // less space under the header in print (the Changes fits its lines a page)
  headingLevel?: 1 | 2 // 1: the sheet's title is the page's heading (the song page); later pages' headers stay h2
}>()

const shown = computed((): readonly (T | null)[] => (props.pages.length ? props.pages : [null]))
const headerOnScreen = (i: number): boolean => i === 0 || props.pages[i]?.subtitle !== props.pages[i - 1]?.subtitle
</script>

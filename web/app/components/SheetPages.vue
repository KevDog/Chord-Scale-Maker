<template>
  <!-- on screen: one continuous paper; in print: bare letter pages, each breaking after itself under its own header -->
  <div
    data-slot="paper"
    class="rounded-paper bg-paper p-4 shadow-paper sm:p-6 print:rounded-none print:bg-white print:p-0 print:shadow-none"
  >
    <section v-for="(page, i) in pages" :key="i" class="print:break-after-page print:last:break-after-auto">
      <!-- every printed page repeats the header; on screen only where the subtitle changes (the first page). With a
           #heading slot (the sheet as the editor), the first page shows it on screen instead, and prints the heading -->
      <header :class="['mb-4 text-center', compact && 'print:mb-1', !headerOnScreen(i) && 'hidden print:block']">
        <div v-if="$slots.heading && i === 0" class="print:hidden"><slot name="heading" /></div>
        <div :class="$slots.heading && i === 0 && 'hidden print:block'">
          <h2 class="font-display text-2xl/8 font-bold tracking-tight text-zinc-950 dark:text-white print:text-black">{{ title }}</h2>
          <!-- with a composer, print lays the line out as a lead sheet does: the style at left, the composer at right (first
               page only), on one line so a page holds as much music as without; on screen the composer goes under it -->
          <div :class="composer && 'print:flex print:items-baseline print:justify-between print:gap-6 print:text-left'">
            <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-neutral-700">{{ page.subtitle }}</p>
            <p v-if="composer && i === 0" class="mt-1 text-right text-sm text-zinc-600 italic dark:text-zinc-400 print:mt-0 print:shrink-0 print:text-neutral-700">{{ composer }}</p>
          </div>
        </div>
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
  compact?: boolean // less space under the header in print (the Changes fits its lines a page)
}>()

const headerOnScreen = (i: number): boolean => i === 0 || props.pages[i]?.subtitle !== props.pages[i - 1]?.subtitle
</script>

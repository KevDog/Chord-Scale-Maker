<template>
  <!-- a numeral or scale on the Changes sheet; a click or tap opens why the analysis chose it, with the rule behind it -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :class="wrap ? 'whitespace-normal' : 'truncate'"
      class="block max-w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500"
    >
      <slot />
    </HPopoverButton>
    <HPopoverPanel
      role="dialog"
      :aria-label="`Why: ${chord}`"
      class="absolute top-full left-0 z-20 mt-2 w-72 rounded-lg max-sm:-left-12 max-sm:w-[calc(100vw-2rem)] bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden"
    >
      <span class="block">
        {{ reason }}<template v-if="rule">
          · rule <template v-for="(id, k) in parts" :key="id"><template v-if="k">+</template><NuxtLink :to="`/functions#rule-${id}`" class="underline decoration-zinc-950/30 hover:decoration-zinc-950 dark:decoration-white/30 dark:hover:decoration-white">{{ id }}</NuxtLink></template><template v-if="fallback">, a guess — an @key or a function would settle it</template>
        </template>
      </span>
      <span class="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{{ keyFrom === 'found' ? '' : '* ' }}in {{ heardIn }}</span>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { type ChangesChord, ruleParts } from '~~/engine'

/**
 * why the analysis gave a chord its function and scale (engine/changes.ts reason, rule, heardIn, keyFrom), opened by a
 * click or tap; Escape or a click outside closes it. A key the author set, by an @key or the function's own key, is
 * starred, as in the grid's Function dropdown. The rule id links to its row on /functions.
 */
const props = withDefaults(
  defineProps<{ reason: string; heardIn: string; keyFrom: ChangesChord['keyFrom']; rule: string; fallback: boolean; chord: string; numeral: string; scale: string | null; wrap?: boolean }>(),
  { wrap: false },
)
const parts = computed(() => ruleParts(props.rule))
</script>

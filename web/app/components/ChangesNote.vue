<template>
  <!-- a numeral or scale on the Changes sheet, with why the analysis chose it; hover, focus or tap shows it, Escape hides it -->
  <span class="group/note relative inline-block max-w-full" @keydown.escape="dismissed = true" @pointerleave="dismissed = false" @focusout="dismissed = false">
    <button
      type="button"
      :aria-describedby="id"
      :class="wrap ? 'whitespace-normal' : 'truncate'"
      class="block max-w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500"
    >
      <slot />
    </button>
    <span
      :id="id"
      role="tooltip"
      :class="[
        'pointer-events-none invisible absolute top-full left-0 z-20 mt-2 w-72 rounded-lg max-sm:-left-12 max-sm:w-[calc(100vw-2rem)] bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 opacity-0 shadow-lg ring-1 ring-zinc-950/10 transition-opacity dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden',
        !dismissed && 'group-hover/note:visible group-hover/note:opacity-100 group-focus-within/note:visible group-focus-within/note:opacity-100',
      ]"
    >
      <span class="block">{{ reason }}</span>
      <span class="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{{ keyFrom === 'found' ? '' : '* ' }}in {{ heardIn }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { ChangesChord } from '~~/engine'

/**
 * why the analysis gave a chord its function and scale (engine/changes.ts reason, heardIn, keyFrom); a key the author
 * set, by an @key or the function's own key, is starred, as in the grid's Function dropdown
 */
withDefaults(defineProps<{ reason: string; heardIn: string; keyFrom: ChangesChord['keyFrom']; wrap?: boolean }>(), { wrap: false })
const id = useId()
const dismissed = ref(false)
</script>

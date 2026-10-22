<template>
  <label data-slot="field" class="grid cursor-default grid-cols-[1.125rem_1fr] gap-x-4 sm:grid-cols-[1rem_1fr]">
    <!-- the native checkbox, invisible over the drawn box: it takes the clicks, the focus and the name -->
    <input v-model="checked" type="checkbox" :name="name" class="peer z-10 col-start-1 row-start-1 mt-0.75 size-4.5 appearance-none opacity-0 sm:mt-1 sm:size-4">
    <span aria-hidden="true" :class="[BASE, COLOR, 'mt-0.75 sm:mt-1']">
      <svg class="size-4 stroke-(--checkbox-check) opacity-0 sm:h-3.5 sm:w-3.5" viewBox="0 0 14 14" fill="none">
        <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span data-slot="label" class="col-start-2 text-base/6 text-zinc-950 select-none sm:text-sm/6 dark:text-white"><slot /></span>
  </label>
</template>

<script setup lang="ts">
/** Catalyst Checkbox with its field (the label in the slot), in the site's note color: a native checkbox under Catalyst's box */
defineProps<{ name?: string }>()
const checked = defineModel<boolean>({ default: false })

const BASE = [
  // Basic layout
  'relative isolate col-start-1 row-start-1 flex size-4.5 items-center justify-center rounded-[0.3125rem] sm:size-4',
  // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
  'before:absolute before:inset-0 before:-z-10 before:rounded-[calc(0.3125rem-1px)] before:bg-white before:shadow-sm',
  'peer-checked:before:bg-(--checkbox-checked-bg) peer-checked:*:opacity-100',
  // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
  'dark:before:hidden',
  'dark:bg-white/5 dark:peer-checked:bg-(--checkbox-checked-bg)',
  // Border
  'border border-zinc-950/15 peer-checked:border-transparent peer-checked:bg-(--checkbox-checked-border) peer-hover:border-zinc-950/30',
  'dark:border-white/15 dark:peer-checked:border-white/5 dark:peer-hover:border-white/30',
  // Inner highlight shadow
  'after:absolute after:inset-0 after:rounded-[calc(0.3125rem-1px)] after:shadow-[inset_0_1px_--theme(--color-white/15%)]',
  'dark:after:-inset-px dark:after:hidden dark:after:rounded-[0.3125rem] dark:peer-checked:after:block',
  // Focus ring
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500',
  // Forced colors mode
  'forced-colors:[--checkbox-check:HighlightText] forced-colors:[--checkbox-checked-bg:Highlight]',
]
const COLOR = '[--checkbox-check:var(--color-white)] [--checkbox-checked-bg:var(--color-note-600)] [--checkbox-checked-border:var(--color-note-700)]/90'
</script>

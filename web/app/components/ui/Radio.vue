<template>
  <HRadioGroupOption v-slot="{ checked, active, disabled: optionDisabled }" :value="value" :disabled="disabled" as="template">
    <div
      :data-checked="dataFlag(checked)"
      :data-focus="dataFlag(active)"
      :data-disabled="dataFlag(optionDisabled)"
      class="group grid cursor-default grid-cols-[1.125rem_1fr] gap-x-3 rounded-lg px-2 py-1.5 focus:outline-hidden data-checked:bg-note-50 data-focus:ring-2 data-focus:ring-blue-500 sm:grid-cols-[1rem_1fr] dark:data-checked:bg-white/5"
    >
      <span :class="[BASE, COLOR, 'mt-0.75 sm:mt-1']">
        <span class="size-full rounded-full border-[4.5px] border-transparent bg-(--radio-indicator) bg-clip-padding forced-colors:border-[Canvas] forced-colors:group-data-checked:border-[Highlight]" />
      </span>
      <span class="col-start-2 min-w-0 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white"><slot /></span>
    </div>
  </HRadioGroupOption>
</template>

<script setup lang="ts" generic="T extends string">
import { RadioGroupOption as HRadioGroupOption } from '@headlessui/vue'
import { dataFlag } from '~/utils/interactive'

/** Catalyst Radio with its field (label and description in the slot), in the site's note colour */
defineProps<{ value: T; disabled?: boolean }>()

const BASE = [
  // Basic layout
  'relative isolate flex size-4.75 shrink-0 rounded-full sm:size-4.25',
  // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
  'before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-white before:shadow-sm',
  // Background color when checked
  'group-data-checked:before:bg-(--radio-checked-bg)',
  // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
  'dark:before:hidden',
  // Background color applied to control in dark mode
  'dark:bg-white/5 dark:group-data-checked:bg-(--radio-checked-bg)',
  // Border
  'border border-zinc-950/15 group-data-checked:border-transparent group-data-hover:border-zinc-950/30 group-data-checked:bg-(--radio-checked-border)',
  'dark:border-white/15 dark:group-data-checked:border-white/5 dark:group-data-hover:border-white/30',
  // Inner highlight shadow
  'after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_--theme(--color-white/15%)]',
  'dark:after:-inset-px dark:after:hidden dark:after:rounded-full dark:group-data-checked:after:block',
  // Indicator color
  '[--radio-indicator:transparent] group-data-checked:[--radio-indicator:var(--radio-checked-indicator)]',
  // Disabled state
  'group-data-disabled:opacity-50',
]
const COLOR = '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-note-600)] [--radio-checked-border:var(--color-note-700)]/90'
</script>

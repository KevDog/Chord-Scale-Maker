<template>
  <HListboxOption v-slot="{ active, selected, disabled: optionDisabled }" :value="value" :disabled="disabled" as="template">
    <div
      :data-focus="dataFlag(active)"
      :data-selected="dataFlag(selected)"
      :data-disabled="dataFlag(optionDisabled)"
      :class="OPTION"
    >
      <svg class="relative hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 8.5l3 3L12 4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span :class="[SHARED, 'col-start-2']"><slot /></span>
    </div>
  </HListboxOption>
</template>

<script setup lang="ts" generic="T extends string | number | boolean | object | null">
import { ListboxOption as HListboxOption } from '@headlessui/vue'
import { dataFlag } from '~/utils/interactive'

defineProps<{ value: T; disabled?: boolean }>()

const SHARED = [
  // Base
  'flex min-w-0 items-center',
  // Icons
  '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
  '*:data-[slot=icon]:text-zinc-500 group-data-focus/option:*:data-[slot=icon]:text-white dark:*:data-[slot=icon]:text-zinc-400',
  'forced-colors:*:data-[slot=icon]:text-[CanvasText] forced-colors:group-data-focus/option:*:data-[slot=icon]:text-[Canvas]',
]
const OPTION = [
  // Basic layout
  'group/option grid cursor-default grid-cols-[--spacing(5)_1fr] items-baseline gap-x-2 rounded-lg py-2.5 pr-3.5 pl-2 sm:grid-cols-[--spacing(4)_1fr] sm:py-1.5 sm:pr-3 sm:pl-1.5',
  // Typography
  'text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
  // Focus
  'outline-hidden data-focus:bg-blue-500 data-focus:text-white',
  // Forced colors mode
  'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]',
  // Disabled
  'data-disabled:opacity-50',
]
</script>

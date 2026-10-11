<template>
  <HMenuItem v-slot="{ active, disabled: itemDisabled }" :disabled="disabled" as="template">
    <button type="button" :data-focus="dataFlag(active)" :data-disabled="dataFlag(itemDisabled)" :class="ITEM"><slot /></button>
  </HMenuItem>
</template>

<script setup lang="ts">
import { MenuItem as HMenuItem } from '@headlessui/vue'
import { dataFlag } from '~/utils/interactive'

/** Catalyst DropdownItem: a button in a UiDropdownMenu */
defineProps<{ disabled?: boolean }>()

const ITEM = [
  // Base styles
  'group cursor-default rounded-lg px-3.5 py-2.5 focus:outline-hidden sm:px-3 sm:py-1.5',
  // Text styles
  'text-left text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
  // Focus
  'data-focus:bg-blue-500 data-focus:text-white',
  // Disabled state
  'data-disabled:opacity-50',
  // Forced colors mode
  'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText] forced-colors:data-focus:*:data-[slot=icon]:text-[HighlightText]',
  // Use subgrid when available but fallback to an explicit grid layout if not
  'col-span-full grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center supports-[grid-template-columns:subgrid]:grid-cols-subgrid',
  // Icons
  '*:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:-ml-0.5 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4',
  '*:data-[slot=icon]:text-zinc-500 data-focus:*:data-[slot=icon]:text-white dark:*:data-[slot=icon]:text-zinc-400 dark:data-focus:*:data-[slot=icon]:text-white',
]
</script>

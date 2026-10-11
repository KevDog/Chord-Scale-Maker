<template>
  <transition leave-active-class="transition-opacity duration-100 ease-in" leave-to-class="opacity-0">
    <HMenuItems :class="[MENU, anchor === 'end' ? 'right-0' : 'left-0']">
      <slot />
    </HMenuItems>
  </transition>
</template>

<script setup lang="ts">
import { MenuItems as HMenuItems } from '@headlessui/vue'

/**
 * Catalyst DropdownMenu. Headless UI Vue has no anchor positioning, so the menu opens below its button,
 * lined up with its start or (anchor="end") its end.
 */
withDefaults(defineProps<{ anchor?: 'start' | 'end' }>(), { anchor: 'start' })

const MENU = [
  'absolute top-full z-30 mt-2',
  // Base styles
  'isolate w-max rounded-xl p-1',
  // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
  'outline outline-transparent focus:outline-hidden',
  // Handle scrolling when menu won't fit in viewport
  'overflow-y-auto',
  // Popover background
  'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
  // Shadows
  'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
  // Define grid at the menu level if subgrid is supported
  'supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]',
]
</script>

<template>
  <UiDropdown>
    <!-- as UiNavbarItem draws its current page; the button opens on click (keyboard and touch alike) -->
    <span v-if="current" class="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-note-500 dark:bg-note-300" />
    <HMenuButton v-interactive :data-current="current ? 'true' : undefined" :class="['cursor-default', navbarItemClasses]">
      <UiTouchTarget>{{ label }}<ChevronDownIcon data-slot="icon" /></UiTouchTarget>
    </HMenuButton>
    <UiDropdownMenu>
      <slot />
    </UiDropdownMenu>
  </UiDropdown>
</template>

<script setup lang="ts">
import { MenuButton as HMenuButton } from '@headlessui/vue'
import { ChevronDownIcon } from '@heroicons/vue/16/solid'
import { navbarItemClasses } from '~/utils/catalyst/navbar'
import { vInteractive } from '~/utils/interactive'

/** Catalyst's Navbar dropdown: a navbar item that opens a UiDropdownMenu of UiDropdownItems (href: links) */
defineProps<{ label: string; current?: boolean }>()
</script>

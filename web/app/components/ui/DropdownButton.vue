<template>
  <HMenuButton :as="UiButton"><slot /></HMenuButton>
</template>

<script setup lang="ts">
import { MenuButton as HMenuButton } from '@headlessui/vue'
import UiButton from './Button.vue'

/** the button that opens a UiDropdown: a UiButton (its props pass through, e.g. plain) */
</script>

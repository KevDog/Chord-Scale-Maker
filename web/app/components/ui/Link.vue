<template>
  <NuxtLink v-interactive :to="href"><slot /></NuxtLink>
</template>

<script setup lang="ts">
import { vInteractive } from '~/utils/interactive'

/** Catalyst Link: the router link, with Headless UI's data-hover / data-focus / data-active */
defineProps<{ href: string }>()
</script>

<template>
  <!-- not in Catalyst: a labelled group of options; Headless UI skips the heading when navigating -->
  <div role="group" :aria-labelledby="id">
    <div :id="id" role="presentation" class="px-2 pt-2 pb-1 text-xs/5 font-semibold text-zinc-500 sm:px-1.5 dark:text-zinc-400">{{ label }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
const id = useId()
</script>

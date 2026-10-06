<template>
  <component :is="`h${level}`" class="font-display text-3xl/9 font-bold tracking-tight text-zinc-950 sm:text-2xl/8 dark:text-white"><slot /></component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ level?: 1 | 2 | 3 | 4 | 5 | 6 }>(), { level: 1 })
</script>

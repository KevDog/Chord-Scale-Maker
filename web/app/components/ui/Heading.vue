<template>
  <component :is="`h${level}`" class="text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white"><slot /></component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ level?: 1 | 2 | 3 | 4 | 5 | 6 }>(), { level: 1 })
</script>

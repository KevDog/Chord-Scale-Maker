<template>
  <component :is="`h${level}`" class="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white"><slot /></component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ level?: 1 | 2 | 3 | 4 | 5 | 6 }>(), { level: 2 })
</script>

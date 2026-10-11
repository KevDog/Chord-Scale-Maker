<template>
  <span class="block">{{ scale }}</span>
  <span class="block text-xs/5 text-zinc-600 tabular-nums dark:text-zinc-400">{{ [scaleFormula(scale), note].filter(Boolean).join(' · ') }}</span>
</template>

<script setup lang="ts">
/** a scale option: its name, and under it its degrees and a note on when it fits */
defineProps<{ scale: string; note?: string }>()
</script>

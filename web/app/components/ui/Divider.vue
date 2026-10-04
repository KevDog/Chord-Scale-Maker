<template>
  <hr role="presentation" :class="['w-full border-t', soft ? 'border-zinc-950/5 dark:border-white/5' : 'border-zinc-950/10 dark:border-white/10']">
</template>

<script setup lang="ts">
defineProps<{ soft?: boolean }>()
</script>

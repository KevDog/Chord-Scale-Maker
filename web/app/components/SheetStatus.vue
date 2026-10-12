<template>
  <!-- one muted line under the sheet's heading: where the chart is saved; a failed save or copy in red -->
  <div class="space-y-1 text-sm/6">
    <p v-if="text" role="status" :class="failed ? 'text-red-700 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'">{{ text }}</p>
    <p v-if="error" role="alert" class="text-red-700 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
/** the save status under the sheet's heading (the song page) */
defineProps<{ text: string; failed?: boolean; error?: string }>()
</script>

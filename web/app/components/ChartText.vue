<template>
  <div class="flex h-full flex-col gap-3">
    <UiTextarea
      :model-value="text"
      spellcheck="false"
      aria-label="Chart text"
      class="h-[60vh] min-h-60 font-mono text-sm/6!"
      @update:model-value="emit('update:text', $event)"
    />
    <ul v-if="diagnostics.length" class="space-y-1.5" aria-live="polite">
      <li v-for="(d, i) in diagnostics" :key="i" class="flex items-baseline gap-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
        <UiBadge :color="d.fatal ? 'red' : 'amber'" class="shrink-0">{{ d.line ? `Line ${d.line}` : 'Chart' }}</UiBadge>
        <span>{{ d.message }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Diagnostic } from '~~/engine'

defineProps<{ text: string; diagnostics: readonly Diagnostic[] }>()
const emit = defineEmits<{ 'update:text': [text: string] }>()
</script>

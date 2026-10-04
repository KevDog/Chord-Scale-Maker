<template>
  <div class="flex h-full flex-col gap-2">
    <textarea
      :value="text"
      spellcheck="false"
      aria-label="Chart text"
      class="h-[60vh] min-h-60 resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
      @input="emit('update:text', ($event.target as HTMLTextAreaElement).value)"
    />
    <ul v-if="diagnostics.length" class="space-y-1 text-sm" aria-live="polite">
      <li v-for="(d, i) in diagnostics" :key="i" :class="d.fatal ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'">
        {{ d.line ? `Line ${d.line}: ` : '' }}{{ d.message }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Diagnostic } from '~~/engine'

defineProps<{ text: string; diagnostics: readonly Diagnostic[] }>()
const emit = defineEmits<{ 'update:text': [text: string] }>()
</script>

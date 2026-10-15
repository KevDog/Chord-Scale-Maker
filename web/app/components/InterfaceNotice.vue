<template>
  <div role="status" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/6 text-zinc-600 dark:text-zinc-400 print:hidden">
    <span>This sheet uses {{ levelLabel(needs) }} settings</span>
    <UiButton plain @click="emit('show')">Show controls</UiButton>
    <UiButton plain @click="emit('reset')">Reset</UiButton>
  </div>
</template>

<script setup lang="ts">
import { type InterfaceLevel, levelLabel } from '~/utils/interface'

/** above the sheet when settings whose controls this Interface level hides are in force (#273): raise the level to show them, or return them to their defaults */
defineProps<{ needs: InterfaceLevel }>()
const emit = defineEmits<{ show: []; reset: [] }>()
</script>

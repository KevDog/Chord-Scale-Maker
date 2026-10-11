<template>
  <UiInput :model-value="error ? draft : value" :invalid="!!error" :title="error ?? undefined" @update:model-value="onInput" />
</template>

<script setup lang="ts">
import { cellError, LIMITS } from '@chord-scale-maker/engine'

/**
 * A heading field (Catalyst Input). Values that pass cellError are emitted; others stay visible in the input, marked
 * invalid with the reason in its tooltip, so the user can fix them (the doc keeps the last good value).
 */
const props = defineProps<{ value: string }>()
const emit = defineEmits<{ update: [value: string] }>()

const draft = ref(props.value)
const error = ref<string | null>(null)

// the heading changed underneath (a Source edit, undo): drop the draft and its error
watch(
  () => props.value,
  (v) => {
    draft.value = v
    error.value = null
  },
)

function onInput(value: string): void {
  draft.value = value
  error.value = cellError(value, LIMITS.maxMeta, true)
  if (!error.value) emit('update', value)
}
</script>

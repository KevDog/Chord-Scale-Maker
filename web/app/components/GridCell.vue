<template>
  <UiInput
    :model-value="error ? draft : value"
    :invalid="!!error"
    :aria-label="label"
    :title="error ?? undefined"
    :class="dense && 'sm:py-1 sm:text-sm/5'"
    @update:model-value="onInput"
  />
</template>

<script setup lang="ts">
import { cellError, LIMITS } from '~~/engine'

/**
 * A grid text cell (Catalyst Input). Values that pass cellError are emitted; others stay visible in
 * the input, marked invalid with the reason in its tooltip, so the user can fix them (the doc keeps
 * the last good value).
 */
const props = withDefaults(defineProps<{ value: string; label?: string; maxLength?: number; dense?: boolean }>(), {
  label: undefined,
  maxLength: LIMITS.maxCell,
})
const emit = defineEmits<{ update: [value: string] }>()

const draft = ref(props.value)
const error = ref<string | null>(null)

// the row changed underneath (text edit, insert, delete): drop the draft and its error
watch(
  () => props.value,
  (v) => {
    draft.value = v
    error.value = null
  },
)

function onInput(value: string): void {
  draft.value = value
  error.value = cellError(value, props.maxLength)
  if (!error.value) emit('update', value)
}
</script>

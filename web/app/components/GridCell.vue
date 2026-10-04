<template>
  <input
    :value="error ? draft : value"
    :aria-label="label"
    :aria-invalid="error ? 'true' : undefined"
    :title="error ?? undefined"
    :class="[field, error && '!border-rose-500']"
    @input="onInput(($event.target as HTMLInputElement).value)"
  >
</template>

<script setup lang="ts">
import { cellError, LIMITS } from '~~/engine'

/**
 * A grid text cell. Values that pass cellError are emitted; others stay visible in the input,
 * flagged, so the user can fix them (the doc keeps the last good value).
 */
const props = withDefaults(defineProps<{ value: string; field: string; label?: string; maxLength?: number }>(), {
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

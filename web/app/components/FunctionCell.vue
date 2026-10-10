<template>
  <UiSelect
    :model-value="selected"
    :aria-label="label"
    :invalid="!!problem"
    :title="problem ?? undefined"
    class="sm:py-1 sm:text-sm/5"
    @update:model-value="(v) => emit('update', String(v))"
  >
    <option v-for="c in choices" :key="c.value" :value="c.value">{{ c.value && c === matching ? '* ' : '' }}{{ c.label }}{{ c.scale ? ` → ${c.scale}` : '' }}</option>
    <option v-if="!matching && value" :value="value">* {{ value }}</option>
  </UiSelect>
</template>

<script setup lang="ts">
import { type FunctionChoice, sameFunction } from '~~/engine'

/**
 * A row's function: Auto (the analyser's reading, shown as its numeral), or one of the functions that fit the chord in
 * its key, each with the scale it gives (engine functionChoices). The author's choice is starred. A function written
 * in the text that isn't among them (another key's, "Db: V7/ii") stays, as one more option.
 */
const props = defineProps<{ choices: readonly FunctionChoice[]; value: string; problem: string | null; label: string }>()
const emit = defineEmits<{ update: [value: string] }>()

const matching = computed(() => (props.value ? props.choices.find((c) => c.value && sameFunction(c.value, props.value)) : props.choices[0]))
const selected = computed(() => matching.value?.value ?? props.value)
</script>

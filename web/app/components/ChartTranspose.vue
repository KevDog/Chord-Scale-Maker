<template>
  <UiButton outline :disabled="!keyValid" :title="keyValid ? undefined : `Set the chart's key first`" @click="openDialog"><ArrowsUpDownIcon data-slot="icon" />Transpose…</UiButton>

  <UiDialog :open="open" size="md" @close="open = false">
    <UiDialogTitle>Transpose chart</UiDialogTitle>
    <UiDialogDescription>Moves every chord and scale to a new concert key. The title and subtitle stay as they are; transpose back to undo.</UiDialogDescription>
    <UiDialogBody>
      <div class="grid grid-cols-2 gap-4">
        <UiField>
          <UiLabel>From key</UiLabel>
          <UiText class="py-1.5 font-medium">{{ keyLabel(from) }}</UiText>
        </UiField>
        <UiField>
          <UiLabel>To key</UiLabel>
          <UiSelect v-model="to">
            <option v-for="k in keys" :key="k" :value="k">{{ keyLabel(k) }}</option>
          </UiSelect>
        </UiField>
      </div>
    </UiDialogBody>
    <UiDialogActions>
      <UiButton plain @click="open = false">Cancel</UiButton>
      <UiButton color="note" :disabled="from === to" @click="apply">Transpose</UiButton>
    </UiDialogActions>
  </UiDialog>
</template>

<script setup lang="ts">
import { ArrowsUpDownIcon } from '@heroicons/vue/16/solid'
import { type ChartDoc, chartMeta, isValidKey, keyLabel, offeredKey, refreshAnalysis, setMeta, transposeChart, transposeKeys } from '@chord-scale-maker/engine'

/**
 * "Transpose…": rewrites the chart in another concert key (engine/src/transpose.ts).
 * `current` returns the chart as of now (the editor parses pending typing first).
 */
const props = defineProps<{ current: () => ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; 'transposed': [message: string] }>()

const open = ref(false)
const from = ref<string>('C')
const to = ref<string>('C')
/** a transposition keeps the mode: a minor chart moves among the minor keys */
const keys = computed(() => transposeKeys(from.value))
/** the chart's declared key is the source; Transpose is unavailable until it's a valid key */
const keyValid = computed(() => isValidKey(chartMeta(props.current()).key))
/** the key the chart had before a run of transposes, and the key the last one left it in; a key changed otherwise ends the run */
const run = ref<{ origin: string; at: string } | null>(null)

function openDialog(): void {
  from.value = chartMeta(props.current()).key.trim()
  to.value = offeredKey(from.value)
  open.value = true
}

function apply(): void {
  const { doc: moved, skipped } = transposeChart(props.current(), from.value, to.value)
  const newKey = to.value
  // the analysis reads the key, so it's set first; a saved analysis then names the new key
  const doc = refreshAnalysis(setMeta(moved, 'key', newKey))
  emit('update:doc', doc)
  const origin = run.value?.at === from.value ? run.value.origin : from.value
  run.value = { origin, at: newKey }
  const note = skipped ? `; ${skipped} ${skipped === 1 ? 'row' : 'rows'} could not be read and stayed as typed` : ''
  // back in the key it started in: nothing to say
  emit('transposed', newKey === origin ? '' : `Transposed from ${keyLabel(origin)} to ${keyLabel(newKey)}${note}.`)
  open.value = false
}
</script>

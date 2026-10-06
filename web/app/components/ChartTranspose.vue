<template>
  <UiButton outline @click="openDialog"><ArrowsUpDownIcon data-slot="icon" />Transpose…</UiButton>

  <UiDialog :open="open" size="md" @close="open = false">
    <UiDialogTitle>Transpose chart</UiDialogTitle>
    <UiDialogDescription>Moves every chord and scale to a new concert key. The title and subtitle stay as they are; transpose back to undo.</UiDialogDescription>
    <UiDialogBody>
      <div class="grid grid-cols-2 gap-4">
        <UiField>
          <UiLabel>From key</UiLabel>
          <UiSelect v-model="from">
            <option v-for="k in fromKeys" :key="k" :value="k">{{ noteText(k) }}</option>
          </UiSelect>
        </UiField>
        <UiField>
          <UiLabel>To key</UiLabel>
          <UiSelect v-model="to">
            <option v-for="k in TRANSPOSE_KEYS" :key="k" :value="k">{{ noteText(k) }}</option>
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
import { type ChartDoc, chartKey, noteText, TRANSPOSE_KEYS, transposeChart } from '~~/engine'

/**
 * "Transpose…": rewrites the chart in another concert key (engine/transpose.ts).
 * `current` returns the chart as of now (the editor parses pending typing first).
 */
const props = defineProps<{ current: () => ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; 'transposed': [message: string] }>()

const open = ref(false)
const from = ref<string>('C')
const to = ref<string>('C')
/** the guessed key leads the list when it isn't one of the usual spellings (C#, G#…) */
const fromKeys = computed(() => ((TRANSPOSE_KEYS as readonly string[]).includes(from.value) ? TRANSPOSE_KEYS : [from.value, ...TRANSPOSE_KEYS]))

function openDialog(): void {
  from.value = chartKey(props.current()) ?? 'C'
  to.value = from.value
  open.value = true
}

function apply(): void {
  const { doc, skipped } = transposeChart(props.current(), from.value, to.value)
  emit('update:doc', doc)
  const note = skipped ? `; ${skipped} ${skipped === 1 ? 'row' : 'rows'} could not be read and stayed as typed` : ''
  emit('transposed', `Transposed from ${noteText(from.value)} to ${noteText(to.value)}${note}.`)
  open.value = false
}
</script>

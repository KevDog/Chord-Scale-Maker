<template>
  <div class="grid gap-4 sm:grid-cols-3">
    <UiField v-for="key in META_KEYS" :key="key">
      <UiLabel class="capitalize">{{ key }}</UiLabel>
      <template v-if="key === 'key'">
        <UiSelect :model-value="meta.key" :invalid="!isValidKey(meta.key)" aria-label="Key" @update:model-value="(v) => emitDoc(setMeta(doc, 'key', String(v)))">
          <option value="" disabled>Pick a key</option>
          <option v-for="k in KEY_OPTIONS" :key="k" :value="k">{{ keyLabel(k) }}</option>
        </UiSelect>
        <UiErrorMessage v-if="!isValidKey(meta.key)">Pick the chart's key</UiErrorMessage>
      </template>
      <GridCell v-else meta :value="meta[key]" :max-length="LIMITS.maxMeta" @update="(v) => emitDoc(setMeta(doc, key, v))" />
    </UiField>
    <template v-if="details">
      <UiField>
        <UiLabel>Time</UiLabel>
        <UiSelect :model-value="time" aria-label="Time" @update:model-value="(v) => v !== time && emitDoc(setMeta(doc, 'time', String(v)))">
          <option v-for="t in TIMES" :key="t" :value="t">{{ t }}</option>
        </UiSelect>
      </UiField>
      <div class="flex items-end sm:col-span-2">
        <UiButton plain :aria-expanded="open" aria-controls="chart-details" @click="open = !open">
          <ChevronRightIcon data-slot="icon" :class="open && 'rotate-90'" />Details
        </UiButton>
      </div>
      <div v-if="open" id="chart-details" class="grid gap-4 sm:col-span-3 sm:grid-cols-3">
        <UiField v-for="key in DETAIL_KEYS" :key="key">
          <UiLabel class="capitalize">{{ key }}</UiLabel>
          <GridCell meta :value="more[key]" :max-length="LIMITS.maxMeta" @update="(v) => emitDoc(setMeta(doc, key, v))" />
        </UiField>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRightIcon } from '@heroicons/vue/16/solid'
import { type ChartDoc, chartDetails, chartMeta, isValidKey, keyLabel, LIMITS, type MetaKey, setMeta } from '@chord-scale-maker/engine'

/**
 * the chart's heading as fields: title, subtitle and key; with `details` (the bar editor) also the time and, folded
 * away, the composer, style and form (the rest stays in the text)
 */
const props = defineProps<{ doc: ChartDoc; details?: boolean }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly Extract<MetaKey, 'title' | 'subtitle' | 'key'>[] = ['title', 'subtitle', 'key']
const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'] as const

const TIMES = ['4/4', '3/4', '2/4'] as const
const DETAIL_KEYS: readonly Extract<MetaKey, 'composer' | 'style' | 'form'>[] = ['composer', 'style', 'form']

const meta = computed(() => chartMeta(props.doc))
const more = computed(() => chartDetails(props.doc))
const time = computed(() => more.value.time || '4/4')
const open = ref(false)
const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)
</script>

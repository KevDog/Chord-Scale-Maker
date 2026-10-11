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
  </div>
</template>

<script setup lang="ts">
import { type ChartDoc, chartMeta, isValidKey, keyLabel, LIMITS, type MetaKey, setMeta } from '@chord-scale-maker/engine'

/** the chart's heading as fields: title, subtitle and key (the rest stays in the text) */
const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly Extract<MetaKey, 'title' | 'subtitle' | 'key'>[] = ['title', 'subtitle', 'key']
const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'] as const

const meta = computed(() => chartMeta(props.doc))
const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)
</script>

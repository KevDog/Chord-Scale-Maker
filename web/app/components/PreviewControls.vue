<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-4">
      <SegmentedControl v-if="guideTones" v-model="sheet" legend="Sheet" name="sheet" :options="SHEETS" />
      <UiField class="w-60">
        <UiLabel>Instrument</UiLabel>
        <UiListbox v-model="instrument">
          <template #selected="{ value }"><UiListboxLabel>{{ instrumentOption(value) }}</UiListboxLabel></template>
          <UiListboxGroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
            <UiListboxOption v-for="name in g.instruments" :key="name" :value="name">
              <UiListboxLabel>{{ instrumentOption(name) }}</UiListboxLabel>
              <UiListboxDescription>{{ INSTRUMENTS[name].description }}</UiListboxDescription>
            </UiListboxOption>
          </UiListboxGroup>
        </UiListbox>
      </UiField>
      <SegmentedControl v-if="sheet === 'scales'" v-model="mode" legend="Where each scale starts" name="mode" :options="modes" />
      <UiField v-if="sheet === 'scales' && mode === 'from'" class="w-28">
        <UiLabel>Start on</UiLabel>
        <UiSelect v-model="start" aria-describedby="start-help">
          <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
        </UiSelect>
      </UiField>
      <UiButton v-bind="intervals ? { color: 'note' } : { outline: true }" :aria-pressed="intervals" title="Label each note against the chord root (on screen only)" @click="intervals = !intervals">
        Intervals
      </UiButton>
    </div>
    <UiText id="start-help" class="sr-only">Written pitch the "from" part starts on</UiText>
    <UiText aria-live="polite">
      <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(instrument).toLowerCase() }}.</template>
      <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(instrument).toLowerCase() }}.</template>
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { INSTRUMENTS, type InstrumentName, type Mode, noteText, partFor } from '~~/engine'
import type { SheetKind } from '~/utils/sheets'

/** the preview toolbar: which sheet, the instrument, where scales start, and interval labels */
const sheet = defineModel<SheetKind>('sheet', { required: true })
const instrument = defineModel<InstrumentName>('instrument', { required: true })
const mode = defineModel<Mode>('mode', { required: true })
const start = defineModel<string>('start', { required: true })
const intervals = defineModel<boolean>('intervals', { required: true })

const guideTones = useFeature('guideTones')
const modes = computed((): readonly { value: Mode; label: string }[] => [
  { value: 'from', label: `From ${noteText(start.value)}` },
  { value: 'root', label: 'From root' },
])
const part = computed(() => partFor(instrument.value))
</script>

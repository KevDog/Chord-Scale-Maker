<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-4">
      <SegmentedControl v-if="sheets.length > 1" v-model="sheet" legend="Sheet" name="sheet" :options="sheets" />
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
      <!-- Intervals and the chart's actions: one group, its own row below lg, two by two on a phone -->
      <div class="flex flex-wrap items-end gap-3 *:whitespace-nowrap max-lg:w-full max-sm:grid max-sm:grid-cols-2">
        <UiButton v-if="sheet !== 'changes'" v-bind="intervals ? { color: 'note' } : { outline: true }" :aria-pressed="intervals" title="Label each note against the chord root (on screen only)" @click="intervals = !intervals">
          Intervals
        </UiButton>
        <template v-else>
          <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
          <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
        </template>
        <slot name="actions" />
      </div>
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

/** the preview toolbar: which sheet, the instrument, where scales start, interval labels, then the #actions slot */
const sheet = defineModel<SheetKind>('sheet', { required: true })
const instrument = defineModel<InstrumentName>('instrument', { required: true })
const mode = defineModel<Mode>('mode', { required: true })
const start = defineModel<string>('start', { required: true })
const intervals = defineModel<boolean>('intervals', { required: true })
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })

const guideTones = useFeature('guideTones')
const changes = useFeature('changes')
const sheets = computed(() => SHEETS.filter((s) => (s.value === 'guideTones' ? guideTones : s.value === 'changes' ? changes : true)))
const modes = computed((): readonly { value: Mode; label: string }[] => [
  { value: 'from', label: `From ${noteText(start.value)}` },
  { value: 'root', label: 'From root' },
])
const part = computed(() => partFor(instrument.value))
</script>

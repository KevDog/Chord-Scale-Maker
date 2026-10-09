<template>
  <div id="preview-toolbar" class="space-y-4">
    <!-- labelled groups: the controls wrap on the left; Display stays pinned top-right (Sheet · Instrument · Work on · Show · Transposition | Display) -->
    <div class="flex items-start justify-between gap-x-4 gap-y-3">
      <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
        <SegmentedControl v-if="sheets.length > 1" v-model="sheet" legend="Sheet" name="sheet" :options="sheets" />
      <UiField class="w-40">
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
      <UiField v-if="$slots.workon">
        <UiLabel>Work on</UiLabel>
        <div class="flex items-center gap-2"><slot name="workon" /></div>
      </UiField>
      <UiField>
        <UiLabel>Show</UiLabel>
        <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
          <UiButton v-if="sheet !== 'changes'" v-bind="intervals ? { color: 'note' } : { outline: true }" :aria-pressed="intervals" title="Label each note against the chord root (on screen only)" @click="intervals = !intervals">Intervals</UiButton>
          <template v-else>
            <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
            <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
          </template>
        </div>
      </UiField>
      <UiField>
        <UiLabel>Transposition</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <UiListbox v-if="sheet === 'scales'" v-model="mode" class="w-32" aria-label="Where each scale starts">
            <template #selected="{ value }"><UiListboxLabel>{{ modeLabel(value) }}</UiListboxLabel></template>
            <UiListboxOption v-for="m in modes" :key="m.value" :value="m.value"><UiListboxLabel>{{ m.label }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
          <UiSelect v-if="sheet === 'scales' && mode === 'from'" v-model="start" class="w-[4.5rem]" aria-label="Start on" aria-describedby="start-help">
            <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
          </UiSelect>
          <slot name="transpose" />
        </div>
      </UiField>
      </div>
      <UiField class="shrink-0">
        <UiLabel>Display</UiLabel>
        <div class="flex flex-wrap justify-end gap-2 *:whitespace-nowrap"><slot name="display" /></div>
      </UiField>
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

/** the preview toolbar, in labelled groups: Sheet, Instrument, #workon, Show, Transposition (+ #transpose), #display */
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
const modeLabel = (v: Mode): string => modes.value.find((m) => m.value === v)?.label ?? ''
const part = computed(() => partFor(instrument.value))
</script>

<template>
  <div id="preview-toolbar" class="space-y-4">
    <!-- labelled groups: the controls wrap on the left, Display pinned top-right (Work on · Instrument · Level · Show (on the Changes: Analysis · Guide Tones) · Transposition · Spell Scale | Display); top-aligned so every label sits on one line -->
    <div class="flex items-start justify-between gap-x-4 gap-y-3">
      <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
      <UiField v-if="sheets.length > 1" class="w-36">
        <UiLabel class="pl-3">Work on</UiLabel>
        <!-- a plain wrapper (not data-slot=control) so the label gap matches the other groups -->
        <div class="flex items-center gap-2">
          <UiListbox v-model="sheet" class="w-full">
            <template #selected="{ value }"><UiListboxLabel>{{ sheetLabel(value) }}</UiListboxLabel></template>
            <UiListboxOption v-for="s in sheets" :key="s.value" :value="s.value"><UiListboxLabel>{{ s.label }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
      </UiField>
      <UiField class="w-36">
        <UiLabel class="pl-3">Instrument</UiLabel>
        <div class="flex items-center gap-2">
          <UiListbox v-model="instrument" class="w-full">
            <template #selected="{ value }"><UiListboxLabel>{{ instrumentOption(value) }}</UiListboxLabel></template>
            <UiListboxGroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
              <UiListboxOption v-for="name in g.instruments" :key="name" :value="name">
                <UiListboxLabel>{{ instrumentOption(name) }}:</UiListboxLabel>
                <UiListboxDescription>{{ INSTRUMENTS[name].description }}</UiListboxDescription>
              </UiListboxOption>
            </UiListboxGroup>
          </UiListbox>
        </div>
      </UiField>
      <UiField v-if="$slots.level">
        <UiLabel class="pl-3">Level</UiLabel>
        <div class="flex items-center gap-2"><slot name="level" /></div>
      </UiField>
      <UiField v-if="sheet !== 'changes'">
        <UiLabel class="pl-3">Show</UiLabel>
        <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
          <UiButton v-bind="intervals ? { color: 'note' } : { outline: true }" :class="intervals ? '' : OFF_FILL" :aria-pressed="intervals" title="Label each note against the chord root (on screen only)" @click="intervals = !intervals">Intervals</UiButton>
        </div>
      </UiField>
      <template v-else>
        <UiField>
          <UiLabel class="pl-3">Analysis</UiLabel>
          <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
            <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :class="numerals ? '' : OFF_FILL" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
            <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :class="scaleNames ? '' : OFF_FILL" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
          </div>
        </UiField>
        <UiField>
          <UiLabel class="pl-3">Guide Tones</UiLabel>
          <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
            <UiButton v-bind="fromThird ? { color: 'note' } : { outline: true }" :class="fromThird ? '' : OFF_FILL" :aria-pressed="fromThird" aria-description="Guide tones: a line from the first chord's 3rd" title="A line that starts on the first chord's 3rd and moves to the nearest guide tone of each chord; with From 7th on, both lines" @click="fromThird = !fromThird">From 3rd</UiButton>
            <UiButton v-bind="fromSeventh ? { color: 'note' } : { outline: true }" :class="fromSeventh ? '' : OFF_FILL" :aria-pressed="fromSeventh" aria-description="Guide tones: a line from the first chord's 7th" title="A line that starts on the first chord's 7th and moves to the nearest guide tone of each chord; with From 3rd on, both lines" @click="fromSeventh = !fromSeventh">From 7th</UiButton>
          </div>
        </UiField>
      </template>
      <UiField>
        <UiLabel class="pl-3">Transposition</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <slot name="transpose" />
        </div>
      </UiField>
      <UiField v-if="sheet === 'scales'">
        <UiLabel class="pl-3">Spell Scale</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <UiListbox v-model="mode" class="w-32" aria-label="Where each scale starts">
            <template #selected="{ value }"><UiListboxLabel>{{ modeLabel(value) }}</UiListboxLabel></template>
            <UiListboxOption v-for="m in modes" :key="m.value" :value="m.value"><UiListboxLabel>{{ m.label }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
          <UiSelect v-if="mode === 'from'" v-model="start" class="w-[4.5rem]" aria-label="Start on" aria-describedby="start-help">
            <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
          </UiSelect>
        </div>
      </UiField>
      </div>
      <UiField class="shrink-0">
        <UiLabel class="block pr-3 text-right">Display</UiLabel>
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

/** the preview toolbar, in labelled groups: Work on (sheet), Instrument, #level, Show (on the Changes: Analysis, Guide Tones), Transposition (+ #transpose), #display */
const sheet = defineModel<SheetKind>('sheet', { required: true })
const instrument = defineModel<InstrumentName>('instrument', { required: true })
const mode = defineModel<Mode>('mode', { required: true })
const start = defineModel<string>('start', { required: true })
const intervals = defineModel<boolean>('intervals', { required: true })
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })
const fromThird = defineModel<boolean>('fromThird', { default: false })
const fromSeventh = defineModel<boolean>('fromSeventh', { default: false })

const changes = useFeature('changes')
const sheets = computed(() => SHEETS.filter((s) => s.value !== 'changes' || changes))
const modes = computed((): readonly { value: Mode; label: string }[] => [
  { value: 'from', label: `From ${noteText(start.value)}` },
  { value: 'root', label: 'From root' },
])
// a solid white fill for the "off" toggles so they read on the tinted box (an outline button is transparent)
const OFF_FILL = 'bg-white hover:bg-zinc-50 dark:bg-white/10 dark:hover:bg-white/15'
const modeLabel = (v: Mode): string => modes.value.find((m) => m.value === v)?.label ?? ''
const sheetLabel = (v: SheetKind): string => sheets.value.find((s) => s.value === v)?.label ?? ''
const part = computed(() => partFor(instrument.value))
</script>

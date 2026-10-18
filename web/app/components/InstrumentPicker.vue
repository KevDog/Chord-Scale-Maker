<template>
  <!-- the instrument in two steps (#417): its pitch (Concert, B♭, E♭, F, Bass), then the instruments that read in it -->
  <div :class="stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'">
    <UiListbox :model-value="group.pitch" aria-label="Pitch" :class="stacked ? 'w-full' : 'w-24 shrink-0'" @update:model-value="pickPitch">
      <template #selected="{ value }"><UiListboxLabel>{{ value }}</UiListboxLabel></template>
      <UiListboxOption v-for="g in INSTRUMENT_GROUPS" :key="g.pitch" :value="g.pitch">
        <UiListboxLabel>{{ g.pitch }}</UiListboxLabel>
      </UiListboxOption>
    </UiListbox>
    <UiListbox :model-value="instrument" :aria-label="field ? undefined : 'Instrument'" class="min-w-0 flex-1" @update:model-value="pickInstrument">
      <template #selected="{ value }"><UiListboxLabel>{{ instrumentOption(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="name in group.instruments" :key="name" :value="name">
        <template v-if="describe">
          <UiListboxLabel>{{ instrumentOption(name) }}:</UiListboxLabel>
          <UiListboxDescription>{{ INSTRUMENTS[name].description }}</UiListboxDescription>
        </template>
        <UiListboxLabel v-else>{{ instrumentOption(name) }}</UiListboxLabel>
      </UiListboxOption>
    </UiListbox>
  </div>
</template>

<script setup lang="ts">
import { type InstrumentName, INSTRUMENTS } from '@chord-scale-maker/engine'
import { FIELD } from '~/utils/field'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

/**
 * the Instrument picker: a pitch, then an instrument of that pitch. A new pitch picks its first instrument. In a
 * UiField its label names the instrument listbox; on its own the listbox is "Instrument". describe: each
 * instrument's range beside it. stacked: the pitch above the instrument (the rail keeps its width). chosen: an instrument picked from the instrument listbox (not a pitch's first).
 */
withDefaults(defineProps<{ describe?: boolean; stacked?: boolean }>(), { describe: true, stacked: false })
const emit = defineEmits<{ chosen: [InstrumentName] }>()
const instrument = defineModel<InstrumentName>({ required: true })
const field = inject(FIELD, undefined)
const group = computed(() => INSTRUMENT_GROUPS.find((g) => g.instruments.includes(instrument.value)) ?? INSTRUMENT_GROUPS[0]!)

function pickInstrument(name: InstrumentName | undefined): void {
  if (!name) return
  instrument.value = name
  emit('chosen', name)
}

function pickPitch(pitch: string | undefined): void {
  const first = INSTRUMENT_GROUPS.find((g) => g.pitch === pitch)?.instruments[0]
  if (first && pitch !== group.value.pitch) instrument.value = first
}
</script>

<template>
  <div id="preview-toolbar" class="space-y-4">
    <!-- labelled groups: the controls wrap on the left, Display pinned top-right (on its own line, still right, once the row is too narrow) (Work on · Instrument · Level · Show (on the Changes: Analysis · Guide Tones) · Transposition · Spell Scale | Display); top-aligned so every label sits on one line -->
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div class="flex min-w-0 grow basis-80 flex-wrap items-start gap-x-4 gap-y-3">
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
        <UiField v-if="!lockLabels">
          <UiLabel class="pl-3">Analysis</UiLabel>
          <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
            <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :class="numerals ? '' : OFF_FILL" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
            <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :class="scaleNames ? '' : OFF_FILL" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
          </div>
        </UiField>
        <UiField>
          <UiLabel class="pl-3">Line</UiLabel>
          <!-- the detail opens beneath the modes, so the Line group keeps its width and place (#187) -->
          <div class="flex flex-col gap-2">
            <SegmentedControl v-model="lineMode" legend="Line" name="line-mode" :options="lineModes" />
            <UiListbox v-if="lineMode === 'guide'" v-model="guideLine" class="w-full" aria-label="Guide tone line">
              <template #selected="{ value }"><UiListboxLabel>{{ guideLabel(value) }}</UiListboxLabel></template>
              <UiListboxOption v-for="g in GUIDE_LINES" :key="g.value" :value="g.value" :title="g.title"><UiListboxLabel>{{ g.label }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
            <UiListbox v-else-if="lineMode === 'arpeggio'" v-model="arpeggio" class="w-full" aria-label="Arpeggio pattern">
              <template #selected="{ value }"><UiListboxLabel>{{ ARPEGGIO_LABELS[value] }}</UiListboxLabel></template>
              <UiListboxOption v-for="p in ARPEGGIO_PATTERNS" :key="p" :value="p"><UiListboxLabel>{{ ARPEGGIO_LABELS[p] }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
          </div>
        </UiField>
      </template>
      <UiField>
        <UiLabel class="pl-3">Transposition</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <slot name="transpose" />
        </div>
      </UiField>
      <UiField v-if="sheet === 'arpeggios'">
        <UiLabel class="pl-3">Arpeggio</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <SegmentedControl v-model="arpNotes" legend="Arpeggio" name="arp-notes" :options="arpNoteOptions" />
          <UiListbox v-model="arpDir" class="w-32" aria-label="Arpeggio direction">
            <template #selected="{ value }"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[value] }}</UiListboxLabel></template>
            <UiListboxOption v-for="d in ARP_DIRECTIONS" :key="d" :value="d"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[d] }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
      </UiField>
      <UiField v-if="sheet === 'scales'">
        <UiLabel class="pl-3">Spell Scale</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <UiListbox v-model="spell" class="w-40" aria-label="Where each scale starts" aria-describedby="start-help">
            <template #selected="{ value }"><UiListboxLabel>{{ spellLabel(value, keyStart) }}</UiListboxLabel></template>
            <UiListboxOption v-for="s in SPELLS" :key="s" :value="s"><UiListboxLabel>{{ spellLabel(s, keyStart) }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
      </UiField>
      </div>
      <UiField class="ml-auto shrink-0">
        <UiLabel class="block pr-3 text-right">Display</UiLabel>
        <div class="flex flex-wrap justify-end gap-2 *:whitespace-nowrap"><slot name="display" /></div>
      </UiField>
    </div>
    <UiText id="start-help" class="sr-only">Each scale from its root, or from a written pitch: the chart's key or any note</UiText>
    <UiText aria-live="polite">
      <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(instrument).toLowerCase() }}.</template>
      <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(instrument).toLowerCase() }}.</template>
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { ARP_DIRECTION_LABELS, ARP_DIRECTIONS, ARP_NOTES, ARP_NOTES_LABELS, ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, type ArpDirection, type ArpeggioPattern, type ArpNotes, INSTRUMENTS, type InstrumentName, partFor } from '@chord-scale-maker/engine'
import type { GuideFrom, LineMode } from '~/utils/sheetLine'
import { type Spell, spellLabel, SPELLS } from '~/utils/scaleChoices'
import type { SheetKind } from '~/utils/sheets'

/** the preview toolbar, in labelled groups: Work on (sheet), Instrument, #level, Show (on the Changes: Analysis, Guide Tones), Transposition (+ #transpose), #display */
const sheet = defineModel<SheetKind>('sheet', { required: true })
const instrument = defineModel<InstrumentName>('instrument', { required: true })
const spell = defineModel<Spell>('spell', { required: true })
const intervals = defineModel<boolean>('intervals', { required: true })
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })
const lineMode = defineModel<LineMode>('lineMode', { default: 'off' })
const guideLine = defineModel<GuideFrom>('guideLine', { default: 'third' })
const arpeggio = defineModel<ArpeggioPattern>('arpeggio', { default: 'up-root' })
const arpNotes = defineModel<ArpNotes>('arpNotes', { default: 'seventh' })
const arpDir = defineModel<ArpDirection>('arpDir', { default: 'up' })
/** the sheet editor is open: numerals and scales are shown (they are the pickers), their toggles hide */
/** keyStart: the chart's key, written for the instrument (what "From key" starts on) */
defineProps<{ lockLabels?: boolean; keyStart: string }>()

const changes = useFeature('changes')
const arpeggios = useFeature('arpeggios')
const sheets = computed(() => SHEETS.filter((s) => (s.value !== 'changes' || changes) && (s.value !== 'arpeggios' || arpeggios)))
const arpNoteOptions = ARP_NOTES.map((value) => ({ value, label: ARP_NOTES_LABELS[value] }))
// a solid white fill for the "off" toggles so they read on the tinted box (an outline button is transparent)
const OFF_FILL = 'bg-white hover:bg-zinc-50 dark:bg-white/10 dark:hover:bg-white/15'
// the Changes sheet's line, at most one: guide tones or 7th chord arpeggios (with the flag on)
const lineModes = computed((): { value: LineMode; label: string; title: string }[] => [
  { value: 'off', label: 'Off', title: 'No line: slashes' },
  { value: 'guide', label: 'Guide Tones', title: "A line that starts on the first chord's 3rd or 7th and moves to the nearest guide tone of each chord" },
  ...(arpeggios ? [{ value: 'arpeggio' as const, label: '7th Chords', title: "Each chord's four chord tones, arpeggiated: quarters, eighths or sixteenths as the bar has one, two or more chords" }] : []),
])
const GUIDE_LINES = [
  { value: 'third', label: 'From 3rd', title: "A line that starts on the first chord's 3rd and moves to the nearest guide tone of each chord" },
  { value: 'seventh', label: 'From 7th', title: "A line that starts on the first chord's 7th and moves to the nearest guide tone of each chord" },
] as const
const guideLabel = (v: GuideFrom): string => GUIDE_LINES.find((g) => g.value === v)?.label ?? ''
const sheetLabel = (v: SheetKind): string => sheets.value.find((s) => s.value === v)?.label ?? ''
const part = computed(() => partFor(instrument.value))
// the flag off with an arpeggio saved: nothing is drawn, so rest the mode on Off
watch(lineMode, () => {
  if (!arpeggios && lineMode.value === 'arpeggio') lineMode.value = 'off'
}, { immediate: true })
</script>

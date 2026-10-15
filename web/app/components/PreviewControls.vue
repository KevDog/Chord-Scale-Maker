<template>
  <!-- display: contents, so the rail's sticky box is the whole Preview section -->
  <div id="preview-toolbar" class="contents space-y-4">
    <!-- the rail: labelled groups wrap on the left (Work on · Instrument · Level · Show (on the Changes: Analysis · Line) · Transposition · Spell Scale), the actions pinned right (on their own line, still right, once the row is too narrow); top-aligned so every label sits on one line -->
    <SheetRail :sticky="stickyRail">
      <template #left>
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
        <!-- the other groups: in the rail, or on a phone (compact) in the Controls dialog -->
        <component :is="compact ? ControlsDialog : Passthrough" v-bind="compact ? { open: controlsOpen, onClose: () => (controlsOpen = false), onClosed: runAfterClose } : {}">
          <UiField v-if="$slots.level && shows('scale-level')">
            <UiLabel class="pl-3">Level</UiLabel>
            <div class="flex items-center gap-2"><slot name="level" /></div>
          </UiField>
          <UiField v-if="sheet !== 'changes'">
            <UiLabel class="pl-3">Show</UiLabel>
            <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
              <ToggleButton v-model="intervals" title="Label each note against the chord root (on screen only)">Intervals</ToggleButton>
            </div>
          </UiField>
          <template v-else>
            <UiField v-if="analysisShown || overlayShown">
              <UiLabel class="pl-3">Analysis</UiLabel>
              <!-- stacked, so the group keeps the width of Numerals and Scales and the rail its two rows (#255) -->
              <div class="flex flex-col items-start gap-2">
                <div v-if="analysisShown" class="flex flex-wrap gap-2 *:whitespace-nowrap">
                  <ToggleButton v-model="numerals" title="Each chord's Roman numeral in its key">Numerals</ToggleButton>
                  <ToggleButton v-model="scaleNames" title="Each chord's scale, under its numeral">Scales</ToggleButton>
                </div>
                <!-- the row under the chords: Off, each key area's or chord's minor pentatonic, or each chord's hexatonic pair -->
                <UiListbox v-if="overlayShown" v-model="overlayModel" class="w-48" aria-label="Overlay" title="A row under the chords: each key area's or each chord's minor pentatonic, ranked by how far out it is, or each chord's hexatonic triad pair">
                  <template #selected="{ value }"><UiListboxLabel>Overlay: {{ overlayLabel(value) }}</UiListboxLabel></template>
                  <UiListboxOption v-for="o in overlayOptions" :key="o.value" :value="o.value"><UiListboxLabel>{{ o.label }}</UiListboxLabel></UiListboxOption>
                </UiListbox>
                <div v-if="overlayShown && overlayModel === 'pentatonic'" class="flex flex-col items-start gap-2">
                  <SegmentedControl v-model="pentBasis" legend="Ranked against" name="pent-basis" aria-label="Pentatonics ranked against" :options="PENT_BASES" />
                  <UiListbox v-if="pentBasis === 'chord'" v-model="pentRank" class="w-48" aria-label="Pentatonic rank">
                    <template #selected="{ value }"><UiListboxLabel>{{ rankLabel(value) }}</UiListboxLabel></template>
                    <UiListboxOption v-for="r in PENT_RANK_CHOICES" :key="r.value" :value="r.value"><UiListboxLabel>{{ r.label }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
                  <template v-else>
                    <UiListbox v-model="pentPath" class="w-48" aria-label="Pentatonic path">
                      <template #selected="{ value }"><UiListboxLabel>{{ pathLabel(value) }}</UiListboxLabel></template>
                      <UiListboxOption v-for="p in pathChoices" :key="p.value" :value="p.value"><UiListboxLabel>{{ p.label }}</UiListboxLabel></UiListboxOption>
                    </UiListbox>
                    <template v-if="pentPath === 'one'">
                      <UiListbox v-model="pentRung" class="w-48" aria-label="Pentatonic rung">
                        <template #selected="{ value }"><UiListboxLabel>{{ rungLabel(value) }}</UiListboxLabel></template>
                        <UiListboxOption v-for="r in PENT_RUNGS" :key="r.value" :value="r.value"><UiListboxLabel>{{ r.label }}</UiListboxLabel></UiListboxOption>
                      </UiListbox>
                      <SegmentedControl v-if="sideShown(pentRung)" v-model="pentSide" legend="Side" name="pent-side" aria-label="Pentatonic side" :options="PENT_SIDES" />
                    </template>
                    <template v-else-if="pentPath !== 'custom'">
                      <SegmentedControl v-model="pentStepUnit" legend="Step by" name="pent-step" aria-label="Pentatonic step" :options="PENT_STEP_UNITS" />
                      <SegmentedControl v-if="pentStepUnit === 'bars'" v-model="pentStepBarsText" legend="Bars" name="pent-step-bars" aria-label="Bars a step" :options="PENT_STEP_BARS" />
                    </template>
                  </template>
                </div>
              </div>
            </UiField>
            <UiField v-if="shows('line')">
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
          <UiField v-if="sheet === 'scales' && shows('spell')">
            <UiLabel class="pl-3">Spell Scale</UiLabel>
            <div class="flex flex-wrap items-center gap-2">
              <UiListbox v-model="spell" class="w-40" aria-label="Where each scale starts" aria-describedby="start-help">
                <template #selected="{ value }"><UiListboxLabel>{{ spellLabel(value, keyStart) }}</UiListboxLabel></template>
                <UiListboxOption v-for="s in SPELLS" :key="s" :value="s"><UiListboxLabel>{{ spellLabel(s, keyStart) }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
            </div>
          </UiField>
          <template v-if="compact" #actions><slot name="actions" place="dialog" :after="afterClose" /></template>
        </component>
      </template>
      <template #right>
        <UiButton v-if="compact" id="controls-button" outline aria-haspopup="dialog" @click="controlsOpen = true"><AdjustmentsHorizontalIcon data-slot="icon" />Controls</UiButton>
        <slot name="actions" place="rail" :after="now" />
      </template>
    </SheetRail>
    <UiText id="start-help" class="sr-only">Each scale from its root, or from a written pitch: the chart's key or any note</UiText>
    <UiText aria-live="polite">
      <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(instrument).toLowerCase() }}.</template>
      <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(instrument).toLowerCase() }}.</template>
    </UiText>
  </div>
</template>

<script setup lang="ts">
import { ARP_DIRECTION_LABELS, ARP_DIRECTIONS, ARP_NOTES, ARP_NOTES_LABELS, ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, type ArpDirection, type ArpeggioPattern, type ArpNotes, INSTRUMENTS, type InstrumentName, partFor, type PentatonicBasis, type PentatonicPathName, type PentatonicSide, type PentatonicStepUnit } from '@chord-scale-maker/engine'
import { PENT_BASES, PENT_PATHS, PENT_RANK_CHOICES, PENT_RUNGS, PENT_SIDES, PENT_STEP_BARS, PENT_STEP_UNITS, pathLabel, rankLabel, rungLabel, sideShown } from '~/utils/pentatonics'
import type { GuideFrom, LineMode } from '~/utils/sheetLine'
import { type Overlay, overlayChoices, overlayInForce, overlayLabel } from '~/utils/overlay'
import { type Spell, spellLabel, SPELLS } from '~/utils/scaleChoices'
import type { SheetKind } from '~/utils/sheets'
import type { FunctionalComponent } from 'vue'
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/16/solid'
import ControlsDialog from './ControlsDialog.vue'

/** the preview toolbar, in labelled groups: Work on (sheet), Instrument, #level, Show (on the Changes: Analysis, Guide Tones), Transposition (+ #transpose), in the rail, with #actions at its right */
const sheet = defineModel<SheetKind>('sheet', { required: true })
const instrument = defineModel<InstrumentName>('instrument', { required: true })
const spell = defineModel<Spell>('spell', { required: true })
const intervals = defineModel<boolean>('intervals', { required: true })
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })
const overlay = defineModel<Overlay>('overlay', { default: 'off' })
const pentRung = defineModel<number>('pentRung', { default: 0 })
const pentSide = defineModel<PentatonicSide>('pentSide', { default: 'flat' })
const pentBasis = defineModel<PentatonicBasis>('pentBasis', { default: 'key' })
const pentRank = defineModel<number>('pentRank', { default: 1 })
const pentPath = defineModel<PentatonicPathName>('pentPath', { default: 'one' })
const pathChoices = computed(() => PENT_PATHS.filter((p) => p.value !== 'custom' || pentPath.value === 'custom'))
const pentStepUnit = defineModel<PentatonicStepUnit>('pentStepUnit', { default: 'section' })
const pentStepBars = defineModel<2 | 4 | 8>('pentStepBars', { default: 4 })
/** SegmentedControl's values are strings */
const pentStepBarsText = computed({ get: () => String(pentStepBars.value) as '2' | '4' | '8', set: (v) => (pentStepBars.value = Number(v) as 2 | 4 | 8) })
const overlayFlags = { pentatonics: useFeature('pentatonics'), hexatonics: useFeature('hexatonics') }
const overlayOptions = overlayChoices(overlayFlags)
/** the overlay in force: one whose flag is off reads Off */
const overlayModel = computed({ get: () => overlayInForce(overlay.value, overlayFlags), set: (v: Overlay) => (overlay.value = v) })
const { shows } = useInterface()
/** what this Interface level shows (#273): Numerals and Scales (hidden while editing too), the Overlay (with either overlay's flag on) */
const analysisShown = computed(() => !props.lockLabels && shows('analysis'))
const overlayShown = computed(() => overlayOptions.length > 1 && shows('pentatonics'))
const lineMode = defineModel<LineMode>('lineMode', { default: 'off' })
const guideLine = defineModel<GuideFrom>('guideLine', { default: 'third' })
const arpeggio = defineModel<ArpeggioPattern>('arpeggio', { default: 'up-root' })
const arpNotes = defineModel<ArpNotes>('arpNotes', { default: 'seventh' })
const arpDir = defineModel<ArpDirection>('arpDir', { default: 'up' })
/** the sheet editor is open: numerals and scales are shown (they are the pickers), their toggles hide */
/** keyStart: the chart's key, written for the instrument (what "From key" starts on) */
/** compact: a phone with compactRail on: the rail keeps Work on, Instrument and the slot's rail actions; Controls opens the rest */
/** stickyRail: the rail sticks over the sheet (lg up): while editing */
const props = defineProps<{ lockLabels?: boolean; keyStart: string; compact?: boolean; stickyRail?: boolean }>()
defineSlots<{ level?: () => unknown; transpose?: () => unknown; actions?: (p: { place: 'rail' | 'dialog'; after: (run: () => void) => void }) => unknown }>()
const controlsOpen = ref(false)
watch(() => props.compact, () => (controlsOpen.value = false))
/** an action chosen in the dialog runs once it has closed (Headless UI then returns focus to Controls first); in the rail, now */
let pending: (() => void) | null = null
const afterClose = (run: () => void): void => void (pending = run)
const now = (run: () => void): void => run()
function runAfterClose(): void {
  const run = pending
  pending = null
  run?.()
} // across md the groups move: don't reopen it later by itself
/** the groups' wrapper in the rail: none */
const Passthrough: FunctionalComponent = (_, { slots }) => slots.default?.()

const changes = useFeature('changes')
const arpeggios = useFeature('arpeggios')
const sheets = computed(() => SHEETS.filter((s) => (s.value !== 'changes' || changes) && (s.value !== 'arpeggios' || arpeggios)))
const arpNoteOptions = ARP_NOTES.map((value) => ({ value, label: ARP_NOTES_LABELS[value] }))
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

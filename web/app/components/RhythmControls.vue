<template>
  <!-- popover: on the rail (the Scales and Arpeggios sheets' Rhythm group), the listbox with its detail behind Rhythm options, so the group is one control tall; stacked under it in the Controls dialog (inline) -->
  <!-- else (Line options): the listbox and its detail under it, in the parent's column -->
  <component :is="popover ? 'div' : Passthrough" v-bind="popover ? { class: inline ? 'flex flex-col gap-2' : 'flex items-center gap-1' } : {}">
    <UiListbox v-model="rhythmFamily" :class="popover && !inline ? 'w-56' : 'w-full'" aria-label="Rhythm" :aria-describedby="describedby">
      <template #selected="{ value }"><UiListboxLabel>Rhythm: {{ familyLabel(value) }}</UiListboxLabel></template>
      <UiListboxOption value="off"><UiListboxLabel>Off</UiListboxLabel></UiListboxOption>
      <UiListboxGroup v-for="g in RHYTHM_FAMILIES" :key="g.label" :label="g.label">
        <UiListboxOption v-for="f in g.options" :key="f" :value="f"><UiListboxLabel>{{ familyLabel(f) }}</UiListboxLabel></UiListboxOption>
      </UiListboxGroup>
      <UiListboxOption value="custom"><UiListboxLabel>{{ familyLabel('custom') }}</UiListboxLabel></UiListboxOption>
    </UiListbox>
    <!-- on the rail, a fixed slot for its button, there or not, so choosing a rhythm never rewraps the rail -->
    <component :is="popover ? 'div' : Passthrough" v-bind="popover ? { class: inline ? 'contents' : 'flex size-9 items-center justify-center' } : {}">
      <component :is="popover ? RailPopover : Passthrough" v-if="!popover || hasDetail" v-bind="popover ? { open: optionsOpen, 'onUpdate:open': setOptionsOpen, inline, label: 'Rhythm options' } : {}">
        <component :is="popover ? 'div' : Passthrough" v-bind="popover ? { class: inline ? 'flex w-full flex-col gap-2' : 'flex w-64 flex-col gap-2' } : {}">
          <EaseReveal :show="parsedRhythm?.kind === 'unit'" inner-class="flex flex-col gap-2">
            <template v-if="parsedRhythm?.kind === 'unit'">
              <UiListbox :model-value="parsedRhythm.group" class="w-full" aria-label="In" title="The unit's length in pulses, repeated across the barlines (after Saindon)" @update:model-value="(g) => g !== undefined && setUnit({ group: g })">
                <template #selected="{ value }"><UiListboxLabel>In {{ value }}</UiListboxLabel></template>
                <UiListboxOption v-for="g in UNIT_GROUPS" :key="g" :value="g"><UiListboxLabel>In {{ g }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
              <UiListbox :model-value="parsedRhythm.variation" class="w-full" aria-label="Variation" @update:model-value="(v) => v !== undefined && setUnit({ variation: v })">
                <template #selected="{ value }"><UiListboxLabel>{{ VARIATION_LABELS[value] }}</UiListboxLabel></template>
                <UiListboxOption v-for="v in VARIATIONS" :key="v" :value="v"><UiListboxLabel>{{ VARIATION_LABELS[v] }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
            </template>
          </EaseReveal>
          <EaseReveal :show="parsedRhythm?.kind === 'run'" inner-class="flex flex-col gap-2">
            <template v-if="parsedRhythm?.kind === 'run'">
              <UiListbox :model-value="parsedRhythm.attacks" class="w-full" aria-label="Attacks" title="How many notes in a row each bar plays" @update:model-value="(n) => n !== undefined && setRun({ attacks: n })">
                <template #selected="{ value }"><UiListboxLabel>{{ value }} attacks</UiListboxLabel></template>
                <UiListboxOption v-for="n in RUN_ATTACKS" :key="n" :value="n"><UiListboxLabel>{{ n }} attacks</UiListboxLabel></UiListboxOption>
              </UiListbox>
              <UiListbox :model-value="parsedRhythm.from" class="w-full" aria-label="From" title="Where in each bar the run starts" @update:model-value="(k) => k !== undefined && setRun({ from: k })">
                <template #selected="{ value }"><UiListboxLabel>From {{ positionLabel(parsedRhythm.pulse, value) }}</UiListboxLabel></template>
                <UiListboxOption v-for="k in runPositions(parsedRhythm.pulse)" :key="k" :value="k"><UiListboxLabel>From {{ positionLabel(parsedRhythm.pulse, k) }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
            </template>
          </EaseReveal>
          <EaseReveal :show="rhythmFamily === 'custom'" inner-class="flex flex-col gap-2">
            <UiInput v-model="rhythmText" aria-label="Your rhythm" placeholder="8: >xx.x_" :invalid="!!rhythmError" :aria-describedby="rhythmError ? 'rhythm-error' : undefined" />
            <p v-if="rhythmError" id="rhythm-error" class="text-sm/5 text-red-700 dark:text-red-400">{{ rhythmError }}</p>
          </EaseReveal>
        </component>
      </component>
    </component>
  </component>
</template>

<script setup lang="ts">
import { formatRhythm, LIBRARY_IDS, parseRhythm, parseRhythmId, positionLabel, type Pulse, PULSE_LABELS, type Rhythm, type RhythmId, rhythmLabel, RUN_ATTACKS, runPositions, UNIT_GROUPS, unitRhythm, type Variation, VARIATION_LABELS, VARIATIONS } from '@chord-scale-maker/engine'
import type { FunctionalComponent } from 'vue'
import { rhythmTextError } from '~/utils/rhythmText'
import RailPopover from './RailPopover.vue'

/**
 * the Rhythm (rhythm spec §9; rhythm-scales-arpeggios spec §9): a unit, a run, a card or your own, and its detail
 * (In and Variation, Attacks and From, the text). describedby: the listbox's help; popover: the detail behind a
 * Rhythm options button (the rail), shown only for a rhythm with detail; inline: that popover stacked (the Controls dialog)
 */
defineProps<{ describedby?: string; popover?: boolean; inline?: boolean }>()
const rhythm = defineModel<RhythmId>({ default: 'off' })
const { shows } = useInterface()
const optionsOpen = ref(false)
const setOptionsOpen = (open: boolean): void => void (optionsOpen.value = open)
/** a wrapper that renders only its content: in Line options, no rail slot or popover */
const Passthrough: FunctionalComponent = (_, { slots }) => slots.default?.()

const DEFAULT_GROUP = 3 // a new unit: 3 against the 4/4 bar
const DEFAULT_ATTACKS = 4 // a new run
/** the Rhythm listbox's value: off, a unit or a run by its pulse, a card's id, or custom */
type RhythmFamily = 'off' | `unit:${Pulse}` | `run:${Pulse}` | `card:${string}` | 'custom'
const familyOf = (id: RhythmId): RhythmFamily => {
  const p = parseRhythmId(id)
  if (!p) return 'off'
  return p.kind === 'unit' || p.kind === 'run' ? `${p.kind}:${p.pulse}` : p.kind === 'card' ? `card:${p.card}` : 'custom'
}
/** the library's families, grouped as LIBRARY_IDS lists them: Units and Runs by pulse, then Cards */
const RHYTHM_FAMILIES = (['unit', 'run', 'card'] as const).map((kind) => ({
  label: ({ unit: 'Units', run: 'Runs', card: 'Cards' } as const)[kind],
  options: [...new Set(LIBRARY_IDS.filter((id) => id.startsWith(`${kind}:`)).map(familyOf))],
}))
const familyLabel = (f: RhythmFamily): string => {
  if (f === 'off') return 'Off'
  if (f === 'custom') return 'Your rhythm…'
  if (f.startsWith('card:')) return rhythmLabel(f as RhythmId)
  const [kind, pulse] = f.split(':') as ['unit' | 'run', Pulse]
  return kind === 'unit' ? PULSE_LABELS[pulse] : `Runs of ${PULSE_LABELS[pulse].toLowerCase()}`
}
const parsedRhythm = computed(() => parseRhythmId(rhythm.value))
/** Your rhythm… chosen: its text plays while it's valid, Off while it isn't */
const rhythmCustom = ref(parsedRhythm.value?.kind === 'custom')
const rhythmText = ref(parsedRhythm.value?.kind === 'custom' ? formatRhythm(parsedRhythm.value.rhythm) : '')
const customId = (r: Rhythm): RhythmId => `custom:${formatRhythm(r).replace(': ', ':')}`
const rhythmError = computed(() => rhythmTextError(rhythmText.value))
watch(rhythmText, (text) => {
  if (!rhythmCustom.value) return
  const r = parseRhythm(text)
  rhythm.value = r ? customId(r) : 'off'
})
// the stored rhythm changed from outside (a share link, a reset): the listbox follows
watch(rhythm, (id) => {
  const p = parsedRhythm.value
  const typed = parseRhythm(rhythmText.value)
  if (p?.kind === 'custom' && (!typed || formatRhythm(typed) !== formatRhythm(p.rhythm))) rhythmText.value = formatRhythm(p.rhythm) // not typed here: the box follows
  rhythmCustom.value = p?.kind === 'custom' || (id === 'off' && rhythmCustom.value && !parseRhythm(rhythmText.value)) // invalid text plays Off, still Your rhythm…
})
// a reset comes from the hidden-settings notice, with these controls hidden; it sets an Off rhythm to Off, which no
// watch sees, so text that doesn't read stops holding Your rhythm… once the controls hide: they come back on Off
watch(() => shows('rhythm'), (shown) => {
  if (!shown && rhythm.value === 'off') rhythmCustom.value = false
})
const rhythmFamily = computed<RhythmFamily>({
  get: () => (rhythmCustom.value ? 'custom' : familyOf(rhythm.value)),
  set: (f) => {
    const was = parsedRhythm.value
    rhythmCustom.value = f === 'custom'
    if (f === 'custom') {
      // start from the unit in force, as text to edit
      if (was?.kind === 'unit' && !rhythmText.value) rhythmText.value = formatRhythm(unitRhythm(was.pulse, was.group, was.variation))
      const r = parseRhythm(rhythmText.value)
      rhythm.value = r ? customId(r) : 'off'
    } else if (f === 'off' || f.startsWith('card:')) {
      rhythm.value = f as RhythmId
    } else {
      const [kind, pulse] = f.split(':') as ['unit' | 'run', Pulse]
      if (kind === 'unit') rhythm.value = `unit:${pulse}:${was?.kind === 'unit' ? was.group : DEFAULT_GROUP}:${was?.kind === 'unit' ? was.variation : 'accents'}`
      else rhythm.value = `run:${pulse}:${was?.kind === 'run' ? was.attacks : DEFAULT_ATTACKS}:${was?.kind === 'run' ? Math.min(was.from, runPositions(pulse).length - 1) : 0}`
    }
  },
})
function setUnit(change: Readonly<{ group?: number; variation?: Variation }>): void {
  const p = parsedRhythm.value
  if (p?.kind === 'unit') rhythm.value = `unit:${p.pulse}:${change.group ?? p.group}:${change.variation ?? p.variation}`
}
function setRun(change: Readonly<{ attacks?: number; from?: number }>): void {
  const p = parsedRhythm.value
  if (p?.kind === 'run') rhythm.value = `run:${p.pulse}:${change.attacks ?? p.attacks}:${change.from ?? p.from}`
}
/** the rhythm has detail to set: a unit's In and Variation, a run's Attacks and From, your rhythm's text (a card has none) */
const hasDetail = computed(() => rhythmFamily.value === 'custom' || parsedRhythm.value?.kind === 'unit' || parsedRhythm.value?.kind === 'run')
</script>

<template>
  <!-- popover: on the rail (the Scales and Arpeggios sheets' Rhythm group), the listbox with its detail behind Rhythm options, so the group is one control tall; stacked under it in the Controls dialog (inline) -->
  <!-- else (Line options): the listbox and its detail under it, in the parent's column -->
  <component :is="popover ? 'div' : Passthrough" v-bind="popover ? { class: inline ? 'flex flex-col gap-2' : 'flex items-center gap-1' } : {}">
    <UiListbox v-model="rhythmFamily" :class="popover && !inline ? 'w-56' : 'w-full'" aria-label="Rhythm" :aria-describedby="describedby">
      <template #selected="{ value }"><UiListboxLabel>Rhythm: {{ familyLabel(value) }}</UiListboxLabel></template>
      <UiListboxOption value="off"><UiListboxLabel>Off</UiListboxLabel></UiListboxOption>
      <UiListboxGroup v-for="g in rhythmFamilies" :key="g.label" :label="g.label">
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
          <!-- the paths (Phase 4 spec §7): Groups for a unit, Gears for a unit or your rhythm, and the Step while a path acts; on the Changes only (paths) -->
          <EaseReveal :show="pathsShown && parsedRhythm?.kind === 'unit'" inner-class="flex flex-col gap-2">
            <UiListbox v-model="groupsChoice" class="w-full" aria-label="Groups" title="Change the grouping at each step (Saindon's mixed phrasing)">
              <template #selected="{ value }"><UiListboxLabel>Groups: {{ GROUPS_LABELS[value] }}</UiListboxLabel></template>
              <UiListboxOption v-for="g in LIST_CHOICES" :key="g" :value="g"><UiListboxLabel>{{ GROUPS_LABELS[g] }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
            <EaseReveal :show="groupsChoice === 'custom'" inner-class="flex flex-col gap-2">
              <UiInput v-model="groupsText" aria-label="Your groups" placeholder="3 4 5" :invalid="!!groupsError" :aria-describedby="groupsError ? 'groups-error' : undefined" @blur="lists.groups.commit" @keydown.enter="lists.groups.commit" />
              <p v-if="groupsError" id="groups-error" class="text-sm/5 text-red-700 dark:text-red-400">{{ groupsError }}</p>
            </EaseReveal>
          </EaseReveal>
          <EaseReveal :show="pathsShown" inner-class="flex flex-col gap-2">
            <UiListbox v-model="gearsChoice" class="w-full" aria-label="Gears" title="Change the pulse at each step (after Bergonzi)">
              <template #selected="{ value }"><UiListboxLabel>Gears: {{ GEARS_LABELS[value] }}</UiListboxLabel></template>
              <UiListboxOption v-for="g in LIST_CHOICES" :key="g" :value="g"><UiListboxLabel>{{ GEARS_LABELS[g] }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
            <EaseReveal :show="gearsChoice === 'custom'" inner-class="flex flex-col gap-2">
              <UiInput v-model="gearsText" aria-label="Your gears" placeholder="8 8t 16" :invalid="!!gearsError" :aria-describedby="gearsError ? 'gears-error' : undefined" @blur="lists.gears.commit" @keydown.enter="lists.gears.commit" />
              <p v-if="gearsError" id="gears-error" class="text-sm/5 text-red-700 dark:text-red-400">{{ gearsError }}</p>
            </EaseReveal>
          </EaseReveal>
          <EaseReveal :show="pathsShown && pathActs" inner-class="flex flex-col gap-2">
            <UiListbox v-model="stepChoice" class="w-full" aria-label="Step" title="When the paths take their next step: at each section, each change of key area, or every few bars">
              <template #selected="{ value }"><UiListboxLabel>Step: {{ STEP_LABELS[value] }}</UiListboxLabel></template>
              <UiListboxOption v-for="s in STEP_CHOICES" :key="s" :value="s"><UiListboxLabel>{{ STEP_LABELS[s] }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
          </EaseReveal>
        </component>
      </component>
    </component>
  </component>
</template>

<script setup lang="ts">
import { formatRhythm, LIBRARY_IDS, parseRhythmId, PENTATONIC_STEP_BARS, positionLabel, type Pulse, PULSE_LABELS, RHYTHM_GEAR_PRESETS, RHYTHM_GROUP_PRESETS, RHYTHM_PATH_OFF, type RhythmId, rhythmLabel, type RhythmPath, rhythmPathCaption, type RhythmStep, RUN_ATTACKS, runPositions, stepLabel, UNIT_GROUPS, unitRhythm, type Variation, VARIATION_LABELS, VARIATIONS } from '@chord-scale-maker/engine'
import type { FunctionalComponent } from 'vue'
import { customRhythmId, RHYTHM_TEXT, useRhythmText } from '~/composables/useRhythmText'
import { LIST_CHOICES, type ListChoice, RHYTHM_PATH_LISTS, useRhythmPathLists } from '~/composables/useRhythmPathLists'
import { gearsTextError, groupsTextError, isGearsRhythm, rhythmTextError } from '~/utils/rhythmText'
import RailPopover from './RailPopover.vue'

/**
 * the Rhythm (rhythm spec §9; rhythm-scales-arpeggios spec §9): a unit, a run, a card or your own, and its detail
 * (In and Variation, Attacks and From, the text). describedby: the listbox's help; popover: the detail behind a
 * Rhythm options button (the rail), shown only for a rhythm with detail; inline: that popover stacked (the Controls dialog)
 */
const props = defineProps<{ describedby?: string; popover?: boolean; inline?: boolean; paths?: boolean }>()
const rhythm = defineModel<RhythmId>({ default: 'off' })
/** the chart's rhythm path (Phase 4 spec §3), set here with paths on (the Changes) */
const path = defineModel<RhythmPath>('path', { default: () => RHYTHM_PATH_OFF })
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
/**
 * the library's families, grouped as LIBRARY_IDS lists them: Units and Runs by pulse, then Cards; the tuplet pulses'
 * units with the rhythmGears flag on and at Everything only (Phase 4 spec §7, D22)
 */
const gearsOn = useFeature('rhythmGears')
const rhythmFamilies = computed(() => {
  const gears = gearsOn && shows('rhythm-gears')
  return (['unit', 'run', 'card'] as const).map((kind) => ({
    label: ({ unit: 'Units', run: 'Runs', card: 'Cards' } as const)[kind],
    options: [...new Set(LIBRARY_IDS.filter((id) => id.startsWith(`${kind}:`) && (gears || !isGearsRhythm(id))).map(familyOf))],
  }))
})
const familyLabel = (f: RhythmFamily): string => {
  if (f === 'off') return 'Off'
  if (f === 'custom') return 'Your rhythm…'
  if (f.startsWith('card:')) return rhythmLabel(f as RhythmId)
  const [kind, pulse] = f.split(':') as ['unit' | 'run', Pulse]
  return kind === 'unit' ? PULSE_LABELS[pulse] : `Runs of ${PULSE_LABELS[pulse].toLowerCase()}`
}
const parsedRhythm = computed(() => parseRhythmId(rhythm.value))
/** Your rhythm…: chosen, and its text; the owner's (PreviewControls), so text that doesn't read survives the panel closing */
const { custom: rhythmCustom, text: rhythmText } = inject(RHYTHM_TEXT, () => useRhythmText(rhythm, () => shows('rhythm'), () => shows('rhythm-gears')), true)
const tupletsTyped = computed(() => gearsOn && shows('rhythm-gears')) // typed tuplet pulses: Everything only, as the listbox families (Phase 4 spec D22)
const rhythmError = computed(() => rhythmTextError(rhythmText.value, tupletsTyped.value))
const rhythmFamily = computed<RhythmFamily>({
  get: () => (rhythmCustom.value ? 'custom' : familyOf(rhythm.value)),
  set: (f) => {
    const was = parsedRhythm.value
    rhythmCustom.value = f === 'custom'
    if (f === 'custom') {
      // start from the unit in force, as text to edit
      if (was?.kind === 'unit' && !rhythmText.value) rhythmText.value = formatRhythm(unitRhythm(was.pulse, was.group, was.variation))
      rhythm.value = customRhythmId(rhythmText.value, tupletsTyped.value)
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

/**
 * the paths (Phase 4 spec §3, §7, D12, D13): Groups on a unit, Gears on a unit or your rhythm, and the Step while a
 * path acts on the rhythm, on the Changes only (paths), with the rhythmGears flag on and at Everything (D22)
 */
const pathsShown = computed(() => !!props.paths && gearsOn && shows('rhythm-gears') && (parsedRhythm.value?.kind === 'unit' || parsedRhythm.value?.kind === 'custom'))
const pathActs = computed(() => rhythmPathCaption(rhythm.value, path.value) !== null)
/** a preset names its list, as spec §3 does: "Up (3 4 5 6 7)", "Up the gears (4t 8 8t 16 16t)" (#553) */
const withList = (name: string, list: readonly unknown[]): string => `${name} (${list.join(' ')})`
const GROUPS_LABELS: Readonly<Record<ListChoice, string>> = { one: 'One', up: withList('Up', RHYTHM_GROUP_PRESETS.up), down: withList('Down', RHYTHM_GROUP_PRESETS.down), custom: 'Your list…' }
const GEARS_LABELS: Readonly<Record<ListChoice, string>> = { one: 'One', up: withList('Up the gears', RHYTHM_GEAR_PRESETS.up), down: withList('Down the gears', RHYTHM_GEAR_PRESETS.down), custom: 'Your list…' }
/** Groups' and Gears' choices and Your list… text: the owner's (PreviewControls), so text that doesn't read survives the panel closing */
const lists = inject(RHYTHM_PATH_LISTS, () => useRhythmPathLists(path), true)
const { choice: groupsChoice, text: groupsText } = lists.groups
const groupsError = computed(() => groupsTextError(groupsText.value))
const { choice: gearsChoice, text: gearsText } = lists.gears
const gearsError = computed(() => gearsTextError(gearsText.value))
type StepChoice = 'section' | 'key-area' | `bars:${(typeof PENTATONIC_STEP_BARS)[number]}`
const STEP_CHOICES: readonly StepChoice[] = ['section', 'key-area', ...PENTATONIC_STEP_BARS.map((n) => `bars:${n}` as const)]
const stepOf = (c: StepChoice): RhythmStep => (c.startsWith('bars:') ? { unit: 'bars', bars: Number(c.slice(5)) as RhythmStep['bars'] } : { unit: c as RhythmStep['unit'], bars: path.value.step.bars })
const STEP_LABELS = Object.fromEntries(STEP_CHOICES.map((c) => [c, stepLabel(stepOf(c)).replace(/^./, (x) => x.toUpperCase())])) as Readonly<Record<StepChoice, string>>
const stepChoice = computed<StepChoice>({
  get: (): StepChoice => {
    const { unit, bars } = path.value.step
    return unit === 'bars' ? `bars:${bars}` : unit
  },
  set: (c) => void (path.value = { ...path.value, step: stepOf(c) }),
})

/** the rhythm has detail to set: a unit's In and Variation, a run's Attacks and From, your rhythm's text (a card has none) */
const hasDetail = computed(() => rhythmFamily.value === 'custom' || parsedRhythm.value?.kind === 'unit' || parsedRhythm.value?.kind === 'run')
</script>

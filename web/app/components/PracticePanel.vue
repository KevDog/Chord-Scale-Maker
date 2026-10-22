<template>
  <fieldset class="space-y-3 rounded-xl border border-zinc-950/10 p-4 dark:border-white/10">
    <legend class="flex items-center gap-3 px-1">
      <span class="font-display text-base/7 font-semibold text-zinc-950 dark:text-white">Practice</span>
      <!-- the explanation stays folded so the sheet starts near the top (#463) -->
      <button
        type="button"
        data-slot="practice-help-toggle"
        :aria-expanded="helpOpen"
        :aria-controls="helpId"
        class="inline-flex items-center gap-1 rounded-md text-sm/6 text-zinc-600 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden dark:text-zinc-400 dark:hover:text-white"
        @click="helpOpen = !helpOpen"
      >
        How it works<ChevronDownIcon class="size-4 transition-transform" :class="helpOpen && 'rotate-180'" aria-hidden="true" />
      </button>
    </legend>
    <EaseReveal :id="helpId" :show="helpOpen" class="-mt-1 print:hidden"><UiText>
      Pick the notes to improvise with; the rest are dimmed, on screen and in print.
      {{ mode === 'root' ? 'Boxes are intervals from each chord’s root, even when its scale starts elsewhere: over B♭–7, B♭ is 1.' : `Boxes are pitches spelled from ${startName}.` }}
      <template v-if="pentatonicShown"> Pentatonic lights the minor pentatonic <em>Built on</em> a degree of each chord (Auto: the one sharing the most): the notes its scale shares, and its others added in a second colour; each staff’s caption says how many it shares. {{ PENT_INSIDE_HELP }} <DecisionLink id="pent.auto">How Auto picks a pentatonic</DecisionLink>.</template>
      <template v-if="quartalShown"> Quartal lights a stack of fourths from each scale: its notes three steps apart, from the degree it's <em>Built on</em> (Auto: <DecisionLink id="quartal.auto">the one that holds the guide tones</DecisionLink>), three or four notes, with at most one augmented fourth unless <em>Perfect only</em>.</template>
      <template v-if="hexatonicShown"> Hexatonic lights two triads from each scale, six notes in two groups. Pair <em>n</em> is the triads on degrees <em>n</em> and <em>n</em> + 1 of each staff’s scale; on a seven-note scale it leaves out degree <em>n</em> − 1 (Pair 1 leaves out the 7th). Ranked against <em>Key</em>, each staff lights its key area’s IV and V triads where its scale holds them (<DecisionLink id="hex.key">pairs by key area</DecisionLink>). <DecisionLink id="hex.auto">How Auto picks a pair</DecisionLink>.</template>
    </UiText></EaseReveal>

    <!-- the presets come and go with the Interface level: the rest slide over (#297) -->
    <TransitionGroup name="ease-pop" tag="div" class="relative flex flex-wrap items-center gap-2">
      <ToggleButton v-for="p in presets" :key="p" :model-value="activePreset === p" @update:model-value="pickPreset(p)">{{ PRESET_LABELS[p] }}</ToggleButton>
      <UiButton key="clear" plain :disabled="!selection" @click="emit('update:selection', null)">Clear</UiButton>
    </TransitionGroup>
    <EaseReveal :show="!!pent" inner-class="flex flex-wrap items-center gap-2">
      <template v-if="pent">
        <UiListbox :model-value="pent.degree" class="w-44" aria-label="Pentatonic built on" @update:model-value="pickDegree">
          <template #selected="{ value }"><UiListboxLabel>Built on: {{ degreeLabel(value) }}</UiListboxLabel></template>
          <UiListboxOption v-for="d in PENT_DEGREE_CHOICES" :key="d" :value="d"><UiListboxLabel>{{ degreeLabel(d) }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
        <ul data-slot="pent-legend" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/5 text-zinc-600 dark:text-zinc-400" aria-label="Notes">
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-zinc-900 dark:bg-note-300" />In the scale</li>
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-second" />Outside the scale</li>
        </ul>
      </template>
    </EaseReveal>
    <EaseReveal :show="!!hex" inner-class="flex flex-wrap items-center gap-2">
      <template v-if="hex">
        <SegmentedControl :model-value="hex.basis ?? 'chord'" legend="Ranked against" name="practice-hex-basis" aria-label="Hexatonics ranked against" :options="HEX_BASES" @update:model-value="pickHex({ basis: $event })" />
        <UiListbox v-if="hex.basis !== 'key'" :model-value="hex.pair" class="w-36" aria-label="Hexatonic pair" @update:model-value="pickHex({ pair: $event })">
          <template #selected="{ value }"><UiListboxLabel>Pair: {{ hexPairLabel(value) }}</UiListboxLabel></template>
          <UiListboxOption v-for="p in HEX_PAIR_CHOICES" :key="p" :value="p"><UiListboxLabel>{{ hexPairLabel(p) }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
        <UiListbox :model-value="hex.grouping" class="w-52" aria-label="Hexatonic grouping" @update:model-value="pickHex({ grouping: $event })">
          <template #selected="{ value }"><UiListboxLabel>{{ groupingLabel(value) }}</UiListboxLabel></template>
          <UiListboxOption v-for="g in HEX_GROUPING_CHOICES" :key="g.value" :value="g.value"><UiListboxLabel>{{ g.label }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
        <ul data-slot="hex-legend" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/5 text-zinc-600 dark:text-zinc-400" aria-label="Groups">
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-zinc-900 dark:bg-note-300" />{{ HEX_GROUP_NAMES[hex.grouping][0] }}</li>
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-second" />{{ HEX_GROUP_NAMES[hex.grouping][1] }}</li>
        </ul>
      </template>
    </EaseReveal>

    <EaseReveal :show="!!quartal" inner-class="flex flex-wrap items-center gap-2">
      <template v-if="quartal">
        <UiListbox :model-value="quartal.degree" class="w-40" aria-label="Quartal built on" @update:model-value="pickQuartal({ degree: $event })">
          <template #selected="{ value }"><UiListboxLabel>Built on: {{ quartalDegreeLabel(value) }}</UiListboxLabel></template>
          <UiListboxOption v-for="d in QUARTAL_DEGREE_CHOICES" :key="d" :value="d"><UiListboxLabel>{{ quartalDegreeLabel(d) }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
        <SegmentedControl :model-value="quartalNotes" legend="Notes" name="practice-quartal-notes" aria-label="Quartal notes" :options="QUARTAL_NOTE_CHOICES" @update:model-value="pickQuartal({ notes: Number($event) as QuartalNotes })" />
        <ToggleButton :model-value="!!quartal.perfect" title="Perfect fourths only: no augmented fourth in a stack" @update:model-value="pickQuartal({ perfect: $event })">Perfect only</ToggleButton>
      </template>
    </EaseReveal>

    <EaseReveal :show="perStaff"><UiText>Click a box to start a custom pick from these notes.</UiText></EaseReveal>
    <div role="group" aria-label="Notes to practise" class="flex flex-wrap gap-1.5">
      <label
        v-for="b in boxes"
        :key="b.key"
        class="relative inline-flex h-9 min-w-11 cursor-default items-center justify-center rounded-lg bg-white px-2.5 text-sm/5 font-semibold text-zinc-950 ring-1 ring-zinc-950/10 ring-inset hover:bg-zinc-50 has-checked:bg-note-100 has-checked:text-note-800 has-checked:ring-note-500 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 dark:has-checked:bg-note-300/15 dark:has-checked:text-note-200 dark:has-checked:ring-note-300"
      >
        <input type="checkbox" class="sr-only" :checked="!perStaff && checked.has(b.key)" @change="toggle(b.key)">{{ b.label }}
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/16/solid'
import { groupingLabel, HEX_BASES, HEX_GROUP_NAMES, HEX_GROUPING_CHOICES, HEX_PAIR_CHOICES, hexPairLabel } from '~/utils/hexatonics'
import { degreeLabel, PENT_DEGREE_CHOICES, PENT_INSIDE_HELP } from '~/utils/pentatonics'
import { QUARTAL_DEGREE_CHOICES, QUARTAL_NOTE_CHOICES, quartalDegreeLabel } from '~/utils/quartal'
import { compareKeys, type HexatonicBasis, type HexGrouping, isHexatonicSelection, isPentatonicSelection, isQuartalSelection, type QuartalDegree, type QuartalNotes, type Mode, noteText, type PentatonicDegree, type PracticeBox, type PracticeSelection, type Preset, PRESET_LABELS, PRESETS } from '@chord-scale-maker/engine'

/**
 * the practice controls: per-chord presets (From root) or All (From X), a box per spelled interval or pitch in the
 * chart, and Clear. A Pentatonic preset with a Built on picker (#266, #286), and
 * a Hexatonic preset with Pair and grouping pickers and a legend of its two groups. Editing a box while a preset is active starts a custom selection from what the preset lit.
 */
const props = defineProps<{
  mode: Mode
  startText: string
  boxes: readonly PracticeBox[]
  selection: PracticeSelection | null
  lit: readonly string[] // the keys the current selection lights somewhere in the chart
}>()
const emit = defineEmits<{ 'update:selection': [selection: PracticeSelection | null] }>()

const activePreset = computed(() => (props.selection && 'preset' in props.selection ? props.selection.preset : null))
const checked = computed(() => new Set(props.selection && 'keys' in props.selection ? props.selection.keys : props.lit))
/** the Pentatonic or Hexatonic selection, for its pickers (null: another) */
const pent = computed(() => (isPentatonicSelection(props.selection) ? props.selection : null))
const hex = computed(() => (isHexatonicSelection(props.selection) ? props.selection : null))
const quartal = computed(() => (isQuartalSelection(props.selection) ? props.selection : null))
/** the Notes control's value: SegmentedControl's values are strings */
const quartalNotes = computed(() => String(quartal.value?.notes ?? 4) as '3' | '4')
/** Pentatonic and Hexatonic light different degrees on each staff, so one row of boxes can't show them: none pressed (#308) */
const perStaff = computed(() => !!pent.value || !!hex.value || !!quartal.value)
const startName = computed(() => noteText(props.startText))
const helpOpen = ref(false)
const helpId = useId()

const { shows } = useInterface()
/** the Pentatonic and Hexatonic presets: from Everything */
const pentatonicShown = computed(() => shows('practice-pentatonic'))
const hexatonicShown = computed(() => shows('practice-hexatonic'))
const quartalShown = computed(() => shows('practice-quartal'))
const presets = computed(() => PRESETS[props.mode].filter((p) => (p !== 'pentatonic' || pentatonicShown.value) && (p !== 'hexatonic' || hexatonicShown.value) && (p !== 'quartal' || quartalShown.value)))

function pickPreset(p: Preset): void {
  if (activePreset.value === p) emit('update:selection', null)
  else if (p === 'pentatonic') emit('update:selection', { preset: 'pentatonic', degree: 'auto' })
  else if (p === 'hexatonic') emit('update:selection', { preset: 'hexatonic', pair: 0, grouping: 'triads' })
  else if (p === 'quartal') emit('update:selection', { preset: 'quartal', degree: 'auto', notes: 4 })
  else emit('update:selection', { preset: p })
}

function pickDegree(degree: PentatonicDegree | undefined): void {
  if (degree !== undefined) emit('update:selection', { preset: 'pentatonic', degree })
}

function pickHex(change: Readonly<{ pair?: number; grouping?: HexGrouping; basis?: HexatonicBasis }>): void {
  const s = props.selection
  if (!isHexatonicSelection(s) || Object.values(change).some((v) => v === undefined)) return
  const basis = (change.basis ?? s.basis) === 'key' ? { basis: 'key' as const } : {}
  emit('update:selection', { preset: 'hexatonic', pair: change.pair ?? s.pair, grouping: change.grouping ?? s.grouping, ...basis })
}

function pickQuartal(change: Readonly<{ degree?: QuartalDegree; notes?: QuartalNotes; perfect?: boolean }>): void {
  const s = props.selection
  if (!isQuartalSelection(s) || Object.values(change).some((v) => v === undefined)) return
  const perfect = (change.perfect ?? !!s.perfect) ? { perfect: true as const } : {}
  emit('update:selection', { preset: 'quartal', degree: change.degree ?? s.degree, notes: change.notes ?? s.notes, ...perfect })
}

function toggle(key: string): void {
  const next = new Set(checked.value)
  if (perStaff.value) next.add(key) // it showed unpressed: pressing it starts the custom pick with it on
  else if (next.has(key)) next.delete(key)
  else next.add(key)
  emit('update:selection', next.size ? { keys: [...next].sort(compareKeys) } : null)
}
</script>

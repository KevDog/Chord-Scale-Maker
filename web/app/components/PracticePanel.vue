<template>
  <fieldset class="space-y-3 rounded-xl border border-zinc-950/10 p-4 dark:border-white/10">
    <legend class="px-1 font-display text-base/7 font-semibold text-zinc-950 dark:text-white">Practice</legend>
    <UiText class="-mt-1">
      Pick the notes to improvise with; the rest are dimmed, on screen and in print.
      {{ mode === 'root' ? 'Boxes are intervals from each chord’s root, even when its scale starts elsewhere: over B♭–7, B♭ is 1.' : `Boxes are pitches spelled from ${startName}.` }}
      <template v-if="pentatonicShown"> Pentatonic lights the notes each scale shares with the minor pentatonic <em>Built on</em> a degree of each chord (Auto: the one sharing the most); each staff’s caption says how many it shares. {{ PENT_INSIDE_HELP }}</template>
      <template v-if="hexatonicShown"> Hexatonic lights two triads from each scale, six notes in two groups. Pair <em>n</em> is the triads on degrees <em>n</em> and <em>n</em> + 1 of each staff’s scale; on a seven-note scale it leaves out degree <em>n</em> − 1 (Pair 1 leaves out the 7th).</template>
    </UiText>

    <div class="flex flex-wrap items-center gap-2">
      <ToggleButton v-for="p in presets" :key="p" :model-value="activePreset === p" @update:model-value="pickPreset(p)">{{ PRESET_LABELS[p] }}</ToggleButton>
      <UiButton plain :disabled="!selection" @click="emit('update:selection', null)">Clear</UiButton>
    </div>
    <UiListbox v-if="isPentatonicSelection(selection)" :model-value="selection.degree" class="w-44" aria-label="Pentatonic built on" @update:model-value="pickDegree">
      <template #selected="{ value }"><UiListboxLabel>Built on: {{ degreeLabel(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="d in PENT_DEGREE_CHOICES" :key="d" :value="d"><UiListboxLabel>{{ degreeLabel(d) }}</UiListboxLabel></UiListboxOption>
    </UiListbox>
    <div v-if="isHexatonicSelection(selection)" class="flex flex-wrap items-center gap-2">
      <UiListbox :model-value="selection.pair" class="w-36" aria-label="Hexatonic pair" @update:model-value="pickHex({ pair: $event })">
        <template #selected="{ value }"><UiListboxLabel>Pair: {{ hexPairLabel(value) }}</UiListboxLabel></template>
        <UiListboxOption v-for="p in HEX_PAIR_CHOICES" :key="p" :value="p"><UiListboxLabel>{{ hexPairLabel(p) }}</UiListboxLabel></UiListboxOption>
      </UiListbox>
      <UiListbox :model-value="selection.grouping" class="w-52" aria-label="Hexatonic grouping" @update:model-value="pickHex({ grouping: $event })">
        <template #selected="{ value }"><UiListboxLabel>{{ groupingLabel(value) }}</UiListboxLabel></template>
        <UiListboxOption v-for="g in HEX_GROUPING_CHOICES" :key="g.value" :value="g.value"><UiListboxLabel>{{ g.label }}</UiListboxLabel></UiListboxOption>
      </UiListbox>
      <ul data-slot="hex-legend" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/5 text-zinc-600 dark:text-zinc-400" aria-label="Groups">
        <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-zinc-900 dark:bg-note-300" />{{ HEX_GROUP_NAMES[selection.grouping][0] }}</li>
        <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="size-2.5 rounded-full bg-second" />{{ HEX_GROUP_NAMES[selection.grouping][1] }}</li>
      </ul>
    </div>

    <div role="group" aria-label="Notes to practise" class="flex flex-wrap gap-1.5">
      <label
        v-for="b in boxes"
        :key="b.key"
        class="relative inline-flex h-9 min-w-11 cursor-default items-center justify-center rounded-lg bg-white px-2.5 text-sm/5 font-semibold text-zinc-950 ring-1 ring-zinc-950/10 ring-inset hover:bg-zinc-50 has-checked:bg-note-100 has-checked:text-note-800 has-checked:ring-note-500 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 dark:has-checked:bg-note-300/15 dark:has-checked:text-note-200 dark:has-checked:ring-note-300"
      >
        <input type="checkbox" class="sr-only" :checked="checked.has(b.key)" @change="toggle(b.key)">{{ b.label }}
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { groupingLabel, HEX_GROUP_NAMES, HEX_GROUPING_CHOICES, HEX_PAIR_CHOICES, hexPairLabel } from '~/utils/hexatonics'
import { degreeLabel, PENT_DEGREE_CHOICES, PENT_INSIDE_HELP } from '~/utils/pentatonics'
import { compareKeys, type HexGrouping, isHexatonicSelection, isPentatonicSelection, type Mode, noteText, type PentatonicDegree, type PracticeBox, type PracticeSelection, type Preset, PRESET_LABELS, PRESETS } from '@chord-scale-maker/engine'

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
const startName = computed(() => noteText(props.startText))

const { shows } = useInterface()
/** the Pentatonic and Hexatonic presets: from Everything */
const pentatonicShown = computed(() => shows('practice-pentatonic'))
const hexatonicShown = computed(() => shows('practice-hexatonic'))
const presets = computed(() => PRESETS[props.mode].filter((p) => (p !== 'pentatonic' || pentatonicShown.value) && (p !== 'hexatonic' || hexatonicShown.value)))

function pickPreset(p: Preset): void {
  if (activePreset.value === p) emit('update:selection', null)
  else if (p === 'pentatonic') emit('update:selection', { preset: 'pentatonic', degree: 'auto' })
  else if (p === 'hexatonic') emit('update:selection', { preset: 'hexatonic', pair: 0, grouping: 'triads' })
  else emit('update:selection', { preset: p })
}

function pickDegree(degree: PentatonicDegree | undefined): void {
  if (degree !== undefined) emit('update:selection', { preset: 'pentatonic', degree })
}

function pickHex(change: Readonly<{ pair?: number; grouping?: HexGrouping }>): void {
  const s = props.selection
  if (!isHexatonicSelection(s) || Object.values(change).some((v) => v === undefined)) return
  emit('update:selection', { preset: 'hexatonic', pair: change.pair ?? s.pair, grouping: change.grouping ?? s.grouping })
}

function toggle(key: string): void {
  const next = new Set(checked.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  emit('update:selection', next.size ? { keys: [...next].sort(compareKeys) } : null)
}
</script>

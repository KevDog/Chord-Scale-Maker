<template>
  <fieldset class="space-y-3 rounded-xl border border-zinc-950/10 p-4 dark:border-white/10">
    <legend class="px-1 font-display text-base/7 font-semibold text-zinc-950 dark:text-white">Practice</legend>
    <UiText class="-mt-1">
      Pick the notes to improvise with; the rest are dimmed, on screen and in print.
      {{ mode === 'root' ? 'Boxes are intervals from each chord’s root, even when its scale starts elsewhere: over B♭–7, B♭ is 1.' : `Boxes are pitches spelled from ${startName}.` }}
      <template v-if="pentatonicShown"> Pentatonic lights the notes each scale shares with a minor pentatonic: rank 1 the closest, 12 the farthest.</template>
    </UiText>

    <div class="flex flex-wrap items-center gap-2">
      <ToggleButton v-for="p in presets" :key="p" :model-value="activePreset === p" @update:model-value="pickPreset(p)">{{ PRESET_LABELS[p] }}</ToggleButton>
      <UiButton plain :disabled="!selection" @click="emit('update:selection', null)">Clear</UiButton>
    </div>
    <UiListbox v-if="isPentatonicSelection(selection)" :model-value="selection.rank" class="w-44" aria-label="Pentatonic rank" @update:model-value="pickRank">
      <template #selected="{ value }"><UiListboxLabel>{{ rankLabel(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="r in RANKS" :key="r" :value="r"><UiListboxLabel>{{ rankLabel(r) }}</UiListboxLabel></UiListboxOption>
    </UiListbox>

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
import { rankLabel } from '~/utils/pentatonics'
import { compareKeys, isPentatonicSelection, type Mode, noteText, PENTATONIC_RANKS, type PracticeBox, type PracticeSelection, type Preset, PRESET_LABELS, PRESETS } from '@chord-scale-maker/engine'

/**
 * the practice controls: per-chord presets (From root) or All (From X), a box per spelled interval or pitch in the
 * chart, and Clear. With the pentatonics flag, a Pentatonic preset with a rank picker (#266). Editing a box while a preset is active starts a custom selection from what the preset lit.
 */
const props = defineProps<{
  mode: Mode
  startText: string
  boxes: readonly PracticeBox[]
  selection: PracticeSelection | null
  lit: readonly string[] // the keys the current selection lights somewhere in the chart
  pentatonic?: boolean // the pentatonics flag: offer the Pentatonic preset (#266)
}>()
const emit = defineEmits<{ 'update:selection': [selection: PracticeSelection | null] }>()

const activePreset = computed(() => (props.selection && 'preset' in props.selection ? props.selection.preset : null))
const checked = computed(() => new Set(props.selection && 'keys' in props.selection ? props.selection.keys : props.lit))
const startName = computed(() => noteText(props.startText))

const { shows } = useInterface()
/** the Pentatonic preset: the flag, from Everything */
const pentatonicShown = computed(() => !!props.pentatonic && shows('practice-pentatonic'))
const presets = computed(() => PRESETS[props.mode].filter((p) => p !== 'hexatonic' && (p !== 'pentatonic' || pentatonicShown.value))) // Hexatonic: not offered yet
const RANKS = Array.from({ length: PENTATONIC_RANKS }, (_, i) => i + 1)

function pickPreset(p: Preset): void {
  if (activePreset.value === p) emit('update:selection', null)
  else if (p === 'pentatonic') emit('update:selection', { preset: 'pentatonic', rank: 1 })
  else if (p === 'hexatonic') emit('update:selection', { preset: 'hexatonic', pair: 0, grouping: 'triads' })
  else emit('update:selection', { preset: p })
}

function pickRank(rank: number | undefined): void {
  if (rank !== undefined) emit('update:selection', { preset: 'pentatonic', rank })
}

function toggle(key: string): void {
  const next = new Set(checked.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  emit('update:selection', next.size ? { keys: [...next].sort(compareKeys) } : null)
}
</script>

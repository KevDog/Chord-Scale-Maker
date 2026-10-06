<template>
  <fieldset class="space-y-3 rounded-xl border border-zinc-950/10 p-4 dark:border-white/10">
    <legend class="px-1 font-display text-base/7 font-semibold text-zinc-950 dark:text-white">Practice</legend>
    <UiText class="-mt-1">
      Pick the notes to improvise with; the rest are dimmed, on screen and in print.
      {{ mode === 'root' ? 'Boxes are intervals from each chord’s root, even when its scale starts elsewhere: over B♭–7, B♭ is 1.' : `Boxes are pitches spelled from ${startName}.` }}
    </UiText>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton
        v-for="p in PRESETS[mode]"
        :key="p"
        v-bind="activePreset === p ? { color: 'note' } : { outline: true }"
        :aria-pressed="activePreset === p"
        @click="pickPreset(p)"
      >
        {{ PRESET_LABELS[p] }}
      </UiButton>
      <UiButton plain :disabled="!selection" @click="emit('update:selection', null)">Clear</UiButton>
    </div>

    <div role="group" aria-label="Notes to practise" class="flex flex-wrap gap-1.5">
      <label
        v-for="b in boxes"
        :key="b.key"
        class="relative inline-flex h-9 min-w-11 cursor-default items-center justify-center rounded-lg bg-white px-2.5 text-sm/5 font-semibold text-zinc-950 ring-1 ring-zinc-950/10 ring-inset hover:bg-zinc-50 has-checked:bg-note-500 has-checked:text-white has-checked:ring-note-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-note-500 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 dark:has-checked:bg-note-300 dark:has-checked:text-zinc-950"
      >
        <input type="checkbox" class="sr-only" :checked="checked.has(b.key)" @change="toggle(b.key)">{{ b.label }}
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { compareKeys, type Mode, noteText, type PracticeBox, type PracticeSelection, type Preset, PRESET_LABELS, PRESETS } from '~~/engine'

/**
 * the practice controls: per-chord presets (From root) or All (From X), a box per spelled interval or pitch in the
 * chart, and Clear. Editing a box while a preset is active starts a custom selection from what the preset lit.
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

function pickPreset(p: Preset): void {
  emit('update:selection', activePreset.value === p ? null : { preset: p })
}

function toggle(key: string): void {
  const next = new Set(checked.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  emit('update:selection', next.size ? { keys: [...next].sort(compareKeys) } : null)
}
</script>

<template>
  <div class="mb-4 space-y-1 text-center">
    <input
      :value="shown('title')"
      type="text"
      aria-label="Title"
      placeholder="Title"
      autocomplete="off"
      spellcheck="false"
      :aria-invalid="errors.title ? 'true' : undefined"
      :title="errors.title ?? undefined"
      :class="[FIELD, 'font-display w-full text-2xl/8 font-bold tracking-tight text-zinc-950 dark:text-white', errors.title && BAD]"
      @input="edit('title', ($event.target as HTMLInputElement).value)"
    >
    <div class="flex items-baseline justify-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <input
        :value="shown('subtitle')"
        type="text"
        aria-label="Subtitle"
        placeholder="Subtitle"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="errors.subtitle ? 'true' : undefined"
        :title="errors.subtitle ?? undefined"
        :class="[FIELD, 'w-56 text-right', errors.subtitle && BAD]"
        @input="edit('subtitle', ($event.target as HTMLInputElement).value)"
      >
      <span aria-hidden="true">·</span>
      <select :value="meta.key" aria-label="Key" :class="[FIELD, 'cursor-pointer appearance-none pr-1', !isValidKey(meta.key) && BAD]" @change="emit('update:doc', setMeta(doc, 'key', ($event.target as HTMLSelectElement).value))">
        <option value="" disabled>Key</option>
        <option v-for="k in KEY_OPTIONS" :key="k" :value="k">{{ keyLabel(k) }}</option>
      </select>
    </div>
    <div class="flex justify-end">
      <input
        :value="shown('composer')"
        type="text"
        aria-label="Composer"
        placeholder="Composer"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="errors.composer ? 'true' : undefined"
        :title="errors.composer ?? undefined"
        :class="[FIELD, 'w-56 text-right text-sm text-zinc-600 italic dark:text-zinc-400', errors.composer && BAD]"
        @input="edit('composer', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <p v-if="!isValidKey(meta.key)" class="text-sm/6 text-red-600 dark:text-red-500">Pick the chart’s key</p>
    <p v-for="(e, k) in errors" :key="k" class="text-sm/6 text-red-600 dark:text-red-500">{{ e }}</p>
  </div>
</template>

<script setup lang="ts">
import { cellError, type ChartDoc, chartHeading, chartMeta, isValidKey, keyLabel, LIMITS, type MetaKey, setMeta } from '@chord-scale-maker/engine'
import { KEY_OPTIONS } from '~/utils/keyOptions'

/**
 * The chart's heading edited where it prints (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.5):
 * the title, subtitle, key and composer as fields laid out as the printed heading is, a dashed underline the one
 * hint they take typing. A value the chart can't hold stays in its field, flagged with why; the doc keeps the last
 * good one (as MetaInput does).
 */
const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

type Field = Extract<MetaKey, 'title' | 'subtitle' | 'composer'>
const FIELD = 'rounded-none border-0 border-b border-dashed border-note-400 bg-transparent px-1 placeholder:text-zinc-400 focus:border-note-600 focus:outline-none dark:border-note-500/60 dark:placeholder:text-zinc-500'
const BAD = 'border-red-500! text-red-700 dark:text-red-400'

const meta = computed(() => chartMeta(props.doc))
const heading = computed(() => chartHeading(props.doc))
const values = computed((): Record<Field, string> => ({ title: meta.value.title, subtitle: meta.value.subtitle, composer: heading.value.composer }))
/** a refused draft, kept in its field with why, until it is fixed or the heading changes underneath */
const drafts = ref<Partial<Record<Field, string>>>({})
const errors = computed((): Partial<Record<Field, string>> => {
  const out: Partial<Record<Field, string>> = {}
  for (const [k, v] of Object.entries(drafts.value) as [Field, string][]) {
    const bad = cellError(v, LIMITS.maxMeta, true)
    if (bad) out[k] = `“${v}” can’t go in the heading: ${bad}.`
  }
  return out
})
watch(values, () => (drafts.value = {}))
const shown = (k: Field): string => drafts.value[k] ?? values.value[k]
function edit(k: Field, v: string): void {
  if (cellError(v, LIMITS.maxMeta, true)) {
    drafts.value = { ...drafts.value, [k]: v }
    return
  }
  const { [k]: _, ...rest } = drafts.value
  drafts.value = rest
  emit('update:doc', setMeta(props.doc, k, v))
}
</script>

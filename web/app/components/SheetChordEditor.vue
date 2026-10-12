<template>
  <HDialog :open="!!target && !!row" class="relative z-50" @close="emit('close')">
    <div class="fixed inset-0 bg-zinc-950/25 dark:bg-zinc-950/50" aria-hidden="true" />
    <HDialogPanel class="fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline">
      <div class="space-y-6 overflow-y-auto p-5">
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <HDialogTitle class="text-sm/6 text-zinc-600 dark:text-zinc-400">{{ place }}</HDialogTitle>
            <UiBadge color="zinc" title="The chart is written and edited in concert pitch, whatever the instrument">Concert pitch</UiBadge>
          </div>
          <UiField>
            <UiLabel>Chord</UiLabel>
            <UiInput v-model="draft" :invalid="!!error" autocomplete="off" autocapitalize="off" spellcheck="false" @keydown.enter.prevent="apply" @change="apply" />
            <UiErrorMessage v-if="error">{{ error }}</UiErrorMessage>
          </UiField>
          <UiText v-if="repeatOf" role="note" class="text-sm/6!">{{ target?.section }} repeats {{ repeatOf }}: a change here changes {{ repeatOf }} and every repeat of it.</UiText>
          <p v-if="row && !known" role="note" class="rounded-lg bg-amber-500/10 p-3 text-sm/6 text-amber-800 dark:text-amber-400">
            “{{ row.chord }}” isn’t a chord I know. Check the spelling (Cm7, F7♯9 is F7#9, B♭maj7 is Bbmaj7), or pick a scale for it below.
          </p>
        </div>
        <ChordChoices v-if="target" :doc="doc" :line="target.line" @update:doc="emit('update:doc', $event)" @said="emit('said', $event)" />
      </div>
      <div class="flex justify-end border-t border-zinc-950/5 px-5 py-3 dark:border-white/5">
        <UiButton color="note" @click="emit('close')">Done</UiButton>
      </div>
    </HDialogPanel>
  </HDialog>
</template>

<script setup lang="ts">
import { Dialog as HDialog, DialogPanel as HDialogPanel, DialogTitle as HDialogTitle } from '@headlessui/vue'
import { cellError, type ChartDoc, type RowLine, setLineChord } from '@chord-scale-maker/engine'
import ChordChoices from './ChordChoices.vue'
import type { SheetChordEdit } from '~/utils/sheetChordEdit'

/**
 * A chord tapped on the Changes sheet below md (a phone), to change: its symbol in concert pitch, then its scale and
 * function (ChordChoices), in a bottom sheet. A dialog: focus stays in it, and Escape or a tap outside closes it.
 * From md up the sheet is the editor itself (SheetChord), and no chord is tapped here.
 */
const props = defineProps<{ doc: ChartDoc; target: SheetChordEdit | null }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string]; close: [] }>()

const row = computed((): RowLine | null => {
  const l = props.target ? props.doc.lines[props.target.line] : undefined
  return l?.kind === 'row' ? l : null
})
const place = computed(() => (props.target ? `${props.target.section}, bar ${props.target.bar}` : ''))
/** the section a repeat's chord is written in: changing it changes that section */
const repeatOf = computed(() => (row.value && props.target && row.value.section !== props.target.section ? row.value.section : ''))
const known = computed(() => scaleChoices(row.value?.chord ?? '').known)

const draft = ref('')
const refused = ref('')
/** the text last written, so Enter and the change event that follows it write it once */
let written = ''
watch(() => [props.target, row.value?.chord] as const, () => {
  draft.value = written = row.value?.chord ?? ''
}, { immediate: true })
watch(draft, () => (refused.value = ''))
const error = computed(() => {
  const text = draft.value.trim()
  const bad = text ? cellError(text) : null
  return bad ? `“${text}” can’t go in a chart: ${bad}.` : refused.value
})

/** the chord as typed, into the chart: blank takes it out; refused (and said why) when the chart can't take it */
function apply(): void {
  const t = props.target
  const text = draft.value.trim()
  if (!t || !row.value || text === written || error.value) return
  const next = setLineChord(props.doc, t.line, text)
  if (next === props.doc) return void (refused.value = text ? 'The chart can’t take that chord here.' : 'A section’s first chord can’t be taken out.')
  written = text
  emit('update:doc', next)
  emit('said', `${place.value}: ${text || 'chord taken out'}`)
  if (!text) emit('close')
}
</script>

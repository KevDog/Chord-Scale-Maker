<template>
  <div v-if="row" class="space-y-6">
    <template v-for="piece in parts" :key="piece">
      <section v-if="piece === 'scale'" :aria-labelledby="`${id}-scale`" class="space-y-2">
        <div class="flex items-center gap-2">
          <UiSubheading :id="`${id}-scale`" :level="3">Scale</UiSubheading>
          <MapPinIcon v-if="pinned" class="size-4 text-note-600 dark:text-note-400" aria-hidden="true" />
        </div>
        <div class="space-y-2">
          <div v-if="pinned" class="flex flex-wrap items-center justify-between gap-2">
            <UiText class="text-sm/6!">{{ pinnedText }}</UiText>
            <UiButton outline @click="setScale('')">Unpin</UiButton>
          </div>
          <UiRadioGroup :model-value="selectedScale" aria-label="Scale" :class="ROOMY" @update:model-value="(v) => v !== undefined && setScale(v)">
            <UiRadio v-if="analysed" value="">
              <ScaleOptionLabel :scale="analysed" :note="analysedNote" />
            </UiRadio>
            <UiRadio v-if="usual" :value="usual">
              <ScaleOptionLabel :scale="usual" :note="'the quality’s usual'" />
            </UiRadio>
            <UiRadio v-for="o in inside" :key="o.scale" :value="o.scale"><ScaleOptionLabel :scale="o.scale" :note="o.note" /></UiRadio>
            <p v-if="outside.length" class="px-2 pt-2 text-xs/5 font-medium tracking-wide text-zinc-600 uppercase dark:text-zinc-400">Outside · tension to resolve</p>
            <UiRadio v-for="o in outside" :key="o.scale" :value="o.scale"><ScaleOptionLabel :scale="o.scale" :note="o.note" /></UiRadio>
            <UiRadio v-if="custom" :value="row.scale"><ScaleOptionLabel :scale="row.scale" note="your choice" /></UiRadio>
          </UiRadioGroup>
          <UiInput v-model="query" type="search" aria-label="Any scale" :placeholder="`Any scale: type “${rootText} ph…”`" />
          <ul v-if="found.length" aria-label="Scales found" class="space-y-1">
            <li v-for="s in found" :key="s">
              <button type="button" class="w-full rounded-lg px-2 py-1.5 text-left text-sm/6 text-zinc-950 hover:bg-note-50 focus:outline-2 focus:outline-blue-500 max-md:py-2.5 dark:text-white dark:hover:bg-white/5" @click="pick(s)">
                {{ s }} <span class="text-xs text-zinc-600 tabular-nums dark:text-zinc-400">{{ scaleFormula(s) }}</span>
              </button>
            </li>
          </ul>
          <UiText v-else-if="query.trim()" class="text-sm/6!">No scale by that name.</UiText>
        </div>
      </section>

      <section v-else-if="piece === 'function' && functionsOn && fnChoices.length" :aria-labelledby="`${id}-function`" class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex min-w-0 items-baseline gap-2">
            <UiSubheading :id="`${id}-function`" :level="3">Function</UiSubheading>
          </div>
          <NuxtLink to="/functions#writing" class="text-xs/5 text-zinc-600 underline dark:text-zinc-400">How to write a function</NuxtLink>
        </div>
        <div v-if="fallbackNote" class="flex flex-wrap items-center justify-between gap-2">
          <UiText class="text-sm/6! text-amber-800! dark:text-amber-400!">{{ fallbackNote }}</UiText>
          <UiButton v-if="accept" plain @click="setFunction(accept)">Accept guess</UiButton>
        </div>
        <UiRadioGroup :model-value="selectedFunction" aria-label="Function" :class="ROOMY" @update:model-value="(v) => v !== undefined && setFunction(v)">
          <UiRadio v-for="c in fnChoices" :key="c.value" :value="c.value">
            <span class="flex flex-wrap justify-between gap-x-3">
              <span>{{ c.value ? c.label : `Auto: ${c.label}` }}</span>
              <span v-if="c.scale" class="text-zinc-600 dark:text-zinc-400">→ {{ c.scale }}</span>
            </span>
          </UiRadio>
          <UiRadio v-if="!matchingFunction && row.function" :value="row.function"><span>{{ row.function }}</span></UiRadio>
        </UiRadioGroup>
        <UiErrorMessage v-if="note?.problem">{{ note.problem }}</UiErrorMessage>
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <UiInput v-model="draft" aria-label="Other function" placeholder="Other function: Eb: V7/ii" :invalid="!!draftError" autocomplete="off" autocapitalize="off" spellcheck="false" @keydown.enter.prevent="applyDraft" />
            <output v-if="draftScale" aria-label="The scale it gives" class="shrink-0 text-sm/6 text-zinc-600 dark:text-zinc-400">→ {{ draftScale }}</output>
          </div>
          <UiErrorMessage v-if="draftError">{{ draftError }}</UiErrorMessage>
        </div>
      </section>

      <section v-else-if="piece === 'why' && functionsOn && note?.note" :aria-labelledby="`${id}-why`" class="space-y-1">
        <UiSubheading :id="`${id}-why`" :level="3">Why</UiSubheading>
        <UiText class="text-sm/6!">{{ note.note }}</UiText>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { cellError, type ChartDoc, functionChoices, parseChord, parseFunction, rootName, type RowLine, type RowNote, rowNotes, sameFunction, samePitchScale, setRowField } from '@chord-scale-maker/engine'
import { MapPinIcon } from '@heroicons/vue/16/solid'
import ScaleOptionLabel from './ScaleOptionLabel.vue'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'

/**
 * A chord's scale (the usual one, the alternates inside and outside, any scale by search), its function with the
 * scale each gives, and why the analysis chose what it did: the chord written on `line` of the chart. Shared by the
 * sheet's label pickers and the phone's chord editor. The function comes first, and the first scale is the
 * analysed one: choosing it, or Unpin, blanks the cell; any other scale pins it.
 * `part` (the sheet's label pickers): 'function' shows the function list and why; 'scale' the scale list and why.
 * `fallbackNote`: a line above the function list (the rules could only guess here).
 */
const props = withDefaults(defineProps<{ doc: ChartDoc; line: number; part?: 'function' | 'scale' | 'all'; fallbackNote?: string }>(), { part: 'all', fallbackNote: '' })
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string] }>()

const id = useId()
/** 44 px rows below md, for fingers */
const ROOMY = 'max-md:[&_[role=radio]]:py-2.5'
const functionsOn = useFeature('functions')
const parts = computed((): readonly ('function' | 'scale' | 'why')[] => (props.part === 'function' ? ['function', 'why'] : props.part === 'scale' ? ['scale', 'why'] : ['function', 'scale', 'why']))
const row = computed((): RowLine | null => {
  const l = props.doc.lines[props.line]
  return l?.kind === 'row' ? l : null
})
const choices = computed(() => scaleChoices(row.value?.chord ?? ''))
const scaleView = inject(SCALE_VIEW, shallowRef(DEFAULT_VIEW))
const note = computed((): RowNote | undefined => (row.value ? rowNotes(props.doc, scaleView.value).get(props.line) : undefined))
/** the analysis's scale at the view's level, the option that blanks the cell; '' where the analysis doesn't reach */
const analysed = computed(() => note.value?.analysed ?? '')
const analysedNote = computed(() => [note.value?.numeral, note.value?.rule && `rule ${note.value.rule}`].filter(Boolean).join(', '))
const pinned = computed(() => !!analysed.value && note.value?.source === 'written')
const pinnedText = computed(() => (samePitchScale(row.value?.scale ?? '', analysed.value) ? 'your choice; the analyser’s too' : `your choice; the analyser says ${analysed.value}`))
/** the options, by pitch, each once: the analysed scale stands for any the same */
const listed = (scale: string | null | undefined): boolean => !!scale && !samePitchScale(scale, analysed.value)
const usual = computed(() => (listed(choices.value.defaultScale) ? choices.value.defaultScale : null))
const inside = computed(() => choices.value.alternates.filter((o) => !o.outside && listed(o.scale)))
const outside = computed(() => choices.value.alternates.filter((o) => o.outside && listed(o.scale)))
/** the scale the row plays, as one of the options: by pitch, so a scale typed another way still shows as its option ('' the analysed one) */
const selectedScale = computed((): string => {
  const scale = row.value?.scale ?? ''
  if (analysed.value && (!scale || samePitchScale(scale, analysed.value))) return ''
  const def = choices.value.defaultScale
  if (!scale || samePitchScale(scale, def)) return def ?? ''
  return choices.value.alternates.find((o) => samePitchScale(scale, o.scale))?.scale ?? scale
})
const custom = computed(() => !!row.value?.scale && selectedScale.value === row.value.scale && !samePitchScale(row.value.scale, choices.value.defaultScale) && !choices.value.alternates.some((o) => o.scale === row.value?.scale))

const fnChoices = computed(() => (row.value && functionsOn ? (functionChoices(props.doc).get(props.line) ?? []) : []))
const matchingFunction = computed(() => {
  const fn = row.value?.function ?? ''
  return fn ? fnChoices.value.find((c) => c.value && sameFunction(c.value, fn)) : fnChoices.value[0]
})
const selectedFunction = computed(() => matchingFunction.value?.value ?? row.value?.function ?? '')
/** the function that states the rules' guess (Auto's `accept`), offered under the fallback note */
const accept = computed(() => (props.fallbackNote ? fnChoices.value[0]?.accept : undefined))

/** a function typed in full: read as the chart would read it, so Enter writes it as the sheet prints it */
const draft = ref('')
watch(() => props.line, () => (draft.value = ''))
const parsedDraft = computed(() => {
  const text = draft.value.trim()
  if (!text) return null
  const bad = cellError(text)
  if (bad) return bad
  return parseFunction(text)
})
const draftError = computed(() => (typeof parsedDraft.value === 'string' ? parsedDraft.value : ''))
/** the draft as the row would hold it: its key prefix as typed, the function as the sheet prints it */
const draftText = computed((): string => {
  const p = parsedDraft.value
  if (!p || typeof p === 'string') return ''
  const colon = draft.value.indexOf(':')
  return colon >= 0 ? `${draft.value.slice(0, colon).trim()}: ${p.text}` : p.text
})
/** the scale the draft would give the row, from a trial doc with it stated */
const draftScale = computed((): string => (draftText.value ? (rowNotes(setRowField(props.doc, props.line, 'function', draftText.value), scaleView.value).get(props.line)?.analysed ?? '') : ''))
const rootText = computed((): string => {
  try {
    return rootName(parseChord(row.value?.chord ?? '').root)
  } catch {
    return 'C'
  }
})
const query = ref('')
watch(() => props.line, () => (query.value = ''))
const found = computed(() => searchScales(query.value, rootText.value))

function setScale(scale: string): void {
  emit('update:doc', setRowField(props.doc, props.line, 'scale', scale))
  emit('said', `${row.value?.chord}: ${scale || `${analysed.value}, the analyser’s`}`)
}
function pick(scale: string): void {
  setScale(scale)
  query.value = ''
}
function setFunction(fn: string): void {
  emit('update:doc', setRowField(props.doc, props.line, 'function', fn))
  const c = fnChoices.value.find((x) => x.value === fn)
  emit('said', `${row.value?.chord}: ${fn || 'Auto'}${c?.scale ? `, ${c.scale}` : ''}`)
}
/** Enter in the field: a function that reads is written and the field cleared; one that doesn't stays, with why */
function applyDraft(): void {
  if (!draftText.value) return
  setFunction(draftText.value)
  draft.value = ''
}
</script>

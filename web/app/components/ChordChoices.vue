<template>
  <div v-if="row" class="space-y-6">
    <template v-for="part in parts" :key="part">
      <section v-if="part === 'scale'" :aria-labelledby="`${id}-scale`" class="space-y-2">
        <div class="flex items-center gap-2">
          <UiSubheading :id="`${id}-scale`" :level="3">
            <button v-if="collapsible" type="button" :class="FOLD" :aria-expanded="scaleOpen" :aria-controls="scaleOpen ? `${id}-scale-body` : undefined" @click="scaleOpen = !scaleOpen"><ChevronRightIcon :class="[CHEVRON, scaleOpen && 'rotate-90']" aria-hidden="true" />Scale</button>
            <template v-else>Scale</template>
          </UiSubheading>
          <MapPinIcon v-if="pinned" class="size-4 text-note-600 dark:text-note-400" aria-hidden="true" />
          <UiText v-if="!scaleOpen" class="min-w-0 truncate text-sm/6!">{{ selectedScale || analysed }}</UiText>
        </div>
        <div v-if="scaleOpen" :id="`${id}-scale-body`" class="space-y-2">
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

      <section v-else-if="part === 'function' && functionsOn && fnChoices.length" :aria-labelledby="`${id}-function`" class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex min-w-0 items-baseline gap-2">
            <UiSubheading :id="`${id}-function`" :level="3">
              <button v-if="collapsible" type="button" :class="FOLD" :aria-expanded="functionOpen" :aria-controls="functionOpen ? `${id}-function-body` : undefined" @click="functionOpen = !functionOpen"><ChevronRightIcon :class="[CHEVRON, functionOpen && 'rotate-90']" aria-hidden="true" />Function</button>
              <template v-else>Function</template>
            </UiSubheading>
            <UiText v-if="!functionOpen" class="min-w-0 truncate text-sm/6!">{{ functionText }}</UiText>
          </div>
          <NuxtLink v-if="functionOpen" to="/functions#writing" class="text-xs/5 text-zinc-600 underline dark:text-zinc-400">How to write a function</NuxtLink>
        </div>
        <UiRadioGroup v-if="functionOpen" :id="`${id}-function-body`" :model-value="selectedFunction" aria-label="Function" :class="ROOMY" @update:model-value="(v) => v !== undefined && setFunction(v)">
          <UiRadio v-for="c in fnChoices" :key="c.value" :value="c.value">
            <span class="flex flex-wrap justify-between gap-x-3">
              <span>{{ c.value ? c.label : `Auto: ${c.label}` }}</span>
              <span v-if="c.scale" class="text-zinc-600 dark:text-zinc-400">→ {{ c.scale }}</span>
            </span>
          </UiRadio>
          <UiRadio v-if="!matchingFunction && row.function" :value="row.function"><span>{{ row.function }}</span></UiRadio>
        </UiRadioGroup>
        <UiErrorMessage v-if="note?.problem">{{ note.problem }}</UiErrorMessage>
      </section>

      <section v-else-if="part === 'why' && functionsOn && note?.note && scaleOpen" :aria-labelledby="`${id}-why`" class="space-y-1">
        <UiSubheading :id="`${id}-why`" :level="3">Why</UiSubheading>
        <UiText class="text-sm/6!">{{ note.note }}</UiText>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { type ChartDoc, functionChoices, parseChord, rootName, type RowLine, type RowNote, rowNotes, sameFunction, samePitchScale, setRowField } from '@chord-scale-maker/engine'
import { ChevronRightIcon, MapPinIcon } from '@heroicons/vue/16/solid'
import ScaleOptionLabel from './ScaleOptionLabel.vue'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'

/**
 * A chord's scale (the usual one, the alternates inside and outside, any scale by search), its function with the
 * scale each gives, and why the analysis chose what it did: the chord written on `line` of the chart. Shared by the
 * bar editor's inspector and the Changes sheet's chord editor. The function comes first, and the first scale is the
 * analysed one: choosing it, or Unpin, blanks the cell; any other scale pins it.
 * `collapsible` (the inspector's): the scale (with its why) and the function each fold away to their choice, remembered.
 */
const props = defineProps<{ doc: ChartDoc; line: number; collapsible?: boolean }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string] }>()

const id = useId()
/** 44 px rows below md, for fingers */
const ROOMY = 'max-md:[&_[role=radio]]:py-2.5'
/** the heading's fold toggle (the inspector's), its chevron turning down when open */
const FOLD = 'flex items-center gap-1 rounded-sm focus:outline-2 focus:outline-blue-500'
const CHEVRON = 'size-4 text-zinc-500 transition-transform dark:text-zinc-400'
const prefs = props.collapsible ? usePreferences() : null
const scaleOpen = computed({ get: () => prefs?.inspectorScale.value ?? true, set: (v) => prefs && (prefs.inspectorScale.value = v) })
const functionOpen = computed({ get: () => prefs?.inspectorFunction.value ?? true, set: (v) => prefs && (prefs.inspectorFunction.value = v) })
const functionsOn = useFeature('functions')
const parts = ['function', 'scale', 'why'] as const
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
/** the chosen function, as its option reads, shown while the list is folded away */
const functionText = computed(() => {
  const c = matchingFunction.value
  return c ? (c.value ? c.label : `Auto: ${c.label}`) : (row.value?.function ?? '')
})

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
</script>

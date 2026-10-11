<template>
  <div v-if="row" class="space-y-6">
    <section :aria-labelledby="`${id}-scale`" class="space-y-2">
      <UiSubheading :id="`${id}-scale`" :level="3">Scale</UiSubheading>
      <UiRadioGroup :model-value="selectedScale" aria-label="Scale" :class="ROOMY" @update:model-value="(v) => v !== undefined && setScale(v)">
        <UiRadio v-if="choices.defaultScale" :value="choices.defaultScale">
          <ScaleOptionLabel :scale="choices.defaultScale" note="the usual choice" />
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
    </section>

    <section v-if="functionsOn && fnChoices.length" :aria-labelledby="`${id}-function`" class="space-y-2">
      <div class="flex items-baseline justify-between gap-2">
        <UiSubheading :id="`${id}-function`" :level="3">Function</UiSubheading>
        <NuxtLink to="/functions#writing" class="text-xs/5 text-zinc-600 underline dark:text-zinc-400">How to write a function</NuxtLink>
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
    </section>

    <section v-if="functionsOn && note?.note" :aria-labelledby="`${id}-why`" class="space-y-1">
      <UiSubheading :id="`${id}-why`" :level="3">Why</UiSubheading>
      <UiText class="text-sm/6!">{{ note.note }}</UiText>
    </section>
  </div>
</template>

<script setup lang="ts">
import { type ChartDoc, functionChoices, parseChord, rootName, type RowLine, type RowNote, rowNotes, sameFunction, samePitchScale, setRowField } from '@chord-scale-maker/engine'
import ScaleOptionLabel from './ScaleOptionLabel.vue'

/**
 * A chord's scale (the usual one, the alternates inside and outside, any scale by search), its function with the
 * scale each gives, and why the analysis chose what it did: the chord written on `line` of the chart. Shared by the
 * bar editor's inspector and the Changes sheet's chord editor.
 */
const props = defineProps<{ doc: ChartDoc; line: number }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string] }>()

const id = useId()
/** 44 px rows below md, for fingers */
const ROOMY = 'max-md:[&_[role=radio]]:py-2.5'
const functionsOn = useFeature('functions')
const row = computed((): RowLine | null => {
  const l = props.doc.lines[props.line]
  return l?.kind === 'row' ? l : null
})
const choices = computed(() => scaleChoices(row.value?.chord ?? ''))
const inside = computed(() => choices.value.alternates.filter((o) => !o.outside))
const outside = computed(() => choices.value.alternates.filter((o) => o.outside))
/** the scale the row plays, as one of the options: by pitch, so a scale typed another way still shows as its option */
const selectedScale = computed((): string => {
  const scale = row.value?.scale ?? ''
  const def = choices.value.defaultScale
  if (!scale || samePitchScale(scale, def)) return def ?? ''
  return choices.value.alternates.find((o) => samePitchScale(scale, o.scale))?.scale ?? scale
})
const custom = computed(() => !!row.value?.scale && selectedScale.value === row.value.scale && !samePitchScale(row.value.scale, choices.value.defaultScale) && !choices.value.alternates.some((o) => o.scale === row.value?.scale))

const note = computed((): RowNote | undefined => (row.value && functionsOn ? rowNotes(props.doc).get(props.line) : undefined))
const fnChoices = computed(() => (row.value && functionsOn ? (functionChoices(props.doc).get(props.line) ?? []) : []))
const matchingFunction = computed(() => {
  const fn = row.value?.function ?? ''
  return fn ? fnChoices.value.find((c) => c.value && sameFunction(c.value, fn)) : fnChoices.value[0]
})
const selectedFunction = computed(() => matchingFunction.value?.value ?? row.value?.function ?? '')

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
  emit('said', `${row.value?.chord}: ${scale}`)
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

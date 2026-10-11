<template>
  <aside aria-labelledby="inspector-heading" class="space-y-6 rounded-xl bg-white p-4 ring-1 ring-note-200 dark:bg-zinc-900 dark:ring-white/10">
    <div>
      <UiText id="inspector-heading" class="text-xs/5!">{{ place }}</UiText>
      <p class="mt-1 text-2xl/8 font-semibold text-zinc-950 dark:text-white">{{ chord?.chord ?? '—' }}</p>
      <UiText v-if="!chord" class="mt-2">This bar holds the chord before it. Type a chord to give it its own.</UiText>
      <p v-else-if="!choices.known" role="note" class="mt-2 rounded-lg bg-amber-500/10 p-3 text-sm/6 text-amber-800 dark:text-amber-400">
        “{{ chord.chord }}” isn’t a chord I know. Check the spelling (Cm7, F7♯9 is F7#9, B♭maj7 is Bbmaj7), or pick a scale for it below.
      </p>
    </div>

    <template v-if="chord">
      <section aria-labelledby="scale-heading" class="space-y-2">
        <UiSubheading id="scale-heading" :level="3">Scale</UiSubheading>
        <UiRadioGroup :model-value="selectedScale" aria-label="Scale" @update:model-value="(v) => v !== undefined && setScale(v)">
          <UiRadio v-if="choices.defaultScale" :value="choices.defaultScale">
            <ScaleOptionLabel :scale="choices.defaultScale" note="the usual choice" />
          </UiRadio>
          <UiRadio v-for="o in inside" :key="o.scale" :value="o.scale"><ScaleOptionLabel :scale="o.scale" :note="o.note" /></UiRadio>
          <p v-if="outside.length" class="px-2 pt-2 text-xs/5 font-medium tracking-wide text-zinc-600 uppercase dark:text-zinc-400">Outside · tension to resolve</p>
          <UiRadio v-for="o in outside" :key="o.scale" :value="o.scale"><ScaleOptionLabel :scale="o.scale" :note="o.note" /></UiRadio>
          <UiRadio v-if="custom" :value="row?.scale ?? ''"><ScaleOptionLabel :scale="row?.scale ?? ''" note="your choice" /></UiRadio>
        </UiRadioGroup>
        <UiInput v-model="query" type="search" aria-label="Any scale" :placeholder="`Any scale: type “${rootText} ph…”`" />
        <ul v-if="found.length" aria-label="Scales found" class="space-y-1">
          <li v-for="s in found" :key="s">
            <button type="button" class="w-full rounded-lg px-2 py-1.5 text-left text-sm/6 text-zinc-950 hover:bg-note-50 focus:outline-2 focus:outline-blue-500 dark:text-white dark:hover:bg-white/5" @click="pick(s)">
              {{ s }} <span class="text-xs text-zinc-600 tabular-nums dark:text-zinc-400">{{ scaleFormula(s) }}</span>
            </button>
          </li>
        </ul>
        <UiText v-else-if="query.trim()" class="text-sm/6!">No scale by that name.</UiText>
      </section>

      <section v-if="functionsOn && fnChoices.length" aria-labelledby="function-heading" class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <UiSubheading id="function-heading" :level="3">Function</UiSubheading>
          <NuxtLink to="/functions#writing" class="text-xs/5 text-zinc-600 underline dark:text-zinc-400">How to write a function</NuxtLink>
        </div>
        <UiRadioGroup :model-value="selectedFunction" aria-label="Function" @update:model-value="(v) => v !== undefined && setFunction(v)">
          <UiRadio v-for="c in fnChoices" :key="c.value" :value="c.value">
            <span class="flex flex-wrap justify-between gap-x-3">
              <span>{{ c.value ? c.label : `Auto: ${c.label}` }}</span>
              <span v-if="c.scale" class="text-zinc-600 dark:text-zinc-400">→ {{ c.scale }}</span>
            </span>
          </UiRadio>
          <UiRadio v-if="!matchingFunction && row?.function" :value="row.function"><span>{{ row.function }}</span></UiRadio>
        </UiRadioGroup>
        <UiErrorMessage v-if="note?.problem">{{ note.problem }}</UiErrorMessage>
      </section>

      <section v-if="functionsOn && note?.note" aria-labelledby="why-heading" class="space-y-1">
        <UiSubheading id="why-heading" :level="3">Why</UiSubheading>
        <UiText class="text-sm/6!">{{ note.note }}</UiText>
      </section>

    </template>

    <section aria-labelledby="bar-heading" class="space-y-3 border-t border-zinc-950/5 pt-4 dark:border-white/5">
      <UiSubheading id="bar-heading" :level="3">Bar {{ bar }}</UiSubheading>
      <UiText v-if="cell.kind === 'implied'" class="text-sm/6!">This bar rounds the part out to a whole phrase. Type a chord here to make it the chart’s own.</UiText>
      <template v-else>
        <div class="flex flex-wrap gap-2">
          <UiButton outline @click="change(insertHeldBar(doc, section, bar), `Bar ${bar} added`, 'A section can’t start with a held bar.')"><PlusIcon data-slot="icon" />Bar before</UiButton>
          <UiButton outline @click="change(insertHeldBar(doc, section, bar + 1), `Bar ${bar + 1} added`, 'No bar can go there.', bar + 1)"><PlusIcon data-slot="icon" />Bar after</UiButton>
          <UiButton outline @click="change(deleteBar(doc, section, bar), `Bar ${bar} deleted`, 'A section can’t start with a held bar: give the next bar a chord first.')"><TrashIcon data-slot="icon" />Delete bar</UiButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-for="n in ENDINGS" :key="n" :outline="ending !== n" :color="ending === n ? 'note' : undefined" :aria-pressed="ending === n" @click="change(toggleEnding(doc, section, n, bar), `${n === 1 ? '1st' : '2nd'} ending ${ending === n ? 'off' : 'on'}`, 'An ending can’t go over the other one.')">
            {{ n === 1 ? '1st' : '2nd' }} ending
          </UiButton>
          <UiButton v-for="m in MARKS" :key="m" :outline="!hasMark(m)" :color="hasMark(m) ? 'note' : undefined" :aria-pressed="hasMark(m)" @click="change(setMark(doc, section, bar, m, !hasMark(m)), `${MARK_LABELS[m]} ${hasMark(m) ? 'off' : 'on'}`, '')">
            {{ MARK_LABELS[m] }}
          </UiButton>
        </div>
        <UiField>
          <UiLabel>Jump at the end of the bar</UiLabel>
          <UiSelect :model-value="navText" @update:model-value="(v) => change(setNav(doc, section, bar, String(v)), String(v) || 'No jump', '')">
            <option value="">None</option>
            <option v-for="t in navOptions" :key="t" :value="t">{{ t }}</option>
          </UiSelect>
        </UiField>
        <div class="flex flex-wrap gap-2">
          <UiButton outline @click="emit('split')">New section here…</UiButton>
          <UiButton v-if="functionsOn && chord" outline @click="emit('update:doc', insertKeyChange(doc, chord.line))"><KeyIcon data-slot="icon" />Key change here</UiButton>
        </div>
      </template>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { KeyIcon, PlusIcon, TrashIcon } from '@heroicons/vue/16/solid'
import { type BarChord, type ChartBar, type ChartDoc, deleteBar, functionChoices, insertHeldBar, insertKeyChange, parseChord, rootName, type RowLine, type RowNote, rowNotes, sameFunction, samePitchScale, setMark, setNav, setRowField, toggleEnding } from '@chord-scale-maker/engine'
import ScaleOptionLabel from './ScaleOptionLabel.vue'

/**
 * The bar editor's inspector (docs/superpowers/proposals/editor-ux/README.md §3 B): the selected chord's scale (the
 * usual one, the alternates inside and outside, any scale by search), its function with the scale each gives, and
 * why the analysis chose what it did; then the bar's own actions: bars in and out, endings, marks, a jump and a new
 * section. A change the chart can't take is refused with why.
 */
const props = defineProps<{ doc: ChartDoc; section: string; bar: number; index: number; chord: BarChord | null; count: number; cell: ChartBar }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string]; refused: [text: string]; select: [bar: number]; split: [] }>()

const functionsOn = useFeature('functions')
const ORDINALS = ['1st', '2nd', '3rd', '4th']
const place = computed(() => [props.section, `bar ${props.bar}`, props.count > 1 ? `${ORDINALS[props.index] ?? `${props.index + 1}th`} chord` : ''].filter(Boolean).join(' · '))
const row = computed((): RowLine | null => {
  const l = props.chord ? props.doc.lines[props.chord.line] : undefined
  return l?.kind === 'row' ? l : null
})
const choices = computed(() => scaleChoices(props.chord?.chord ?? ''))
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

const note = computed((): RowNote | undefined => (props.chord && functionsOn ? rowNotes(props.doc).get(props.chord.line) : undefined))
const fnChoices = computed(() => (props.chord && functionsOn ? (functionChoices(props.doc).get(props.chord.line) ?? []) : []))
const matchingFunction = computed(() => {
  const fn = row.value?.function ?? ''
  return fn ? fnChoices.value.find((c) => c.value && sameFunction(c.value, fn)) : fnChoices.value[0]
})
const selectedFunction = computed(() => matchingFunction.value?.value ?? row.value?.function ?? '')

const rootText = computed((): string => {
  try {
    return rootName(parseChord(props.chord?.chord ?? '').root)
  } catch {
    return 'C'
  }
})
const query = ref('')
watch(() => props.chord?.line, () => (query.value = ''))
const found = computed(() => searchScales(query.value, rootText.value))

const ENDINGS = [1, 2] as const
const MARKS = ['segno', 'coda'] as const
const MARK_LABELS = { segno: 'Segno', coda: 'Coda' } as const
const NAVS = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
const ending = computed(() => props.cell.ending?.n ?? null)
const hasMark = (m: 'segno' | 'coda'): boolean => props.cell.marks.some((x) => x.mark === m)
const navText = computed(() => props.cell.nav[0]?.text ?? '')
const navOptions = computed(() => (navText.value && !NAVS.includes(navText.value) ? [...NAVS, navText.value] : NAVS))

/** a bar action's new doc: the same doc means the chart can't take it, and why is said */
function change(next: ChartDoc, said: string, refused: string, select?: number): void {
  if (next === props.doc) return emit('refused', refused || 'The chart can’t take that here.')
  emit('update:doc', next)
  emit('said', `${props.section}: ${said}`)
  if (select !== undefined) emit('select', select)
}

function setScale(scale: string): void {
  const line = props.chord?.line
  if (line === undefined) return
  emit('update:doc', setRowField(props.doc, line, 'scale', scale))
  emit('said', `${props.chord?.chord}: ${scale}`)
}
function pick(scale: string): void {
  setScale(scale)
  query.value = ''
}
function setFunction(fn: string): void {
  const line = props.chord?.line
  if (line === undefined) return
  emit('update:doc', setRowField(props.doc, line, 'function', fn))
  const c = fnChoices.value.find((x) => x.value === fn)
  emit('said', `${props.chord?.chord}: ${fn || 'Auto'}${c?.scale ? `, ${c.scale}` : ''}`)
}
</script>

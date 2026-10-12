<template>
  <div v-if="!isEditing" class="text-base font-semibold print:text-sm/4">
    <button
      type="button"
      :aria-label="label"
      :class="[
        'relative -mx-1 cursor-pointer rounded px-1 hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10',
        selected && 'ring-2 ring-note-600 dark:ring-note-400',
        unknown && 'underline decoration-amber-500 decoration-2 underline-offset-4',
      ]"
      @click="emit('edit', adding ? { kind: 'slot', section, bar } : { kind: 'chord', line })"
    >
      <UiTouchTarget><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>{{ text }}</span></UiTouchTarget>
    </button>
  </div>
  <div v-else class="relative print:hidden">
    <input
      ref="input"
      v-model="draft"
      type="text"
      :aria-label="`Chord, ${section} bar ${bar}`"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="options.length > 0"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="active >= 0 && options.length ? `${id}-${active}` : undefined"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :style="{ width: `max(3ch, ${draft.length + 1}ch)` }"
      class="-mx-1 rounded bg-white px-1 text-base font-semibold text-zinc-950 ring-2 ring-note-500 outline-none dark:bg-zinc-900 dark:text-white"
      @keydown="onKey"
      @blur="onBlur"
    >
    <div class="absolute top-full left-0 z-30 mt-1 w-72 rounded-lg bg-white text-sm shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
      <ul v-if="options.length" :id="`${id}-list`" role="listbox" aria-label="Completions">
        <li
          v-for="(o, i) in options"
          :id="`${id}-${i}`"
          :key="o.text"
          role="option"
          :aria-selected="i === active"
          :class="['flex justify-between gap-3 px-3 py-1.5', i === active ? 'bg-note-500 text-white' : 'text-zinc-950 dark:text-white']"
          @mousedown.prevent="take(o.text)"
        >
          <b><ChordSymbol v-if="o.tokens" :tokens="o.tokens" /><span v-else>{{ o.text }}</span></b>
          <span :class="['truncate text-xs/5', i === active ? 'opacity-90' : 'text-zinc-600 dark:text-zinc-400']">{{ readingOf(o.preview) }}</span>
        </li>
      </ul>
      <UiErrorMessage v-if="error" class="px-3 py-1.5">{{ error }}</UiErrorMessage>
      <UiText v-if="repeatOf" role="note" class="px-3 py-1.5 text-xs/5!">{{ section }} repeats {{ repeatOf }}: a change here changes {{ repeatOf }} and every repeat of it.</UiText>
      <p class="border-t border-zinc-950/5 px-3 py-1.5 text-xs/5 text-zinc-600 dark:border-white/5 dark:text-zinc-400"><kbd>Tab</kbd> next bar · <kbd>Space</kbd> add a chord · <kbd>Esc</kbd> cancel</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { barView, cellError, type ChartDoc, chordCompletions, chordPreview, type ChordPreview, chordsAfterTyping, type ChordToken, chordTokens, CONCERT, type GridPos, posOfLine, setBarChords, sheetScale } from '@chord-scale-maker/engine'
import type { SheetEdit } from '~/utils/sheetChordEdit'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'

/**
 * A chord on the Changes sheet while the editor is shown (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md
 * §1.1–1.2): a button ("Edit G7, A bar 2"), or, when `editing` names it, a field in its place with completions that
 * read each candidate in this bar. Enter and Tab commit (Tab then asks to move), Space commits and asks for a new chord
 * slot, Esc cancels, blank takes the chord out, % is the bar before. A slot instance (`adding`) is the new chord after
 * the bar's: it opens empty and commits as an added chord. The doc is written once, on commit.
 */
const props = defineProps<{
  doc: ChartDoc
  line: number
  section: string
  bar: string
  text: string
  tokens: readonly ChordToken[] | null
  label: string
  editing: SheetEdit | null
  selected: boolean
  adding?: boolean // the new chord slot after the bar's chords, not a chord that exists
}>()
const emit = defineEmits<{
  edit: [edit: SheetEdit]
  'update:doc': [doc: ChartDoc]
  said: [text: string]
  preview: [preview: ChordPreview | null]
  done: [then: 'stay' | 'next' | 'prev' | 'add' | 'cancel']
}>()

const id = useId()
const input = ref<HTMLInputElement | null>(null)
const scaleView = inject(SCALE_VIEW, shallowRef(DEFAULT_VIEW))
const isEditing = computed(() => {
  const e = props.editing
  if (!e) return false
  return props.adding ? e.kind === 'slot' && e.section === props.section && e.bar === props.bar : e.kind === 'chord' && e.line === props.line
})
const unknown = computed(() => !props.adding && !!props.text && !scaleChoices(props.text).known)

const view = computed(() => barView(props.doc))
/** the chord's place on the grid; a slot's is after the bar's last chord (insert) */
const pos = computed((): GridPos | null => {
  if (props.adding) {
    const bars = view.value.sections.find((s) => s.name === props.section)?.bars
    const b = bars?.find((x) => String(x.bar) === props.bar)
    return b ? { section: props.section, bar: b.bar, chord: b.chords.length } : null
  }
  return posOfLine(view.value, props.line)
})
/** the bar's chords as they are */
const barChords = computed((): string[] => (pos.value ? chordsAfterTyping(view.value, pos.value, props.adding ? '' : props.text, false) : []))
/** the section a repeat's chord is written in (the drawn section differs): changing it changes that section */
const repeatOf = computed(() => {
  const l = props.doc.lines[props.line]
  return l?.kind === 'row' && l.section !== props.section ? l.section : ''
})

const draft = ref('')
const refused = ref('')
const active = ref(0)
let settled = false // the field closed by a key, so blur writes nothing twice
/** the field opens on the chord as it is, selected, so typing replaces it */
function open(): void {
  draft.value = props.adding ? '' : props.text
  refused.value = ''
  active.value = 0
  settled = false
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}
watch(isEditing, (on) => on && open())
onMounted(() => isEditing.value && open())
watch(draft, () => {
  refused.value = ''
  active.value = 0
})

const error = computed(() => {
  const t = draft.value.trim()
  const bad = t && t !== '%' ? cellError(t) : null
  return bad ? `“${t}” can’t go in a chart: ${bad}.` : refused.value
})

/** the bar's chords once `text` is written at pos (a slot inserts, a chord replaces) */
const chordsWith = (text: string): string[] => (pos.value ? chordsAfterTyping(view.value, pos.value, text, !!props.adding) : [])
const previewOf = (text: string): ChordPreview | null => {
  const p = pos.value
  const t = text.trim()
  if (!p || !t) return null
  const chords = chordsWith(t)
  const index = t === '%' ? Math.max(0, chords.length - 1) : Math.min(p.chord, chords.length - 1)
  return chordPreview(props.doc, p.section, p.bar, chords, index, scaleView.value)
}
/** "V7 → G H/W Dim.": the candidate's reading, its scale written as the sheet labels it (concert while editing, D2) */
const readingOf = (p: ChordPreview | null): string => (p?.readable ? [p.numeral, sheetScale(CONCERT, p.scale)].filter(Boolean).join(' → ') : '')
function tokensOf(text: string): readonly ChordToken[] | null {
  try {
    return chordTokens(CONCERT, text) // the sheet edits in concert pitch (D2)
  } catch {
    return null
  }
}
const options = computed(() => (isEditing.value ? chordCompletions(draft.value).map((text) => ({ text, tokens: tokensOf(text), preview: previewOf(text) })) : []))
watch([draft, isEditing], () => emit('preview', isEditing.value ? previewOf(draft.value) : null))

/** the draft into its bar; false (and the field stays) when the chart can't take it */
function commit(text = draft.value): boolean {
  const p = pos.value
  if (!p) return true
  const t = text.trim()
  if (error.value) return false
  const chords = chordsWith(t)
  if (chords.length === barChords.value.length && chords.every((c, k) => c === barChords.value[k])) return true // nothing changed, or an empty slot
  const next = setBarChords(props.doc, p.section, p.bar, chords)
  if (next === props.doc) {
    refused.value = chords.length ? `“${t}” can’t go in a chart: it’s not a chord.` : 'A section’s first bar needs a chord.'
    return false
  }
  emit('update:doc', next)
  emit('said', `${p.section}, bar ${p.bar}: ${chords.join(', ') || 'held'}`)
  return true
}
function finish(then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'): void {
  settled = true
  emit('preview', null)
  emit('done', then)
}
function take(text: string): void {
  draft.value = text
  if (commit(text)) finish('stay')
}
function onKey(e: KeyboardEvent): void {
  const n = options.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    active.value = (active.value + 1) % n
    return
  }
  if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    finish('cancel')
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const chosen = options.value[active.value]?.text ?? draft.value
    if (active.value > 0) draft.value = chosen
    if (commit(chosen)) finish('stay')
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    if (commit()) finish(e.shiftKey ? 'prev' : 'next')
    return
  }
  if (e.key === ' ') {
    e.preventDefault()
    if (!commit()) return
    if (chordsWith(draft.value).length >= view.value.beats) {
      emit('said', `A bar holds at most ${view.value.beats} chords.`)
      finish('stay')
      return
    }
    finish('add')
  }
}
function onBlur(): void {
  if (settled || !isEditing.value) return
  if (commit()) finish('stay')
  else finish('cancel')
}
</script>

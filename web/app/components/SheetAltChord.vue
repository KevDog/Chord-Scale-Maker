<template>
  <button
    v-if="!open"
    ref="button"
    type="button"
    :aria-label="text ? `${name}: ${text}` : name"
    class="relative block h-full w-full cursor-pointer rounded text-left hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10"
    @click="emit('edit')"
  >
    <slot v-if="text">{{ text }}</slot><span v-else class="font-normal text-zinc-500 print:hidden dark:text-zinc-400">+ alt</span>
  </button>
  <div v-else class="relative print:hidden">
    <input
      ref="input"
      v-model="draft"
      type="text"
      :aria-label="name"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="options.length > 0"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="active >= 0 && options.length ? `${id}-${active}` : undefined"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :style="{ width: `max(6ch, ${draft.length + 1}ch)` }"
      class="rounded bg-white px-1 text-xs/4 font-medium text-zinc-950 ring-2 ring-note-500 outline-none dark:bg-zinc-900 dark:text-white"
      @keydown="onKey"
      @blur="onBlur"
    >
    <div class="absolute top-full left-0 z-30 mt-1 w-72 rounded-lg bg-white text-sm shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
      <ul v-if="options.length" :id="`${id}-list`" role="listbox" aria-label="Completions">
        <!-- eslint-disable-next-line vuejs-accessibility/interactive-supports-focus -- a combobox: focus stays in the input, aria-activedescendant points at the option -->
        <li
          v-for="(o, i) in options"
          :id="`${id}-${i}`"
          :key="o.text"
          role="option"
          :aria-selected="i === active"
          :class="['px-3 py-1.5 font-semibold', i === active ? 'bg-note-500 text-white' : 'text-zinc-950 dark:text-white']"
          @mousedown.prevent="take(o.text)"
        >
          <ChordSymbol v-if="o.tokens" :tokens="o.tokens" /><span v-else>{{ o.text }}</span>
        </li>
      </ul>
      <UiErrorMessage v-if="error" :id="`${id}-error`" class="px-3 py-1.5">{{ error }}</UiErrorMessage>
      <p class="border-t border-zinc-950/5 px-3 py-1.5 text-xs/5 text-zinc-600 dark:border-white/5 dark:text-zinc-400">The bar’s alternate chords, spaced · blank: none · <kbd>Tab</kbd> bar · <kbd>Esc</kbd> cancel</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { altBarChords, barView, cellError, changesFor, type ChartDoc, chordCompletions, chordsAfterTyping, type ChordToken, chordTokens, CONCERT, setAltBarChords } from '@chord-scale-maker/engine'
import { barFull, CANT_TAKE, notAChord } from '~/utils/refusals'

/**
 * a bar's place on the alternate line (#469), while the sheet editor plays Standard: a button showing the bar's
 * alternate chords (a faint "+ alt" where it has none), or, while `open`, one field for the bar's alt chords, spaced.
 * Enter and Tab commit (Tab then asks for the next bar, ⇧Tab the previous), Esc cancels; ← → move the caret. Blank
 * takes the alternate out, % is the Alternate set's bar before, and the bar's standard chords make no alternate
 * (setAltBarChords). The commit writes `source`, the chart with its alt rows.
 */
const props = defineProps<{
  source: ChartDoc
  section: string
  bar: number
  text: string // the alternate drawn over the bar, spaced; '' for none
  open: boolean
  refocus?: number // a new value asks for focus on the button (Tab past the line's end closed the field)
}>()
const emit = defineEmits<{
  edit: []
  'update:doc': [doc: ChartDoc]
  said: [text: string]
  refused: [text: string]
  next: []
  prev: []
  close: []
}>()

const id = useId()
const input = ref<HTMLInputElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const name = computed(() => `Alternate for ${props.section} bar ${props.bar}`)

const draft = ref('')
const refused = ref('')
const active = ref(0)
let settled = false // the field closed by a key, so blur writes nothing twice
/** the bar's alt rows as typed, selected, so typing replaces them */
function start(): void {
  draft.value = altBarChords(props.source, props.section, props.bar).join(' ')
  refused.value = ''
  active.value = 0
  settled = false
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}
watch(() => props.open, (on) => on && start())
onMounted(() => props.open && start())
watch(() => props.refocus, () => nextTick(() => button.value?.focus()))
watch(draft, () => {
  refused.value = ''
  active.value = 0
})

const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean)
/** the bar's beats: at most a chord a beat (#235) */
const beats = computed(() => {
  const view = barView(props.source)
  return view.sections.find((s) => s.name === props.section)?.bars.find((b) => b.bar === props.bar)?.beats ?? view.beats
})
/** the chords typed; % alone is the Alternate set's bar before as it plays */
function chordsOf(text: string): string[] {
  const typed = words(text)
  if (typed.length === 1 && typed[0] === '%') return chordsAfterTyping(barView(changesFor(props.source, 'alternate')), { section: props.section, bar: props.bar, chord: 0 }, '%', false)
  return typed
}
const error = computed(() => {
  const typed = words(draft.value)
  if (typed.length === 1 && typed[0] === '%') return refused.value
  for (const t of typed) {
    const bad = cellError(t)
    if (bad) return notAChord(t, bad)
  }
  return refused.value
})

function tokensOf(text: string): readonly ChordToken[] | null {
  try {
    return chordTokens(CONCERT, text) // the sheet edits in concert pitch (D2)
  } catch {
    return null
  }
}
/** completions of the last chord typed, each the whole text with it completed */
const options = computed(() => {
  if (!props.open || /\s$/.test(draft.value)) return []
  const typed = words(draft.value)
  const last = typed.at(-1) ?? ''
  const before = typed.slice(0, -1).join(' ')
  return chordCompletions(last).map((c) => ({ text: before ? `${before} ${c}` : c, tokens: tokensOf(c) }))
})

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((c, k) => c === b[k])
/** the draft as the bar's alternate; false (and the field stays) when the chart can't take it */
function commit(text = draft.value): boolean {
  if (error.value) return refuse(error.value)
  const chords = chordsOf(text)
  if (chords.length > beats.value) return refuse((refused.value = barFull(beats.value)))
  const before = altBarChords(props.source, props.section, props.bar)
  if (same(chords, before)) return true // nothing changed, or blank where there's none
  const next = setAltBarChords(props.source, props.section, props.bar, chords)
  if (next === props.source) return refuse((refused.value = CANT_TAKE))
  const after = altBarChords(next, props.section, props.bar)
  if (same(after, before)) return true // the standard chords typed where there's no alternate
  emit('update:doc', next)
  emit('said', `${props.section}, bar ${props.bar}: ${after.length ? `alternate ${after.join(', ')}` : 'no alternate'}`)
  return true
}
/** the field stays, marked invalid, and why is said (the message under it is only seen) */
function refuse(why: string): false {
  emit('refused', why)
  return false
}
function finish(then: 'close' | 'next' | 'prev'): void {
  settled = true
  if (then === 'next') emit('next')
  else if (then === 'prev') emit('prev')
  else {
    emit('close')
    nextTick(() => button.value?.focus())
  }
}
function take(text: string): void {
  draft.value = text
  nextTick(() => input.value?.focus())
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
    finish('close')
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const chosen = options.value[active.value]?.text ?? draft.value
    if (active.value > 0) draft.value = chosen
    if (commit(chosen)) finish('close')
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    if (commit()) finish(e.shiftKey ? 'prev' : 'next')
  }
}
function onBlur(): void {
  if (settled || !props.open) return
  commit()
  settled = true
  emit('close')
}
</script>

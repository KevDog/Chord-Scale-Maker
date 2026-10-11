import type { Ref } from 'vue'
import { type GuideLine, type InstrumentName, isInstrumentName, type ShareView } from '~~/engine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** the preview's instrument, start note and interval labels, and whether the editor is shown, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (isInstrumentName(s) ? s : undefined), 'concert')
  const start = storedRef<string>('csm-start', (s) => ((PICKER_ROOTS as readonly string[]).includes(s) ? s : undefined), 'C')
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor (grid + text): hidden until shown, song-first
  // the Changes sheet's study rows: each chord's numeral and its scale, both on until turned off
  const numerals = storedRef<boolean>('csm-numerals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  const scaleNames = storedRef<boolean>('csm-scale-names', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the Changes sheet's guide tone line, at most one: from the 3rd (A) or from the 7th (B); off until chosen
  const guideLine = storedRef<GuideLine>('csm-guide-line', (s) => (s === 'off' || s === 'third' || s === 'seventh' ? s : undefined), 'off')
  // the editor grid's Notes column: why each scale was chosen; hidden until shown
  const notes = storedRef<boolean>('csm-grid-notes', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the text editor under the full-width grid (with the functions flag): shown until hidden
  const textPane = storedRef<boolean>('csm-text-pane', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the /functions page's key: C major until another is picked
  const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')
  return { instrument, start, intervals, showEditor, numerals, scaleNames, guideLine, notes, textPane, functionsKey }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const start = view.start && (PICKER_ROOTS as readonly string[]).includes(view.start) ? view.start : own.start.value
  return {
    instrument: ref<InstrumentName>(view.instrument ?? own.instrument.value),
    start: ref<string>(start),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    numerals: ref<boolean>(view.numerals ?? own.numerals.value),
    scaleNames: ref<boolean>(view.scaleNames ?? own.scaleNames.value),
    guideLine: ref<GuideLine>(view.guideLine ?? 'off'), // a link without one shows no line
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    textPane: own.textPane,
    notes: own.notes, // whether the grid's Notes column is shown: yours, and remembered
  }
}

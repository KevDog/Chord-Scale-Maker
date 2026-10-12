import type { Ref } from 'vue'
import { type GuideLine, type InstrumentName, isInstrumentName, type ShareView } from '@chord-scale-maker/engine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'
import { isSpell, type Spell } from '~/utils/scaleChoices'

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** the preview's instrument, spelling (from the chart's key until another is picked) and interval labels, and whether the editor is shown, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (isInstrumentName(s) ? s : undefined), 'concert')
  const spell = storedRef<Spell>('csm-spell', (s) => (isSpell(s) ? s : undefined), 'key') // csm-start, the old note, is ignored
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor: hidden until shown, song-first
  // the Changes sheet's study rows: each chord's numeral and its scale, both on until turned off
  const numerals = storedRef<boolean>('csm-numerals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  const scaleNames = storedRef<boolean>('csm-scale-names', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the Changes sheet's guide tone line, at most one: from the 3rd (A) or from the 7th (B); off until chosen
  const guideLine = storedRef<GuideLine>('csm-guide-line', (s) => (s === 'off' || s === 'third' || s === 'seventh' ? s : undefined), 'off')
  // the editor's Source (the chart's text): hidden until shown
  const source = storedRef<boolean>('csm-source', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the /functions page's key: C major until another is picked
  const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')
  return { instrument, spell, intervals, showEditor, numerals, scaleNames, guideLine, source, functionsKey }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  // a link's spelling: from the root, its note, or (from, without a note) the key
  const note = PICKER_ROOTS.find((r) => r === view.start)
  const linked: Spell | undefined = view.mode === 'root' ? 'root' : view.mode === 'from' ? (note ?? 'key') : undefined
  return {
    instrument: ref<InstrumentName>(view.instrument ?? own.instrument.value),
    spell: ref<Spell>(linked ?? own.spell.value),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    numerals: ref<boolean>(view.numerals ?? own.numerals.value),
    scaleNames: ref<boolean>(view.scaleNames ?? own.scaleNames.value),
    guideLine: ref<GuideLine>(view.guideLine ?? 'off'), // a link without one shows no line
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    source: own.source,
  }
}

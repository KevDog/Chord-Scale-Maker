import type { Ref } from 'vue'
import { type InstrumentName, isInstrumentName, type ShareView } from '~~/engine'

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** the preview's instrument, start note and interval labels, and whether the editor shows its Text pane, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (isInstrumentName(s) ? s : undefined), 'concert')
  const start = storedRef<string>('csm-start', (s) => ((PICKER_ROOTS as readonly string[]).includes(s) ? s : undefined), 'C')
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showText = storedRef<boolean>('csm-show-text', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor's Text pane: hidden until shown
  return { instrument, start, intervals, showText }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const start = view.start && (PICKER_ROOTS as readonly string[]).includes(view.start) ? view.start : own.start.value
  return {
    instrument: ref<InstrumentName>(view.instrument ?? own.instrument.value),
    start: ref<string>(start),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    showText: own.showText, // how you like the editor laid out: yours, and remembered
  }
}

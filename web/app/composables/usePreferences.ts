import { type InstrumentName, isInstrumentName } from '~~/engine'

const INSTRUMENT_KEY = 'csm-instrument'
const START_KEY = 'csm-start'
const INTERVALS_KEY = 'csm-intervals'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the choice still applies for this visit
  }
}

/** the preview's instrument, start note and interval labels, remembered in this browser (client-only) */
export function usePreferences() {
  const stored = read(INSTRUMENT_KEY) ?? ''
  const storedStart = read(START_KEY) ?? ''
  const instrument = ref<InstrumentName>(isInstrumentName(stored) ? stored : 'concert')
  const start = ref<string>((PICKER_ROOTS as readonly string[]).includes(storedStart) ? storedStart : 'C')

  watch(instrument, (v) => write(INSTRUMENT_KEY, v))
  const intervals = ref(read(INTERVALS_KEY) === 'on')

  watch(start, (v) => write(START_KEY, v))
  watch(intervals, (v) => write(INTERVALS_KEY, v ? 'on' : 'off'))

  return { instrument, start, intervals }
}

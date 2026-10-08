import { type InstrumentName, INSTRUMENTS } from '~~/engine'

export type InstrumentGroup = Readonly<{ label: string; instruments: readonly InstrumentName[] }>

const GROUP_LABELS: Readonly<Record<string, string>> = {
  'treble/C': 'Concert pitch (C)',
  'treble/Bb': 'B♭ instruments',
  'treble/Eb': 'E♭ instruments',
  'treble/F': 'F instruments',
  'bass/C': 'Bass clef (C)',
}

/** instruments grouped by what they read (clef + key), in preset order */
export const INSTRUMENT_GROUPS: readonly InstrumentGroup[] = Object.entries(GROUP_LABELS).map(([id, label]) => ({
  label,
  instruments: (Object.keys(INSTRUMENTS) as InstrumentName[]).filter((n) => {
    const { clef, trans } = INSTRUMENTS[n]
    return `${clef}/${trans}` === id
  }),
}))

/** "tenor-sax" -> "Tenor sax" for the dropdown */
export const instrumentOption = (name: InstrumentName): string => {
  const words = name.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

import { type InstrumentName, INSTRUMENTS } from '~~/engine'

export type InstrumentGroup = Readonly<{ label: string; instruments: readonly InstrumentName[] }>

const GROUP_LABELS: Readonly<Record<string, string>> = {
  'treble/C': 'Concert Pitch (C)',
  'treble/Bb': 'B♭ Instruments',
  'treble/Eb': 'E♭ Instruments',
  'treble/F': 'F Instruments',
  'bass/C': 'Bass Clef (C)',
}

/** instruments grouped by what they read (clef + key), in preset order */
export const INSTRUMENT_GROUPS: readonly InstrumentGroup[] = Object.entries(GROUP_LABELS).map(([id, label]) => ({
  label,
  instruments: (Object.keys(INSTRUMENTS) as InstrumentName[]).filter((n) => {
    const { clef, trans } = INSTRUMENTS[n]
    return `${clef}/${trans}` === id
  }),
}))

/** "tenor-sax" -> "Tenor Sax" for the dropdown (title case) */
export const instrumentOption = (name: InstrumentName): string =>
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

import { type InstrumentName, INSTRUMENTS } from '@chord-scale-maker/engine'

/** pitch: the group's name in the picker's first step (#417) */
export type InstrumentGroup = Readonly<{ label: string; pitch: string; instruments: readonly InstrumentName[] }>

const GROUP_LABELS: Readonly<Record<string, readonly [label: string, pitch: string]>> = {
  'treble/C': ['Concert Pitch (C)', 'Concert'],
  'treble/Bb': ['B♭ Instruments', 'B♭'],
  'treble/Eb': ['E♭ Instruments', 'E♭'],
  'treble/F': ['F Instruments', 'F'],
  'bass/C': ['Bass Clef (C)', 'Bass'],
}

/** instruments grouped by what they read (clef + key), in preset order */
export const INSTRUMENT_GROUPS: readonly InstrumentGroup[] = Object.entries(GROUP_LABELS).map(([id, [label, pitch]]) => ({
  label,
  pitch,
  instruments: (Object.keys(INSTRUMENTS) as InstrumentName[]).filter((n) => {
    const { clef, trans } = INSTRUMENTS[n]
    return `${clef}/${trans}` === id
  }),
}))

/** "tenor-sax" -> "B♭": the pitch it is listed under */
export const pitchOf = (name: InstrumentName): string => INSTRUMENT_GROUPS.find((g) => g.instruments.includes(name))?.pitch ?? ''

/** "tenor-sax" -> "Tenor Sax" for the dropdown (title case) */
export const instrumentOption = (name: InstrumentName): string =>
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

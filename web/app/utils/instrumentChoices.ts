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

const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const
/** 58 -> "B♭3" (middle C = C4) */
const noteName = (midi: number): string => `${NOTE[midi % 12]}${Math.floor(midi / 12) - 1}`
/** ["a", "b", "c"] -> "a, b and c" */
const listed = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/** each written guide tone range in INSTRUMENTS, instruments sharing one range together: "concert C4–A5; piano and flute C4–C6; …" */
export function guideRanges(): string {
  const groups = new Map<string, string[]>()
  for (const n of Object.keys(INSTRUMENTS) as InstrumentName[]) {
    const { lo, hi } = INSTRUMENTS[n].range
    const key = `${noteName(lo)}–${noteName(hi)}`
    groups.set(key, [...(groups.get(key) ?? []), n.replace(/-/g, ' ')])
  }
  return [...groups].map(([range, names]) => `${listed(names)} ${range}`).join('; ')
}

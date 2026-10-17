/**
 * Instrument presets (clef, transposition, full and practice ranges, description) and clef ranges. Port of INSTRUMENTS and TRANSPOSITIONS.
 */

export type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
export type Clef = 'treble' | 'bass'
/** a guide tone line's written range (MIDI, C4 = 60): candidates lie in [lo, hi]; centre places a start and breaks ties */
export type Range = Readonly<{ lo: number; hi: number; centre: number }>
/** an instrument's full written range (MIDI), what the picker shows; range is the lines' practice range inside it */
export type Compass = Readonly<{ lo: number; hi: number }>
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string; compass: Compass; range: Range }>

/** the most a guide tone line may need on the staff: three ledger lines either side in treble (E3–F6), two in bass (B1–F4) */
export const CAPS: Readonly<Record<Clef, Readonly<{ lo: number; hi: number }>>> = {
  treble: { lo: 52, hi: 89 },
  bass: { lo: 35, hi: 65 },
}

/** written = concert + interval: [letter steps, semitones] up from concert */
export const TRANSPOSITIONS: Readonly<Record<Transposition, readonly [number, number]>> = {
  C: [0, 0],
  Bb: [1, 2],
  Eb: [5, 9],
  F: [4, 7],
}

const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const
/** 58 -> "B♭3" (middle C = C4) */
export const noteName = (midi: number): string => `${NOTE[midi % 12]}${Math.floor(midi / 12) - 1}`

type Preset = Omit<Instrument, 'description'>
/** the picker's line: the full written range, then a note where it tells the player something ("F3–E6 · right hand") */
const described = <P extends Preset>(p: P, note?: string): P & Readonly<{ description: string }> => ({
  ...p,
  description: [`${noteName(p.compass.lo)}–${noteName(p.compass.hi)}`, note].filter(Boolean).join(' · '),
})

/** octave transpositions (guitar, bass, tenor, bari) don't matter: scales sit in a fixed written range */
export const INSTRUMENTS = {
  piano: described({ clef: 'treble', trans: 'C', compass: { lo: 53, hi: 88 }, range: { lo: 53, hi: 88, centre: 70 } }, 'right hand'), // F3–E6 (the treble staff's share), centre B♭4
  vibes: described({ clef: 'treble', trans: 'C', compass: { lo: 53, hi: 89 }, range: { lo: 53, hi: 89, centre: 70 } }), // F3–F6, all three octaves, centre the middle B♭ (B♭4)
  flute: described({ clef: 'treble', trans: 'C', compass: { lo: 60, hi: 96 }, range: { lo: 60, hi: 84, centre: 73 } }, 'also oboe, violin and any other treble C instrument'), // C4–C6, centre C♯5
  guitar: described({ clef: 'treble', trans: 'C', compass: { lo: 52, hi: 86 }, range: { lo: 57, hi: 81, centre: 66 } }), // A3–A5 written, centre F♯4
  trumpet: described({ clef: 'treble', trans: 'Bb', compass: { lo: 54, hi: 84 }, range: { lo: 55, hi: 79, centre: 70 } }), // G3–G5 written, centre B♭4
  flugelhorn: described({ clef: 'treble', trans: 'Bb', compass: { lo: 54, hi: 84 }, range: { lo: 55, hi: 79, centre: 70 } }), // G3–G5 written, centre B♭4
  clarinet: described({ clef: 'treble', trans: 'Bb', compass: { lo: 52, hi: 96 }, range: { lo: 57, hi: 84, centre: 66 } }), // A3–C6 written, centre F♯4
  'soprano-sax': described({ clef: 'treble', trans: 'Bb', compass: { lo: 58, hi: 89 }, range: { lo: 58, hi: 84, centre: 68 } }), // B♭3–C6 written, centre A♭4
  'tenor-sax': described({ clef: 'treble', trans: 'Bb', compass: { lo: 58, hi: 90 }, range: { lo: 58, hi: 84, centre: 68 } }), // B♭3–C6 written, centre A♭4
  'alto-sax': described({ clef: 'treble', trans: 'Eb', compass: { lo: 58, hi: 90 }, range: { lo: 58, hi: 84, centre: 68 } }), // B♭3–C6 written, centre A♭4
  'bari-sax': described({ clef: 'treble', trans: 'Eb', compass: { lo: 58, hi: 90 }, range: { lo: 58, hi: 84, centre: 68 } }), // B♭3–C6 written, centre A♭4
  horn: described({ clef: 'treble', trans: 'F', compass: { lo: 42, hi: 84 }, range: { lo: 55, hi: 79, centre: 70 } }), // G3–G5 written, centre B♭4
  trombone: described({ clef: 'bass', trans: 'C', compass: { lo: 40, hi: 77 }, range: { lo: 40, hi: 64, centre: 56 } }), // E2–E4, centre A♭3
  tuba: described({ clef: 'bass', trans: 'C', compass: { lo: 26, hi: 65 }, range: { lo: 36, hi: 58, centre: 47 } }), // C2–B♭3, centre B2
  bass: described({ clef: 'bass', trans: 'C', compass: { lo: 40, hi: 67 }, range: { lo: 40, hi: 60, centre: 49 } }), // E2–C4 written, centre C♯3
} as const satisfies Record<string, Instrument>

export type InstrumentName = keyof typeof INSTRUMENTS

export const isInstrumentName = (name: string): name is InstrumentName => Object.hasOwn(INSTRUMENTS, name)

/** "tenor-sax" -> "Tenor Sax (Bb)", "piano" -> "Piano" (the page-subtitle label) */
export function instrumentLabel(name: InstrumentName): string {
  const words = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  const { trans } = INSTRUMENTS[name]
  return words.join(' ') + (trans === 'C' ? '' : ` (${trans})`)
}

/** default 'from' pitch: C4 / C3 (MIDI, middle C = 60) */
export const CLEF_START: Readonly<Record<Clef, number>> = { treble: 60, bass: 48 }
/** root-spelled scales start in Bb3..A4 / G2..F#3 */
export const CLEF_ROOT_LOW: Readonly<Record<Clef, number>> = { treble: 58, bass: 43 }

/**
 * Instrument presets (clef, transposition, description) and clef ranges. Port of INSTRUMENTS and TRANSPOSITIONS.
 */

export type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
export type Clef = 'treble' | 'bass'
/** a guide tone line's written range (MIDI, C4 = 60): candidates lie in [lo, hi]; centre places a start and breaks ties */
export type Range = Readonly<{ lo: number; hi: number; centre: number }>
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string; range: Range }>

/** the most a guide tone line may need on the staff: two ledger lines either side (treble G3–D6, bass B1–F4) */
export const CAPS: Readonly<Record<Clef, Readonly<{ lo: number; hi: number }>>> = {
  treble: { lo: 55, hi: 86 },
  bass: { lo: 35, hi: 65 },
}

/** written = concert + interval: [letter steps, semitones] up from concert */
export const TRANSPOSITIONS: Readonly<Record<Transposition, readonly [number, number]>> = {
  C: [0, 0],
  Bb: [1, 2],
  Eb: [5, 9],
  F: [4, 7],
}

/** octave transpositions (guitar, bass, tenor, bari) don't matter: scales sit in a fixed written range */
export const INSTRUMENTS = {
  concert: { clef: 'treble', trans: 'C', description: 'any C instrument, treble clef (piano RH, vibes, flute, violin)', range: { lo: 60, hi: 81, centre: 69 } }, // C4–A5, centre A4
  piano: { clef: 'treble', trans: 'C', description: 'same as concert', range: { lo: 60, hi: 84, centre: 70 } }, // C4–C6, centre B♭4
  vibes: { clef: 'treble', trans: 'C', description: 'same as concert', range: { lo: 55, hi: 86, centre: 70 } }, // G3–D6, centre the middle B♭ (B♭4)
  flute: { clef: 'treble', trans: 'C', description: 'same as concert', range: { lo: 60, hi: 84, centre: 73 } }, // C4–C6, centre C♯5
  guitar: { clef: 'treble', trans: 'C', description: 'same as concert', range: { lo: 57, hi: 81, centre: 63 } }, // A3–A5 written, centre D♯4
  trumpet: { clef: 'treble', trans: 'Bb', description: 'Bb, written a major 2nd up', range: { lo: 60, hi: 79, centre: 70 } }, // C4–G5 written, centre B♭4
  flugelhorn: { clef: 'treble', trans: 'Bb', description: 'same as trumpet', range: { lo: 60, hi: 79, centre: 70 } }, // C4–G5 written, centre B♭4
  clarinet: { clef: 'treble', trans: 'Bb', description: 'same as trumpet', range: { lo: 57, hi: 84, centre: 66 } }, // A3–C6 written, centre F♯4
  'soprano-sax': { clef: 'treble', trans: 'Bb', description: 'same as trumpet', range: { lo: 58, hi: 84, centre: 68 } }, // B♭3–C6 written, centre A♭4
  'tenor-sax': { clef: 'treble', trans: 'Bb', description: 'same key as trumpet (sounds an octave lower)', range: { lo: 58, hi: 84, centre: 68 } }, // B♭3–C6 written, centre A♭4
  'alto-sax': { clef: 'treble', trans: 'Eb', description: 'Eb, written a major 6th up', range: { lo: 58, hi: 84, centre: 68 } }, // B♭3–C6 written, centre A♭4
  'bari-sax': { clef: 'treble', trans: 'Eb', description: 'same key as alto (sounds an octave lower)', range: { lo: 58, hi: 84, centre: 68 } }, // B♭3–C6 written, centre A♭4
  horn: { clef: 'treble', trans: 'F', description: 'French horn in F, written a perfect 5th up', range: { lo: 60, hi: 79, centre: 70 } }, // C4–G5 written, centre B♭4
  trombone: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch', range: { lo: 46, hi: 64, centre: 56 } }, // B♭2–E4, centre A♭3
  tuba: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch', range: { lo: 36, hi: 58, centre: 47 } }, // C2–B♭3, centre B2
  bass: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch', range: { lo: 40, hi: 60, centre: 49 } }, // E2–C4 written, centre C♯3
} as const satisfies Record<string, Instrument>

export type InstrumentName = keyof typeof INSTRUMENTS

export const isInstrumentName = (name: string): name is InstrumentName => Object.hasOwn(INSTRUMENTS, name)

/** "tenor-sax" -> "Tenor Sax (Bb)"; concert -> "" (the page-subtitle label) */
export function instrumentLabel(name: InstrumentName): string {
  if (name === 'concert') return ''
  const words = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  const { trans } = INSTRUMENTS[name]
  return words.join(' ') + (trans === 'C' ? '' : ` (${trans})`)
}

/** default 'from' pitch: C4 / C3 (MIDI, middle C = 60) */
export const CLEF_START: Readonly<Record<Clef, number>> = { treble: 60, bass: 48 }
/** root-spelled scales start in Bb3..A4 / G2..F#3 */
export const CLEF_ROOT_LOW: Readonly<Record<Clef, number>> = { treble: 58, bass: 43 }

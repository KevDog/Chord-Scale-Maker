export type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
export type Clef = 'treble' | 'bass'
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string }>

/** written = concert + interval: [letter steps, semitones] up from concert */
export const TRANSPOSITIONS: Readonly<Record<Transposition, readonly [number, number]>> = {
  C: [0, 0],
  Bb: [1, 2],
  Eb: [5, 9],
  F: [4, 7],
}

/** octave transpositions (guitar, bass, tenor, bari) don't matter: scales sit in a fixed written range */
export const INSTRUMENTS = {
  concert: { clef: 'treble', trans: 'C', description: 'any C instrument, treble clef (piano RH, vibes, flute, violin)' },
  piano: { clef: 'treble', trans: 'C', description: 'same as concert' },
  vibes: { clef: 'treble', trans: 'C', description: 'same as concert' },
  flute: { clef: 'treble', trans: 'C', description: 'same as concert' },
  guitar: { clef: 'treble', trans: 'C', description: 'same as concert' },
  trumpet: { clef: 'treble', trans: 'Bb', description: 'Bb, written a major 2nd up' },
  flugelhorn: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  clarinet: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'soprano-sax': { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'tenor-sax': { clef: 'treble', trans: 'Bb', description: 'same key as trumpet (sounds an octave lower)' },
  'alto-sax': { clef: 'treble', trans: 'Eb', description: 'Eb, written a major 6th up' },
  'bari-sax': { clef: 'treble', trans: 'Eb', description: 'same key as alto (sounds an octave lower)' },
  horn: { clef: 'treble', trans: 'F', description: 'French horn in F, written a perfect 5th up' },
  trombone: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  tuba: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  bass: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
} as const satisfies Record<string, Instrument>

export type InstrumentName = keyof typeof INSTRUMENTS

/** default 'from' pitch: C4 / C3 (MIDI, middle C = 60) */
export const CLEF_START: Readonly<Record<Clef, number>> = { treble: 60, bass: 48 }
/** root-spelled scales start in Bb3..A4 / G2..F#3 */
export const CLEF_ROOT_LOW: Readonly<Record<Clef, number>> = { treble: 58, bass: 43 }

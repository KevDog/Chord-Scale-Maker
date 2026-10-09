import { type Clef, type InstrumentName, type Transposition, CLEF_ROOT_LOW, CLEF_START, INSTRUMENTS, TRANSPOSITIONS } from './instruments'
import { type Spelled, LETTERS, mod, NAT_PC, parseRoot, pcOf, shiftBy } from './pitch'
import { type ScaleKey, type ScaleNote, parseScale, SCALES, simplifyRoot, spellScale } from './scales'

/**
 * A Part (clef + transposition) is how the sheet is written for one instrument: written roots and scales, scale
 * notes from the root or from a start note, labels.
 */

/** an instrument "view" of the chart */
export type Part = Readonly<{ clef: Clef; trans: Transposition }>
export type Mode = 'from' | 'root'
export type Pitched = Readonly<Spelled & { midi: number }>
type WrittenScale = Readonly<{ root: Spelled; key: ScaleKey; notes: readonly ScaleNote[] }>
export type ScaleLabel = Readonly<{ root: Spelled; name: string }>

export const CONCERT: Part = { clef: 'treble', trans: 'C' }

/** the clef and transposition an instrument reads in */
export const partFor = (name: InstrumentName): Part => {
  const { clef, trans } = INSTRUMENTS[name]
  return { clef, trans }
}

/** move a spelled note up by the transposition interval */
function transposeRoot(n: Spelled, trans: Transposition): Spelled {
  const [steps, semis] = TRANSPOSITIONS[trans]
  return shiftBy(n, steps, semis)
}

export const writtenRoot = (part: Part, n: Spelled, key?: ScaleKey): Spelled =>
  part.trans === 'C' ? n : simplifyRoot(transposeRoot(n, part.trans), key)

/** concert scale text -> written root, key and spelled notes */
export function writtenScale(part: Part, text: string): WrittenScale {
  const { root, key } = parseScale(text)
  const written = writtenRoot(part, root, key)
  return { root: written, key, notes: spellScale(written, key) }
}

export function scaleNotes(part: Part, text: string, mode: Mode, start: number): Pitched[] {
  const { root, notes } = writtenScale(part, text)
  const rootPc = pcOf(root)
  if (mode === 'root') {
    const low = CLEF_ROOT_LOW[part.clef]
    const p0 = low + mod(rootPc - low, 12)
    return notes.map((n) => ({ letter: n.letter, acc: n.acc, midi: p0 + n.semis }))
  }
  // every note in the octave beginning at the start pitch
  return notes
    .map((n) => ({ letter: n.letter, acc: n.acc, midi: start + mod(rootPc + n.semis - start, 12) }))
    .sort((a, b) => a.midi - b.midi)
}

export function scaleLabel(part: Part, text: string): ScaleLabel {
  const { root, key } = writtenScale(part, text)
  return { root, name: SCALES[key][1] }
}

/** LilyPond note name, e.g. ees': a compact note spelling for the golden fixture */
export function lilyNote(n: Pitched): string {
  const d = n.midi - NAT_PC[n.letter] - n.acc
  if (mod(d, 12) !== 0) throw new Error(`pitch ${n.midi} does not match its spelling`)
  const marks = Math.floor(d / 12) - 4 // written octave, C4 = 60; c = octave 3
  const name = LETTERS[n.letter].toLowerCase() + (n.acc > 0 ? 'is'.repeat(n.acc) : 'es'.repeat(-n.acc))
  return name + (marks >= 0 ? "'".repeat(marks) : ','.repeat(-marks))
}

/** 'C' -> { exact: null, pc: 0 }; 'F#3' -> { exact: 54, pc: 6 } (middle C = C4) */
export function parseStart(text: string): Readonly<{ exact: number | null; pc: number }> {
  const m = /^([A-Ga-g][b#♭♯]*)(\d)?$/.exec(text.trim())
  if (!m) throw new Error(`bad start note ${JSON.stringify(text)} (try C, Eb, F#3)`)
  const [, note = '', octave] = m
  const r = parseRoot(note)
  const pc = NAT_PC[r.letter] + r.acc
  return { exact: octave === undefined ? null : 12 * (Number(octave) + 1) + pc, pc }
}

/** written start pitch: exact octave if given, else the first one at/above the clef's default */
export function resolveStart(clef: Clef, text: string): number {
  const { exact, pc } = parseStart(text)
  const base = CLEF_START[clef]
  return exact ?? base + mod(pc - base, 12)
}

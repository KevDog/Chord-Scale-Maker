import { tonicOf } from './analysis/functions'
import type { Key } from './analysis/keys'
import { type Part, type Pitched, writtenRoot } from './part'
import { accText, type Letter, NAT_PC, parseRoot, rootName, shiftBy } from './pitch'
import { SCALES, simplifyRoot, spellFrom } from './scales'

/**
 * Key signatures (docs/superpowers/specs/2026-10-10-key-signatures-design.md): the tune's key written for a part as
 * VexFlow names it, the letters it alters, and which notes then need an accidental (the measure rule).
 */

/** the VexFlow major-key spec for the key as written for the part (a minor key by its relative major); null: none */
export function keySignature(key: Key | null, part: Part): string | null {
  if (!key) return null
  const tonic = tonicOf(key)
  const major = key.minor ? shiftBy(tonic, 2, 3) : tonic
  return rootName(simplifyRoot(writtenRoot(part, major, 'ionian'), 'ionian'))
}

/** the letters a signature alters, and by how much (Eb: E, A and B a flat) */
export function signatureAccidentals(spec: string | null): ReadonlyMap<Letter, number> {
  if (!spec) return new Map()
  return new Map(spellFrom(parseRoot(spec), SCALES.ionian[0]).filter((n) => n.acc !== 0).map((n) => [n.letter, n.acc]))
}

export type BarNote = Readonly<{ letter: Letter; acc: number; octave: number; tiedIn?: boolean }>

/** each note's printed accidental ('#', 'b', 'n', '##', 'bb') or null: shown where it differs from what's in force */
export function accidentalsInBar(notes: readonly BarNote[], spec: string | null): (string | null)[] {
  const sig = signatureAccidentals(spec)
  const inForce = new Map<string, number>()
  return notes.map((n) => {
    const place = `${n.letter}/${n.octave}`
    if (n.tiedIn) return null // carried over the barline: nothing is written here, so nothing is in force from it
    const current = inForce.get(place) ?? sig.get(n.letter) ?? 0
    inForce.set(place, n.acc)
    if (n.acc === current) return null
    return n.acc === 0 ? 'n' : accText(n.acc)
  })
}

/** the octave number VexFlow writes for a spelled pitch (middle C = 4; B#4 sounds as C5) */
export const octaveOf = (p: Pitched): number => (p.midi - NAT_PC[p.letter] - p.acc) / 12 - 1

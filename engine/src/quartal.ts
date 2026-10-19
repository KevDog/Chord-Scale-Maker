import { guideToneDegrees } from './guideTones'
import type { Range } from './instruments'
import { chordTonePcs } from './hexatonics'
import { fifthsFrom } from './ladder'
import { glyphs, mod, pcOf, rootName, type Spelled } from './pitch'
import { spellFrom } from './scales'

/**
 * Quartal stacks (#432 §3): a seven-note scale's notes three steps apart, so each pair a fourth apart, from each degree.
 * A stack keeps perfect fourths and at most one augmented one (the owner's default); perfect-only keeps none.
 */
export type QuartalNotes = 3 | 4
export const QUARTAL_NOTES: readonly QuartalNotes[] = [3, 4]
/** Built on: the scale degree a stack starts on, 1–7, or Auto */
export type QuartalDegree = 'auto' | number
/** a stack: its bottom's scale degree, its notes bottom up, its name ('D G C F'), its augmented fourths, and what it holds of the chord */
export type QuartalStack = Readonly<{ degree: number; notes: readonly Spelled[]; pcs: readonly number[]; name: string; augmented: number; avoid: boolean; guides: number; tones: number }>

const PERFECT = 5
const AUGMENTED = 6

/** a chord's guide tones as pitch classes (its 3rd and 7th, the 4th on a sus chord); empty if the quality is unknown */
const guidePcs = (chordRoot: Spelled, quality: string | null): ReadonlySet<number> => {
  const degrees = quality === null ? null : guideToneDegrees(quality)
  return new Set(degrees ? spellFrom(chordRoot, degrees.join(' ')).map(pcOf) : [])
}

/** a staff's stacks of `notes` notes, by degree from 1; none on a scale that is not seven notes */
export function quartalStacks(scale: readonly Spelled[], chordRoot: Spelled, quality: string | null, notes: QuartalNotes, perfectOnly = false): readonly QuartalStack[] {
  if (scale.length !== 7) return []
  const tones = chordTonePcs(chordRoot, quality)
  const guides = guidePcs(chordRoot, quality)
  const scalePcs = new Set(scale.map(pcOf))
  // an avoid note: a scale note outside the chord a half step above one of its tones
  const avoids = new Set([...scalePcs].filter((pc) => !tones.has(pc) && tones.has(mod(pc - 1, 12))))
  return scale.flatMap((_, i) => {
    const stack = Array.from({ length: notes }, (__, k) => scale[(i + 3 * k) % 7]!)
    const pcs = stack.map(pcOf)
    const fourths = pcs.slice(1).map((pc, k) => mod(pc - pcs[k]!, 12))
    if (fourths.some((f) => f !== PERFECT && f !== AUGMENTED)) return []
    const augmented = fourths.filter((f) => f === AUGMENTED).length
    if (augmented > (perfectOnly ? 0 : 1)) return []
    return [{ degree: i + 1, notes: stack, pcs, name: stack.map((n) => glyphs(rootName(n))).join(' '), augmented, avoid: pcs.some((pc) => avoids.has(pc)), guides: pcs.filter((pc) => guides.has(pc)).length, tones: pcs.filter((pc) => tones.has(pc)).length }]
  })
}

/**
 * the stacks in Auto's order: no avoid note first, then the most guide tones, perfect fourths before an augmented one,
 * the most chord tones, then the bottom note fewest fifths from the chord root (♭ side first), then by degree
 */
export function quartalRanking(stacks: readonly QuartalStack[], chordRoot: Spelled): readonly QuartalStack[] {
  const ref = pcOf(chordRoot)
  const key = (s: QuartalStack): readonly number[] => {
    const fifths = fifthsFrom(s.pcs[0]!, ref)
    return [s.avoid ? 1 : 0, -s.guides, s.augmented, -s.tones, Math.abs(fifths), fifths, s.degree]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((d, x, j) => d || x - b[j]!, 0)
  return [...stacks].sort((a, b) => cmp(key(a), key(b)))
}

/** the Changes sheet's Notes: 3, 4, or Auto, by the part's range (#432) */
export type QuartalNotesChoice = 'auto' | QuartalNotes

/** a stack's span bottom to top, in semitones */
const spanOf = (s: QuartalStack): number => s.pcs.slice(1).reduce((sum, pc, k) => sum + mod(pc - s.pcs[k]!, 12), 0)

/** whether some octave of a stack (its pitch classes written) lies inside a range */
export function stackFits(s: QuartalStack, range: Range): boolean {
  for (let m = range.lo; m + spanOf(s) <= range.hi; m++) if (mod(m, 12) === s.pcs[0]) return true
  return false
}

/** a chord's stacks in Auto's order; Notes Auto stacks four where two of its four-note stacks fit the range, else three */
export function rankedStacks(scale: readonly Spelled[], chordRoot: Spelled, quality: string | null, notes: QuartalNotesChoice, perfectOnly: boolean, range: Range): readonly QuartalStack[] {
  const ranked = (n: QuartalNotes) => quartalRanking(quartalStacks(scale, chordRoot, quality, n, perfectOnly), chordRoot)
  if (notes !== 'auto') return ranked(notes)
  const four = ranked(4)
  return four.filter((s) => stackFits(s, range)).length >= 2 ? four : ranked(3)
}

/** a staff's stack under the Quartal preset: its name, the degree it's built on, how many notes; picked and sheet as the other presets' */
export type StaffQuartal = Readonly<{ name: string; degree: number; notes: QuartalNotes; picked: boolean; sheet: string }>

/**
 * the stack Built on `degree` (Auto, or one with no stack, reads as Auto) on a staff's scale (its notes from the root,
 * as written), and which of the staff's notes (`pcs`) it lights
 */
export function quartalPick(
  scale: readonly Spelled[],
  chordRoot: Spelled,
  quality: string | null,
  degree: QuartalDegree,
  notes: QuartalNotes,
  perfectOnly: boolean,
  pcs: readonly number[],
): Readonly<{ quartal: StaffQuartal | null; lit: boolean[] }> {
  const ranked = quartalRanking(quartalStacks(scale, chordRoot, quality, notes, perfectOnly), chordRoot)
  const used = (degree === 'auto' ? undefined : ranked.find((s) => s.degree === degree)) ?? ranked[0]
  if (!used) return { quartal: null, lit: pcs.map(() => false) }
  return { quartal: { name: used.name, degree: used.degree, notes, picked: false, sheet: used.name }, lit: pcs.map((pc) => used.pcs.includes(pc)) }
}

/** "D G C F · 4ths", or "no 4ths stack" */
export const quartalCaption = (q: StaffQuartal | null): string => (q ? `${q.name} · 4ths` : 'no 4ths stack')

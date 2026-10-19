import { parseChord, writtenChordRootLenient, writtenChordTextOrNull } from './chord'
import { hexatonicPairs, hexatonicRanking } from './hexatonics'
import { concertPc, type Part, rangeOf, scaleLabel, writtenScale } from './part'
import { PENTATONIC_DEGREE_LABELS, pentatonicRanking } from './pentatonics'
import { glyphs, mod, pcOf } from './pitch'
import { type QuartalNotesChoice, rankedStacks } from './quartal'
import { baseQuality } from './qualities'
import { orNull } from './util'

/** a popover's rows (#303): one chord's choices from inside to outside, written for the part; pitch classes concert, as picks store them */
export type PentChoice = Readonly<{ pc: number; name: string; degree: number; shared: number; label: string }>
export type HexChoice = Readonly<{ roots: readonly [number, number]; name: string; coverage: number; label: string }>
export type QuartChoice = Readonly<{ pc: number; name: string; degree: number; guides: number; label: string }>

const read = (chord: string, scale: string, part: Part) =>
  orNull(() => {
    const w = writtenScale(part, scale)
    return { w, root: orNull(() => writtenChordRootLenient(part, chord, scale)) ?? w.root }
  })

/** the 12 minor pentatonics against the chord's scale, ranked as the sheet ranks them; [] if the scale can't be read */
export function pentatonicChoices(chord: string, scale: string, part: Part): readonly PentChoice[] {
  const r = read(chord, scale, part)
  if (!r) return []
  const pcs = new Set(r.w.notes.map((n) => mod(pcOf(r.w.root) + n.semis, 12))) // as buildChanges ranks
  return pentatonicRanking(pcs, r.root).map((p) => ({
    pc: concertPc(part, pcOf(p.root)),
    name: p.name,
    degree: p.degree,
    shared: p.shared,
    label: `${p.name} pent · on ${PENTATONIC_DEGREE_LABELS[p.degree]} · ${p.shared} shared`,
  }))
}

/** the scale's triad pairs in Auto's order, with chord-tone coverage; [] if none */
export function hexatonicChoices(chord: string, scale: string, part: Part): readonly HexChoice[] {
  const r = read(chord, scale, part)
  if (!r) return []
  const quality = orNull(() => baseQuality(parseChord(chord).quality))
  return hexatonicRanking(hexatonicPairs(r.w.notes, r.root, quality), r.root).map((p) => ({
    roots: [concertPc(part, pcOf(p.lower.root)), concertPc(part, pcOf(p.upper.root))] as const,
    name: p.name,
    coverage: p.coverage,
    label: `${p.name} · covers ${p.coverage}`,
  }))
}

/** the scale's quartal stacks (#432) in Auto's order, by their bottom note concert, with the guide tones each holds; [] if none */
export function quartalChoices(chord: string, scale: string, part: Part, notes: QuartalNotesChoice, perfectOnly: boolean): readonly QuartChoice[] {
  const r = read(chord, scale, part)
  if (!r) return []
  const quality = orNull(() => baseQuality(parseChord(chord).quality))
  return rankedStacks(r.w.notes, r.root, quality, notes, perfectOnly, rangeOf(part)).map((s) => ({
    pc: concertPc(part, s.pcs[0]!),
    name: s.name,
    degree: s.degree,
    guides: s.guides,
    label: `${s.name} · on ${s.degree} · ${s.guides} guide tone${s.guides === 1 ? '' : 's'}`,
  }))
}

/** a popover's heading: the chord written for the part and its scale's name ('D♭7 Mixolydian') */
export const pickHeading = (part: Part, chord: string, scale: string): string =>
  orNull(() => `${glyphs(writtenChordTextOrNull(part, chord, scale) ?? chord)} ${scaleLabel(part, scale).name}`) ?? glyphs(chord)

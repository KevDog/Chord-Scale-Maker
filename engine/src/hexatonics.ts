import { fifthsFrom, pitchClasses, rankByFifths } from './ladder'
import { type Part, writtenRoot } from './part'
import { glyphs, mod, parseRoot, pcOf, rootName, shiftBy, type Spelled } from './pitch'
import { CHORD_TONES } from './qualities'
import { SCALES, simplifyRoot, spellFrom, spellScale } from './scales'

/**
 * Hexatonics (docs/superpowers/specs/2026-10-14-hexatonic-practice-design.md): six-note sets made of two triads from a
 * staff's own scale, after Gary Campbell, Triad Pairs for Jazz (2001), pp. 4–8. A scale's pairs come from its triad
 * chain: a start triad, each note moved one scale step up, until the chain returns; adjacent triads are the pairs.
 */
export type TriadQuality = 'maj' | 'min' | 'dim' | 'aug'
/** a triad on a scale note: its root as the staff spells it, and its pitch classes root, third, fifth */
export type ChainTriad = Readonly<{ root: Spelled; quality: TriadQuality; pcs: readonly number[]; name: string }>
/** a valid link of the chain: link numbers the staff's pairs from 1; tones: the six pcs ascending from the lower root; from: a tritone sub's pair, the sub chord it comes from ('D♭7', tritoneSubPairs) */
export type HexPair = Readonly<{ link: number; lower: ChainTriad; upper: ChainTriad; name: string; tones: readonly number[]; coverage: number; from?: string }>

/** [third, fifth] above the root, by quality */
const SHAPES: readonly (readonly [TriadQuality, number, number])[] = [
  ['maj', 4, 7],
  ['min', 3, 7],
  ['dim', 3, 6],
  ['aug', 4, 8],
]
const SUFFIX: Readonly<Record<TriadQuality, string>> = { maj: '', min: 'm', dim: '°', aug: '+' }

const qualityOn = (root: number, pcs: ReadonlySet<number>): TriadQuality | null =>
  SHAPES.find(([, third, fifth]) => pcs.has(mod(root + third, 12)) && pcs.has(mod(root + fifth, 12)))?.[0] ?? null

/** a triad on a root, of a quality */
export const chainTriad = (root: Spelled, quality: TriadQuality): ChainTriad => {
  const [, third, fifth] = SHAPES.find(([q]) => q === quality)!
  const pc = pcOf(root)
  return { root, quality, pcs: [pc, mod(pc + third, 12), mod(pc + fifth, 12)], name: glyphs(`${rootName(root)}${SUFFIX[quality]}`) }
}

/** three scale notes read as a triad (an augmented one, symmetric, on the note its stacking started from), or null */
function readTriad(scale: readonly Spelled[], indices: readonly number[]): ChainTriad | null {
  const set = new Set(indices.map((i) => pcOf(scale[i]!)))
  if (set.size !== 3) return null
  const roots = indices.filter((i) => qualityOn(pcOf(scale[i]!), set) !== null)
  const at = roots.includes(indices[0]!) ? indices[0]! : roots[0]
  if (at === undefined) return null
  return chainTriad(scale[at]!, qualityOn(pcOf(scale[at]!), set)!)
}

/** the start triad's scale indices: degrees 1 3 5 on a seven-note scale, else the first major triad from the root, else the first minor one */
function startTriad(scale: readonly Spelled[]): readonly number[] | null {
  if (scale.length === 7) return [0, 2, 4]
  const pcs = scale.map(pcOf)
  const on = (third: number): readonly number[] | null => {
    for (let i = 0; i < pcs.length; i++) {
      const t = pcs.indexOf(mod(pcs[i]! + third, 12))
      const f = pcs.indexOf(mod(pcs[i]! + 7, 12))
      if (t >= 0 && f >= 0) return [i, t, f]
    }
    return null
  }
  return on(4) ?? on(3)
}

/** a spelled scale's chain (its notes from the root), one entry per note, null where three notes make no triad; empty if it has no start triad */
export function triadChain(scale: readonly Spelled[]): readonly (ChainTriad | null)[] {
  const start = startTriad(scale)
  if (start === null) return []
  return scale.map((_, step) => readTriad(scale, start.map((i) => mod(i + step, scale.length))))
}

/** the chord's tones as pitch classes (CHORD_TONES by its base quality); empty if the quality is unknown */
export const chordTonePcs = (chordRoot: Spelled, quality: string | null): ReadonlySet<number> => {
  const degrees = quality === null ? undefined : CHORD_TONES[quality]
  return new Set(degrees ? spellFrom(chordRoot, degrees.join(' ')).map(pcOf) : [])
}

/** the scale's notes repeat a step of `by` semitones round the octave (diminished: 3, whole tone: 2, augmented: 4) */
const symmetric = (pcs: ReadonlySet<number>, size: number, by: number): boolean => pcs.size === size && [...pcs].every((pc) => pcs.has(mod(pc + by, 12)))

/**
 * a symmetric scale's pairs off its chain (#432), after Weiskopf, Intervalic Improvisation, pp. 12, 16: on a diminished
 * scale the major triads a tritone apart, then the minor ones, each lower root first in scale order; on whole tone its
 * two augmented triads, a whole step apart; on the augmented scale its two, a minor third apart; none on any other scale
 */
function offChainLinks(scale: readonly Spelled[]): readonly Readonly<{ lower: ChainTriad; upper: ChainTriad }>[] {
  const pcs = new Set(scale.map(pcOf))
  if (symmetric(pcs, 6, 2)) return [{ lower: chainTriad(scale[0]!, 'aug'), upper: chainTriad(scale[1]!, 'aug') }]
  if (symmetric(pcs, 6, 4)) return [{ lower: chainTriad(scale[0]!, 'aug'), upper: chainTriad(scale.find((n) => pcOf(n) === mod(pcOf(scale[0]!) + 3, 12))!, 'aug') }]
  if (!symmetric(pcs, 8, 3)) return []
  return (['maj', 'min'] as const).flatMap((quality) =>
    scale.flatMap((root, i) => {
      const lower = chainTriad(root, quality)
      const j = scale.findIndex((n) => pcOf(n) === mod(pcOf(root) + 6, 12))
      if (j <= i || !lower.pcs.every((pc) => pcs.has(pc))) return []
      return [{ lower, upper: chainTriad(scale[j]!, quality) }]
    }),
  )
}

/** a chain's links whose triads share no note */
function chainLinks(scale: readonly Spelled[]): readonly Readonly<{ lower: ChainTriad; upper: ChainTriad }>[] {
  const chain = triadChain(scale)
  return chain.flatMap((lower, i) => {
    const upper = chain[(i + 1) % chain.length] ?? null
    if (lower === null || upper === null || upper.pcs.some((pc) => lower.pcs.includes(pc))) return []
    return [{ lower, upper }]
  })
}

/** a staff's pairs: the chain's links whose triads are both standard and share no note, in chain order from 1, then a symmetric scale's off-chain pairs (offChainLinks), with chord-tone coverage */
export function hexatonicPairs(scale: readonly Spelled[], chordRoot: Spelled, quality: string | null): readonly HexPair[] {
  return pairsOf([...chainLinks(scale), ...offChainLinks(scale)], chordTonePcs(chordRoot, quality))
}

function pairsOf(links: readonly Readonly<{ lower: ChainTriad; upper: ChainTriad }>[], tones: ReadonlySet<number>): readonly HexPair[] {
  return links.map(({ lower, upper }, i) => {
    const base = lower.pcs[0]!
    const six = [...lower.pcs, ...upper.pcs].sort((a, b) => mod(a - base, 12) - mod(b - base, 12))
    return { link: i + 1, lower, upper, name: `${lower.name}/${upper.name}`, tones: six, coverage: six.filter((pc) => tones.has(pc)).length }
  })
}

const standard = (t: ChainTriad): boolean => t.quality === 'maj' || t.quality === 'min'

/**
 * The pairs in Auto's order: most chord tones covered, then a pair of major and minor triads, then the lower root
 * fewest fifths from the chord root (♭ side first), then chain position.
 */
export function hexatonicRanking(pairs: readonly HexPair[], chordRoot: Spelled): readonly HexPair[] {
  const ref = pcOf(chordRoot)
  const key = (p: HexPair): readonly number[] => {
    const fifths = fifthsFrom(pcOf(p.lower.root), ref)
    return [-p.coverage, standard(p.lower) && standard(p.upper) ? 0 : 1, Math.abs(fifths), fifths, p.link]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((d, x, j) => d || x - b[j]!, 0)
  return [...pairs].sort((a, b) => cmp(key(a), key(b)))
}

/** the most a dominant's popover offers from its tritone sub */
const SUB_PAIRS = 2
const dominant = (quality: string | null): boolean => {
  const degrees = quality === null ? undefined : CHORD_TONES[quality]
  return !!degrees && degrees.includes('3') && degrees.includes('b7')
}
/** B, not C♭: a triad root without a double accidental or B♯ E♯ C♭ F♭ */
const ugly = ({ letter, acc }: Spelled): boolean => Math.abs(acc) > 1 || (acc === 1 && (letter === 2 || letter === 6)) || (acc === -1 && (letter === 0 || letter === 3))
const cleanTriad = (t: ChainTriad): ChainTriad => (ugly(t.root) ? chainTriad(simplifyRoot(t.root), t.quality) : t)

/**
 * a dominant's pairs from its tritone sub (#432), after Weiskopf, Intervalic Improvisation, p. 19 (B/D♭ over G7): the
 * sub's Mixolydian pairs of major and minor triads (G7 → D♭7, its root spelled as a key's) covering the most of the
 * written chord's tones, a pair holding the sub's own
 * triad first, then as hexatonicRanking ranks against the written chord; up to SUB_PAIRS, leaving out any the staff's
 * own pairs (own) have; none off a dominant
 */
export function tritoneSubPairs(chordRoot: Spelled, quality: string | null, own: readonly HexPair[] = []): readonly HexPair[] {
  if (!dominant(quality)) return []
  const sub = simplifyRoot(shiftBy(chordRoot, 4, 6))
  const from = glyphs(`${rootName(sub)}7`)
  const has = (p: HexPair): boolean => own.some((o) => pcOf(o.lower.root) === pcOf(p.lower.root) && pcOf(o.upper.root) === pcOf(p.upper.root))
  const links = chainLinks(spellScale(sub, 'mixolydian'))
    .filter(({ lower, upper }) => standard(lower) && standard(upper))
    .map(({ lower, upper }) => ({ lower: cleanTriad(lower), upper: cleanTriad(upper) }))
  const ranked = hexatonicRanking(pairsOf(links, chordTonePcs(chordRoot, quality)), chordRoot).filter((p) => !has(p))
  const onSub = (p: HexPair): number => (pcOf(p.lower.root) === pcOf(sub) || pcOf(p.upper.root) === pcOf(sub) ? 0 : 1)
  const best = ranked.filter((p) => p.coverage === ranked[0]!.coverage)
  return [...best].sort((a, b) => onSub(a) - onSub(b)).slice(0, SUB_PAIRS).map((p) => ({ ...p, from }))
}

/** the pairs a pick may name (#303): the staff's own, then a dominant's tritone sub's (tritoneSubPairs); none where it has none of its own */
export const pickablePairs = (pairs: readonly HexPair[], chordRoot: Spelled, quality: string | null): readonly HexPair[] => (pairs.length ? [...pairs, ...tritoneSubPairs(chordRoot, quality, pairs)] : [])

/** Auto: the first pair in hexatonicRanking's order; null if there are no pairs */
export const hexatonicAuto = (pairs: readonly HexPair[], chordRoot: Spelled): HexPair | null => hexatonicRanking(pairs, chordRoot)[0] ?? null

/** what a chord's pair is ranked against (#432): its own scale's chain (Auto), or its key area (keyPair) */
export type HexatonicBasis = 'chord' | 'key'
/** a key area's pair: two triads and their name, lower first */
export type KeyPair = Readonly<{ lower: ChainTriad; upper: ChainTriad; name: string }>

/**
 * a key area's pair, after Weiskopf, Intervalic Improvisation (1995), pp. 5–10: the major triads on 4 and 5 of a
 * major key (F/G in C), harmonic minor's minor iv and augmented V in a minor one (Gm/A+ in D minor)
 */
export function keyPair(tonic: Spelled, mode: 'major' | 'minor'): KeyPair {
  const lower = chainTriad(shiftBy(tonic, 3, 5), mode === 'major' ? 'maj' : 'min')
  const upper = chainTriad(shiftBy(tonic, 4, 7), mode === 'major' ? 'maj' : 'aug')
  return { lower, upper, name: `${lower.name}/${upper.name}` }
}

/** a key area's pair ('F major', 'D minor', concert) written for the part; null where the name doesn't read */
export function writtenKeyPair(keyName: string, part: Part): KeyPair | null {
  const m = /^([A-G][b#]?) (major|minor)$/.exec(keyName)
  if (!m) return null
  const mode = m[2] as 'major' | 'minor'
  return keyPair(writtenRoot(part, parseRoot(m[1]!), mode === 'major' ? 'ionian' : 'aeolian'), mode)
}

const sameTriad = (a: ChainTriad, b: ChainTriad): boolean => a.pcs.every((pc) => b.pcs.includes(pc))

/** the chain's pair made of the key pair's two triads (by their notes, so an augmented triad matches however the chain spells it), named as the key names it; null where the chain lacks it */
export function keyedPair(pairs: readonly HexPair[], key: KeyPair): HexPair | null {
  const found = pairs.find((p) => (sameTriad(p.lower, key.lower) && sameTriad(p.upper, key.upper)) || (sameTriad(p.lower, key.upper) && sameTriad(p.upper, key.lower)))
  return found ? { ...found, name: key.name } : null
}

/** the Pair control's choices: 0 is Auto, 1 … HEX_PAIRS a link (eight-note scales have eight) */
export const HEX_PAIRS = 8

/** a staff's pair for the control's value: 0 Auto, n the pair ((n − 1) mod count) + 1, wrapping round; null if there are no pairs */
export function resolvePair(pairs: readonly HexPair[], pair: number, chordRoot: Spelled): HexPair | null {
  if (pairs.length === 0) return null
  if (!Number.isInteger(pair) || pair < 1) return hexatonicAuto(pairs, chordRoot)
  return pairs[(pair - 1) % pairs.length]!
}

/** how the six notes divide into group A and group B: the two triads, chord tones and color, a pentatonic and the rest, low and high trichords */
export type HexGrouping = 'triads' | 'tones' | 'pent' | 'trichords'
export const HEX_GROUPINGS: readonly HexGrouping[] = ['triads', 'tones', 'pent', 'trichords']
export const HEX_GROUPING_LABELS: Readonly<Record<HexGrouping, string>> = {
  triads: 'Triad pair',
  tones: 'Chord tones + color',
  pent: 'Pentatonic + 1',
  trichords: 'Trichords 3+3',
}

const MINOR_PENT = pitchClasses(SCALES['minor pentatonic'][0])

/** group B's pitch classes (group A is the rest of the six) */
function groupB(pair: HexPair, grouping: HexGrouping, chordRoot: Spelled, quality: string | null): ReadonlySet<number> {
  switch (grouping) {
    case 'triads':
      return new Set(pair.upper.pcs)
    case 'tones': {
      const tones = chordTonePcs(chordRoot, quality)
      return new Set(tones.size ? pair.tones.filter((pc) => !tones.has(pc)) : [])
    }
    case 'pent': {
      const best = rankByFifths(MINOR_PENT, new Set(pair.tones), pcOf(chordRoot))[0]!
      return new Set(pair.tones.filter((pc) => !MINOR_PENT.has(mod(pc - best.root, 12))))
    }
    case 'trichords':
      return new Set(pair.tones.slice(3))
  }
}

/** a staff's hexatonic under the preset: the pair used, and its link number; picked: a chord pick (#303); sheet: the Pair control's pair (or the key's); offKey: ranked against the key, its chain lacks the key's pair (#432) */
export type StaffHexatonic = Readonly<{ name: string; link: number; picked: boolean; sheet: string; offKey: boolean }>

/**
 * the hexatonic for the Pair control's value on a staff's scale (its notes from the root, spelled as written), and
 * which of the staff's notes (`pcs`, the scale's own by default) it lights; second: the lit notes in group B. A pick
 * (#303, its triads' written root pcs, lower first) plays over the control where it is one of the scale's pairs. key
 * (#432): ranked against a key area, its pair over the control where the chain has it (null: no key, so Auto)
 */
export function hexatonicPick(
  scale: readonly Spelled[],
  chordRoot: Spelled,
  quality: string | null,
  pair: number,
  grouping: HexGrouping,
  pcs: readonly number[] = scale.map(pcOf),
  picked: readonly [number, number] | null = null,
  key?: KeyPair | null,
): Readonly<{ hexatonic: StaffHexatonic | null; lit: boolean[]; second: boolean[] }> {
  const pairs = hexatonicPairs(scale, chordRoot, quality)
  const keyed = key ? keyedPair(pairs, key) : null
  const auto = keyed ?? resolvePair(pairs, key === undefined ? pair : 0, chordRoot)
  const found = picked === null ? undefined : pickablePairs(pairs, chordRoot, quality).find((p) => pcOf(p.lower.root) === picked[0] && pcOf(p.upper.root) === picked[1])
  const used = found ?? auto
  if (used === null) return { hexatonic: null, lit: pcs.map(() => false), second: pcs.map(() => false) }
  const b = groupB(used, grouping, chordRoot, quality)
  return { hexatonic: { name: used.name, link: used.link, picked: !!found, sheet: auto?.name ?? '', offKey: key !== undefined && !keyed }, lit: pcs.map((pc) => used.tones.includes(pc)), second: pcs.map((pc) => b.has(pc)) }
}

/** "G/Am hex", or "no triad pair"; " · off key" where it isn't the key's pair (#432), " · varies" where the staff's chords have different picks */
export const hexatonicCaption = (h: StaffHexatonic | null, varies = false): string => (h ? `${h.name} hex${offKeyNote(h)}${varies ? ' · varies' : ''}` : 'no triad pair')
/** " · off key" on a pair ranked against the key that isn't the key's (#432), else '' */
export const offKeyNote = (h: StaffHexatonic): string => (h.offKey && !h.picked ? ' · off key' : '')

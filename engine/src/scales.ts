import { type Spelled, accFor, enharmonics, mod, NAT_PC, parseRoot, pcOf, rootName, spellEqual, toLetter } from './pitch'

/**
 * Scales from degree formulas (never hand-typed note lists), their names and aliases, and simplifyRoot: the
 * project's enharmonic rule (avoid double accidentals and B#/E#/Cb/Fb, then fewest accidentals, then keep the
 * typed direction).
 */

/** name: [degree formula, label printed on the page] */
export const SCALES = {
  ionian: ['1 2 3 4 5 6 7', 'Ionian'],
  dorian: ['1 2 b3 4 5 6 b7', 'Dorian'],
  phrygian: ['1 b2 b3 4 5 b6 b7', 'Phrygian'],
  lydian: ['1 2 3 #4 5 6 7', 'Lydian'],
  mixolydian: ['1 2 3 4 5 6 b7', 'Mixolydian'],
  aeolian: ['1 2 b3 4 5 b6 b7', 'Aeolian'],
  locrian: ['1 b2 b3 4 b5 b6 b7', 'Locrian'],
  'locrian natural 2': ['1 2 b3 4 b5 b6 b7', 'Locrian ♮2'],
  'melodic minor': ['1 2 b3 4 5 6 7', 'Melodic Minor'],
  'harmonic minor': ['1 2 b3 4 5 b6 7', 'Harmonic Minor'],
  'lydian dominant': ['1 2 3 #4 5 6 b7', 'Lydian Dominant'],
  'lydian augmented': ['1 2 3 #4 #5 6 7', 'Lydian Augmented'],
  altered: ['1 b2 b3 3 #4 b6 b7', 'Altered'],
  'phrygian dominant': ['1 b2 3 4 5 b6 b7', 'Phrygian Dominant'],
  'dorian b2': ['1 b2 b3 4 5 6 b7', 'Dorian ♭2'],
  'mixolydian b6': ['1 2 3 4 5 b6 b7', 'Mixolydian ♭6'],
  'half whole diminished': ['1 b2 b3 3 #4 5 6 b7', 'Half-Whole Dim.'],
  'whole half diminished': ['1 2 b3 4 b5 b6 6 7', 'Whole-Half Dim.'],
  'whole tone': ['1 2 3 #4 #5 b7', 'Whole Tone'],
  'major pentatonic': ['1 2 3 5 6', 'Major Pentatonic'],
  'minor pentatonic': ['1 b3 4 5 b7', 'Minor Pentatonic'],
  'spanish phrygian': ['1 b2 b3 3 4 5 b6 b7', 'Spanish Phrygian'],
  blues: ['1 b3 4 b5 5 b7', 'Blues'],
  'bebop dominant': ['1 2 3 4 5 6 b7 7', 'Bebop Dominant'],
  'bebop major': ['1 2 3 4 5 b6 6 7', 'Bebop Major'],
  'bebop dorian': ['1 2 b3 3 4 5 6 b7', 'Bebop Dorian'],
  // R3b, a functional °7's key-derived scale (M&H pp. 152–161): the ascending vii°7 of X is X's V7(♭9 ♯9 ♭13) from
  // the °7's root; ♯IV°7 to I/5 is the ♯II°7's; the passing ♭III°7 and ♭VI°7 and the auxiliary I°7 and V°7 are their
  // chord tones plus the key's notes
  'diatonic diminished': ['1 b2 b3 b4 b5 b6 bb7 b8', 'Diatonic Dim.'],
  'diatonic diminished biii': ['1 #1 b3 3 #4 #5 6 7', 'Diatonic Dim. (♭III°7)'], // fig. 7.22
  'diatonic diminished biii optional': ['1 2 b3 3 #4 #5 6 7', 'Diatonic Dim. (♭III°7 optional)'], // fig. 7.23, the 9 (common with the ii it falls to)
  'diatonic diminished bvi': ['1 #1 #2 3 #4 #5 6 7', 'Diatonic Dim. (♭VI°7)'], // fig. 7.27
  'diatonic diminished i': ['1 2 b3 3 b5 5 6 7', 'Diatonic Dim. (I°7)'], // fig. 7.31, first
  'diatonic diminished i optional': ['1 2 b3 4 b5 5 6 7', 'Diatonic Dim. (I°7 optional)'], // fig. 7.31, second, the 11 in place of the 3
  'diatonic diminished v': ['1 2 b3 4 b5 5 6 b7', 'Diatonic Dim. (V°7)'], // fig. 7.34
  'diatonic diminished #iv': ['1 b2 b3 4 b5 b6 bb7 b7', 'Diatonic Dim. (♯IV°7)'], // fig. 7.13, ♯IV°7 to I/5: the ♯II°7's notes
  'diatonic diminished #iv optional': ['1 b2 b3 4 b5 b6 bb7 b8', 'Diatonic Dim. (♯IV°7 optional)'], // fig. 7.14, with the major 7th (printed F♮ over F♯)
} as const satisfies Record<string, readonly [string, string]>

export type ScaleKey = keyof typeof SCALES

export const ALIASES: Readonly<Record<string, ScaleKey>> = {
  major: 'ionian',
  minor: 'aeolian',
  'natural minor': 'aeolian',
  'locrian 2': 'locrian natural 2',
  'locrian #2': 'locrian natural 2',
  'lydian b7': 'lydian dominant',
  'lydian #5': 'lydian augmented',
  'super locrian': 'altered',
  'diminished whole half': 'whole half diminished',
  'half whole': 'half whole diminished',
  hw: 'half whole diminished',
  'half whole dim': 'half whole diminished',
  'dominant diminished': 'half whole diminished',
  'whole half': 'whole half diminished',
  wh: 'whole half diminished',
  'whole half dim': 'whole half diminished',
  diminished: 'whole half diminished',
  'phrygian natural 6': 'dorian b2',
  'aeolian dominant': 'mixolydian b6',
  bebop: 'bebop dominant',
  'leading tone diminished': 'diatonic diminished',
}

export type ScaleNote = Readonly<Spelled & { semis: number }>
export type ParsedScale = Readonly<{ root: Spelled; key: ScaleKey }>

const SCALE_ABBREV: Readonly<Record<string, string>> = {
  Mixolydian: 'Mixo',
  Pentatonic: 'Pent',
  Dominant: 'Dom',
  Diminished: 'Dim',
  Lydian: 'Lyd',
  Phrygian: 'Phryg',
  Locrian: 'Locr',
  Augmented: 'Aug',
}

/** shorten the long scale words for a tight display ("Lydian Dominant" -> "Lyd Dom"); roots and degrees untouched */
export function abbreviateScale(name: string): string {
  return name
    .replace(/Harmonic Minor/g, 'Harm min')
    .replace(/Melodic Minor/g, 'Mel min')
    .replace(/Half-Whole/g, 'H/W')
    .replace(/Whole-Half/g, 'W/H')
    .split(' ')
    .map((w) => SCALE_ABBREV[w] ?? w)
    .join(' ')
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll('-', ' ')
    .replaceAll('♮', 'natural ')
    .replaceAll('♭', 'b')
    .replaceAll('♯', '#')
    .replaceAll('.', '')
    .replace(/[()]|°7?/g, '') // a label's function: "Diatonic Dim. (♭VI°7)"
    .replace(/\bdim\b/g, 'diminished')
    .replace(/\s+/g, ' ')
    .trim()

const count = (s: string, c: string): number => s.split(c).length - 1

/** scale formula on a root -> spelled notes with semitones above the root */
export function spellFrom(root: Spelled, formula: string): ScaleNote[] {
  const rootPc = pcOf(root)
  return formula
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const m = /^([b#]*)(\d+)$/.exec(tok)
      if (!m) throw new Error(`bad scale degree: ${JSON.stringify(tok)}`)
      const [, accs = '', degree = ''] = m
      const idx = toLetter(Number(degree) - 1) // degree's offset in letters, wrapping (a true modulo)
      const octaves = Math.max(0, Math.floor((Number(degree) - 1) / 7)) // an 8th is an octave above the root
      const semis = NAT_PC[idx] + 12 * octaves + count(accs, '#') - count(accs, 'b')
      const letter = toLetter(root.letter + idx)
      return { letter, acc: accFor(mod(rootPc + semis, 12), letter), semis }
    })
}

const isUgly = (n: Spelled): boolean =>
  Math.abs(n.acc) > 1 ||
  (n.acc === 1 && (n.letter === 6 || n.letter === 2)) || // B#, E#
  (n.acc === -1 && (n.letter === 0 || n.letter === 3)) // Cb, Fb

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

/** first element with the smallest key (lexicographic): ties go to the earlier one */
function minBy<T>(xs: readonly T[], key: (x: T) => readonly number[]): T {
  const [first, ...rest] = xs
  if (first === undefined) throw new Error('minBy of an empty list')
  return rest.reduce((best, x) => (lexLess(key(x), key(best)) ? x : best), first)
}

/** the symmetric diminished scales: players letter their notes as they spell best (D♭ D E F G A♭ B♭ B), not one letter per degree */
const RELETTERED: ReadonlySet<ScaleKey> = new Set<ScaleKey>(['half whole diminished', 'whole half diminished'])

/** every formula for these semitones above a root: letters ascending (the last may be the root's octave, F♯ … D♯ F),
 * a letter repeated or skipped, no triple accidental */
function letterings(semis: readonly number[]): string[] {
  const out: string[] = []
  const go = (i: number, letter: number, tokens: readonly string[]): void => {
    if (i === semis.length) return void out.push(tokens.join(' '))
    for (const step of i === 0 ? [0] : [0, 1, 2]) {
      const l = letter + step
      const acc = (semis[i] ?? 0) - (l === 7 ? 12 : (NAT_PC[l] ?? Infinity))
      if (l <= 7 && Math.abs(acc) <= 2) go(i + 1, l, [...tokens, `${(acc < 0 ? 'b' : '#').repeat(Math.abs(acc))}${l + 1}`])
    }
  }
  go(0, 0, [])
  return out
}

const LETTERINGS = new Map<ScaleKey, readonly string[]>()
const letteringsOf = (key: ScaleKey): readonly string[] => {
  const known = LETTERINGS.get(key)
  if (known) return known
  const all = letterings(spellFrom({ letter: 0, acc: 0 }, SCALES[key][0]).map((n) => n.semis))
  LETTERINGS.set(key, all)
  return all
}

/**
 * #279: a scale's notes on a root as written. The formula's letters, unless the scale is symmetric diminished and they
 * spell badly: then the same notes lettered with the fewest double accidentals, then B♯/E♯/C♭/F♭, then accidentals, then
 * accidentals against the root's side, then closest to the formula.
 */
const LETTERED = new Map<string, string>() // `${letter} ${acc} ${key}` -> the formula chosen
function lettered(root: Spelled, key: ScaleKey): ScaleNote[] {
  const formula = SCALES[key][0]
  const notes = spellFrom(root, formula)
  if (!RELETTERED.has(key) || !notes.some(isUgly)) return notes
  const id = `${root.letter} ${root.acc} ${key}`
  const known = LETTERED.get(id)
  if (known) return spellFrom(root, known)
  const degrees = formula.split(/\s+/)
  const side = Math.sign(root.acc)
  const cost = (f: string): readonly number[] => {
    const ns = spellFrom(root, f)
    return [
      ns.filter((n) => Math.abs(n.acc) > 1).length,
      ns.filter(isUgly).length,
      ns.reduce((sum, n) => sum + Math.abs(n.acc), 0),
      ns.filter((n) => side !== 0 && n.acc !== 0 && Math.sign(n.acc) !== side).length,
      f.split(' ').filter((d, i) => d !== degrees[i]).length,
    ]
  }
  const best = minBy(letteringsOf(key), cost)
  LETTERED.set(id, best)
  return spellFrom(root, best)
}

/**
 * friendliest spelling of a root, judged over the whole scale: no B#/E#/Cb/Fb or
 * double accidentals if avoidable, then fewest accidentals; ties keep the original
 * direction, else flats (but F# over Gb). A relettered scale skips the count: it keeps the written side (F♯°7: F♯).
 */
export function simplifyRoot(n: Spelled, key: ScaleKey = 'ionian'): Spelled {
  const cost = (o: Spelled): readonly number[] => {
    const notes = lettered(o, key)
    const ugly = notes.filter(isUgly).length
    const total = notes.reduce((s, x) => s + Math.abs(x.acc), 0)
    const sameDir = o.acc === n.acc || (n.acc === 0 && (o.acc <= 0 || pcOf(o) === 6)) ? 0 : 1
    return RELETTERED.has(key) ? [ugly, sameDir] : [ugly, total, sameDir]
  }
  return minBy(enharmonics(n), cost)
}

/** the scale spells cleanly on this root: no double accidental, no B♯ E♯ C♭ F♭ */
export const spellsCleanly = (root: Spelled, key: ScaleKey): boolean => !lettered(root, key).some(isUgly)

/** two formulas with the same notes, lettered differently (♭III°7's and the ascending diatonic diminished) */
export function samePitches(a: ScaleKey, b: ScaleKey): boolean {
  const pcs = (k: ScaleKey): string => [...new Set(spellFrom({ letter: 0, acc: 0 }, SCALES[k][0]).map((n) => mod(n.semis, 12)))].sort((x, y) => x - y).join()
  return pcs(a) === pcs(b)
}

/** the ascending diatonic diminished, the lettering ♭III°7's and ♭VI°7's notes fall back to, and its written name */
const ASCENDING_DIM: ScaleKey = 'diatonic diminished'
const ASCENDING_DIM_NAME = 'Diatonic Diminished'

/**
 * R9: a scale on this pitch, on the root the project rule spells best (simplifyRoot: E♭ ascending is D♯ Diatonic
 * Diminished); where no root spells the formula cleanly, the ascending diatonic diminished's lettering of the same
 * notes when it spells them cleanly, as M&H print ♭III°7 as ♯II°7 (fig. 7.22: B°7 in A♭ is B C D E♭ F G A♭ B♭, not
 * C♭ C E𝄫 E♭ …). `name`: the written name of that re-lettered scale, when it is one.
 */
export function cleanLettering(root: Spelled, key: ScaleKey): Readonly<{ root: Spelled; key: ScaleKey; name?: string }> {
  const r = simplifyRoot(root, key)
  if (!spellsCleanly(r, key) && key !== ASCENDING_DIM && samePitches(key, ASCENDING_DIM)) {
    const alt = simplifyRoot(root, ASCENDING_DIM)
    if (spellsCleanly(alt, ASCENDING_DIM)) return { root: alt, key: ASCENDING_DIM, name: ASCENDING_DIM_NAME }
  }
  return { root: r, key }
}

const isScaleKey = (k: string): k is ScaleKey => Object.hasOwn(SCALES, k)

/** scale name ("Half-Whole Dim.", "hw", "Locrian ♮2") -> SCALES key */
export function scaleKey(name: string): ScaleKey {
  const k = norm(name)
  const key = (Object.hasOwn(ALIASES, k) ? ALIASES[k] : undefined) ?? k
  if (!isScaleKey(key)) throw new Error(`unknown scale ${JSON.stringify(name.trim())}`)
  return key
}

/** "Bb Dorian" -> root + key */
export function parseScale(text: string): ParsedScale {
  const t = text.trim()
  const i = t.search(/\s/)
  if (i < 0) throw new Error(`scale needs a root and a name: ${JSON.stringify(text)}`)
  return { root: parseRoot(t.slice(0, i)), key: scaleKey(t.slice(i)) }
}

/** the same scale however it's written ("D Half-Whole" and "D Half-Whole Diminished"); false if either can't be read */
export function sameScale(a: string, b: string | null | undefined): boolean {
  if (!b) return false
  if (a === b) return true
  try {
    const [x, y] = [parseScale(a), parseScale(b)]
    return x.key === y.key && spellEqual(x.root, y.root)
  } catch {
    return false
  }
}

/**
 * R18: the same menu entry, its root compared by pitch ("F# Whole-Half" on G♭°7 is the menu's "Gb Whole-Half"); for a
 * written scale matched against a chord's options, never to respell one. False if either can't be read (unless equal).
 */
export function samePitchScale(a: string, b: string | null | undefined): boolean {
  if (!b) return false
  if (a === b) return true
  try {
    const [x, y] = [parseScale(a), parseScale(b)]
    return x.key === y.key && pcOf(x.root) === pcOf(y.root)
  } catch {
    return false
  }
}

export function spellScale(root: Spelled, key: ScaleKey): ScaleNote[] {
  const notes = lettered(root, key)
  if (notes.some((n) => Math.abs(n.acc) > 2))
    throw new Error(`${rootName(root)} ${key} needs a triple accidental; pick an enharmonic root`)
  if (notes.some((n, i) => i > 0 && n.semis <= (notes[i - 1]?.semis ?? -1)))
    throw new Error(`scale formula not ascending: ${key}`)
  return notes
}

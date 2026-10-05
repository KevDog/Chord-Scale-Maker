import { type Spelled, accFor, enharmonics, mod, NAT_PC, parseRoot, pcOf, rootName, toLetter } from './pitch'

/** name: [degree formula, label printed on the page]; copied verbatim from jazz_scales.py */
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
  blues: ['1 b3 4 b5 5 b7', 'Blues'],
  'bebop dominant': ['1 2 3 4 5 6 b7 7', 'Bebop Dominant'],
  'bebop major': ['1 2 3 4 5 b6 6 7', 'Bebop Major'],
  'bebop dorian': ['1 2 b3 3 4 5 6 b7', 'Bebop Dorian'],
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
}

export type ScaleNote = Readonly<Spelled & { semis: number }>
export type ParsedScale = Readonly<{ root: Spelled; key: ScaleKey }>

export const norm = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll('-', ' ')
    .replaceAll('♮', 'natural ')
    .replaceAll('♭', 'b')
    .replaceAll('♯', '#')
    .replaceAll('.', '')
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
      const idx = toLetter(Number(degree) - 1) // degree's offset in letters, wrapping like Python's %
      const semis = NAT_PC[idx] + count(accs, '#') - count(accs, 'b')
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

/** first element with the smallest key (lexicographic), like Python's min() */
function minBy<T>(xs: readonly T[], key: (x: T) => readonly number[]): T {
  const [first, ...rest] = xs
  if (first === undefined) throw new Error('minBy of an empty list')
  return rest.reduce((best, x) => (lexLess(key(x), key(best)) ? x : best), first)
}

/**
 * friendliest spelling of a root, judged over the whole scale: no B#/E#/Cb/Fb or
 * double accidentals if avoidable, then fewest accidentals; ties keep the original
 * direction, else flats (but F# over Gb)
 */
export function simplifyRoot(n: Spelled, key: ScaleKey = 'ionian'): Spelled {
  const formula = SCALES[key][0]
  const cost = (o: Spelled): readonly number[] => {
    const notes = spellFrom(o, formula)
    const ugly = notes.filter(isUgly).length
    const total = notes.reduce((s, x) => s + Math.abs(x.acc), 0)
    const sameDir = o.acc === n.acc || (n.acc === 0 && (o.acc <= 0 || pcOf(o) === 6)) ? 0 : 1
    return [ugly, total, sameDir]
  }
  return minBy(enharmonics(n), cost)
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

export function spellScale(root: Spelled, key: ScaleKey): ScaleNote[] {
  const notes = spellFrom(root, SCALES[key][0])
  if (notes.some((n) => Math.abs(n.acc) > 2))
    throw new Error(`${rootName(root)} ${key} needs a triple accidental; pick an enharmonic root`)
  if (notes.some((n, i) => i > 0 && n.semis <= (notes[i - 1]?.semis ?? -1)))
    throw new Error(`scale formula not ascending: ${key}`)
  return notes
}

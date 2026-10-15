import { PENTATONIC_DEGREE_LABELS, PENTATONIC_PATH_LABELS, PENTATONIC_PATHS, PENTATONIC_STEP_BARS, type PentatonicBasis, type PentatonicDegree, type PentatonicPathName, type PentatonicSide, type PentatonicStepUnit } from '@chord-scale-maker/engine'

/** the Pentatonics row's controls (#255): rung 0–6 with the notes it shares with the key, and the side */
export const PENT_RUNGS = [
  { value: 0, label: 'Home · 5 shared' },
  { value: 1, label: '1 · 5 shared' },
  { value: 2, label: '2 · 4 shared' },
  { value: 3, label: '3 · 3 shared' },
  { value: 4, label: '4 · 2 shared' },
  { value: 5, label: '5 · 1 shared' },
  { value: 6, label: '6 · 0 shared (Outside)' },
] as const
export const PENT_SIDES: readonly { value: PentatonicSide; label: string; title: string }[] = [
  { value: 'flat', label: '♭', title: 'Round the circle of fifths toward the flats' },
  { value: 'sharp', label: '♯', title: 'Round the circle of fifths toward the sharps' },
]
/** Home and 6 have one pentatonic each: no side to choose */
export const sideShown = (rung: number): boolean => rung > 0 && rung < 6
export const rungLabel = (rung: number): string => PENT_RUNGS.find((r) => r.value === rung)?.label ?? ''

/** the Path listbox (#264); Custom is listed only while it is the current path */
export const PENT_PATHS: readonly { value: PentatonicPathName; label: string }[] = PENTATONIC_PATHS.map((value) => ({ value, label: PENTATONIC_PATH_LABELS[value] }))
export const pathLabel = (p: PentatonicPathName): string => PENTATONIC_PATH_LABELS[p] ?? ''

/** what a preset steps by (#276) */
export const PENT_STEP_UNITS: readonly { value: PentatonicStepUnit; label: string; title: string }[] = [
  { value: 'section', label: 'Section', title: 'The next step at each section of the form' },
  { value: 'key-area', label: 'Key area', title: 'The next step at each change of key area' },
  { value: 'bars', label: 'Bars', title: 'The next step every few bars, through the form' },
]
export const PENT_STEP_BARS: readonly { value: '2' | '4' | '8'; label: string }[] = PENTATONIC_STEP_BARS.map((n) => ({ value: String(n) as '2' | '4' | '8', label: String(n) }))

/** what the Pentatonics row ranks against (#272): the key area's ladder, or each chord's own scale */
export const PENT_BASES: readonly { value: PentatonicBasis; label: string; title: string }[] = [
  { value: 'key', label: 'Key', title: 'One pentatonic per key area, on its tension ladder' },
  { value: 'chord', label: 'Chord', title: 'Each chord’s own pentatonic, built on the degree you choose' },
]
/** the Built on listbox (#286): Auto, then the degree of the chord each minor pentatonic is built on, chromatically from 1 */
export const PENT_DEGREE_CHOICES: readonly PentatonicDegree[] = ['auto', ...PENTATONIC_DEGREE_LABELS.map((_, d) => d)]
export const degreeLabel = (d: PentatonicDegree): string => (d === 'auto' ? 'Auto' : (PENTATONIC_DEGREE_LABELS[d] ?? 'Auto'))
/** the usual inside choices: the degrees whose minor pentatonic fits the scale whole (test/pentatonics.test.ts checks them against the engine) */
export const PENT_INSIDE_HELP = 'Wholly inside: over a major chord (Ionian) on 2, 3 or 6; over a minor (Dorian) on 1, 2 or 5; over a dominant (Mixolydian) on 2, 5 or 6.'

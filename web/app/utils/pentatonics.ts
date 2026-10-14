import { PENTATONIC_RANKS, type PentatonicBasis, type PentatonicPathName, type PentatonicSide } from '@chord-scale-maker/engine'

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
export const PENT_PATHS: readonly { value: PentatonicPathName; label: string }[] = [
  { value: 'one', label: 'One rung' },
  { value: 'side-slip', label: 'Side-slip' },
  { value: 'fifths', label: 'Fifths' },
  { value: 'minor-thirds', label: 'Minor thirds' },
  { value: 'major-thirds', label: 'Major thirds' },
  { value: 'custom', label: 'Custom' },
]
export const pathLabel = (p: PentatonicPathName): string => PENT_PATHS.find((x) => x.value === p)?.label ?? ''

/** what the Pentatonics row ranks against (#272): the key area's ladder, or each chord's own scale */
export const PENT_BASES: readonly { value: PentatonicBasis; label: string; title: string }[] = [
  { value: 'key', label: 'Key', title: 'One pentatonic per key area, on its tension ladder' },
  { value: 'chord', label: 'Chord', title: 'Each chord’s own pentatonic, ranked against its scale' },
]
export const rankLabel = (r: number): string => (r === 1 ? '1 · closest' : r === PENTATONIC_RANKS ? `${r} · farthest` : String(r))
export const PENT_RANK_CHOICES = Array.from({ length: PENTATONIC_RANKS }, (_, i) => ({ value: i + 1, label: rankLabel(i + 1) }))

import type { ChangesSet } from '@chord-scale-maker/engine'

/** why the chart refused an edit: shown under the field or toolbar, and said */
export const NO_FIRST_CHORD = 'A section’s first bar needs a chord.'
export const NO_HELD_ALTERNATE = 'An alternate can’t be held: type its chords, or switch to Standard to edit the bar.'
/** a bar's chords blanked and refused: in Alternate, a bar with no alt rows (an alternate is never held, #469); else a section's first */
export const noChords = (set: ChangesSet | undefined): string => (set === 'alternate' ? NO_HELD_ALTERNATE : NO_FIRST_CHORD)
export const CANT_TAKE = 'The chart can’t take that here.'
export const barFull = (beats: number): string => `A bar holds at most ${beats} chords.`
export const notAChord = (text: string, why: string): string => `“${text}” can’t go in a chart: ${why}.`

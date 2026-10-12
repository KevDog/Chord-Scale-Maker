/** why the chart refused an edit: shown under the field or toolbar, and said */
export const NO_FIRST_CHORD = 'A section’s first bar needs a chord.'
export const CANT_TAKE = 'The chart can’t take that here.'
export const barFull = (beats: number): string => `A bar holds at most ${beats} chords.`
export const notAChord = (text: string, why: string): string => `“${text}” can’t go in a chart: ${why}.`

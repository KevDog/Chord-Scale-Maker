import { type QuartalDegree, QUARTAL_NOTES, type QuartalNotesChoice } from '@chord-scale-maker/engine'

/** the Practice panel's Quartal controls (#432): Built on Auto or a scale degree 1–7, and the notes a stack */
export const QUARTAL_DEGREE_CHOICES: readonly QuartalDegree[] = ['auto', 1, 2, 3, 4, 5, 6, 7]
export const quartalDegreeLabel = (d: QuartalDegree): string => (d === 'auto' ? 'Auto' : String(d))
export const QUARTAL_NOTE_CHOICES: readonly { value: '3' | '4'; label: string; title: string }[] = QUARTAL_NOTES.map((n) => ({ value: String(n) as '3' | '4', label: String(n), title: `${n} notes a stack` }))

/** the Changes sheet's Quartal options (#432): Auto (four notes where the range has room for them, else three), 3 or 4 */
export type QuartalNotesText = 'auto' | '3' | '4'
export const QUARTAL_LINE_NOTE_CHOICES: readonly { value: QuartalNotesText; label: string; title: string }[] = [
  { value: 'auto', label: 'Auto', title: 'Four notes a stack where your range has room for two of the chord’s, else three' },
  ...QUARTAL_NOTE_CHOICES,
]
export const quartalNotesOf = (v: QuartalNotesText): QuartalNotesChoice => (v === 'auto' ? 'auto' : v === '3' ? 3 : 4)

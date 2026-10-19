import { type QuartalDegree, QUARTAL_NOTES } from '@chord-scale-maker/engine'

/** the Practice panel's Quartal controls (#432): Built on Auto or a scale degree 1–7, and the notes a stack */
export const QUARTAL_DEGREE_CHOICES: readonly QuartalDegree[] = ['auto', 1, 2, 3, 4, 5, 6, 7]
export const quartalDegreeLabel = (d: QuartalDegree): string => (d === 'auto' ? 'Auto' : String(d))
export const QUARTAL_NOTE_CHOICES: readonly { value: '3' | '4'; label: string; title: string }[] = QUARTAL_NOTES.map((n) => ({ value: String(n) as '3' | '4', label: String(n), title: `${n} notes a stack` }))

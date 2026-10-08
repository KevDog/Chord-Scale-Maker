import { accText, mod, NAT_PC, pcOf, type Spelled } from './pitch'

/**
 * Interval names of notes against a chord root, as jazz players say them (b9, #9, #11, b13), for the Intervals labels.
 */

/** letter steps above the root (0-6) and the accidental against that major-scale degree */
function interval(root: Spelled, note: Spelled): Readonly<{ steps: number; acc: number }> {
  const steps = mod(note.letter - root.letter, 7)
  const semis = mod(pcOf(note) - pcOf(root), 12)
  return { steps, acc: mod(semis - (NAT_PC[steps] ?? 0) + 6, 12) - 6 }
}

/** the plain spelled interval, a degree 1-7 with its accidentals ("b3", "#4", "bb7"): no jazz renames */
export function spelledInterval(root: Spelled, note: Spelled): string {
  const { steps, acc } = interval(root, note)
  return accText(acc) + String(steps + 1)
}

/** names by letter distance from the root: chord tones 1 3 5 7, the rest as tensions 9 11 13 */
const NAMES = ['1', '9', '3', '11', '5', '13', '7'] as const
const MAJOR_THIRD = new Set(['maj', 'Maj7', 'Maj7#11', 'Maj7#5', '6', '7', '7b9', '7b9b13', '7b13', '7#11', '7alt'])
const SIXTH = new Set(['6', 'm6'])
const SUS = new Set(['7sus4', '7sus4b9'])

/**
 * a note's interval from the chord root, spelled as written (Db over G is b5, C# is #11).
 * quality is the canonical chord quality (resolveQuality), or null if unknown: on chords with a
 * major 3rd a minor 3rd is #9; sus chords have a 4, not an 11; sixth chords a 6, not a 13.
 */
export function intervalLabel(root: Spelled, note: Spelled, quality: string | null): string {
  const { steps, acc } = interval(root, note)
  if (steps === 2 && acc === -1 && quality !== null && MAJOR_THIRD.has(quality)) return '#9'
  if (steps === 3 && acc === 0 && quality !== null && SUS.has(quality)) return '4'
  if (steps === 5 && acc === 0 && quality !== null && SIXTH.has(quality)) return '6'
  return accText(acc) + NAMES[steps]
}

export const intervalLabels = (root: Spelled, notes: readonly Spelled[], quality: string | null): string[] =>
  notes.map((n) => intervalLabel(root, n, quality))

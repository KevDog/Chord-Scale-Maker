/** The Start and Timing a rhythm is phrased with on the Lines (rhythm-on-lines spec §2, §3.1). */

export type RhythmStart = 'beat' | 'pickup-1' | 'pickup-2' | 'pickup-3'

export const RHYTHM_STARTS: readonly RhythmStart[] = ['beat', 'pickup-1', 'pickup-2', 'pickup-3']

export const RHYTHM_START_LABELS: Readonly<Record<RhythmStart, string>> = {
  beat: 'On the beat',
  'pickup-1': '1-note pick-up',
  'pickup-2': '2-note pick-up',
  'pickup-3': '3-note pick-up',
}

export function isRhythmStart(s: unknown): s is RhythmStart {
  return typeof s === 'string' && (RHYTHM_STARTS as readonly string[]).includes(s)
}

export function pickupNotes(s: RhythmStart): 0 | 1 | 2 | 3 {
  return s === 'beat' ? 0 : s === 'pickup-1' ? 1 : s === 'pickup-2' ? 2 : 3
}

/** Beats a chord's change is shifted early (positive) or late (negative), in the listbox's order. */
export const ANTICIPATE_STEPS: readonly number[] = [3, 2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3]

export function isAnticipate(n: unknown): n is number {
  return typeof n === 'number' && ANTICIPATE_STEPS.includes(n)
}

export function anticipateLabel(n: number): string {
  if (n === 0) return 'On time'
  const a = Math.abs(n)
  const whole = Math.floor(a)
  const text = a % 1 === 0 ? `${whole}` : whole === 0 ? '½' : `${whole}½`
  return `${n > 0 ? 'Anticipate' : 'Resolve late'} ${text} ${a > 1 ? 'beats' : 'beat'}`
}

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/** The rhythm's caption with the Start (pick-ups) and the Timing appended where they are set. */
export function phrasingCaption(caption: string, start: RhythmStart, anticipate: number): string {
  const parts = [caption]
  if (start !== 'beat') parts.push(`${RHYTHM_START_LABELS[start]}s`)
  if (anticipate !== 0) parts.push(lowerFirst(anticipateLabel(anticipate)))
  return parts.join(' · ')
}

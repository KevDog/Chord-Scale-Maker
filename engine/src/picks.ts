/**
 * Pentatonic picks across an edit (#275): picks are keyed by drawn position (ChordAt), so a bar put in or taken out
 * moves later keys. Lining up the chords drawn before and after (longest common run of chord texts) carries each pick
 * to its chord's new key; a pick on a chord removed or written over goes.
 */
import type { ChordAt, DrawnChord } from './changes'
import type { ChordPicks } from './chordPicks'

type Drawn = readonly DrawnChord[]

export function carryPicks<T>(before: Drawn, after: Drawn, picks: Readonly<Record<ChordAt, T>>): Record<ChordAt, T> {
  const n = before.length
  const m = after.length
  // lcs[i][j]: the longest common run of before[i..] and after[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = before[i]!.text === after[j]!.text ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const moved: Record<ChordAt, T> = {}
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (before[i]!.text === after[j]!.text) {
      const p = Object.hasOwn(picks, before[i]!.at) ? picks[before[i]!.at] : undefined
      if (p !== undefined) moved[after[j]!.at] = p
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++
    else j++
  }
  return moved
}

/** every kind carried across an edit; each pick keeps what it was made for */
export const carryChordPicks = (before: Drawn, after: Drawn, picks: ChordPicks): ChordPicks => ({
  pentatonic: carryPicks(before, after, picks.pentatonic),
  hexatonic: carryPicks(before, after, picks.hexatonic),
  ...(picks.quartal ? { quartal: carryPicks(before, after, picks.quartal) } : {}),
})

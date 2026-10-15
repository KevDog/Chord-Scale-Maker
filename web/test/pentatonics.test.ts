import { describe, expect, it } from 'vitest'
import { PENT_BASES, PENT_PATHS, PENT_RANK_CHOICES, PENT_RUNGS, PENT_SIDES, PENT_STEP_BARS, PENT_STEP_UNITS, pathLabel, rankLabel, sideShown } from '~/utils/pentatonics'

describe('pentatonic controls', () => {
  it('labels the rungs with their shared notes', () => {
    expect(PENT_RUNGS.map((r) => r.label)).toEqual(['Home · 5 shared', '1 · 5 shared', '2 · 4 shared', '3 · 3 shared', '4 · 2 shared', '5 · 1 shared', '6 · 0 shared (Outside)'])
    expect(PENT_SIDES.map((s) => s.label)).toEqual(['♭', '♯'])
  })

  it('shows the side only where a rung has two pentatonics', () => {
    expect([0, 1, 5, 6].map(sideShown)).toEqual([false, true, true, false])
  })

  it('names the paths', () => {
    expect(PENT_PATHS.map((p) => p.label)).toEqual(['One rung', 'Side-slip', 'Fifths', 'Minor thirds', 'Major thirds', 'Custom'])
    expect(pathLabel('minor-thirds')).toBe('Minor thirds')
  })

  it('offers Key | Chord and twelve ranks, closest and farthest named', () => {
    expect(PENT_BASES.map((b) => b.value)).toEqual(['key', 'chord'])
    expect(PENT_RANK_CHOICES.map((r) => r.label)).toEqual(['1 · closest', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12 · farthest'])
    expect(rankLabel(1)).toBe('1 · closest')
  })
})

describe('the Step by choices (#276)', () => {
  it('offers Section, Key area and Bars, then 2, 4 and 8; the path labels are the engine’s', () => {
    expect(PENT_STEP_UNITS.map((u) => [u.value, u.label])).toEqual([['section', 'Section'], ['key-area', 'Key area'], ['bars', 'Bars']])
    expect(PENT_STEP_BARS.map((b) => b.value)).toEqual(['2', '4', '8'])
    expect(PENT_PATHS.map((p) => p.label)).toEqual(['One rung', 'Side-slip', 'Fifths', 'Minor thirds', 'Major thirds', 'Custom'])
  })
})

import { describe, expect, it } from 'vitest'
import { PENT_PATHS, PENT_RUNGS, PENT_SIDES, pathLabel, sideShown } from '~/utils/pentatonics'

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
})

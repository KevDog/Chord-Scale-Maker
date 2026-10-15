import { describe, expect, it } from 'vitest'
import { PENTATONIC_DEGREE_LABELS, parseRoot, pentatonicRanking, pitchClasses, SCALES } from '@chord-scale-maker/engine'
import { degreeLabel, PENT_BASES, PENT_DEGREE_CHOICES, PENT_INSIDE_HELP, PENT_PATHS, PENT_RUNGS, PENT_SIDES, PENT_STEP_BARS, PENT_STEP_UNITS, pathLabel, sideShown } from '~/utils/pentatonics'

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

  it('offers Key | Chord, and Built on: Auto then the twelve degrees chromatically from 1', () => {
    expect(PENT_BASES.map((b) => b.value)).toEqual(['key', 'chord'])
    expect(PENT_DEGREE_CHOICES).toEqual(['auto', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(PENT_DEGREE_CHOICES.map(degreeLabel)).toEqual(['Auto', '1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'])
  })

  it('names the usual inside choices as the engine finds them: the degrees whose pentatonic fits Ionian, Dorian, Mixolydian whole', () => {
    const inside = (scale: 'ionian' | 'dorian' | 'mixolydian'): string =>
      pentatonicRanking(pitchClasses(SCALES[scale][0]!), parseRoot('C')).filter((p) => p.shared === 5).map((p) => p.degree).toSorted((a, b) => a - b).map((d) => PENTATONIC_DEGREE_LABELS[d]).join(', ').replace(/, (\S+)$/, ' or $1')
    expect(PENT_INSIDE_HELP).toContain(`major chord (Ionian) on ${inside('ionian')}`)
    expect(PENT_INSIDE_HELP).toContain(`minor (Dorian) on ${inside('dorian')}`)
    expect(PENT_INSIDE_HELP).toContain(`dominant (Mixolydian) on ${inside('mixolydian')}`)
  })
})

describe('the Step by choices (#276)', () => {
  it('offers Section, Key area and Bars, then 2, 4 and 8; the path labels are the engine’s', () => {
    expect(PENT_STEP_UNITS.map((u) => [u.value, u.label])).toEqual([['section', 'Section'], ['key-area', 'Key area'], ['bars', 'Bars']])
    expect(PENT_STEP_BARS.map((b) => b.value)).toEqual(['2', '4', '8'])
    expect(PENT_PATHS.map((p) => p.label)).toEqual(['One rung', 'Side-slip', 'Fifths', 'Minor thirds', 'Major thirds', 'Custom'])
  })
})

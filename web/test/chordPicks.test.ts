import { describe, expect, it } from 'vitest'
import { barList, choiceId, pickFooter, pickHeader } from '~/utils/chordPicks'

describe('chord pick wording', () => {
  it('names one bar, two, or more', () => {
    expect([barList(['6']), barList(['6', '22']), barList(['6', '14', '22'])]).toEqual(['6', '6 and 22', '6, 14 and 22'])
  })
  it('heads with the chord, scale and bars', () => {
    expect(pickHeader('D♭7 Mixolydian', ['6', '22'])).toBe('D♭7 Mixolydian · bars 6, 22')
    expect(pickHeader('D♭7 Mixolydian', ['6'])).toBe('D♭7 Mixolydian · bar 6')
  })
  it('says what a pick changes: all three footers', () => {
    expect(pickFooter('changes', ['6'], false)).toBe('Sets bar 6.')
    expect(pickFooter('changes', ['6', '7'], false)).toBe('Sets bars 6 and 7.')
    expect(pickFooter('scales', ['6', '22'], false)).toBe('Sets bars 6 and 22 on the Changes sheet too.')
    expect(pickFooter('scales', ['6'], false)).toBe('Sets bar 6 on the Changes sheet too.')
    expect(pickFooter('scales', ['6', '22'], true)).toBe('Replaces the different picks in bars 6 and 22.')
  })
  it('gives each choice a stable id', () => {
    expect([choiceId.pent(9), choiceId.hex([7, 9])]).toEqual(['p9', 'h7-9'])
  })
})

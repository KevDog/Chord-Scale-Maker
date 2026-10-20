import { describe, expect, it } from 'vitest'
import { barList, choiceId, hexChoiceRows, pickFooter, pickHeader } from '~/utils/chordPicks'

describe('chord pick wording', () => {
  it('names one bar, two, or more', () => {
    expect([barList(['6']), barList(['6', '22']), barList(['6', '14', '22'])]).toEqual(['6', '6 and 22', '6, 14 and 22'])
  })
  it('heads with the chord, scale and bars, each named by its section', () => {
    expect(pickHeader('D♭7 Mixolydian', ['A1 bar 6', 'A2 bar 6'])).toBe('D♭7 Mixolydian · A1 bar 6, A2 bar 6')
    expect(pickHeader('D♭7 Mixolydian', ['B bar 6'])).toBe('D♭7 Mixolydian · B bar 6')
    expect(pickHeader('D♭7 Mixolydian', [])).toBe('D♭7 Mixolydian') // no bars: no trailing "· bars "
  })
  it('says what a pick changes: all three footers', () => {
    expect(pickFooter('changes', ['A bar 6'], false)).toBe('Sets A bar 6.')
    expect(pickFooter('changes', ['A bar 6', 'A bar 7'], false)).toBe('Sets A bar 6 and A bar 7.')
    expect(pickFooter('scales', ['A1 bar 6', 'A2 bar 6'], false)).toBe('Sets A1 bar 6 and A2 bar 6 on the Changes sheet too.')
    expect(pickFooter('scales', ['B bar 6'], false)).toBe('Sets B bar 6 on the Changes sheet too.')
    expect(pickFooter('scales', ['A1 bar 6', 'A2 bar 6'], true)).toBe('Replaces the different picks in A1 bar 6 and A2 bar 6.')
  })
  it('makes triad pair rows, a tritone sub’s under their own heading (#432)', () => {
    const rows = hexChoiceRows([{ roots: [7, 9], name: 'G/Am', coverage: 3, label: 'G/Am · covers 3' }, { roots: [11, 1], name: 'B/D♭', coverage: 2, label: 'from D♭7: B/D♭ · covers 2', from: 'D♭7' }], 'B/D♭')
    expect(rows).toEqual([
      { id: 'h7-9', label: 'G/Am · covers 3', current: false },
      { id: 'h11-1', label: 'from D♭7: B/D♭ · covers 2', current: true, group: 'From the tritone sub' },
    ])
  })
  it('gives each choice a stable id', () => {
    expect([choiceId.pent(9), choiceId.hex([7, 9])]).toEqual(['p9', 'h7-9'])
  })
})

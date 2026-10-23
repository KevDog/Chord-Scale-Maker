import { describe, expect, it } from 'vitest'
import { layRhythm } from '../rhythm/lay'
import type { RhythmId } from '../rhythm/library'
import { rhythmNotes, type RhythmNote } from '../rhythm/notation'
import { targetBeats } from '../rhythm/targets'

const notes = (id: RhythmId, bars: number[]) => rhythmNotes(layRhythm(id, bars)!)
const vals = (n: readonly RhythmNote[]) => n.map(x => `${x.value}${x.rest ? 'r' : ''}${x.tie ? '~' : ''}`)

describe('rhythmNotes: splitting (§6)', () => {
  it('splits 8ths in 3, tied, at the beats', () => {
    expect(vals(notes('unit:8:3:tied', [4, 4])[0]!)).toEqual(['qd', '8~', 'q', 'q~'])
  })

  it('draws a dotted quarter from the beat', () => {
    const n = notes('custom:8:x__x', [2])[0]!
    expect(vals(n)).toEqual(['qd', '8'])
    expect(n.map(x => x.beat)).toEqual([0, 1.5])
  })

  it('splits an off-beat 1.5-beat note as an 8th tied to a quarter', () => {
    const n = notes('custom:8:.x__', [2])[0]!
    expect(vals(n)).toEqual(['8r', '8~', 'q'])
    expect(n.map(x => x.tiedIn)).toEqual([false, false, true])
  })

  it('keeps the accent off a note held over a barline', () => {
    const [a, b] = notes('custom:4:>x__', [2, 2])
    expect(a![0]).toMatchObject({ value: 'h', accent: true, tie: true, tiedIn: false })
    expect(b![0]).toMatchObject({ value: 'q', accent: false, tie: false, tiedIn: true })
    // the sheet ends here, so nothing ties on
    expect(b![1]).toMatchObject({ value: 'q', accent: true, tie: false })
  })

  it('keeps the accent on the first piece only, and never ties a rest', () => {
    const n = notes('custom:8:.>x__....', [4])[0]!
    expect(vals(n)).toEqual(['8r', '8~', 'q', 'hr'])
    expect(n.map(x => x.accent)).toEqual([false, true, false, false])
  })

  it('puts triplets as a q then an 8 in one tuplet', () => {
    const t = notes('custom:8t:x_x', [2])[0]!
    expect(vals(t)).toEqual(['q', '8', 'q', '8'])
    expect(t.map(n => n.tuplet)).toEqual([0, 0, 1, 1])
    expect(t.every(n => n.ratio?.notes === 3 && n.ratio.of === 2)).toBe(true)
  })

  it('merges whole triplet beats of one held note', () => {
    const t = notes('custom:8t:x_____', [2])[0]!
    expect(vals(t)).toEqual(['h'])
    expect(t[0]!.tuplet).toBeNull()
    expect(t[0]!.ratio).toBeNull()
  })

  it('gives straight notes no ratio', () => {
    expect(notes('unit:8:3:accents', [4])[0]!.every(n => n.ratio === null)).toBe(true)
  })
})

describe('rhythmNotes: tuplets at any pulse (Phase 4 spec §2)', () => {
  const r = (notes: number, of: number) => ({ notes, of })
  const bar1 = (id: RhythmId, bars: number[] = [4]) => {
    const n = notes(id, bars)[0]!
    return {
      values: vals(n),
      ratio: n.map(x => x.ratio),
      tuplet: n.map(x => x.tuplet),
      accent: n.map(x => x.accent),
      tie: n.map(x => x.tie),
    }
  }
  const times = <T>(k: number, xs: readonly T[]): T[] => Array.from({ length: k }, () => xs).flat()

  it('unit:4t:3:accents', () => {
    expect(bar1('unit:4t:3:accents')).toEqual({
      values: times(6, ['q']),
      ratio: times(6, [r(3, 2)]),
      tuplet: [0, 0, 0, 1, 1, 1],
      accent: times(2, [true, false, false]),
      tie: times(6, [false]),
    })
  })

  it('unit:4q:5:accents', () => {
    expect(bar1('unit:4q:5:accents')).toEqual({
      values: times(5, ['q']),
      ratio: times(5, [r(5, 4)]),
      tuplet: times(5, [0]),
      accent: [true, false, false, false, false],
      tie: times(5, [false]),
    })
  })

  it('unit:4q:5:tied', () => {
    expect(bar1('unit:4q:5:tied')).toEqual({ values: ['w'], ratio: [null], tuplet: [null], accent: [false], tie: [false] })
  })

  it('unit:8q:5:accents', () => {
    expect(bar1('unit:8q:5:accents')).toEqual({
      values: times(10, ['8']),
      ratio: times(10, [r(5, 4)]),
      tuplet: [...times(5, [0]), ...times(5, [1])],
      accent: times(2, [true, false, false, false, false]),
      tie: times(10, [false]),
    })
  })

  it('custom:8q:x_x__', () => {
    expect(bar1('custom:8q:x_x__')).toEqual({
      values: ['q', 'qd', 'q', 'qd'],
      ratio: times(4, [r(5, 4)]),
      tuplet: [0, 0, 1, 1],
      accent: times(4, [false]),
      tie: times(4, [false]),
    })
  })

  it('unit:16q:5:tied', () => {
    expect(bar1('unit:16q:5:tied')).toEqual({
      values: times(4, ['q']),
      ratio: times(4, [null]),
      tuplet: times(4, [null]),
      accent: times(4, [false]),
      tie: times(4, [false]),
    })
  })

  it('unit:16t:3:rests', () => {
    // the rests in each group merge as P1 §6.2's do: 16 r8 16 r8, one 6:4 a beat
    expect(bar1('unit:16t:3:rests')).toEqual({
      values: times(8, ['16', '8r']),
      ratio: times(16, [r(6, 4)]),
      tuplet: [0, 1, 2, 3].flatMap(t => times(4, [t])),
      accent: times(16, [false]),
      tie: times(16, [false]),
    })
  })

  it('unit:16s:7:accents', () => {
    expect(bar1('unit:16s:7:accents')).toEqual({
      values: times(28, ['16']),
      ratio: times(28, [r(7, 4)]),
      tuplet: [0, 1, 2, 3].flatMap(t => times(7, [t])),
      accent: times(4, [true, ...times(6, [false])]),
      tie: times(28, [false]),
    })
  })

  it('unit:4t:3:accents in 3/4 falls back to quarters', () => {
    expect(bar1('unit:4t:3:accents', [3])).toEqual({
      values: ['q', 'q', 'q'],
      ratio: [null, null, null],
      tuplet: [null, null, null],
      accent: [true, false, false],
      tie: [false, false, false],
    })
  })

  it('unit:4q:5:accents over 4, 3, 4: a 5:4, three straight quarters, a 5:4', () => {
    const [a, b, c] = notes('unit:4q:5:accents', [4, 3, 4])
    expect(a!.map(n => n.ratio)).toEqual(times(5, [r(5, 4)]))
    expect(vals(b!)).toEqual(['q', 'q', 'q'])
    expect(b!.map(n => n.ratio)).toEqual([null, null, null])
    expect(vals(c!)).toEqual(times(5, ['q']))
    expect(c!.map(n => n.ratio)).toEqual(times(5, [r(5, 4)]))
    expect(c!.map(n => n.tuplet)).toEqual(times(5, [0]))
  })

  it('splits an in-group piece as the longest value that fits, the rest tied', () => {
    // 16s, L = 5: a quarter tied to a 16th; 8q, L = 3: a dotted quarter; 16t, L = 2: an 8th
    expect(vals(notes('custom:16s:x____xx', [1])[0]!)).toEqual(['q~', '16', '16', '16'])
    expect(vals(notes('custom:16t:x_xxxx', [1])[0]!)).toEqual(['8', '16', '16', '16', '16'])
  })

  it('beams tuplet notes by their group', () => {
    expect(notes('unit:8q:5:accents', [4])[0]!.map(n => n.beam)).toEqual([...times(5, [0]), ...times(5, [1])])
    expect(notes('unit:16t:3:accents', [2])[0]!.map(n => n.beam)).toEqual([...times(6, [0]), ...times(6, [1])])
  })
})

describe('rhythmNotes: beams (§6.4)', () => {
  it('beams by statement', () => {
    expect(notes('unit:8:3:accents', [4])[0]!.map(n => n.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
  })

  it('never beams across a rest, and leaves a lone note unbeamed', () => {
    expect(notes('unit:8:3:rest-last', [4])[0]!.map(n => n.beam)).toEqual([0, 0, null, 1, 1, null, 2, 2])
    expect(notes('unit:8:2:rest-last', [2])[0]!.map(n => n.beam)).toEqual([null, null, null, null])
  })

  it('beams a piece cut at a beat with its own statement', () => {
    // statements at 0, 1.5, 3: statement 2's leading `_` holds statement 1's last x past beat 3, where it is cut
    const n = notes('unit:8:3:syncopated', [4, 4, 4])[0]!
    // the q at beat 1 is held into statement 1 as one value, so it stays with its attack
    expect(vals(n)).toEqual(['8', '8', 'q', '8', '8~', '8', '8'])
    expect(n.map(x => x.beam)).toEqual([0, 0, null, 1, 1, 2, 2])
  })

  it('beams a per-bar rhythm by beat', () => {
    expect(notes('run:8:4:1', [4])[0]!.map(n => n.beam)).toEqual([null, null, 0, 0, null, null, null])
  })

  it('beams triplets by tuplet', () => {
    expect(notes('unit:8t:3:accents', [2])[0]!.map(n => n.beam)).toEqual([0, 0, 0, 1, 1, 1])
  })
})

describe('rhythmNotes: brackets (§6.5)', () => {
  it('marks the first statement on the sheet and each landing bar first', () => {
    const b = notes('unit:8:5:accents', Array(6).fill(4)).map(bar => bar.map(n => n.bracket))
    expect(b[0]!.slice(0, 5)).toEqual(['start', null, null, null, 'end'])
    expect(b[0]!.slice(5)).toEqual([null, null, null])
    expect(b[1]!.every(x => x === null)).toBe(true)
    expect(b[5]![0]).toBe('start')
    expect(b[5]![4]).toBe('end')
  })

  it('ends the bracket at its own statement, not at a held note cut at the beat', () => {
    // statement 0 is _xxx; statement 1's leading `_` holds its last x across beat 1
    const n = notes('custom:16:_xxx', [2])[0]!
    expect(vals(n)).toEqual(['16', '16', '16', '16~', '16', '16', '16', '16'])
    expect(n.map(x => x.bracket)).toEqual(['start', null, null, 'end', null, null, null, null])
  })

  it('marks a one-note statement both', () => {
    expect(notes('unit:4:2:tied', [2, 2]).map(bar => bar.map(n => n.bracket))).toEqual([['both'], ['both']])
  })

  it('has no brackets for a per-bar rhythm', () => {
    expect(notes('card:downbeats', [4])[0]!.every(n => n.bracket === null)).toBe(true)
  })
})

describe('targetBeats (§7)', () => {
  it('gives the strong beats', () => {
    expect([2, 3, 4, 5, 6, 7].map(n => targetBeats(n))).toEqual([[0], [0], [0, 2], [0, 3], [0, 3], [0, 4]])
  })
})

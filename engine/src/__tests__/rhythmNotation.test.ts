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
  })

  it('merges whole triplet beats of one held note', () => {
    const t = notes('custom:8t:x_____', [2])[0]!
    expect(vals(t)).toEqual(['h'])
    expect(t[0]!.tuplet).toBeNull()
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

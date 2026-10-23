import { describe, expect, it } from 'vitest'
import { FEELS, feelGroups, feelSlashes, feelTargets, isFeel } from '../rhythm/feel'
import { layRhythm, rhythmCaption } from '../rhythm/lay'
import type { RhythmId } from '../rhythm/library'
import { rhythmNotes } from '../rhythm/notation'
import { lineRhythm } from '../rhythm/pour'

const slashes = (beats: number, feel: 4 | 2 | 1) => feelSlashes(beats, feel).map(s => `${s.value}${s.tie ? '~' : ''}`)
const beamsOf = (id: RhythmId, feel: 4 | 2 | 1) => rhythmNotes(layRhythm(id, [4])!, feel)[0]!.map(n => n.beam)

describe('Feel (Phase 4 spec §4)', () => {
  it('is 4, 2 or 1', () => {
    expect(FEELS).toEqual([4, 2, 1])
    expect([4, 2, 1, 3, '4', null].map(isFeel)).toEqual([true, true, true, false, false, false])
  })

  it('groups a beat each in 4, by the target beats in 2, the bar in 1', () => {
    expect(feelGroups(4, 4)).toEqual([0, 1, 2, 3])
    expect(feelGroups(4, 2)).toEqual([0, 2])
    expect(feelGroups(5, 2)).toEqual([0, 3])
    expect(feelGroups(3, 2)).toEqual([0])
    expect(feelGroups(4, 1)).toEqual([0])
  })

  it.each([
    [4, 4, ['q', 'q', 'q', 'q']],
    [4, 2, ['h', 'h']],
    [4, 1, ['w']],
    [3, 4, ['q', 'q', 'q']],
    [3, 2, ['hd']],
    [3, 1, ['hd']],
    [5, 4, ['q', 'q', 'q', 'q', 'q']],
    [5, 2, ['hd', 'h']],
    [5, 1, ['w~', 'q']],
  ] as const)('slashes a %i-beat bar in %i as %j (the worked examples)', (beats, feel, want) => {
    expect(slashes(beats, feel)).toEqual(want)
  })

  it('gives each slash its beat, ties a slash longer than a whole note', () => {
    expect(feelSlashes(5, 1)).toEqual([{ beat: 0, value: 'w', tie: true }, { beat: 4, value: 'q', tie: false }])
    expect(feelSlashes(3, 2)).toEqual([{ beat: 0, value: 'hd', tie: false }])
    expect(feelSlashes(5, 2).map(s => s.beat)).toEqual([0, 3])
  })

  it('targets 1 and 3 in 4 and in 2, the downbeat in 1 (D20)', () => {
    expect(feelTargets(4, 4)).toEqual([0, 2])
    expect(feelTargets(4, 2)).toEqual([0, 2])
    expect(feelTargets(4, 1)).toEqual([0])
    expect(feelTargets(3, 4)).toEqual([0])
  })
})

describe('Feel: beams (D19)', () => {
  it('beams run:8:4:0 by the beat in 4, by the group in 2 and in 1', () => {
    expect(beamsOf('run:8:4:0', 4)).toEqual([0, 0, 1, 1, null, null])
    expect(beamsOf('run:8:4:0', 2)).toEqual([0, 0, 0, 0, null, null])
    expect(beamsOf('run:8:4:0', 1)).toEqual([0, 0, 0, 0, null, null])
  })

  it('leaves the default as in 4', () => {
    expect(rhythmNotes(layRhythm('run:8:4:0', [4])!)).toEqual(rhythmNotes(layRhythm('run:8:4:0', [4])!, 4))
  })

  it('breaks a 4/4 bar of 8ths in 2 at beat 3, and not in 1', () => {
    expect(beamsOf('run:8:6:0', 2)).toEqual([0, 0, 0, 0, 1, 1, null])
    expect(beamsOf('run:8:6:0', 1)).toEqual([0, 0, 0, 0, 0, 0, null])
  })

  it('beams a 5/4 bar in 2 by its 3 + 2 groups', () => {
    // beat 4's 8th is alone in the second group, so it beams with nothing
    expect(rhythmNotes(layRhythm('run:8:7:0', [5])!, 2)[0]!.map(n => n.beam)).toEqual([0, 0, 0, 0, 0, 0, null, null, null])
    expect(rhythmNotes(layRhythm('run:8:7:0', [5])!, 4)[0]!.map(n => n.beam)).toEqual([0, 0, 1, 1, 2, 2, null, null, null])
  })

  it("keeps a unit statement's beams and a tuplet group's", () => {
    expect(beamsOf('unit:8:3:accents', 1)).toEqual(beamsOf('unit:8:3:accents', 4))
    expect(beamsOf('unit:8:3:accents', 2)).toEqual(beamsOf('unit:8:3:accents', 4))
    expect(beamsOf('run:8t:6:0', 1)).toEqual([0, 0, 0, 1, 1, 1, null, null])
  })

  it("beams a poured Line's straight beats by the group", () => {
    const spans = [{ at: 0, sounds: true }]
    expect(lineRhythm('run:8:4:0', [4], [], spans, 'beat', 0)!.bars[0]!.map(n => n.beam)).toEqual([0, 0, 1, 1, null, null])
    expect(lineRhythm('run:8:4:0', [4], [], spans, 'beat', 0, 2)!.bars[0]!.map(n => n.beam)).toEqual([0, 0, 0, 0, null, null])
  })
})

describe('Feel: caption (D21)', () => {
  it('appends " · feel in 2" or " · feel in 1", and nothing in 4', () => {
    const laid = layRhythm('unit:8:3:accents', [4, 4, 4])!
    const plain = rhythmCaption('unit:8:3:accents', laid)
    expect(rhythmCaption('unit:8:3:accents', laid, undefined, 4)).toBe(plain)
    expect(rhythmCaption('unit:8:3:accents', laid, undefined, 2)).toBe(`${plain} · feel in 2`)
    expect(rhythmCaption('run:8:4:0', layRhythm('run:8:4:0', [4])!, undefined, 1)).toBe('Rhythm: 4 8ths from 1 · feel in 1')
  })
})

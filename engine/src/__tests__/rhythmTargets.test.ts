import { describe, expect, it } from 'vitest'
import type { GuideNote } from '../guideTones'
import { parseRoot, pcOf } from '../pitch'
import { markTargets } from '../rhythm/targets'

const n = (letter: string, beat: number, more: Partial<GuideNote> = {}): GuideNote => ({ pitch: { ...parseRoot(letter), midi: 60 + pcOf(parseRoot(letter)) }, beat, beats: 1, tie: false, tiedIn: false, accidental: null, ...more })
const CMAJ7 = () => [0, 4, 7, 11]

describe('markTargets (rhythm-on-lines spec §6)', () => {
  it('marks a struck note on a target beat as a tone of the chord there, or another note', () => {
    expect(markTargets([n('C', 0), n('E', 1), n('D', 2)], [0, 2], CMAJ7).map((x) => x.target)).toEqual(['tone', undefined, 'other'])
  })

  it('compares beats within a tolerance: a beat summed from thirds is not exactly the target', () => {
    const beat = 2 + 1e-12 // what summing thirds can leave behind
    expect(beat).not.toBe(2)
    expect(markTargets([n('C', beat)], [2], CMAJ7)[0]!.target).toBe('tone')
    expect(markTargets([n('C', 2 - 1e-12)], [2], CMAJ7)[0]!.target).toBe('tone')
    expect(markTargets([n('C', 2.001)], [2], CMAJ7)[0]!.target).toBeUndefined()
  })

  it('leaves a tied-in piece, a rest and an unreadable chord unmarked', () => {
    expect(markTargets([n('E', 2, { tiedIn: true })], [0, 2], CMAJ7)[0]!.target).toBeUndefined()
    expect(markTargets([{ ...n('C', 0), pitch: null }], [0], CMAJ7)[0]!.target).toBeUndefined()
    expect(markTargets([n('C', 0)], [0], () => null)[0]!.target).toBeUndefined()
  })
})

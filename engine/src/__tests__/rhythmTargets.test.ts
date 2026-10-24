import { describe, expect, it } from 'vitest'
import type { GuideNote } from '../guideTones'
import { parseRoot, pcOf } from '../pitch'
import { landTargets, markTargets, targetLandings } from '../rhythm/targets'

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

const tones = (...names: string[]) => names.map((x) => parseRoot(x))
const CMAJ7_TONES = tones('C', 'E', 'G', 'B')
const midiOf = (v: readonly GuideNote[]) => v.map((x) => x.pitch?.midi ?? null)

describe('landTargets: a chord tone struck on every target', () => {
  it('moves a struck note that isn’t a chord tone to the nearest one (a tie: the lower), spelled as the chord spells it', () => {
    const out = landTargets([n('D', 0), n('F#', 2)], [{ beat: 0, tones: CMAJ7_TONES }, { beat: 2, tones: CMAJ7_TONES }], { split: true })
    expect(midiOf(out)).toEqual([60, 67]) // D → C (C and E both a tone away), F♯ → G
    expect(out[1]!.pitch).toMatchObject({ letter: parseRoot('G').letter, acc: 0 })
  })

  it('leaves a chord tone, a note off the targets and a rest as they are', () => {
    const v = [n('E', 0), n('D', 1), { ...n('C', 2), pitch: null }]
    expect(landTargets(v, [{ beat: 0, tones: CMAJ7_TONES }, { beat: 2, tones: CMAJ7_TONES }], { split: true })).toEqual(v)
  })

  it('strikes a held note again on a target it holds through, as a chord tone there', () => {
    const out = landTargets([n('C', 0, { beats: 3 }), n('D', 3)], [{ beat: 0, tones: CMAJ7_TONES }, { beat: 2, tones: tones('D', 'F', 'A', 'C') }], { split: true })
    expect(out.map((x) => [x.beat, x.beats, x.pitch?.midi, x.tiedIn, x.tie])).toEqual([[0, 2, 60, false, false], [2, 1, 60, false, false], [3, 1, 62, false, false]])
  })

  it('re-strikes a note tied in on a target, so the chord tone is played there', () => {
    const out = landTargets([n('E', 0, { beats: 2, tiedIn: true }), n('G', 2, { beats: 2 })], [{ beat: 0, tones: CMAJ7_TONES }, { beat: 2, tones: CMAJ7_TONES }], { split: true })
    expect(out[0]).toMatchObject({ beat: 0, tiedIn: false })
  })

  it('under a rhythm (split off) adds no attack: a held or tied note stays, a struck one still moves', () => {
    const v = [n('C', 0, { beats: 3 }), n('D', 3)]
    expect(landTargets(v, [{ beat: 2, tones: CMAJ7_TONES }], { split: false })).toEqual(v)
    expect(landTargets([n('E', 0, { tiedIn: true })], [{ beat: 0, tones: tones('F', 'A', 'C') }], { split: false })[0]!.tiedIn).toBe(true)
    expect(midiOf(landTargets([n('D', 2)], [{ beat: 2, tones: CMAJ7_TONES }], { split: false }))).toEqual([60])
  })

  it('keeps a moved note in the band, going the other way when the nearest is outside it', () => {
    expect(midiOf(landTargets([n('D', 0)], [{ beat: 0, tones: CMAJ7_TONES }], { split: true, band: { lo: 61, hi: 80 } }))).toEqual([64])
  })

  it('leaves the note when the chord can’t be read', () => {
    const v = [n('D', 0)]
    expect(landTargets(v, [{ beat: 0, tones: null }], { split: true })).toEqual(v)
  })
})

describe('targetLandings: the targets moved with the phrasing', () => {
  const bar = (targets: number[], changes: number[] = []) => ({ beats: 4, targets, changes })

  it('on time, each target stays on its beat', () => {
    expect(targetLandings([bar([0, 2], [0]), bar([0, 2], [0])], 0)).toEqual([
      [0, 2],
      [0, 2],
    ])
  })

  it('anticipated, a target on a chord change lands that much earlier, into the bar before; one inside a chord stays', () => {
    expect(targetLandings([bar([0, 2]), bar([0, 2], [0])], 1)).toEqual([
      [0, 2, 3],
      [2],
    ])
  })

  it('resolved late, it lands after its beat; none lands past the end', () => {
    expect(targetLandings([bar([0, 2], [2]), bar([0, 2], [2])], -2.5)).toEqual([
      [0],
      [0, 0.5],
    ])
  })
})

import { describe, expect, it } from 'vitest'
import type { GuideInput, GuideNote } from '../guideTones'
import { CONCERT, type Part, rangeOf } from '../part'
import { parseRoot } from '../pitch'
import { type QuartalNotes, quartalRanking, type QuartalStack, quartalStacks } from '../quartal'
import { type QuartalLine, quartalVoices } from '../quartalLine'
import { type ScaleKey, spellScale } from '../scales'
import { toVexKey } from '../sheet'

const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, start, beats }
    start += beats
    return c
  })
}
/** a chord's stacks in Auto's order, from its root and scale */
const ranked = (root: string, key: ScaleKey, quality: string, notes: QuartalNotes = 4): readonly QuartalStack[] =>
  quartalRanking(quartalStacks(spellScale(parseRoot(root), key), parseRoot(root), quality, notes), parseRoot(root))
const II_V_I = (notes: QuartalNotes = 4) => [ranked('D', 'dorian', 'm7', notes), ranked('G', 'mixolydian', '7', notes), ranked('C', 'ionian', 'Maj7', notes)]
const byRow = (...rows: readonly (readonly QuartalStack[] | null)[]): ReadonlyMap<number, readonly QuartalStack[]> => new Map(rows.flatMap((r, i) => (r ? [[i, r] as const] : [])))
const line = (over: Partial<QuartalLine> = {}): QuartalLine => ({ kind: 'quartal', dir: 'up-down', arpeggio: 'up-root', ...over })
const pitches = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))
const midis = (notes: readonly GuideNote[] | undefined) => (notes ?? []).flatMap((n) => (n.pitch ? [n.pitch.midi] : []))
const voice = (cs: readonly GuideInput[], stacks: ReadonlyMap<number, readonly QuartalStack[]>, over: Partial<QuartalLine> = {}, part: Part = CONCERT) =>
  quartalVoices(cs, part, 4, null, line(over), stacks)

describe('the Quartal line (#432)', () => {
  it("plays each chord's labelled stack whole, Up & down, each placed nearest the last note; a stack out of range gives way to the next", () => {
    const v = voice(seq(['Dm7', 4], ['G7', 4], ['Cmaj7', 4]), byRow(...II_V_I()))
    expect(pitches(v.bars.get(0))).toEqual(['d/4', 'g/4', 'c/5', 'f/5']) // the run's start nearest the centre
    expect(pitches(v.bars.get(1))).toEqual(['a/5', 'e/5', 'b/4', 'f/4']) // F B E A down, its top nearest F5
    expect(pitches(v.bars.get(2))).toEqual(['e/4', 'a/4', 'd/5', 'g/5']) // B E A D fits no octave of C4–A5: E A D G
    expect(v.missing).toEqual([])
  })

  it('goes up only, or down only', () => {
    const up = voice(seq(['Dm7', 4], ['G7', 4]), byRow(...II_V_I()), { dir: 'up' })
    for (const bar of [0, 1]) expect(midis(up.bars.get(bar))).toEqual([...midis(up.bars.get(bar))].sort((a, b) => a - b))
    const down = voice(seq(['Dm7', 4], ['G7', 4]), byRow(...II_V_I()), { dir: 'down' })
    for (const bar of [0, 1]) expect(midis(down.bars.get(bar))).toEqual([...midis(down.bars.get(bar))].sort((a, b) => b - a))
  })

  it('moves to another stack on a held chord, and on a repeated one, never repeating the last', () => {
    const stacks = (v: ReturnType<typeof voice>) => [...v.bars.values()].map((b) => midis(b).map((m) => m % 12).sort((x, y) => x - y).join(' '))
    const held = stacks(voice(seq(['Dm7', 12]), byRow(II_V_I()[0]!))) // a stack a bar
    expect(held[1]).not.toBe(held[0])
    expect(held[2]).not.toBe(held[1])
    const again = stacks(voice(seq(['Dm7', 4], ['Dm7', 4]), byRow(II_V_I()[0]!, II_V_I()[0]!)))
    expect(again[1]).not.toBe(again[0])
  })

  it('never starts a chord on the note the last one ended on', () => {
    const v = voice(seq(['Dm7', 4], ['G7', 4], ['Cmaj7', 4]), byRow(...II_V_I()), { dir: 'up' })
    const bars = [0, 1, 2].map((b) => midis(v.bars.get(b)))
    for (const k of [1, 2]) expect(bars[k]![0]).not.toBe(bars[k - 1]!.at(-1))
  })

  it('keeps every note in the range', () => {
    const range = rangeOf(CONCERT)
    const v = voice(seq(['Dm7', 2], ['G7', 2], ['Cmaj7', 4]), byRow(...II_V_I()))
    expect([...v.bars.values()].flatMap(midis).every((m) => m >= range.lo && m <= range.hi)).toBe(true)
  })

  it('carries a three-note stack across the beat, as the Triad pair line does', () => {
    const v = voice(seq(['Dm7', 4]), byRow(II_V_I(3)[0]!))
    const notes = pitches(v.bars.get(0))
    expect(notes).toHaveLength(4)
    expect(notes.slice(0, 3)).toEqual(['g/4', 'c/5', 'f/5'])
  })

  it('plays a chord with no stack its 7th chord arpeggio', () => {
    const v = voice(seq(['C7', 4]), byRow(null))
    expect(pitches(v.bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'bb/4'])
  })
})

import { describe, expect, it } from 'vitest'
import { aimedCell, isStep, PALETTE } from '../cellPhrase'
import { CELL_SYSTEMS, type CellId, type CellsLine, cellsVoices, cellTones, SINGLE_CELLS } from '../cells'
import type { GuideInput } from '../guideTones'
import { CONCERT } from '../part'
import { rootName } from '../pitch'

const SCALE: Readonly<Record<string, string>> = {
  Cmaj7: 'C Ionian',
  C: 'C Ionian',
  A7: 'A Mixolydian',
  Dm7: 'D Dorian',
  G7: 'G Mixolydian',
  Em7: 'E Phrygian',
  Eb7: 'Eb Mixolydian',
  Abmaj7: 'Ab Lydian',
  Db7: 'Db Lydian dominant',
}

/** chords in time order, each [symbol, beats] (N.C. a rest) */
const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, scale: SCALE[chord], start, beats }
    start += beats
    return c
  })
}
const phrase = (id: CellId, extra: Partial<CellsLine> = {}): CellsLine => ({ kind: 'cells', id, phrase: true, ...extra })
/** the line's notes, every bar in order, four to a slot (a turn-back or rest makes a short group) */
const notes = (chords: readonly GuideInput[], line: CellsLine, metre = 4) => {
  const { bars } = cellsVoices(chords, CONCERT, metre, null, line)
  return [...bars.keys()].sort((a, b) => a - b).flatMap((b) => (bars.get(b) ?? []).map((n) => (n.pitch ? rootName(n.pitch) : 'r')))
}
const slots = (ns: readonly string[]) => Array.from({ length: Math.ceil(ns.length / 4) }, (_, i) => ns.slice(i * 4, i * 4 + 4).join(' '))

describe('cell phrase: the palette and a step', () => {
  it('holds the 15 palette cells in the spec’s order', () => {
    expect(PALETTE.map((c) => `${c.degrees.join(' ')} ${c.contour.join('')}`)).toEqual([
      '3 2 1 7 ddd', '1 3 5 7 uuu', '3 5 7 9 uuu', '1 2 3 5 uuu', '5 3 2 1 ddd', '3 5 1 7 uud', '3 1 7 5 ddd', '1 7 6 5 ddd',
      '5 3 1 7 ddd', '7 1 3 5 uuu', '5 6 7 9 uuu', '1 6 5 3 ddd', '1 3 5 3 uud', '1 5 3 5 udu', '1 2 3 1 uud',
    ])
  })
  it('a step is 1 or 2 semitones either way, across the octave; 0 is not', () => {
    expect([1, 2, 10, 11].map((to) => isStep(0, to))).toEqual([true, true, true, true])
    expect([0, 3, 9, 6].map((to) => isStep(0, to))).toEqual([false, false, false, false])
    expect(isStep(11, 1)).toBe(true)
  })
  it('keeps its own cell when the last note steps; else the first palette cell on the same first degree that does; else its own', () => {
    const toneOf = (c: { degrees: readonly number[] }) => cellTones(CONCERT, 'G7', 'G Mixolydian', c.degrees)
    const a = CELL_SYSTEMS['3rd-3rd'].a // 3 2 1 7 over G7: B A G F
    expect(aimedCell(a, toneOf(a)!, 4, toneOf)).toBe(a) // F into E
    expect(aimedCell(a, toneOf(a)!, 11, toneOf).degrees).toEqual([3, 5, 7, 9]) // into B: 3 5 7 9 ends on A
    expect(aimedCell(a, toneOf(a)!, 5, toneOf)).toBe(a) // into F: no palette cell from the 3rd ends a step from F (F, A, F, D): its own
  })
})

describe('cell phrase: the Cells line aims each cell at the next chord (#379, #380)', () => {
  it('II–V–I, 3rd to 3rd: both system cells already step, kept (the spec’s worked example)', () => {
    expect(slots(notes(seq(['Dm7', 2], ['G7', 2], ['Cmaj7', 2]), phrase('3rd-3rd')))).toEqual(['F E D C', 'B D G F', 'E D C B'])
  })
  it('I–VI–II–V, 3rd to 3rd: E D C B · C♯ E A G · F E D C · B D G F (the spec’s worked example)', () => {
    expect(slots(notes(seq(['Cmaj7', 2], ['A7', 2], ['Dm7', 2], ['G7', 2]), phrase('3rd-3rd')))).toEqual(['E D C B', 'C# E A G', 'F E D C', 'B D G F'])
  })
  // computed once, then checked by hand: each slot's last note a step from the next slot's first (its target), or
  // (BREAK) no palette cell on the slot's first degree ends a step from it; CHANGED: a palette cell replaced the system's
  const IIVI = seq(['Dm7', 2], ['G7', 2], ['Cmaj7', 2])
  const IVIIIV = seq(['Cmaj7', 2], ['A7', 2], ['Dm7', 2], ['G7', 2])
  const iiiVIIIV = seq(['Em7', 2], ['A7', 2], ['Dm7', 2], ['G7', 2])
  const TADD = seq(['Cmaj7', 2], ['Eb7', 2], ['Abmaj7', 2], ['Db7', 2]) // I–♭III–♭VI–♭II
  const LONG = seq(['Dm7', 4], ['G7', 4], ['Cmaj7', 2]) // a four-beat II–V
  it.each([
    // II–V–I, I–VI–II–V, iii–VI–II–V: every system cell already steps into the next target; none changed, none break
    ['II–V–I', 'root-root', IIVI, ['D E F A', 'G F E D', 'C D E G']],
    ['II–V–I', '3rd-5th', IIVI, ['F A C E', 'D B G F', 'E G B D']],
    ['II–V–I', '3rd-root', IIVI, ['F D C A', 'G B D F', 'E C B G']],
    ['I–VI–II–V', 'root-root', IVIIIV, ['C D E G', 'A G F# E', 'D E F A', 'G F E D']],
    ['I–VI–II–V', '3rd-5th', IVIIIV, ['E G B D', 'E C# A G', 'F A C E', 'D B G F']],
    ['I–VI–II–V', '3rd-root', IVIIIV, ['E C B G', 'A C# E G', 'F D C A', 'G B D F']],
    ['iii–VI–II–V', '3rd-3rd', iiiVIIIV, ['G F E D', 'C# E A G', 'F E D C', 'B D G F']],
    ['iii–VI–II–V', 'root-root', iiiVIIIV, ['E F G B', 'A G F# E', 'D E F A', 'G F E D']],
    ['iii–VI–II–V', '3rd-5th', iiiVIIIV, ['G B D F', 'E C# A G', 'F A C E', 'D B G F']],
    ['iii–VI–II–V', '3rd-root', iiiVIIIV, ['G E D B', 'A C# E G', 'F D C A', 'G B D F']],
    // Cmaj7 BREAKs: 3 2 1 7, 3 5 7 9, 3 5 1 7, 3 1 7 5 end B, D, B, G, none a step from E♭7's G
    ['I–♭III–♭VI–♭II', '3rd-3rd', TADD, ['E D C B', 'G Bb Eb Db', 'C Bb Ab G', 'F Ab Db Cb']],
    ['I–♭III–♭VI–♭II', 'root-root', TADD, ['C A G E', 'Eb Db C Bb', 'Ab Bb C Eb', 'Db Cb Bb Ab']], // Cmaj7 CHANGED: 1 6 5 3 into E♭
    ['I–♭III–♭VI–♭II', '3rd-5th', TADD, ['E D C B', 'Bb G Eb Db', 'C Eb G Bb', 'Ab F Db Cb']], // Cmaj7 CHANGED: 3 2 1 7 into B♭
    ['I–♭III–♭VI–♭II', '3rd-root', TADD, ['E G B D', 'Eb G Bb Db', 'C Ab G Eb', 'Db F Ab Cb']], // Cmaj7 CHANGED: 3 5 7 9 into E♭
    // each chord's first slot aims at its own second slot's target: Dm7 3 5 7 9 into F, G7 3 5 7 9 into B (both CHANGED)
    ['four-beat II–V', '3rd-3rd', LONG, ['F A C E', 'F A D C', 'B D F A', 'B D G F', 'E D C B']],
    ['four-beat II–V', 'root-root', LONG, ['D F A C', 'D C B A', 'G B D F', 'G F E D', 'C D E G']], // 1 3 5 7 into D, into G (CHANGED)
    // both first slots BREAK: over Dm7 the 3rd's cells end C, E, C, A, none a step from A; over G7 F, A, F, D, none from D
    ['four-beat II–V', '3rd-5th', LONG, ['F A C E', 'A F D C', 'B D F A', 'D B G F', 'E G B D']],
    ['four-beat II–V', '3rd-root', LONG, ['F E D C', 'D F A C', 'B A G F', 'G B D F', 'E C B G']], // 3 2 1 7 into D, into G (CHANGED)
  ] as const)('%s, %s', (_, id, chords, expected) => {
    expect(slots(notes(chords, phrase(id)))).toEqual(expected)
  })
  it('the slot before a rest plays the system’s cell: C D E G, though into E♭7 it would be C A G E', () => {
    expect(slots(notes(seq(['Cmaj7', 2], ['N.C.', 2], ['Eb7', 2]), phrase('root-root')))[0]).toBe('C D E G')
    expect(slots(notes(seq(['Cmaj7', 2], ['Eb7', 2]), phrase('root-root')))[0]).toBe('C A G E')
  })
  it('3/4, a chord of two bars: every bar turns back, so none of its cells is aimed (the phrase-off line)', () => {
    const cs = seq(['Cmaj7', 6], ['Eb7', 3])
    const on = notes(cs, phrase('root-root'), 3)
    expect(on.slice(0, 12)).toEqual(notes(cs, { kind: 'cells', id: 'root-root', phrase: false }, 3).slice(0, 12))
    expect(on.slice(6, 10)).toEqual(['C', 'B', 'A', 'G']) // bar 2's B cell, 1 7 6 5 over C: not aimed at E♭7 (into E♭ it would be 1 6 5 3, C A G E)
  })
  it('4/4, a chord of two bars: a cell at the bar line aims at the chord’s cell in the next bar', () => {
    // A into B's F: 3 5 7 9; B into A's F (bar 2): 3 5 7 9; A into B's F: 3 5 7 9; B into G7's B: F A D C already steps
    expect(slots(notes(seq(['Dm7', 8], ['G7', 2]), phrase('3rd-3rd')))).toEqual(['F A C E', 'F A C E', 'F A C E', 'F A D C', 'B A G F'])
  })
  it('4/4, a chord of three beats: its cell is followed by its own turn-back, so it isn’t aimed', () => {
    const cs = seq(['Cmaj7', 3], ['Eb7', 3])
    expect(notes(cs, phrase('root-root')).slice(0, 6)).toEqual(['C', 'D', 'E', 'G', 'E', 'D'])
  })
  it('a cell in sixteenths under a short chord plays the system’s cell', () => {
    expect(slots(notes(seq(['Cmaj7', 1], ['Eb7', 2]), phrase('root-root')))[0]).toBe('C D E G')
  })
  it('Order re-reads the palette too: reversed, II–V–I root to root aims 5 3 1 7 (as 7 1 3 5 reversed) at each next 5th', () => {
    const off = notes(IIVI, { kind: 'cells', id: 'root-root', order: 'reversed', phrase: false })
    const on = notes(IIVI, phrase('root-root', { order: 'reversed' }))
    expect(slots(off)).toEqual(['A F E D', 'D E F G', 'G E D C']) // D into D, G into G: common tones
    expect(slots(on)).toEqual(['A F D C', 'D B G F', 'G E D C'])
  })
  it('a single cell plays exactly as with phrase off', () => {
    const cs = seq(['Cmaj7', 2], ['A7', 2], ['Dm7', 2], ['G7', 2])
    const id = SINGLE_CELLS[0]!.id
    expect(cellsVoices(cs, CONCERT, 4, null, phrase(id))).toEqual(cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id, phrase: false }))
  })
  it('3/4, one chord a bar (Dm7 | G7 | C): the turned-back slots are the phrase-off line’s', () => {
    const cs = seq(['Dm7', 3], ['G7', 3], ['Cmaj7', 3])
    const on = notes(cs, phrase('3rd-3rd'), 3)
    const off = notes(cs, { kind: 'cells', id: '3rd-3rd', phrase: false }, 3)
    const turns = (ns: readonly string[]) => [ns.slice(4, 6), ns.slice(10, 12), ns.slice(16, 18)]
    expect(turns(on)).toEqual(turns(off))
    expect(on).toEqual(off)
  })
  it('a chord on a pentatonic scale: no throw, the line drawn', () => {
    const cs: GuideInput[] = [
      { row: 0, chord: 'Dm7', scale: 'D minor pentatonic', start: 0, beats: 2 },
      { row: 1, chord: 'G7', scale: 'G major pentatonic', start: 2, beats: 2 },
      { row: 2, chord: 'Cmaj7', scale: 'C major pentatonic', start: 4, beats: 2 },
    ]
    for (const id of Object.keys(CELL_SYSTEMS) as CellId[]) expect(notes(cs, phrase(id)).filter((n) => n !== 'r')).toHaveLength(12)
  })
})

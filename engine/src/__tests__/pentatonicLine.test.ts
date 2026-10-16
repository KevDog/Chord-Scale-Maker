import { describe, expect, it } from 'vitest'
import type { GuideInput, GuideNote } from '../guideTones'
import { CONCERT, type Part, partFor, rangeOf } from '../part'
import { parseRoot, pcOf, rootName, type Spelled } from '../pitch'
import { isPentatonicLeave, PENTATONIC_LEAVE, PENTATONIC_LEAVE_LABELS, PENTATONIC_LEAVES, pentatonicCell, type PentatonicLine, pentatonicVoices } from '../pentatonicLine'
import { SCALES } from '../scales'
import { toVexKey } from '../sheet'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const BASS: Part = { clef: 'bass', trans: 'C' }
const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, start, beats }
    start += beats
    return c
  })
}
const line = (over: Partial<PentatonicLine> = {}): PentatonicLine => ({ kind: 'pentatonic', leave: '1', dir: 'up', arpeggio: 'up-root', ...over })
/** the pentatonic roots by row: a name per row, null for none */
const roots = (...names: readonly (string | null)[]): ReadonlyMap<number, Spelled> => new Map(names.flatMap((n, i) => (n ? [[i, parseRoot(n)] as const] : [])))
const pitches = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))
const voice = (cs: readonly GuideInput[], r: ReadonlyMap<number, Spelled>, over: Partial<PentatonicLine> = {}, part: Part = CONCERT, beats: 2 | 3 | 4 = 4) =>
  pentatonicVoices(cs, part, beats, null, line(over), r)

describe('leave out', () => {
  it("names the minor pentatonic's five degrees, in its formula's order, leave out 1 the default", () => {
    expect(PENTATONIC_LEAVES).toEqual(SCALES['minor pentatonic'][0].split(' '))
    expect(PENTATONIC_LEAVES.map((d) => PENTATONIC_LEAVE_LABELS[d])).toEqual(['1', '♭3', '4', '5', '♭7'])
    expect(PENTATONIC_LEAVE).toBe('1')
  })
  it('reads untrusted values: a degree, nothing else', () => {
    expect(PENTATONIC_LEAVES.every(isPentatonicLeave)).toBe(true)
    expect(['', '3', 'b5', 1, null, '♭3'].some(isPentatonicLeave)).toBe(false)
  })
  it('makes a cell of the other four, spelled from the root, in pentatonic order', () => {
    const cell = (root: string, leave: Parameters<typeof pentatonicCell>[1]) => pentatonicCell(parseRoot(root), leave).map(rootName)
    expect(cell('A', '1')).toEqual(['C', 'D', 'E', 'G']) // ♭3-4-5-♭7: C major's 1-2-3-5
    expect(cell('A', 'b3')).toEqual(['A', 'D', 'E', 'G'])
    expect(cell('A', '4')).toEqual(['A', 'C', 'E', 'G'])
    expect(cell('A', '5')).toEqual(['A', 'C', 'D', 'G'])
    expect(cell('A', 'b7')).toEqual(['A', 'C', 'D', 'E'])
    expect(cell('Bb', '1')).toEqual(['Db', 'Eb', 'F', 'Ab'])
  })
})

describe('pentatonic voices', () => {
  it('plays one chord a bar in quarters, the cell up, the run placed nearest the centre', () => {
    const { bars } = voice(seq(['Am7', 4]), roots('A'))
    expect(pitches(bars.get(0))).toEqual(['c/4', 'd/4', 'e/4', 'g/4'])
    expect(bars.get(0)?.map((n) => [n.beat, n.beats])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]])
  })
  it('leaves out the degree chosen', () => {
    expect(pitches(voice(seq(['Am7', 4]), roots('A'), { leave: 'b7' }).bars.get(0))).toEqual(['a/4', 'c/5', 'd/5', 'e/5'])
  })
  it('plays Down from the top of the cell', () => {
    expect(pitches(voice(seq(['Am7', 4]), roots('A'), { dir: 'down' }).bars.get(0))).toEqual(['g/4', 'e/4', 'd/4', 'c/4'])
  })
  it('plays two chords a bar in eighths, the next cell from its note nearest the last (a tie: the lower)', () => {
    const { bars } = voice(seq(['Am7', 2], ['Dm7', 2]), roots('A', 'D'))
    expect(pitches(bars.get(0))).toEqual(['c/4', 'd/4', 'e/4', 'g/4', 'f/4', 'g/4', 'a/4', 'c/5'])
    expect(bars.get(0)?.every((n) => n.beats === 0.5)).toBe(true)
  })
  it('plays three chords a bar in sixteenths', () => {
    const bar = voice(seq(['Am7', 2], ['Dm7', 1], ['G7', 1]), roots('A', 'D', 'E')).bars.get(0) ?? []
    expect(bar).toHaveLength(16)
    expect(bar.every((n) => n.beats === 0.25)).toBe(true)
  })
  it('a held chord: its next cell starts on its note nearest the last, never the last itself', () => {
    const { bars } = voice(seq(['Am7', 8]), roots('A'))
    expect(pitches(bars.get(1))).toEqual(['e/4', 'g/4', 'c/5', 'd/5']) // G4 played: E4 is 3 below, C5 5 above
  })
  it('fills a 3/4 bar of one chord with six eighths', () => {
    expect(pitches(voice(seq(['Am7', 3]), roots('A'), {}, CONCERT, 3).bars.get(0))).toHaveLength(6)
  })
  it('alternates Up & down each cell', () => {
    const { bars } = voice(seq(['Am7', 4], ['Am7', 4], ['Am7', 4]), roots('A', 'A', 'A'), { dir: 'up-down' })
    const shape = (b: number) => {
      const m = (bars.get(b) ?? []).map((n) => n.pitch?.midi ?? 0)
      return m.every((x, i) => i === 0 || x > m[i - 1]!) ? 'up' : m.every((x, i) => i === 0 || x < m[i - 1]!) ? 'down' : 'mixed'
    }
    expect([0, 1, 2].map(shape)).toEqual(['up', 'down', 'up'])
  })
  it('a chord with no pentatonic plays its 7th chord arpeggio, in the line’s pattern', () => {
    const { bars } = voice(seq(['Am7', 4], ['G7', 4]), roots('A', null))
    expect(pitches(bars.get(1))).toEqual(['g/4', 'b/4', 'd/5', 'f/5'])
    expect(pitches(voice(seq(['G7', 4]), roots(null), { arpeggio: 'down-root' }).bars.get(0))).toEqual(['f/5', 'd/5', 'b/4', 'g/4'])
  })
  it('a chord with no pentatonic and no tones rests, and restarts the run near the centre', () => {
    const { bars, missing } = voice(seq(['Am7', 4], ['N.C.', 4], ['Am7', 4]), roots('A', null, 'A'))
    expect(bars.get(1)).toEqual([{ pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }])
    expect(pitches(bars.get(2))).toEqual(['c/4', 'd/4', 'e/4', 'g/4'])
    expect(missing).toHaveLength(1)
  })
  it('a transposing part: plays the written root it is given, accidentals by the measure rule', () => {
    const { bars } = voice(seq(['Am7', 4]), roots('B'), {}, TENOR) // concert Am, written Bm
    expect(pitches(bars.get(0)).map((p) => p.split('/')[0])).toEqual(['d', 'e', 'f#', 'a'])
    expect(bars.get(0)?.map((n) => n.accidental)).toEqual([null, null, '#', null])
  })
  it("keeps inside the part's range", () => {
    const range = rangeOf(BASS)
    const notes = [...voice(seq(['Am7', 2], ['Dm7', 2], ['G7', 4], ['CMaj7', 8]), roots('A', 'D', 'E', 'A'), {}, BASS).bars.values()].flat()
    expect(notes.every((n) => n.pitch && n.pitch.midi >= range.lo && n.pitch.midi <= range.hi)).toBe(true)
  })
  it('never ties', () => {
    expect([...voice(seq(['Am7', 2], ['Dm7', 2]), roots('A', 'D')).bars.values()].flat().some((n) => n.tie || n.tiedIn)).toBe(false)
  })
})

describe('the leap between cells (#284: each cell from its note nearest the last, inside the range)', () => {
  /** the smallest leap from prev to any placement of the cell (any start, the direction's order, any octave) that fits the range; never prev itself */
  const smallest = (cell: readonly Spelled[], up: boolean, prev: number, range: { lo: number; hi: number }): number => {
    const pcs = cell.map(pcOf)
    const leaps = pcs.flatMap((_, s) => {
      const order = pcs.map((__, j) => pcs[(((s + (up ? j : -j)) % 4) + 4) % 4]!)
      const rel = order.reduce<number[]>((acc, pc, i) => (i === 0 ? [0] : [...acc, acc[i - 1]! + (up ? ((pc - order[i - 1]! + 11) % 12) + 1 : -(((order[i - 1]! - pc + 11) % 12) + 1))]), [])
      return Array.from({ length: 128 }, (__, m) => m)
        .filter((m) => m % 12 === order[0] && m !== prev && rel.every((r) => m + r >= range.lo && m + r <= range.hi))
        .map((m) => Math.abs(m - prev))
    })
    return Math.min(...leaps)
  }
  it('Down: the next cell starts from the nearest note whose whole cell fits, not an octave away', () => {
    const { bars } = voice(seq(['Am7', 8]), roots('A'), { dir: 'down' })
    expect(pitches(bars.get(0))).toEqual(['g/4', 'e/4', 'd/4', 'c/4'])
    expect(pitches(bars.get(1))).toEqual(['g/4', 'e/4', 'd/4', 'c/4']) // D4 down would leave the range: G4, 7 from C4, not D5 (14)
  })
  for (const [name, part] of [['concert', CONCERT], ['trumpet (ceiling G5)', partFor('trumpet')], ['bass', BASS]] as const) {
    for (const dir of ['up', 'down', 'up-down'] as const) {
      it(`${name}, ${dir}: every cell after the first leaps the least that fits`, () => {
        const names = ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E']
        const { bars } = voice(seq(...names.map((n) => [`${n}m7`, 4] as const)), roots(...names), { dir }, part)
        const range = rangeOf(part)
        for (let b = 1; b < names.length; b++) {
          const prev = bars.get(b - 1)?.at(-1)?.pitch?.midi ?? 0
          const notes = bars.get(b) ?? []
          const midi = notes.map((n) => n.pitch?.midi ?? 0)
          const up = midi[1]! > midi[0]!
          expect(midi.every((m) => m >= range.lo && m <= range.hi)).toBe(true)
          expect(Math.abs(midi[0]! - prev), `bar ${b}`).toBe(smallest(pentatonicCell(parseRoot(names[b]!), '1'), up, prev, range))
        }
      })
    }
  }
})


import { describe, expect, it } from 'vitest'
import type { GuideInput, GuideNote } from '../guideTones'
import { chainTriad, type TriadQuality } from '../hexatonics'
import { CONCERT, type Part, partFor, rangeOf } from '../part'
import { parseRoot, rootName } from '../pitch'
import { toVexKey } from '../sheet'
import { type TriadPair, triadPairVoices, type TriadPairLine, triadTones } from '../triadPairLine'

const BASS: Part = { clef: 'bass', trans: 'C' }
const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, start, beats }
    start += beats
    return c
  })
}
const t = (name: string): ReturnType<typeof chainTriad> => {
  const m = /^([A-G][b#]?)(m|°|\+)?$/.exec(name)!
  const quality: TriadQuality = m[2] === 'm' ? 'min' : m[2] === '°' ? 'dim' : m[2] === '+' ? 'aug' : 'maj'
  return chainTriad(parseRoot(m[1]!), quality)
}
/** the pairs by row: "G/Am" per row, null for none */
const pairs = (...names: readonly (string | null)[]): ReadonlyMap<number, TriadPair> =>
  new Map(names.flatMap((n, i) => (n ? [[i, { lower: t(n.split('/')[0]!), upper: t(n.split('/')[1]!) }] as const] : [])))
const line = (over: Partial<TriadPairLine> = {}): TriadPairLine => ({ kind: 'triad-pair', dir: 'up', arpeggio: 'up-root', ...over })
const pitches = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))
const voice = (cs: readonly GuideInput[], p: ReadonlyMap<number, TriadPair>, over: Partial<TriadPairLine> = {}, part: Part = CONCERT, beats: 2 | 3 | 4 = 4) =>
  triadPairVoices(cs, part, beats, null, line(over), p)

describe('triad tones', () => {
  it('spells a triad from its root: root, third, fifth', () => {
    const tones = (n: string) => triadTones(t(n)).map(rootName)
    expect(tones('G')).toEqual(['G', 'B', 'D'])
    expect(tones('Am')).toEqual(['A', 'C', 'E'])
    expect(tones('Bb')).toEqual(['Bb', 'D', 'F'])
    expect(tones('B°')).toEqual(['B', 'D', 'F'])
    expect(tones('C+')).toEqual(['C', 'E', 'G#'])
  })
})

describe('triad pair voices (#325)', () => {
  it('plays the lower triad, then the upper from its note nearest the last, in quarters', () => {
    const { bars } = voice(seq(['Cmaj7', 4]), pairs('G/Am'))
    expect(pitches(bars.get(0))).toEqual(['g/4', 'b/4', 'd/5', 'c/5']) // D5: C5 and E5 2 away, the lower
    expect(bars.get(0)?.map((n) => [n.beat, n.beats])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]])
  })
  it('a held chord carries a cell over the bar line, alternating triads, turning at the range’s wall, cut at its end', () => {
    const { bars } = voice(seq(['Cmaj7', 8]), pairs('G/Am'))
    expect(pitches(bars.get(0))).toEqual(['g/4', 'b/4', 'd/5', 'c/5'])
    expect(pitches(bars.get(1))).toEqual(['e/5', 'a/5', 'g/5', 'd/5']) // G5 up would pass A5: down from it; B4 cut
  })
  it('each chord starts on its lower triad, in eighths for two chords a bar', () => {
    const { bars } = voice(seq(['Cmaj7', 2], ['Fmaj7', 2]), pairs('G/Am', 'C/Dm'))
    expect(pitches(bars.get(0))).toEqual(['g/4', 'b/4', 'd/5', 'c/5', 'e/5', 'c/5', 'g/4', 'f/4'])
    expect(bars.get(0)?.every((n) => n.beats === 0.5)).toBe(true)
  })
  it('plays Down from the top of the lower triad', () => {
    expect(pitches(voice(seq(['Cmaj7', 4]), pairs('G/Am'), { dir: 'down' }).bars.get(0)).slice(0, 3)).toEqual(['d/5', 'b/4', 'g/4'])
  })
  it('alternates Up & down each cell', () => {
    const { bars } = voice(seq(['Cmaj7', 8]), pairs('G/Am'), { dir: 'up-down' })
    expect(pitches(bars.get(0))).toEqual(['g/4', 'b/4', 'd/5', 'c/5'])
    expect(pitches(bars.get(1))).toEqual(['a/4', 'e/4', 'd/4', 'g/4']) // C5 A4 E4 down, then up from D4, 2 below E4
  })
  it('Up & down turns chord by chord when a chord holds one cell and a note of the next (#433)', () => {
    const { bars } = voice(seq(['Cmaj7', 4], ['Fmaj7', 4], ['Cmaj7', 4]), pairs('G/Am', 'C/Dm', 'G/Am'), { dir: 'up-down' })
    const contour = (b: readonly GuideNote[] | undefined) => {
      const m = (b ?? []).slice(0, 3).map((n) => n.pitch!.midi)
      return m[0]! < m[2]! ? 'up' : 'down'
    }
    expect([0, 1, 2].map((i) => contour(bars.get(i)))).toEqual(['up', 'down', 'up'])
  })
  it('a chord with no pair plays its 7th chord arpeggio, in the line’s pattern', () => {
    const { bars } = voice(seq(['Cmaj7', 4], ['G7', 4]), pairs('G/Am', null))
    expect(pitches(bars.get(1))).toEqual(['g/4', 'b/4', 'd/5', 'f/5'])
  })
  it('a chord with no pair and no tones rests: a rest (N.C.) with nothing to report, a chord it cannot read reported', () => {
    const { bars, missing } = voice(seq(['Cmaj7', 4], ['N.C.', 4]), pairs('G/Am', null))
    expect(bars.get(1)).toEqual([{ pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }])
    expect(missing).toEqual([])
    expect(voice(seq(['Cmaj7', 4], ['Xyz', 4]), pairs('G/Am', null)).missing).toHaveLength(1)
  })
  for (const [name, part] of [['concert', CONCERT], ['trumpet', partFor('trumpet')], ['bass', BASS]] as const) {
    for (const dir of ['up', 'down', 'up-down'] as const) {
      it(`${name}, ${dir}: keeps in range, every note in its chord's pair`, () => {
        const names = ['G/Am', 'C/Dm', 'F/G', 'Bb/C', 'Eb/F', 'Ab/Bb', 'Db/Eb', 'F#/G#', 'B/C#', 'E/F#', 'A/B', 'D/E']
        const p = pairs(...names)
        const { bars } = voice(seq(...names.map(() => ['C7', 4] as const)), p, { dir }, part)
        const range = rangeOf(part)
        names.forEach((_, b) => {
          const pr = p.get(b)!
          const pcs = new Set([...pr.lower.pcs, ...pr.upper.pcs])
          const notes = bars.get(b) ?? []
          expect(notes).toHaveLength(4)
          expect(notes.every((n) => n.pitch && n.pitch.midi >= range.lo && n.pitch.midi <= range.hi && pcs.has(((n.pitch.midi % 12) + 12) % 12))).toBe(true)
        })
      })
    }
  }
  it('never ties', () => {
    expect([...voice(seq(['Cmaj7', 2], ['Fmaj7', 2]), pairs('G/Am', 'C/Dm')).bars.values()].flat().some((n) => n.tie || n.tiedIn)).toBe(false)
  })
})

describe('the Triad pair line’s shapes, after Weiskopf’s exercises 1–6 (#432)', () => {
  /** each note of a held chord's line, bar after bar */
  const flat = (over: Partial<TriadPairLine>, beats = 12) => {
    const { bars } = voice(seq(['Dm7', beats]), pairs('F/G'), over)
    return [...bars.values()].flatMap((b) => pitches(b))
  }
  it('Nearest is the line as it was', () => {
    expect(flat({ shape: 'nearest' })).toEqual(flat({}))
  })
  it('Climb: both triads in root position, then first inversion, then second, each from the note above the last start', () => {
    expect(flat({ shape: 'climb' }).slice(0, 12)).toEqual(['f/4', 'a/4', 'c/5', 'g/4', 'b/4', 'd/5', 'a/4', 'c/5', 'f/5', 'b/4', 'd/5', 'g/5'])
  })
  it('Climb down mirrors it: from the upper triad’s second inversion, top down, each from the note below the last start', () => {
    expect(flat({ shape: 'climb', dir: 'down' }).slice(0, 6)).toEqual(['b/4', 'g/4', 'd/4', 'a/4', 'f/4', 'c/4'])
  })
  it('Arpeggios: 1 3 5 8 through the inversions, four notes to the beat', () => {
    expect(flat({ shape: 'arpeggios' }).slice(0, 12)).toEqual(['f/4', 'a/4', 'c/5', 'f/5', 'g/4', 'b/4', 'd/5', 'g/5', 'a/4', 'c/5', 'f/5', 'a/5'])
  })
  it('Arpeggios: a 1 3 5 8 that fits no octave of the range drops its 8', () => {
    expect(flat({ shape: 'arpeggios' }, 16).slice(12, 15)).toEqual(['b/4', 'd/5', 'g/5']) // B4–B5 passes A5, B3–B4 is below C4
  })
  it('Climb Up & down climbs the six triads up, then six down', () => {
    const notes = flat({ shape: 'climb', dir: 'up-down' }, 36).map((k) => k.split('/')[0])
    expect(notes.slice(18, 21)).toEqual(['b', 'g', 'd']) // the seventh triad: down from the upper's second inversion
  })
  for (const shape of ['climb', 'arpeggios'] as const) {
    for (const dir of ['up', 'down', 'up-down'] as const) {
      it(`${shape}, ${dir}: keeps in range, every note in the pair`, () => {
        const range = rangeOf(CONCERT)
        const { bars } = voice(seq(['Dm7', 32]), pairs('F/G'), { shape, dir })
        const notes = [...bars.values()].flat()
        expect(notes.every((n) => n.pitch && n.pitch.midi >= range.lo && n.pitch.midi <= range.hi && [5, 9, 0, 7, 11, 2].includes(n.pitch.midi % 12))).toBe(true)
      })
    }
  }
})

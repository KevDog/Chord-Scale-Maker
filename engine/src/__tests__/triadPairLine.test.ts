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

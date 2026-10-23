import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { arpeggioTones } from '../arpeggios'
import type { RhythmId } from '../rhythm'
import { expandRows, parseChart, type Row } from '../chart'
import { resolveScales, rowKeys } from '../resolve'
import { buildSheet } from '../sheet'
import { CONCERT, type Part, rangeOf } from '../part'
import { rootName } from '../pitch'
import { arpeggioLine, ARP_DIRECTION_LABELS, ARP_NOTES_LABELS, buildArpeggioSheet, isArpDirection, isArpNotes, pairCaption, tensionsOf } from '../arpeggioSheet'
import { chordPositions, pickTargets } from '../changes'
import { hexatonicChoices } from '../chordChoices'
import { NO_PICKS, withPick } from '../chordPicks'

const names = (chord: string, scale: string): string[] =>
  tensionsOf(CONCERT, chord, scale, arpeggioTones(CONCERT, chord, scale) ?? []).map(rootName)

describe('tensionsOf', () => {
  it("stacks the scale's other notes as 9s, 11s, 13s", () => {
    expect(names('Cm7', 'C Dorian')).toEqual(['D', 'F', 'A'])
    expect(names('G7', 'G Altered')).toEqual(['Ab', 'Bb', 'C#', 'Eb'])
    expect(names('C7', 'C Half-Whole')).toEqual(['Db', 'Eb', 'F#', 'A'])
    expect(names('CMaj7', 'C Lydian')).toEqual(['D', 'F#', 'A'])
  })

  it('works for scales that are not seven notes', () => {
    expect(names('CMaj7', 'C Major Pentatonic')).toEqual(['D', 'A'])
    expect(names('C7', 'C Blues')).toEqual(['Eb', 'F', 'Gb']) // #9, 11, #11
  })

  it("puts a triad's or a 6 chord's 7th first", () => {
    expect(names('C', 'C Ionian')).toEqual(['B', 'D', 'F', 'A'])
    expect(names('C6', 'C Ionian')).toEqual(['B', 'D', 'F'])
  })

  it('spells for the part', () => {
    const part = { clef: 'treble', trans: 'Bb' } as const
    expect(tensionsOf(part, 'Cm7', 'C Dorian', arpeggioTones(part, 'Cm7', 'C Dorian') ?? []).map(rootName)).toEqual(['E', 'G', 'B'])
  })
})

const line = (chord: string, scale: string | null, notes: 'seventh' | 'extended', dir: 'up' | 'down' | 'up-down', part = CONCERT) => {
  const l = arpeggioLine(part, chord, scale, notes, dir)
  if ('error' in l) throw new Error(l.error)
  return l
}

describe('arpeggioLine', () => {
  it('plays the 7th chord over two octaves up, down, and up and down without repeating the top (#227)', () => {
    const up = line('Cm7', 'C Dorian', 'seventh', 'up')
    expect(up.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'C', 'Eb', 'G', 'Bb', 'C'])
    expect(up.groups).toEqual([4, 4, 1])
    expect((up.notes[8]?.midi ?? 0) - (up.notes[0]?.midi ?? 0)).toBe(24)
    expect(up.notes.every((n, i) => i === 0 || n.midi > (up.notes[i - 1]?.midi ?? 0))).toBe(true)
    const down = line('Cm7', 'C Dorian', 'seventh', 'down')
    expect(down.notes.map(rootName)).toEqual(['C', 'Bb', 'G', 'Eb', 'C', 'Bb', 'G', 'Eb', 'C'])
    expect(down.notes.map((n) => n.midi)).toEqual([...up.notes.map((n) => n.midi)].reverse())
    expect(down.groups).toEqual([4, 4, 1])
    const ud = line('Cm7', 'C Dorian', 'seventh', 'up-down')
    expect(ud.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'C', 'Eb', 'G', 'Bb', 'C', 'Bb', 'G', 'Eb', 'C', 'Bb', 'G', 'Eb', 'C'])
    expect(ud.groups).toEqual([4, 4, 4, 4, 1])
  })

  it('adds the tensions above, beamed apart', () => {
    const up = line('Cm7', 'C Dorian', 'extended', 'up')
    expect(up.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'D', 'F', 'A'])
    expect(up.groups).toEqual([4, 3])
    expect(up.notes.every((n, i) => i === 0 || n.midi > (up.notes[i - 1]?.midi ?? 0))).toBe(true)
    expect(line('Cm7', 'C Dorian', 'extended', 'down').groups).toEqual([3, 4])
    const ud = line('Cm7', 'C Dorian', 'extended', 'up-down')
    expect(ud.notes).toHaveLength(13)
    expect(ud.groups).toEqual([4, 3, 2, 4])
  })

  it('plays a triad over two octaves in 7th Chord mode', () => {
    const up = line('C', 'C Ionian', 'seventh', 'up')
    expect(up.notes.map(rootName)).toEqual(['C', 'E', 'G', 'C', 'E', 'G', 'C'])
    expect(up.groups).toEqual([3, 3, 1])
    expect(line('C', 'C Ionian', 'seventh', 'up-down').groups).toEqual([3, 3, 3, 3, 1])
  })

  it('needs a scale only for Extended', () => {
    expect(line('Cm7', null, 'seventh', 'up').notes).toHaveLength(9)
    expect(arpeggioLine(CONCERT, 'Cm7', null, 'extended', 'up')).toEqual({ error: 'Choose a scale' })
    expect(arpeggioLine(CONCERT, 'Xyz', 'C Dorian', 'seventh', 'up')).toEqual({ error: 'No chord tones for Xyz' })
  })

  it("places the run at the fewest notes out of the instrument's range", () => {
    for (const part of [{ clef: 'bass', trans: 'C' }, { clef: 'treble', trans: 'Bb' }] as const) {
      const r = rangeOf(part)
      const midis = line('G7', 'G Altered', 'extended', 'up', part).notes.map((n) => n.midi)
      const outBy = (shift: number): number => midis.filter((m) => m + shift < r.lo || m + shift > r.hi).length
      const base = outBy(0)
      expect(base).toBeLessThanOrEqual(2)
      expect(outBy(12)).toBeGreaterThanOrEqual(base)
      expect(outBy(-12)).toBeGreaterThanOrEqual(base)
    }
  })

  it('places a two-octave run at the fewest notes out of range, the rest on ledger lines', () => {
    const tuba = { clef: 'bass', trans: 'C', range: { lo: 36, hi: 58, centre: 47 } } as const
    const flute = { clef: 'treble', trans: 'C', range: { lo: 60, hi: 84, centre: 73 } } as const
    for (const part of [tuba, flute]) {
      const r = rangeOf(part)
      const midis = line('Cm7', 'C Dorian', 'seventh', 'up', part).notes.map((n) => n.midi)
      expect(midis).toHaveLength(9)
      const outBy = (shift: number): number => midis.filter((m) => m + shift < r.lo || m + shift > r.hi).length
      expect(outBy(12)).toBeGreaterThanOrEqual(outBy(0))
      expect(outBy(-12)).toBeGreaterThanOrEqual(outBy(0))
    }
    expect(line('Cm7', 'C Dorian', 'seventh', 'up', flute).notes.map((n) => n.midi)).toEqual([60, 63, 67, 70, 72, 75, 79, 82, 84])
  })

  it('has labels and guards', () => {
    expect(Object.values(ARP_NOTES_LABELS)).toEqual(['7th Chord', 'Extended', 'Triad pairs'])
    expect(Object.values(ARP_DIRECTION_LABELS)).toEqual(['Up', 'Down', 'Up & down'])
    expect([isArpNotes('extended'), isArpNotes('up'), isArpDirection('up-down'), isArpDirection('x')]).toEqual([true, false, true, false])
  })
})

const row = (chord: string, scale = ''): Row => ({ section: 'A', bar: '1', chord, scale })

describe('buildArpeggioSheet', () => {
  it("draws the Scales sheet's lines, with its labels", () => {
    const doc = parseChart(readFileSync(new URL('../../charts/autumn-leaves.txt', import.meta.url), 'utf8')).value
    const rows = expandRows(doc).value
    const resolved = resolveScales(doc, { level: 'standard', seed: 0 })
    const arp = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up', undefined, resolved).pages.flat()
    const scales = buildSheet(rows, CONCERT, 'root', 'C', 12, null, undefined, resolved)[0]?.pages.flat() ?? []
    expect(arp.map((s) => [s.chords, s.scale])).toEqual(scales.map((s) => [s.chords, s.scale]))
    expect(arp.at(-1)?.last).toBe(true)
  })

  it('heads the sheet by mode and splits pages', () => {
    const rows = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C'].map((r, i) => row(`${r}${i < 12 ? 'm7' : '7'}`))
    const s = buildArpeggioSheet(rows, CONCERT, 12, 'extended', 'up')
    expect(s.heading).toBe('Extended arpeggios')
    expect(s.pages.map((p) => p.length)).toEqual([12, 1])
    expect(buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up').heading).toBe('Arpeggios')
  })

  it('changes ids with mode and direction', () => {
    const id = (n: 'seventh' | 'extended', d: 'up' | 'down') => buildArpeggioSheet([row('Cm7')], CONCERT, 12, n, d).pages[0]?.[0]?.id
    expect(new Set([id('seventh', 'up'), id('extended', 'up'), id('seventh', 'down')]).size).toBe(3)
  })

  it('labels intervals and reports errors per line', () => {
    const [ok, bad] = buildArpeggioSheet([row('Cm7'), row('Xyz')], CONCERT, 12, 'extended', 'up').pages.flat()
    expect(ok?.intervals).toEqual(['1', 'b3', '5', 'b7', '9', '11', '13'])
    expect(bad).toMatchObject({ error: 'No chord tones for Xyz', notes: [], intervals: null })
  })
})

describe('buildArpeggioSheet: errors, keys and the last line', () => {
  it('never throws on an unreadable scale: Extended shows the Scales sheet error, 7th Chord still draws', () => {
    const rows = [row('Cm7', 'Foo Bar')]
    const scalesError = buildSheet(rows, CONCERT, 'root', 'C', 12)[0]?.pages.flat()[0]?.error
    expect(scalesError).toEqual(expect.any(String))
    const ext = buildArpeggioSheet(rows, CONCERT, 12, 'extended', 'up').pages.flat()[0]
    expect(ext).toMatchObject({ error: scalesError, notes: [], intervals: null })
    const sev = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up').pages.flat()[0]
    expect(sev?.error).toBeNull()
    expect(sev?.notes).toHaveLength(9)
    expect(sev?.intervals).toEqual(['1', 'b3', '5', 'b7', '1', 'b3', '5', 'b7', '1'])
  })

  it('says Choose a scale for an Extended line with no scale', () => {
    const resolved = new Map([[0, { scale: null, source: 'default' as const }]])
    const [s] = buildArpeggioSheet([row('Cm7')], CONCERT, 12, 'extended', 'up', undefined, resolved).pages.flat()
    expect(s).toMatchObject({ error: 'Choose a scale', notes: [], intervals: null, scale: null })
  })

  it('marks an error line that ends the sheet as last', () => {
    const pages = buildArpeggioSheet([row('Cm7'), row('Xyz')], CONCERT, 12, 'extended', 'up').pages.flat()
    expect(pages.map((s) => s.last)).toEqual([false, true])
  })

  it('draws the clef and key signature on every line, and marks accidentals by the measure rule', () => {
    const eb = { tonic: 3, minor: false, name: 'Eb' } as const
    const rows = [row('Cm7', 'C Dorian'), row('Fm7', 'F Dorian')]
    const plain = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up').pages.flat()
    expect(plain[0]?.accidentals).toContain('b')
    const keyed = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up', eb).pages.flat()
    expect(keyed.map((s) => s.showClefAndKey)).toEqual([true, true])
    expect(keyed.map((s) => s.keySig)).toEqual([keyed[0]?.keySig, keyed[0]?.keySig])
    expect(keyed[0]?.keySig).not.toBeNull()
    expect(keyed[0]?.accidentals).not.toContain('b')
    expect(keyed[0]?.accidentals).toEqual(keyed[0]?.notes.map(() => null))
  })
})

describe('buildArpeggioSheet: range and the bar rule without a key', () => {
  it('changes the id and the notes with the range, for the same clef and transposition', () => {
    const r = rangeOf(CONCERT)
    const wide = { ...CONCERT, range: { ...r, lo: r.lo - 12, hi: r.hi + 12 } }
    const low = { ...CONCERT, range: { ...r, lo: r.lo - 24, hi: r.lo + 6, centre: r.lo - 9 } }
    const first = (p: typeof CONCERT) => buildArpeggioSheet([row('G7', 'G Altered')], p, 12, 'extended', 'up').pages[0]?.[0]
    const a = first(CONCERT)
    const b = first(low)
    expect(a?.id).not.toBe(b?.id)
    expect(a?.notes.map((n) => n.midi)).not.toEqual(b?.notes.map((n) => n.midi))
    expect(first(wide)?.id).not.toBe(a?.id)
  })

  it('marks each flat once per octave in Up & down with no key', () => {
    const [s] = buildArpeggioSheet([row('Cm7', 'C Dorian')], CONCERT, 12, 'seventh', 'up-down').pages.flat()
    expect(s?.accidentals.filter(Boolean)).toEqual(['b', 'b', 'b', 'b'])
    expect(s?.accidentals.slice(9).every((a) => a === null)).toBe(true)
  })

  it('prints a natural for the B after a Bb in the same octave (bebop dominant, no key)', () => {
    const [s] = buildArpeggioSheet([row('C7', 'C Bebop Dominant')], CONCERT, 12, 'extended', 'up').pages.flat()
    const ns = s?.notes ?? []
    const i = ns.findIndex((n) => rootName(n) === 'B')
    expect(i).toBeGreaterThan(0)
    expect(s?.accidentals[i]).toBe('n')
  })
})

describe('buildArpeggioSheet: Triad pairs (#436)', () => {
  const FORM = ['title: T', 'key: C', 'section: A', '1 | Dm7 | D Dorian', '2 | G7 | G Mixolydian', 'section: B', '1 | Dm7 | D Dorian'].join('\n') + '\n'
  const doc = parseChart(FORM).value
  const rows = expandRows(doc).value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const at = chordPositions(doc)
  const targets = pickTargets(doc, res)
  const staves = (opts: Parameters<typeof buildArpeggioSheet>[7] = {}, dir: 'up' | 'down' = 'up', part: Part = CONCERT) =>
    buildArpeggioSheet(rows, part, 12, 'pairs', dir, undefined, res, opts).pages.flat()

  it("plays each line's Auto pair, the Changes sheet's, as the six-triad figure", () => {
    const [dm] = staves()
    const auto = hexatonicChoices('Dm7', 'D Dorian', CONCERT)[0]!
    expect(dm?.pair).toMatchObject({ hexatonic: { name: auto.name, picked: false }, coverage: auto.coverage, varies: false })
    expect(dm?.notes).toHaveLength(18)
    expect(dm?.groups).toEqual([3, 3, 3, 3, 3, 3])
    expect(buildArpeggioSheet(rows, CONCERT, 12, 'pairs', 'up').heading).toBe('Triad pairs')
  })

  it('spells the pair for the part', () => {
    const tenor: Part = { clef: 'treble', trans: 'Bb' }
    expect(staves({}, 'up', tenor)[0]?.pair?.hexatonic?.name).toBe(hexatonicChoices('Dm7', 'D Dorian', tenor)[0]!.name)
  })

  it('takes the first position’s chord pick, and varies where they differ', () => {
    const all = withPick(NO_PICKS, 'hexatonic', ['A:1:0', 'B:1:0'], [5, 7], targets)
    expect(staves({ picks: { picks: all, at } })[0]?.pair).toMatchObject({ hexatonic: { name: 'F/G', picked: true }, varies: false, positions: ['A:1:0', 'B:1:0'], source: { chord: 'Dm7', scale: 'D Dorian' } })
    const one = withPick(NO_PICKS, 'hexatonic', ['B:1:0'], [5, 7], targets)
    expect(staves({ picks: { picks: one, at } })[0]?.pair).toMatchObject({ hexatonic: { picked: false }, varies: true })
  })

  it("plays a dominant's tritone sub pair as a pick (#432)", () => {
    const picks = withPick(NO_PICKS, 'hexatonic', ['A:2:0'], [11, 1], targets)
    expect(staves({ picks: { picks, at } })[1]?.pair).toMatchObject({ hexatonic: { name: 'B/D♭', picked: true } })
  })

  it('writes block chords whatever the direction, and changes the id with the shape', () => {
    const [block] = staves({ shape: 'block' }, 'down')
    const [arp] = staves({ shape: 'arpeggiated' })
    expect(block?.block).toBe(true)
    expect(block?.notes).toEqual(arp?.notes)
    expect(block?.id).not.toBe(arp?.id)
  })

  it('has no run for Block under a rhythm', () => {
    const [block] = staves({ shape: 'block', rhythm: 'unit:8:3:accents' }, 'up')
    expect(block).toMatchObject({ run: null, timeSig: null })
  })

  it("plays a chord with no pair as its 7th chord arpeggio, captioned 'no triad pair'", () => {
    const [s] = buildArpeggioSheet([row('C6', 'C Major Pentatonic')], CONCERT, 12, 'pairs', 'up').pages.flat()
    expect(s?.pair?.hexatonic).toBeNull()
    expect(s?.block).toBeFalsy()
    expect(s?.notes).toEqual(line('C6', 'C Major Pentatonic', 'seventh', 'up').notes)
    expect(pairCaption(s!.pair!)).toBe('no triad pair')
  })

  it("plays the key area's pair ranked against the key (#432), as the Changes sheet does", () => {
    const keys = rowKeys(doc)
    const [dm, g7] = staves({ keys })
    expect([dm?.pair?.hexatonic?.name, g7?.pair?.hexatonic?.name, dm?.pair?.hexatonic?.offKey]).toEqual(['F/G', 'F/G', false])
    expect(dm?.notes).toHaveLength(18)
    expect(staves({ keys }, 'up', { clef: 'treble', trans: 'Bb' })[0]?.pair?.hexatonic?.name).toBe('G/A')
  })

  it('captions the pair and what it covers', () => {
    const p = { hexatonic: { name: 'F/G', link: 3, picked: false, sheet: 'F/G', offKey: false }, coverage: 4, positions: [], varies: false, source: null }
    expect(pairCaption(p)).toBe('F/G · covers 4')
    expect(pairCaption({ ...p, varies: true })).toBe('F/G · covers 4 · varies')
    expect(pairCaption({ ...p, hexatonic: { ...p.hexatonic, offKey: true } })).toBe('F/G · covers 4 · off key')
  })
})

describe('the run poured into the rhythm', () => {
  const first = (rhythm?: RhythmId, beats?: number) =>
    buildArpeggioSheet([row('Cmaj7')], CONCERT, 12, 'seventh', 'up', undefined, undefined, { rhythm, ...(beats ? { beatsOf: () => beats } : {}) }).pages[0]![0]!
  /** a bar as [note index or 'r', value, beat] */
  const seq = (bar: NonNullable<ReturnType<typeof first>['run']>['bars'][number]) => bar.notes.map((n) => [n.note ?? 'r', n.mark.value, n.mark.beat])

  it('pours the nine notes as accents in 3 (Grouping in 3)', () => {
    const s = first('unit:8:3:accents')
    expect(s.timeSig).toBe('4/4')
    const bars = s.run!.bars
    expect(bars).toHaveLength(2)
    const b0 = bars[0]!.notes
    expect(b0.map((n) => n.note)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(b0.map((n) => !!n.mark.accent)).toEqual([true, false, false, true, false, false, true, false])
    expect(b0.map((n) => n.mark.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
    expect(seq(bars[1]!)).toEqual([[8, '8', 0], ['r', '8', 0.5], ['r', 'q', 1], ['r', 'h', 2]])
    expect(bars[1]!.notes[0]!.mark.accent).toBe(false)
    expect(s.notes).toHaveLength(9)
    expect(s.accidentals).toHaveLength(9)
  })

  it('pours rests until the 9th note', () => {
    const run = first('unit:8:3:rests').run!
    expect(run.bars.map(seq)).toEqual([
      [[0, '8', 0], ['r', '8', 0.5], ['r', '8', 1], [1, '8', 1.5], ['r', 'q', 2], [2, '8', 3], ['r', '8', 3.5]],
      [['r', '8', 0], [3, '8', 0.5], ['r', 'q', 1], [4, '8', 2], ['r', '8', 2.5], ['r', '8', 3], [5, '8', 3.5]],
      [['r', 'q', 0], [6, '8', 1], ['r', '8', 1.5], ['r', '8', 2], [7, '8', 2.5], ['r', 'q', 3]],
      [[8, '8', 0], ['r', '8', 0.5], ['r', 'q', 1], ['r', 'h', 2]],
    ])
  })

  it('pours card:downbeats four then four then one, resting by the beats its length divides', () => {
    const run = first('card:downbeats').run!
    expect(run.bars.map(seq)).toEqual([
      [[0, 'q', 0], [1, 'q', 1], [2, 'q', 2], [3, 'q', 3]],
      [[4, 'q', 0], [5, 'q', 1], [6, 'q', 2], [7, 'q', 3]],
      [[8, 'q', 0], ['r', 'q', 1], ['r', 'h', 2]],
    ])
  })

  it('takes the beats per bar from beatsOf', () => {
    expect(first('card:downbeats', 3).timeSig).toBe('3/4')
    expect(first('card:downbeats', 3).run!.beats).toBe(3)
  })

  it('has no run on an error staff', () => {
    const [bad] = buildArpeggioSheet([row('Xyz')], CONCERT, 12, 'seventh', 'up', undefined, undefined, { rhythm: 'unit:8:3:accents' }).pages.flat()
    expect(bad).toMatchObject({ error: expect.any(String), run: null, timeSig: null })
  })

  it('leaves the staff as today where pourRun gives none (Off)', () => {
    const plain = first(undefined)
    expect(first('off')).toEqual(plain)
    expect(first('off')).toMatchObject({ run: null, timeSig: null, id: plain.id })
  })

  it('(guard) leaves ids and groups as they were with no rhythm', () => {
    const off = first(undefined)
    const plain = buildArpeggioSheet([row('Cmaj7')], CONCERT, 12, 'seventh', 'up').pages[0]![0]!
    expect(off).toMatchObject({ id: plain.id, groups: [4, 4, 1], run: null, timeSig: null })
    expect(first('unit:8:3:accents').id).not.toBe(off.id)
    expect(first('unit:8:3:accents', 3).id).not.toBe(first('unit:8:3:accents').id)
  })
})

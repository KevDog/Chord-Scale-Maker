import { describe, expect, it } from 'vitest'
import { layRhythm, rhythmCaption } from '../rhythm/lay'
import type { RhythmId } from '../rhythm/library'
import { rhythmNotes } from '../rhythm/notation'
import { lineRhythm } from '../rhythm/pour'
import { cardBars, pourRun } from '../rhythm/run'
import { RHYTHM_PATH_OFF, type RhythmPath } from '../rhythm/path'

const cap = (id: RhythmId, bars: number[]) => rhythmCaption(id, layRhythm(id, bars)!)

describe('layRhythm landings (§4)', () => {
  it('follows the landing table', () => {
    expect(layRhythm('unit:8:5:accents', Array(8).fill(4))?.landings).toEqual([0, 5])
    expect(layRhythm('unit:8:4:accents', Array(4).fill(3))?.landings).toEqual([0, 2])
    expect(layRhythm('unit:8t:4:accents', [4, 4])?.landings).toEqual([0, 1])
    expect(layRhythm('unit:8:7:accents', Array(14).fill(3))?.landings).toEqual([0, 7])
    expect(layRhythm('unit:8:5:accents', [4, 4, 3, 4, 4])?.landings).toEqual([0, 4])
  })

  it('has no landings for a per-bar rhythm', () => {
    expect(layRhythm('run:8:4:3', [4, 4])?.landings).toEqual([])
  })

  it('gives the unit and each bar start in pulses', () => {
    expect(layRhythm('unit:8:5:accents', [4, 3, 4])).toMatchObject({ unit: 5, starts: [0, 8, 14] })
    expect(layRhythm('run:8:4:3', [4, 4])).toMatchObject({ unit: 0, starts: [0, 8] })
  })

  it('is null for off, an invalid id or no bars', () => {
    expect(layRhythm('off', [4])).toBeNull()
    expect(layRhythm('unit:8:9:accents' as RhythmId, [4])).toBeNull()
    expect(layRhythm('unit:8:3:accents', [])).toBeNull()
  })
})

describe('rhythmCaption', () => {
  it('names the cycle', () => {
    expect(cap('unit:8:5:accents', Array(8).fill(4))).toBe('Rhythm: 8ths in 5, with accents · back on one every 5 bars')
    expect(cap('unit:8t:4:rests', [4, 4])).toBe('Rhythm: Triplets in 4, with rests · back on one every bar')
    expect(cap('unit:8:5:accents', [4, 4, 3, 4, 4])).toBe('Rhythm: 8ths in 5, with accents · back on one at bars 1, 5')
    expect(cap('unit:8:3:accents', [4, 3])).toBe('Rhythm: 8ths in 3, with accents · never back on one')
    expect(cap('run:8:4:3', [4, 4])).toBe('Rhythm: 4 8ths from the and of 2')
  })

  it('lists six landings at most, then …', () => {
    // 8ths in 2 over alternating 3/4 and 4/4: every bar lands
    const bars = [3, 4, 3, 4, 3, 4, 3, 4]
    expect(cap('unit:8:2:accents', bars)).toBe(
      'Rhythm: 8ths in 2, with accents · back on one at bars 1, 2, 3, 4, 5, 6, …',
    )
  })
})

describe('layRhythm events', () => {
  it('ties a unit held over the barline', () => {
    // 8ths in 3, tied, over 4/4: the third statement (pulses 6–8) crosses into bar 1
    const laid = layRhythm('unit:8:3:tied', [4, 4])!
    expect(laid.bars[0]!.at(-1)).toMatchObject({ at: 6, length: 2, tie: true })
    expect(laid.bars[1]![0]).toMatchObject({ at: 0, length: 1, tiedIn: true })
  })

  it('breaks the tie into a break bar (a 2nd ending) with a fresh attack, the stream still counting', () => {
    // 8ths in 3, tied: the third statement (pulses 6–8) would tie into bar 1
    const laid = layRhythm('unit:8:3:tied', [4, 4], [1])!
    expect(laid.bars[0]!.at(-1)).toMatchObject({ at: 6, length: 2, tie: false })
    expect(laid.bars[1]![0]).toMatchObject({ at: 0, length: 1, rest: false, tiedIn: false, accent: false, statement: 2 })
    expect(laid.landings).toEqual(layRhythm('unit:8:3:tied', [4, 4])!.landings)
    expect(laid.bars[1]!.slice(1)).toEqual(layRhythm('unit:8:3:tied', [4, 4])!.bars[1]!.slice(1))
  })

  it('leaves bars with no tie into them alone at a break', () => {
    expect(layRhythm('unit:8:4:tied', [4, 4], [1])).toEqual(layRhythm('unit:8:4:tied', [4, 4]))
    expect(layRhythm('run:8:4:6', [4, 4], [1])).toEqual(layRhythm('run:8:4:6', [4, 4]))
  })

  it('spills a run into the next bar and merges it with that bar’s own run (§3)', () => {
    const r = layRhythm('run:8:4:6', [4, 4])!
    expect(r.bars[1]!.filter(e => !e.rest).map(e => e.at)).toEqual([0, 1, 6, 7])
    // the sheet's last bar drops what would spill past it
    expect(r.bars[1]!.reduce((n, e) => n + e.length, 0)).toBe(8)
  })

  it('sounds a leading tie on the first pulse or after a rest (Review Focus 1)', () => {
    const c = layRhythm('custom:8:_x.', [3])!
    expect(c.bars[0]!.filter(e => !e.rest).map(e => [e.at, e.tiedIn])).toEqual([
      [0, false],
      [1, false],
      [3, false],
      [4, false],
    ])
  })

  it('lays downbeats in 3/4 as three quarter notes', () => {
    const d = layRhythm('card:downbeats', [3])!
    expect(d.kind).toBe('bar')
    expect(d.bars[0]!.map(e => [e.at, e.length, e.rest, e.statement])).toEqual([
      [0, 2, false, 0],
      [2, 2, false, 1],
      [4, 2, false, 2],
    ])
  })

  it('plays only the spill in a 2/4 bar after 4/4 (Review Focus 2)', () => {
    const r = layRhythm('run:8:3:6', [4, 2, 4])!
    expect(r.bars[1]!.filter(e => !e.rest).map(e => e.at)).toEqual([0])
    for (const bar of r.bars) for (const e of bar) expect(e.length).toBeGreaterThan(0)
    expect(r.bars[1]!.reduce((n, e) => n + e.length, 0)).toBe(4)
    expect(r.bars[2]!.filter(e => !e.rest).map(e => e.at)).toEqual([6, 7])
  })

  it('plays only the spill in a 3/4 bar after 4/4 (Review Focus 2)', () => {
    const r = layRhythm('run:8:3:6', [4, 3, 4])!
    expect(r.bars[1]!.filter(e => !e.rest).map(e => e.at)).toEqual([0])
    for (const bar of r.bars) for (const e of bar) expect(e.length).toBeGreaterThan(0)
    expect(r.bars[1]!.reduce((n, e) => n + e.length, 0)).toBe(6)
    expect(r.bars[2]!.filter(e => !e.rest).map(e => e.at)).toEqual([6, 7])
    expect(rhythmNotes(r).flat().every(n => n.beat >= 0)).toBe(true)
  })

  it('takes the accent off a piece held into a bar', () => {
    const r = layRhythm('custom:4:>x__', [2, 2])!
    expect(r.bars[0]![0]).toMatchObject({ accent: true, tie: true })
    expect(r.bars[1]![0]).toMatchObject({ tiedIn: true, accent: false })
  })

  it('ties a syncopated unit across a statement and a barline at once (#505)', () => {
    // 8ths in 4, syncopated (_ x x x): the statement at pulse 8 starts with a hold of pulse 7, over the barline
    const r = layRhythm('unit:8:4:syncopated', [4, 4])!
    expect(r.bars[0]!.at(-1)).toMatchObject({ at: 7, length: 1, tie: true, statement: 1 })
    expect(r.bars[1]![0]).toMatchObject({ at: 0, length: 1, tiedIn: true, accent: false, statement: 2 })
    expect(r.bars[1]![1]).toMatchObject({ at: 1, tiedIn: false, statement: 2 })
  })

  it('gives a piece held into a bar the statement it belongs to', () => {
    // 8ths in 3, tied: the statement on pulses 6–8 is the sheet's third (index 2)
    const r = layRhythm('unit:8:3:tied', [4, 4])!
    expect(r.bars[1]![0]).toMatchObject({ tiedIn: true, statement: 2 })
    expect(r.bars[1]![1]).toMatchObject({ at: 1, tiedIn: false, statement: 3 })
  })

  it('accents only the attack and merges rests within a statement', () => {
    const r = layRhythm('unit:8:3:rests', [4])!
    expect(r.bars[0]!.map(e => [e.at, e.length, e.rest, e.statement])).toEqual([
      [0, 1, false, 0],
      [1, 2, true, 0],
      [3, 1, false, 1],
      [4, 2, true, 1],
      [6, 1, false, 2],
      [7, 1, true, 2],
    ])
    const a = layRhythm('unit:8:3:accents', [4])!
    expect(a.bars[0]!.filter(e => e.accent).map(e => e.at)).toEqual([0, 3, 6])
  })
})

describe('layRhythm forced attacks (lines spec §3.2)', () => {
  const ats = (l: ReturnType<typeof layRhythm>, b = 0) => l!.bars[b]!.filter(e => !e.rest).map(e => [e.at, e.length])

  it('makes an attack of a rest', () => {
    expect(layRhythm('card:upbeats', [4], [], [0])!.bars[0]!.filter(e => !e.rest).map(e => e.at)).toEqual([0, 1, 3, 5, 7])
    expect(layRhythm('unit:8:3:rests', [4], [], [1])!.bars[0]!.find(e => e.at === 1)).toMatchObject({ rest: false, accent: false, length: 1 })
  })

  it('makes an attack of a hold, so the tie after it holds the new note', () => {
    expect(ats(layRhythm('unit:8:3:tied', [4], [], [1]))).toEqual([[0, 1], [1, 2], [3, 3], [6, 2]])
  })

  it('forces a pulse on a break as the break already sounds it: one attack, no tie into it (#505)', () => {
    // 8ths in 4, syncopated (_ x x x): pulse 8, a 2nd ending's first, holds pulse 7 but for the break
    const broken = layRhythm('unit:8:4:syncopated', [4, 4], [1])!
    expect(layRhythm('unit:8:4:syncopated', [4, 4], [1], [8])).toEqual(broken)
    expect(broken.bars[0]!.at(-1)).toMatchObject({ tie: false })
    expect(broken.bars[1]![0]).toMatchObject({ at: 0, rest: false, tiedIn: false })
  })

  it('keeps an accent (guard)', () => {
    expect(layRhythm('unit:8:3:accents', [4], [], [3])!.bars[0]!.find(e => e.at === 3)?.accent).toBe(true)
  })

  it('ignores pulses outside the sheet (guard)', () => {
    expect(layRhythm('unit:8:3:tied', [4], [], [-1, 99])).toEqual(layRhythm('unit:8:3:tied', [4]))
  })
})

describe("each bar's pulse (Phase 4 spec §1, D11)", () => {
  it('lays a bar the group does not fit at the fallback, the stream counting through it', () => {
    const laid = layRhythm('unit:4t:2:accents', [4, 3, 4])!
    expect(laid.pulses).toEqual(['4t', '4', '4t'])
    expect(laid.starts).toEqual([0, 6, 9])
    expect(laid.bars.map(events => events.reduce((n, e) => n + e.length, 0))).toEqual([6, 3, 6])
    // 15 cells of a 2-cell unit: the third bar starts on the unit's 2nd cell
    expect(laid.bars[2]![0]).toMatchObject({ at: 0, accent: false })
    expect(laid.landings).toEqual([0, 1])
  })

  it('keeps one pulse where every bar fits', () => {
    expect(layRhythm('unit:16s:3:accents', [4, 3])!.pulses).toEqual(['16s', '16s'])
    expect(layRhythm('run:8:4:2', [4, 3])!.pulses).toEqual(['8', '8'])
  })
})

/** a flat record as one line of its set fields ("beat:0 value:h tie"), a bar of them as one line, so the regression snapshot stays readable (#553) */
const compact = (v: unknown): unknown => {
  if (Array.isArray(v)) {
    const xs = v.map(compact)
    const records = v.length > 0 && v.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x)) && xs.every((x) => typeof x === 'string')
    return records ? xs.join(' | ') : xs
  }
  if (v === null || typeof v !== 'object') return v
  const entries = Object.entries(v)
  if (entries.every(([, x]) => x === null || typeof x !== 'object'))
    return entries.filter(([, x]) => x !== null && x !== false).map(([k, x]) => (x === true ? k : `${k}:${String(x)}`)).join(' ')
  return Object.fromEntries(entries.map(([k, x]) => [k, compact(x)]))
}

// recorded on the four-pulse code before the pulse grid (Phase 4 spec §1): the grid must not move the old pulses
describe('the old pulses on the pulse grid (regression)', () => {
  const ids: RhythmId[] = [
    ...(['4', '8', '8t', '16'] as const).flatMap((p): RhythmId[] => [`unit:${p}:5:accents`, `unit:${p}:3:syncopated`, `custom:${p}:x.x_`]),
    'run:8:4:2',
    'card:halves',
  ]
  it.each(ids)('lays and notates %s as before', id => {
    const laid = layRhythm(id, [4, 3, 4])!
    const { pulses: _pulses, ...old } = laid as typeof laid & { pulses?: unknown }
    const line = lineRhythm(id, [4, 3, 4], [], [{ at: 0, sounds: true }, { at: 5.5, sounds: true }, { at: 7, sounds: false }], 'pickup-2', 0.5)!
    const { pulses: _linePulses, ...lineLaid } = line.laid as typeof line.laid & { pulses?: unknown }
    expect(
      compact({
        laid: old,
        notes: rhythmNotes(laid),
        line: { ...line, laid: lineLaid },
        card: cardBars(id, 3),
        poured: pourRun(9, id, 4, null),
      }),
    ).toMatchSnapshot()
  })
})

describe('rhythmCaption with a path (Phase 4 spec §3)', () => {
  const bars = Array<number>(6).fill(4)
  const groups: RhythmPath = { groups: [3, 4, 5], gears: null, step: { unit: 'section', bars: 4 } }
  const gears: RhythmPath = { groups: null, gears: ['8', '8t', '16'], step: { unit: 'bars', bars: 2 } }

  it('names the Groups path and its step, keeping the pulse', () => {
    expect(rhythmCaption('unit:8:3:accents', layRhythm('unit:8:3:accents', bars)!, groups)).toBe('Rhythm: 8ths, with accents · in 3 → 4 → 5 · by section')
  })

  it('names the Gears path and its step, keeping the group', () => {
    expect(rhythmCaption('unit:8:4:accents', layRhythm('unit:8:4:accents', bars)!, gears)).toBe('Rhythm: Units in 4, with accents · 8ths → triplets → 16ths · every 2 bars')
  })

  it('names both paths, by key area', () => {
    const both: RhythmPath = { groups: [3, 5], gears: ['8', '16'], step: { unit: 'key-area', bars: 4 } }
    expect(rhythmCaption('unit:8:4:rests', layRhythm('unit:8:4:rests', bars)!, both)).toBe('Rhythm: Units, with rests · in 3 → 5 · 8ths → 16ths · by key area')
  })

  it('is unchanged with no path, the path off, or a path the rhythm ignores (D12)', () => {
    const laid = layRhythm('unit:8:5:accents', bars)!
    const want = 'Rhythm: 8ths in 5, with accents · back on one every 5 bars'
    expect(rhythmCaption('unit:8:5:accents', laid)).toBe(want)
    expect(rhythmCaption('unit:8:5:accents', laid, RHYTHM_PATH_OFF)).toBe(want)
    expect(rhythmCaption('run:8:4:0', layRhythm('run:8:4:0', bars)!, gears)).toBe(cap('run:8:4:0', bars))
    expect(rhythmCaption('custom:8:x.x', layRhythm('custom:8:x.x', bars)!, groups)).toBe(cap('custom:8:x.x', bars))
  })

  it("names a custom rhythm's gears without its pulse", () => {
    expect(rhythmCaption('custom:8:x.x', layRhythm('custom:8:x.x', bars)!, gears)).toBe('Rhythm: Your rhythm (x.x) · 8ths → triplets → 16ths · every 2 bars')
  })
})

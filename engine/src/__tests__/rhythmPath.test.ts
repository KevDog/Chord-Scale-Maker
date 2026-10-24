import { describe, expect, it } from 'vitest'
import { PENTATONIC_STEP } from '../pentatonics'
import { layRhythm, type Laid } from '../rhythm/lay'
import { rhythmNotes } from '../rhythm/notation'
import {
  isRhythmPath,
  RHYTHM_GEAR_PRESETS,
  RHYTHM_GROUP_PRESETS,
  RHYTHM_PATH_OFF,
  rhythmStepCards,
  rhythmSteps,
  type RhythmPath,
  type RhythmSteps,
} from '../rhythm/path'

const path = (p: Partial<RhythmPath>): RhythmPath => ({ ...RHYTHM_PATH_OFF, ...p })

/** a bar's events as cells: `>` accent, `x` attack, `_` held, `.` rest */
const cells = (laid: Laid, b: number): string =>
  laid.bars[b]!.map(e => (e.rest ? '.' : e.accent ? '>' : 'x') + (e.rest ? '.' : '_').repeat(e.length - 1)).join('')

describe('the rhythm path (Phase 4 spec §3)', () => {
  it('is off with both lists null and the pentatonic default step', () => {
    expect(RHYTHM_PATH_OFF).toEqual({ groups: null, gears: null, step: PENTATONIC_STEP })
    expect(RHYTHM_GROUP_PRESETS).toEqual({ up: [3, 4, 5, 6, 7], down: [7, 6, 5, 4, 3] })
    expect(RHYTHM_GEAR_PRESETS).toEqual({ up: ['4t', '8', '8t', '16', '16t'], down: ['16t', '16', '8t', '8', '4t'] })
  })

  it('checks each list (1–8 entries, groups 2–7, known pulses) and the step', () => {
    expect(isRhythmPath(RHYTHM_PATH_OFF)).toBe(true)
    expect(isRhythmPath(path({ groups: [3, 4, 5], gears: ['8', '16'] }))).toBe(true)
    expect(isRhythmPath(path({ groups: [3, 4, 5, 6, 7, 2, 3, 4] }))).toBe(true)
    expect(isRhythmPath(path({ groups: [] }))).toBe(false)
    expect(isRhythmPath(path({ groups: [3, 4, 5, 6, 7, 2, 3, 4, 5] }))).toBe(false)
    expect(isRhythmPath(path({ groups: [8] }))).toBe(false)
    expect(isRhythmPath(path({ groups: [3.5] }))).toBe(false)
    expect(isRhythmPath(path({ gears: ['32' as never] }))).toBe(false)
    expect(isRhythmPath(path({ gears: [] }))).toBe(false)
    expect(isRhythmPath({ groups: null, gears: null, step: { unit: 'bars', bars: 3 } })).toBe(false)
    expect(isRhythmPath({ groups: null, step: PENTATONIC_STEP })).toBe(false)
    expect(isRhythmPath(null)).toBe(false)
    expect(isRhythmPath('off')).toBe(false)
  })
})

describe('rhythmSteps (Phase 4 spec §3 "The plan")', () => {
  it('puts each step\'s group into a unit, one entry per run of bars', () => {
    expect(rhythmSteps('unit:8:3:accents', path({ groups: [3, 4, 5] }), [0, 0, 1, 1, 2, 2])).toEqual([
      { from: 0, id: 'unit:8:3:accents' },
      { from: 2, id: 'unit:8:4:accents' },
      { from: 4, id: 'unit:8:5:accents' },
    ])
  })

  it('gives a bar outside the form step 0 (D15), and cycles the list', () => {
    expect(rhythmSteps('unit:8:3:rests', path({ groups: [3, 4] }), [null, 0, 1, 2, null])).toEqual([
      { from: 0, id: 'unit:8:3:rests' },
      { from: 2, id: 'unit:8:4:rests' },
      { from: 3, id: 'unit:8:3:rests' },
    ])
  })

  it('merges equal neighbours', () => {
    expect(rhythmSteps('unit:8:4:accents', path({ groups: [4, 4, 5] }), [0, 1, 2, 3])).toEqual([
      { from: 0, id: 'unit:8:4:accents' },
      { from: 2, id: 'unit:8:5:accents' },
      { from: 3, id: 'unit:8:4:accents' },
    ])
  })

  it('cycles groups and gears independently (D16)', () => {
    expect(rhythmSteps('unit:8:4:accents', path({ groups: [3, 5], gears: ['8', '16', '8t'] }), [0, 1, 2, 3])).toEqual([
      { from: 0, id: 'unit:8:3:accents' },
      { from: 1, id: 'unit:16:5:accents' },
      { from: 2, id: 'unit:8t:3:accents' },
      { from: 3, id: 'unit:8:5:accents' },
    ])
  })

  it('ignores Groups for a custom rhythm, and changes its pulse by Gears (D12)', () => {
    expect(rhythmSteps('custom:8:x.x', path({ groups: [3, 4] }), [0, 1])).toEqual([{ from: 0, id: 'custom:8:x.x' }])
    expect(rhythmSteps('custom:8:x.x', path({ gears: ['8', '16'] }), [0, 1])).toEqual([
      { from: 0, id: 'custom:8:x.x' },
      { from: 1, id: 'custom:16:x.x' },
    ])
  })

  it('is the id alone for a per-bar rhythm, Off, or no path', () => {
    expect(rhythmSteps('card:downbeats', path({ groups: [3, 4], gears: ['8', '16'] }), [0, 1])).toEqual([{ from: 0, id: 'card:downbeats' }])
    expect(rhythmSteps('run:8:4:0', path({ gears: ['8', '16'] }), [0, 1])).toEqual([{ from: 0, id: 'run:8:4:0' }])
    expect(rhythmSteps('off', path({ groups: [3, 4] }), [0, 1])).toEqual([{ from: 0, id: 'off' }])
    expect(rhythmSteps('unit:8:3:accents', RHYTHM_PATH_OFF, [0, 1])).toEqual([{ from: 0, id: 'unit:8:3:accents' }])
  })
})

describe('layRhythm by steps (Phase 4 spec §3 "Laying", D14)', () => {
  const groups345: RhythmSteps = [
    { from: 0, id: 'unit:8:3:accents' },
    { from: 2, id: 'unit:8:4:accents' },
    { from: 4, id: 'unit:8:5:accents' },
  ]
  const bars6 = Array<number>(6).fill(4)

  it('lays the worked example: Groups 3 4 5, every 2 bars', () => {
    const laid = layRhythm(groups345, bars6)!
    expect(range6.map(b => cells(laid, b))).toEqual(['>xx>xx>x', 'x>xx>xx>', '>xxx>xxx', '>xxx>xxx', '>xxxx>xx', 'xx>xxxx>'])
    // the statement at pulse 15 of bar 2 is one note, not tied into the next step
    expect(laid.bars[1]!.at(-1)).toMatchObject({ at: 7, length: 1, tie: false })
    expect(laid.bars[2]![0]).toMatchObject({ at: 0, tiedIn: false, accent: true })
    expect(laid.steps).toEqual([
      { from: 0, id: 'unit:8:3:accents', unit: 3 },
      { from: 2, id: 'unit:8:4:accents', unit: 4 },
      { from: 4, id: 'unit:8:5:accents', unit: 5 },
    ])
    expect(laid.steps[1]!.from).toBe(2)
    expect(laid).toMatchObject({ unit: 3, pulse: '8', kind: 'repeat', starts: [0, 8, 16, 24, 32, 40] })
    // each step lands on its first bar; statements are counted per step, on through the sheet
    expect(laid.landings).toEqual([0, 2, 3, 4])
    expect(laid.bars[2]![0]!.statement).toBeGreaterThan(laid.bars[1]!.at(-1)!.statement)
  })

  it('lays the worked example: Groups 3 4 with rests', () => {
    const laid = layRhythm(
      [
        { from: 0, id: 'unit:8:3:rests' },
        { from: 2, id: 'unit:8:4:rests' },
        { from: 4, id: 'unit:8:3:rests' },
      ],
      bars6,
    )!
    expect(range6.map(b => cells(laid, b))).toEqual(['x..x..x.', '.x..x..x', 'x...x...', 'x...x...', 'x..x..x.', '.x..x..x'])
  })

  it('cuts a note held into a step (no tie)', () => {
    const laid = layRhythm(
      [
        { from: 0, id: 'unit:8:3:tied' },
        { from: 1, id: 'unit:8:4:tied' },
      ],
      [4, 4],
    )!
    expect(laid.bars[0]!.at(-1)).toMatchObject({ tie: false })
    expect(laid.bars[1]![0]).toMatchObject({ at: 0, length: 4, tiedIn: false })
  })

  it('lays each step at its own pulse (Gears)', () => {
    const laid = layRhythm(
      [
        { from: 0, id: 'unit:8:4:accents' },
        { from: 1, id: 'unit:8t:4:accents' },
        { from: 2, id: 'unit:16:4:accents' },
      ],
      [4, 4, 4],
    )!
    expect(laid.pulses).toEqual(['8', '8t', '16'])
    expect(laid.starts).toEqual([0, 8, 20])
    expect(cells(laid, 1)).toBe('>xxx>xxx>xxx')
    expect(cells(laid, 2)).toBe('>xxx>xxx>xxx>xxx')
  })

  it('brackets and beams each step\'s statements (P1 §6.5 per step)', () => {
    const notes = rhythmNotes(layRhythm(groups345, bars6)!)
    expect(notes[2]!.map(n => n.bracket)).toEqual(['start', null, null, 'end', null, null, null, null])
    expect(notes[2]!.map(n => n.beam)).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
  })

  it('lays a bare id as a one-step plan', () => {
    expect(layRhythm([{ from: 0, id: 'unit:8:5:accents' }], [4, 3, 4])).toEqual(layRhythm('unit:8:5:accents', [4, 3, 4]))
    expect(layRhythm('unit:8:5:accents', [4, 3, 4])?.steps).toEqual([{ from: 0, id: 'unit:8:5:accents', unit: 5 }])
    expect(layRhythm('run:8:4:3', [4, 4])?.steps).toEqual([{ from: 0, id: 'run:8:4:3', unit: 0 }])
  })

  it('lays a break that is also a step start once (Review Focus 3)', () => {
    const steps: RhythmSteps = [
      { from: 0, id: 'unit:8:3:accents' },
      { from: 2, id: 'unit:8:4:accents' },
    ]
    expect(layRhythm(steps, [4, 4, 4, 4], [2])).toEqual(layRhythm(steps, [4, 4, 4, 4]))
  })

  it('keeps a break inside a step', () => {
    const steps: RhythmSteps = [
      { from: 0, id: 'unit:8:3:tied' },
      { from: 2, id: 'unit:8:3:tied' },
    ]
    const laid = layRhythm(steps, [4, 4, 4, 4], [3])!
    // bar 3's stream pulse 8 is mid-statement: held over by `_`, but cut by the break
    expect(laid.bars[3]![0]).toMatchObject({ at: 0, tiedIn: false })
    expect(laid.bars[2]!.at(-1)).toMatchObject({ tie: false })
  })
})

const range6 = [0, 1, 2, 3, 4, 5]

describe('rhythmStepCards (#574)', () => {
  it('one card a step, in the order the form first plays it, each named by what the path changes', () => {
    const steps = rhythmSteps('unit:8:3:accents', path({ groups: [3, 4, 5] }), [0, 1, 2, 0, 1])
    expect(rhythmStepCards('unit:8:3:accents', path({ groups: [3, 4, 5] }), steps)).toEqual([
      { id: 'unit:8:3:accents', group: 3, pulse: null },
      { id: 'unit:8:4:accents', group: 4, pulse: null },
      { id: 'unit:8:5:accents', group: 5, pulse: null },
    ])
  })

  it('names the pulse under Gears, and both with both', () => {
    const p = path({ groups: [3, 4], gears: ['8', '16'] })
    const cards = rhythmStepCards('unit:8:3:accents', p, rhythmSteps('unit:8:3:accents', p, [0, 1]))
    expect(cards).toEqual([
      { id: 'unit:8:3:accents', group: 3, pulse: '8' },
      { id: 'unit:16:4:accents', group: 4, pulse: '16' },
    ])
  })

  it('with no path acting, the rhythm’s one card, unnamed', () => {
    expect(rhythmStepCards('card:upbeats', path({ groups: [3, 4] }), [{ from: 0, id: 'card:upbeats' }])).toEqual([{ id: 'card:upbeats', group: null, pulse: null }])
  })
})

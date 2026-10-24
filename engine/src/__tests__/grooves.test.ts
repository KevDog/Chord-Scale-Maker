import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import { defaultTempo } from '../click'
import { grooveFor, seedOf, styleGroove } from '../grooves'
import { scheduleDrums } from '../voice'
import { bassNotes, type HarmonyBar, pianoNotes } from '../harmony'
import { CONCERT } from '../part'
import { pcOf } from '../pitch'
import { parseChord } from '../chord'

const charts = new URL('../../charts/', import.meta.url)
const styleOf = (text: string) => /^style:\s*(.+)$/m.exec(text)?.[1]?.trim()

describe('styleGroove (styles.json)', () => {
  it('maps every library chart’s style to a set, its tempo the click’s', () => {
    for (const f of readdirSync(charts)) {
      const style = styleOf(readFileSync(new URL(f, charts), 'utf8'))
      if (!style) continue
      const g = styleGroove(style)
      expect(['swing', 'ballad', 'bossa'], `${f}: ${style}`).toContain(g.set)
      expect(g.tempo, style).toBe(defaultTempo(style))
    }
  })

  it('a style it doesn’t list: by its words', () => {
    expect(styleGroove('Slow ballad, rubato')).toMatchObject({ set: 'ballad', tempo: defaultTempo('Slow ballad, rubato') })
    expect(styleGroove('Medium bossa')).toMatchObject({ set: 'bossa', swing: 0.5 })
    expect(styleGroove('Hard bop')).toMatchObject({ set: 'swing', swing: 0.67 })
    expect(styleGroove('Shuffle')).toMatchObject({ set: 'swing', swing: 0.72 })
    expect(styleGroove('')).toMatchObject({ set: 'swing' })
  })
})

const doc = (body: string, time = '') => parseChart(`title: T\nkey: C\n${time}\nsection: A\n${body}`).value
const bars = (d = doc('1 | Dm7\n2 | G7\n3 | CMaj7\n4 | A7\n')): HarmonyBar[] => buildChanges(d, CONCERT, 4, false, 'off').lines.flatMap((l) => l.bars)
const at = <T extends { bar: number; at: number }>(xs: readonly T[], bar: number) => xs.filter((x) => x.bar === bar)

describe('the swing set: drums', () => {
  it('in 4: the ride’s ding, ding-a, ding, ding-a, the hat’s foot on 2 and 4', () => {
    const g = grooveFor('swing', bars(), 1)
    const bar0 = at(g.drums, 0)
    expect(bar0.filter((h) => h.kind === 'ride').map((h) => h.at)).toEqual([0, 1, 1.5, 2, 3, 3.5])
    expect(bar0.filter((h) => h.kind === 'hat').map((h) => h.at)).toEqual([1, 3])
    const ride = bar0.filter((h) => h.kind === 'ride')
    expect(ride[1]!.velocity).toBeGreaterThan(ride[0]!.velocity) // 2 and 4 lean
    expect(ride[2]!.velocity).toBeLessThan(ride[0]!.velocity) // the skip note lighter
  })

  it('a jazz waltz: ding, ding-a, ding; the hat on 2 and 3', () => {
    const g = grooveFor('swing', bars(doc('1 | Dm7\n2 | G7\n', 'time: 3/4\n')), 1)
    expect(at(g.drums, 0).filter((h) => h.kind === 'ride').map((h) => h.at)).toEqual([0, 1, 1.5, 2])
    expect(at(g.drums, 0).filter((h) => h.kind === 'hat').map((h) => h.at)).toEqual([1, 2])
  })
})

describe('the swing set: walking bass (decision groove.swing)', () => {
  const b = bars()
  const walk = grooveFor('swing', b, seedOf('Autumn Leaves')).bass
  const rootPc = (bar: number) => pcOf(parseChord(b[bar]!.chords[0]!.text).root)

  it('walks in quarters: four a bar in 4, the chord’s root on 1', () => {
    for (let bar = 0; bar < 4; bar++) {
      const notes = at(walk, bar)
      expect(notes.map((n) => [n.at, n.beats])).toEqual([0, 1, 2, 3].map((x) => [x, 1]))
      expect(notes[0]!.midi % 12).toBe(rootPc(bar))
    }
  })

  it('the last beat leads into the next root: a half step away, or its 5th; the form’s last bar into its first', () => {
    for (let bar = 0; bar < 4; bar++) {
      const last = at(walk, bar)[3]!.midi
      const next = at(walk, (bar + 1) % 4)[0]!.midi
      expect([1, 11, 5, 7], `bar ${bar}`).toContain((((next - last) % 12) + 12) % 12)
    }
  })

  it('stays from E1 to G3, mostly by step', () => {
    for (const n of walk) {
      expect(n.midi).toBeGreaterThanOrEqual(28)
      expect(n.midi).toBeLessThanOrEqual(55)
    }
    for (let i = 1; i < walk.length; i++) expect(Math.abs(walk[i]!.midi - walk[i - 1]!.midi)).toBeLessThanOrEqual(7)
  })

  it('the same line every time for a chart; another chart’s seed walks another', () => {
    expect(grooveFor('swing', b, seedOf('Autumn Leaves')).bass).toEqual(walk)
    const others = ['A', 'B', 'C', 'D', 'E'].map((t) => JSON.stringify(grooveFor('swing', b, seedOf(t)).bass))
    expect(new Set([JSON.stringify(walk), ...others]).size).toBeGreaterThan(1)
  })

  it('in 3/4, the root on 1 for two beats and a lead-in on 3', () => {
    const w = grooveFor('swing', bars(doc('1 | Dm7\n2 | G7\n', 'time: 3/4\n')), 1).bass
    expect(at(w, 0).map((n) => [n.at, n.beats])).toEqual([
      [0, 2],
      [2, 1],
    ])
  })
})

describe('the swing set: comping (decision groove.swing)', () => {
  it('strikes each chord’s voicing in a comping rhythm, never past its chord', () => {
    const b = bars()
    const g = grooveFor('swing', b, 7)
    const held = pianoNotes(b)
    for (let bar = 0; bar < 4; bar++) {
      const hits = at(g.piano, bar)
      expect(hits.length).toBeGreaterThan(0)
      const voicing = at(held, bar).map((n) => n.midi)
      const strikes = [...new Set(hits.map((h) => h.at))]
      for (const s of strikes) expect(hits.filter((h) => h.at === s).map((h) => h.midi)).toEqual(voicing)
      for (const h of hits) expect(h.at + h.beats).toBeLessThanOrEqual(4)
    }
  })
})

describe('the ballad set (decision groove.ballad)', () => {
  const b = bars()
  const g = grooveFor('ballad', b, 1)

  it('brushes: a sweep on each beat, a tap on 2 and 4, the hat’s foot with it', () => {
    const bar0 = at(g.drums, 0)
    expect(bar0.filter((h) => h.kind === 'sweep').map((h) => h.at)).toEqual([0, 1, 2, 3])
    expect(bar0.filter((h) => h.kind === 'brush').map((h) => h.at)).toEqual([1, 3])
    expect(bar0.filter((h) => h.kind === 'hat').map((h) => h.at)).toEqual([1, 3])
    expect(g.drums.some((h) => h.kind === 'ride')).toBe(false)
  })

  it('in 3/4, the tap on 2 and 3', () => {
    const w = grooveFor('ballad', bars(doc('1 | Dm7\n2 | G7\n', 'time: 3/4\n')), 1)
    expect(at(w.drums, 0).filter((h) => h.kind === 'brush').map((h) => h.at)).toEqual([1, 2])
  })

  it('the piano holds each voicing; the bass plays in two', () => {
    expect(g.piano).toEqual(pianoNotes(b))
    expect(g.bass).toEqual(bassNotes(b, 'two'))
  })
})

describe('the bossa set (decision groove.bossa)', () => {
  const b = bars()
  const g = grooveFor('bossa', b, 1)
  const kinds = (bar: number, kind: string) => at(g.drums, bar).filter((h) => h.kind === kind).map((h) => h.at)

  it('the cross-stick’s two-bar pattern: 1, the and of 2, 4; then 2 and the and of 3', () => {
    expect(kinds(0, 'stick')).toEqual([0, 1.5, 3])
    expect(kinds(1, 'stick')).toEqual([1, 2.5])
    expect(kinds(2, 'stick')).toEqual([0, 1.5, 3])
  })

  it('the hat on every 8th, the kick on 1 and 3 with a pickup before each', () => {
    expect(kinds(0, 'tip')).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
    expect(kinds(0, 'kick')).toEqual([0, 1.5, 2, 3.5])
  })

  it('the bass: the root on 1 and its 5th on 3, each held a dotted quarter', () => {
    const notes = at(g.bass, 0)
    expect(notes.map((n) => [n.at, n.beats])).toEqual([
      [0, 1.5],
      [2, 1.5],
    ])
    expect(notes[0]!.midi % 12).toBe(2) // D
    expect(notes[1]!.midi % 12).toBe(9) // A
  })

  it('the piano strikes its voicings off the beat too, never past its chord', () => {
    const held = pianoNotes(b)
    for (let bar = 0; bar < 4; bar++) {
      const hits = at(g.piano, bar)
      expect(hits.length).toBeGreaterThan(0)
      for (const h of hits) {
        expect(at(held, bar).map((n) => n.midi)).toContain(h.midi)
        expect(h.at + h.beats).toBeLessThanOrEqual(4)
      }
    }
    expect(g.piano.some((h) => h.at % 1 === 0.5)).toBe(true)
  })
})

describe('scheduleDrums', () => {
  it('books the hits from the click’s clock, the skip notes swung as the dial says', () => {
    const hits = grooveFor('swing', bars(), 1).drums.filter((h) => h.bar === 0 && h.kind === 'ride')
    const plan = { options: { beats: 4 as const, feel: 'swing' as const, hat: false, swing: 0.75 }, tempo: 60, countIn: 0 as const }
    const booked = scheduleDrums(hits, 4, plan, { barStart: 0, bar: 0 }, 0, 4)
    expect(booked.map((h) => h.time)).toEqual([0, 1, 1.75, 2, 3, 3.75])
    expect(booked.every((h) => h.kind === 'ride' && h.velocity > 0)).toBe(true)
  })
})

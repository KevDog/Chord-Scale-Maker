import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { arpeggioTones } from '../arpeggios'
import { expandRows, parseChart, type Row } from '../chart'
import { resolveScales } from '../resolve'
import { buildSheet } from '../sheet'
import { CONCERT, rangeOf } from '../part'
import { rootName } from '../pitch'
import { arpeggioLine, ARP_DIRECTION_LABELS, ARP_NOTES_LABELS, buildArpeggioSheet, isArpDirection, isArpNotes, tensionsOf } from '../arpeggioSheet'

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
  it('plays the 7th chord up, down, and up and down without repeating the top', () => {
    expect(line('Cm7', 'C Dorian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb'])
    expect(line('Cm7', 'C Dorian', 'seventh', 'down').notes.map(rootName)).toEqual(['Bb', 'G', 'Eb', 'C'])
    const ud = line('Cm7', 'C Dorian', 'seventh', 'up-down')
    expect(ud.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'G', 'Eb', 'C'])
    expect(ud.groups).toEqual([4, 3])
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

  it("plays a triad's root on top in 7th Chord mode", () => {
    expect(line('C', 'C Ionian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'E', 'G', 'C'])
  })

  it('needs a scale only for Extended', () => {
    expect(line('Cm7', null, 'seventh', 'up').notes).toHaveLength(4)
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

  it('has labels and guards', () => {
    expect(Object.values(ARP_NOTES_LABELS)).toEqual(['7th Chord', 'Extended'])
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
    expect(sev?.notes).toHaveLength(4)
    expect(sev?.intervals).toEqual(['1', 'b3', '5', 'b7'])
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

  it('draws the key signature on the first line only, and marks accidentals by the measure rule', () => {
    const eb = { tonic: 3, minor: false, name: 'Eb' } as const
    const rows = [row('Cm7', 'C Dorian'), row('Fm7', 'F Dorian')]
    const plain = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up').pages.flat()
    expect(plain[0]?.accidentals).toContain('b')
    const keyed = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up', eb).pages.flat()
    expect(keyed.map((s) => s.showClefAndKey)).toEqual([true, false])
    expect(keyed[0]?.keySig).not.toBeNull()
    expect(keyed[0]?.accidentals).not.toContain('b')
    expect(keyed[0]?.accidentals).toEqual(keyed[0]?.notes.map(() => null))
  })
})

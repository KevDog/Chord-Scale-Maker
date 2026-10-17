import { readdirSync, readFileSync } from 'node:fs'
import { isRest } from '../chord'
import { describe, expect, it, vi } from 'vitest'
import { breakLines, buildChanges, type ChangesLine, type ChangesSheet, changesLinesPerPage, changesSections, chordPositions, drawnChords, type PentatonicPlan, pickTargets, showHexatonics, showPentatonics } from '../changes'
import { type ChartDoc, expandRowLines, parseChart } from '../chart'
import { NO_PICKS, pickTarget, withPick } from '../chordPicks'
import { resolveScales } from '../resolve'
import { type GuideLine, type GuideNote, guideVoices } from '../guideTones'
import { CONCERT, concertPc, type Part, partFor, rangeOf } from '../part'
import { parseRoot, pcOf, rootName, type Spelled } from '../pitch'
import type { PentatonicLine } from '../pentatonicLine'
import type { TriadPairLine } from '../triadPairLine'
import { toVexKey } from '../sheet'
import type { ScaleView } from '../resolve'
import { type PentatonicDegree, PENTATONIC_HOME, type PentatonicPathName, type PentatonicStep } from '../pentatonics'
import { abbreviateScale } from '../scales'
import { chunk, isSyncCopy } from '../util'

// a transparent wrapper, so a test can see what buildChanges hands the voice leading
vi.mock('../guideTones', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guideTones')>()
  return { ...actual, guideVoices: vi.fn(actual.guideVoices) }
})

const library = (name: string) => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const bars = (name: string, part = CONCERT) => buildChanges(library(name), part).lines.flatMap((l) => l.bars)
const one = (rung: number, side: 'flat' | 'sharp'): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: { rung, side }, counts: false })

describe('the Changes sheet', () => {
  it('lays a chart out four bars a line, each section on a new line, a @copy straight after its source as a repeat', () => {
    const sheet = buildChanges(library('autumn-leaves'), CONCERT)
    expect(sheet.lines.map((l) => l.bars.length)).toEqual([4, 4, 4, 4, 4, 4]) // A1·A2 (8 bars, played twice), B (16)
    const [first] = sheet.lines[0]?.bars ?? []
    expect([first?.marker, first?.keyArea, first?.repeatStart]).toEqual(['A1 · A2', 'G minor', true])
    expect(sheet.lines[1]?.bars[3]?.repeatEnd).toBe(2)
    expect(sheet.lines[2]?.bars[0]?.marker).toBe('B')
    expect(sheet.lines.at(-1)?.bars.at(-1)?.end).toBe('final')
  })

  it('puts each chord on its beat with its numeral and its scale', () => {
    const bar3 = bars('autumn-leaves')[2]
    expect(bar3?.chords.map((c) => [c.text, c.beat, c.numeral, c.scale])).toEqual([
      ['Bm7', 0, 'ii7/II', 'B Dorian'],
      ['E7', 2, 'V7/II', 'E Mixo'],
    ])
  })

  it('prints an intro before the form, writes a later copy out, marks key areas, and closes both with a double bar before a tag', () => {
    const b = bars('a-night-in-tunisia')
    expect(b.filter((x) => x.marker).map((x) => x.marker)).toEqual(['Intro', 'A1 · A2', 'B', 'A3 (= A1)', 'Tag'])
    expect(b.filter((x) => x.keyArea).map((x) => x.keyArea)).toEqual(['D minor', 'F major', 'D minor'])
    expect(b.map((x) => x.end).filter((e) => e !== 'none')).toEqual(['double', 'double', 'final'])
  })

  it('each chord carries the rule behind its scale, and whether the rules only guessed', () => {
    const rows = (text: string) => buildChanges(parseChart(text).value, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    const chords = rows('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | Abm7\n')
    expect(chords.map((c) => [c.text, c.rule, c.fallback])).toEqual([
      ['Dm7', 'm4', false],
      ['G7', 'D4', false],
      ['CMaj7', 'M3', false],
      ['Abm7', 'm8', true],
    ])
  })

  it('a function the author wrote is never a guess on the sheet, though its rule is still named', () => {
    const [a] = buildChanges(parseChart('title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | D7 |  | II7\n3 | Dm7\n4 | G7\n').value, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords).filter((c) => c.text === 'D7')
    expect([a?.stated, a?.fallback, a?.rule !== '']).toEqual([true, false, true])
  })

  it('heads a coda "after the last chorus"', () => {
    const doc = parseChart('key: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n\nsection: Coda\nbars: 4\n1 | Db7\n2 | CMaj7\n').value
    const markers = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).filter((x) => x.marker).map((x) => x.marker)
    expect(markers).toEqual(['A', 'Coda (after the last chorus)'])
  })

  it('writes chords, scales and key areas for a transposing instrument; numerals stay', () => {
    const [first] = bars('autumn-leaves', TENOR)
    expect([first?.keyArea, first?.chords[0]?.scale, first?.chords[0]?.numeral]).toEqual(['A minor', 'D Dorian', 'ii7/♭III'])
  })

  it('gives each chord its symbol as written for the part, beside the chart\'s concert symbol', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n').value
    const chords = (part: Part) => buildChanges(doc, part).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords(TENOR).map((c) => [c.text, c.written])).toEqual([['Dm7', 'Em7'], ['G7', 'A7'], ['CMaj7', 'DMaj7']])
    expect(chords(CONCERT).map((c) => c.written)).toEqual(['Dm7', 'G7', 'CMaj7'])
  })

  it('gives each chord the chart row it comes from: its section and bar', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 8\n1 | Dm7\n2 | G7\n\nsection: B\nbars: 4\n1 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.map((c) => c.at)).toEqual([{ section: 'A', bar: '1' }, { section: 'A', bar: '2' }, { section: 'B', bar: '1' }])
  })

  it('gives each bar its place in the chart (held bars too), the section a written-out copy repeats, and marks a section’s last line', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n4 | CMaj7\n5 | Am7\n6 | D7\n\nsection: B\n1 | Fm7\n\nsection: C\ncopy: A\n').value
    const sheet = buildChanges(doc, CONCERT)
    expect(sheet.lines.map((l) => l.bars.map((b) => `${b.at.section}${b.at.bar}`))).toEqual([['A1', 'A2', 'A3', 'A4'], ['A5', 'A6'], ['B1'], ['C1', 'C2', 'C3', 'C4'], ['C5', 'C6']])
    expect(sheet.lines[0]?.bars[2]?.chords).toEqual([]) // bar 3 holds G7
    expect(sheet.lines.map((l) => l.sectionEnd)).toEqual([false, true, true, false, true])
    expect(sheet.lines.map((l) => l.bars[0]?.repeatOf ?? null)).toEqual([null, null, null, 'A', 'A'])
  })

  it('counts a waltz in 3', () => {
    expect(buildChanges(library('someday-my-prince-will-come'), CONCERT).beats).toBe(3)
  })

  it('gives each chord its reason, the key it is heard in, and whether its function was stated', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Bb7 |  | D: ♭VI7\n3 | G7\n4 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    const bb7 = chords.find((c) => c.text === 'Bb7')
    expect([bb7?.numeral, bb7?.stated, bb7?.heardIn]).toEqual(['♭VI7', true, 'D major'])
    expect(bb7?.reason).toMatch(/^\* /)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ stated: false, heardIn: 'C major', reason: 'V7 of C: natural tensions' })
  })

  it("keeps the rules' numeral on a chord whose written function doesn't fit, and says why", () => {
    const doc = parseChart('title: T\nkey: Eb\n\nsection: A\n1 | EbMaj7\n2 | G7 |  | Eb: V7/ii\n3 | Fm7\n4 | Bb7 |  | V7/q\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ numeral: 'III7', stated: false, problem: 'V7/ii in Eb is on C, not G7' })
    expect(chords.find((c) => c.text === 'Bb7')?.problem).not.toBe('')
    expect(chords.find((c) => c.text === 'Fm7')?.problem).toBe('')
  })

  it('says where the key it is heard in came from: found, an @key, or the function', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Bb7 |  | D: ♭VI7\n3 | G7\n4 | CMaj7\n\nsection: B\nkey: F\nbars: 4\n1 | Gm7\n2 | C7\n3 | FMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(['Bb7', 'G7', 'C7'].map((t) => chords.find((c) => c.text === t)?.keyFrom)).toEqual(['function', 'found', 'area'])
  })

  const pents = (sheet: Pick<ChangesSheet, 'lines'>) => sheet.lines.map((l) => l.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label ?? '')).filter(Boolean))

  it('names each key area’s pentatonic at a rung and side, only where the area changes or a line starts', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | Cmaj7\n4 | Cmaj7\n5 | F#m7b5\n6 | B7\n7 | Em7\n8 | Em7\n@key 5 Em').value
    const sheet = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(2, 'flat')).lines)
    expect(pents({ lines: sheet })).toEqual([['Gm♪'], ['Dm♪']]) // C major ♭2 Gm; E minor (home Em) ♭2 Dm
  })

  it('plays a section named after an Object built-in at the fallback', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: constructor\n1 | Dm7\n2 | G7\n\nsection: toString\nbars: 2\n1 | Cmaj7\n').value
    const sheet = buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(2, 'flat'))
    expect(pents(sheet).flat().length).toBeGreaterThan(0)
  })

  it('writes the ladder for the part: a B♭ part over concert C major reads D major’s', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7').value
    const [chord] = buildChanges(doc, TENOR, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]?.chords ?? []
    expect([chord?.pentatonic?.label, chord?.pentatonic?.key, chord?.pentatonic?.ladder.length]).toEqual(['Bm♪', 'D major', 12])
  })

  it('spells the title from the ladder’s Home, so a transposed minor area and its Home agree', () => {
    const minor = parseChart('title: T\nkey: Bm\n\nsection: A\nbars: 4\n1 | Bm7').value
    const bar = buildChanges(minor, TENOR, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]
    expect([bar?.chords[0]?.pentatonic?.key, bar?.chords[0]?.pentatonic?.label, bar?.keyArea]).toEqual(['C♯ minor', 'C♯m♪', 'C♯ minor'])
    const major = parseChart('title: T\nkey: C#\n\nsection: A\nbars: 4\n1 | C#maj7').value
    const [chord] = buildChanges(major, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]?.chords ?? []
    expect([chord?.pentatonic?.key, chord?.pentatonic?.label]).toEqual(['D♭ major', 'B♭m♪'])
  })

  it('does not repeat the label across relative keys, but each chord keeps its own area’s key', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | Am7\n@key 2 Am').value
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines)
    const chords = lines[0]?.bars.flatMap((b) => b.chords) ?? []
    expect(chords.map((c) => c.pentatonic?.label ?? '')).toEqual(['Am♪', '']) // printed once: the same home
    expect(chords.map((c) => c.pentatonic?.key)).toEqual(['C major', 'A minor'])
  })

  it('labels the first chord of a line the app breaks off', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | C\n2 | F\n3 | G\n4 | C').value
    const built = buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(1, 'sharp'))
    const lines = showPentatonics(breakLines(built.lines, new Set(['A 3'])))
    expect(pents({ lines })).toEqual([['Em♪'], ['Em♪']])
  })

  it('lists the sections it draws: a repeat drawn once and a section with endings are one each', () => {
    expect(changesSections(library('autumn-leaves')).map((s) => [s.key, s.marker, s.part])).toEqual([['A1', 'A1 · A2', 'form'], ['B', 'B', 'form']])
    expect(changesSections(library('take-the-a-train')).map((s) => [s.key, s.part])).toEqual([['Intro', 'before'], ['A1', 'form'], ['A2', 'form'], ['B', 'form'], ['A3', 'form']])
    expect(changesSections(library('stardust')).filter((s) => s.key === 'Intro')).toHaveLength(1) // played twice, with endings
  })

  it('plays each section at its own rung, with the shared count when asked', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Cmaj7\n\nsection: B\n1 | Cmaj7\n2 | Cmaj7').value
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines })).toEqual([['Am♪ 5'], ['B♭m♪ 1']]) // each section starts a line, so its label prints
    const b = lines[1]?.bars[0]?.chords[0]?.pentatonic
    expect([b?.section, b?.view, b?.shared]).toEqual(['B', { rung: 5, side: 'flat' }, 1])
  })

  it('keeps a section’s rung in the key of its own area', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nkey: G\nbars: 3\n1 | Gmaj7').value
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines })).toEqual([['Am♪ 5'], ['B♭m♪ 0']]) // G major's home Em, its rung 6 B♭m
  })

  it('gives a merged repeat’s chords the first section’s rung', () => {
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: { A1: { rung: 2, side: 'flat' }, A2: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: false }
    const first = buildChanges(library('autumn-leaves'), CONCERT, 4, false, 'off', undefined, plan).lines[0]?.bars[0]?.chords[0]?.pentatonic
    expect([first?.section, first?.view.rung]).toEqual(['A1', 2])
  })

  describe('a preset’s steps (#276)', () => {
    const tag = (v: { rung: number; side: string } | undefined): string => (!v ? '' : v.rung === 0 || v.rung === 6 ? String(v.rung) : `${v.rung}${v.side === 'flat' ? '♭' : '♯'}`)
    const rungs = (sheet: ChangesSheet) => sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => tag(c.pentatonic?.view))))
    const preset = (path: PentatonicPathName, step?: PentatonicStep, extra: Partial<PentatonicPlan> = {}): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: true, path, ...(step ? { step } : {}), ...extra })
    const build = (text: string, plan: PentatonicPlan, part = CONCERT) => buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan)
    const ABC = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\n1 | Cmaj7\n\nsection: C\nbars: 2\n1 | Cmaj7\n'
    const bars = (section: string, n: number) => [`section: ${section}`, ...Array.from({ length: n }, (_, i) => `${i + 1} | Cmaj7`)].join('\n')

    it('by section, moves every section after the first: A B C is Home, then out, then further', () => {
      const sheet = build(ABC, preset('minor-thirds', { unit: 'section', bars: 4 }))
      expect(rungs(sheet)).toEqual(['0', '3♭', '6'])
      expect(pents({ lines: showPentatonics(sheet.lines) })).toEqual([['Am♪ 5'], ['Cm♪ 3'], ['E♭m♪ 0']])
    })

    it('steps by section when the plan has no step', () => {
      expect(rungs(build(ABC, preset('fifths')))).toEqual(['0', '1♯', '2♯'])
    })

    it('plays Home outside the form, and counts only the form', () => {
      const text = 'title: T\nkey: C\n\nsection: Intro\nbars: 4\n1 | Cmaj7\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | Cmaj7\n\nsection: Coda\nbars: 4\n1 | Cmaj7\n'
      expect(rungs(build(text, preset('fifths', { unit: 'section', bars: 4 })))).toEqual(['0', '0', '1♯', '0'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '0', '0'])
    })

    it('a chart with no form plays Home', () => {
      const sheet = build('title: T\nkey: C\n\nsection: Intro\nbars: 4\n1 | Cmaj7\n', preset('fifths', { unit: 'bars', bars: 2 }))
      expect(rungs(sheet)).toEqual(['0'])
      expect(sheet.pentatonicCaption).toBe('Pentatonics: Fifths · every 2 bars')
    })

    it('every N bars counts on through a section break', () => {
      const text = `title: T\nkey: C\n${bars('A', 3)}\n${bars('B', 3)}\n`
      expect(rungs(build(text, preset('side-slip', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '5♭', '5♭', '0', '0'])
    })

    it('every 2, 4 or 8 bars', () => {
      const text = `title: T\nkey: C\n${bars('A', 8)}\n`
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '1♯', '1♯', '2♯', '2♯', '3♯', '3♯'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 4 })))).toEqual(['0', '0', '0', '0', '1♯', '1♯', '1♯', '1♯'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 8 })))).toEqual(Array(8).fill('0'))
    })

    it('counts a repeat drawn once by its drawn bars', () => {
      const sheet = buildChanges(library('autumn-leaves'), CONCERT, 4, false, 'off', undefined, preset('fifths', { unit: 'bars', bars: 4 }))
      expect(sheet.lines.slice(0, 3).map((l) => tag(l.bars[0]?.chords[0]?.pentatonic?.view))).toEqual(['0', '1♯', '2♯']) // A1 · A2's 8 bars, then B at form bar 8
    })

    it('by key area, a revisit takes the next step', () => {
      const text = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | Fmaj7\n3 | Cmaj7\n@key 2 F\n@key 3 C\n'
      expect(rungs(build(text, preset('minor-thirds', { unit: 'key-area', bars: 4 })))).toEqual(['0', '3♭', '6'])
    })

    it('steps the same for a B♭ part', () => {
      expect(rungs(build(ABC, preset('minor-thirds'), TENOR))).toEqual(['0', '3♭', '6'])
    })

    it('a pick still wins over the preset', () => {
      const [, b] = build(ABC, preset('minor-thirds', undefined, { picks: { 'B:1:0': { pc: 9 } } })).lines.flatMap((l) => l.bars.flatMap((x) => x.chords)) // concert A: Am, Home
      expect([tag(b?.pentatonic?.view), b?.pentatonic?.picked]).toEqual(['0', true])
    })

    it('names the path for a preset on the key basis only', () => {
      expect(build(ABC, preset('minor-thirds', { unit: 'bars', bars: 4 })).pentatonicCaption).toBe('Pentatonics: Minor thirds · every 4 bars')
      expect(build(ABC, preset('fifths', undefined, { basis: 'chord' })).pentatonicCaption).toBeNull()
      expect(build(ABC, one(2, 'flat')).pentatonicCaption).toBeNull()
      expect(build(ABC, preset('custom')).pentatonicCaption).toBeNull()
      expect(buildChanges(parseChart(ABC).value, CONCERT).pentatonicCaption).toBeNull()
    })
  })

  it('has no pentatonics with no view, and none where the analysis finds no key', () => {
    expect(bars('autumn-leaves').flatMap((b) => b.chords).every((c) => c.pentatonic === null)).toBe(true)
    const doc = parseChart('title: T\n\nsection: A\nbars: 4\n1 | N.C.').value
    expect(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines.flatMap((l) => l.bars.flatMap((b) => b.chords)).every((c) => c.pentatonic === null)).toBe(true)
  })

  it('counts the pentatonic row as a row: 7 with a line and every row off, else 6, 5 with all three rows; 8 with no line, 7 with all three rows', () => {
    expect(changesLinesPerPage('third', { numerals: false, scales: false, pentatonics: true })).toBe(6)
    expect(changesLinesPerPage('third', { numerals: false, scales: false, pentatonics: false })).toBe(7)
    expect(changesLinesPerPage('third', { numerals: true, scales: true, pentatonics: true })).toBe(5)
    expect(changesLinesPerPage('seventh', { numerals: true, scales: false, pentatonics: true })).toBe(6)
    expect(changesLinesPerPage('off', { numerals: true, scales: true, pentatonics: true })).toBe(7)
    expect(changesLinesPerPage('off', { numerals: true, scales: false, pentatonics: true })).toBe(8)
  })
})

describe('scale labels', () => {
  const chords = (text: string) =>
    buildChanges(parseChart(text).value, CONCERT).lines.map((l) => l.bars.flatMap((b) => b.chords.map((c) => [c.text, c.scale])))

  it('abbreviates scale names and blanks a scale that repeats the previous chord on the same line', () => {
    const text = ['key: C', '', 'section: A', '1 | Dm7', '2 | Dm7', '3 | G7', '4 | G7'].join('\n') + '\n'
    const line0 = chords(text)[0]!
    expect(line0.map((c) => c[1])).toEqual(['D Dorian', null, 'G Mixo', null])
  })

  it('always shows the first chord of a line, even if it repeats the previous line', () => {
    const text = ['key: C', '', 'section: A', 'bars: 8', '1 | Dm7', '2 | Dm7', '3 | Dm7', '4 | Dm7', '5 | Dm7'].join('\n') + '\n'
    const lines = chords(text)
    expect(lines[0]!.map((c) => c[1])).toEqual(['D Dorian', null, null, null])
    expect(lines[1]![0]![1]).toBe('D Dorian')
  })

  const chordPlan = (degree: PentatonicDegree = 'auto'): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord', degree })
  const flat = (lines: readonly ChangesLine[]) => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))

  it('ranks each chord against its own scale under the chord basis: Waltz for Debby bars 1–4', () => {
    const built = buildChanges(library('waltz-for-debby'), CONCERT, 4, false, 'off', undefined, chordPlan())
    const first4 = flat(built.lines).slice(0, 4)
    // F Ionian from F, D Aeolian, G Dorian, C Mixolydian: all F major's notes, ties by fifths from each chord root
    expect(first4.map((c) => c.pentatonic?.name)).toEqual(['Gm', 'Dm', 'Gm', 'Gm'])
    expect(first4.map((c) => [c.pentatonic?.degree, c.pentatonic?.shared, c.pentatonic?.level])).toEqual([[2, 5, 0], [0, 5, 0], [0, 5, 0], [7, 5, 0]]) // Auto: on the 2, 1, 1, 5
    expect(showPentatonics(built.lines)[0]?.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label))).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5', ''])
  })

  it('names the chord basis title and keeps its ranking; builds on the degree chosen', () => {
    const doc = parseChart('title: T\nkey: F\n\nsection: A\nbars: 4\n1 | Dm7').value
    const [c] = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan(1)).lines) // E♭m on ♭2 of D Dorian: none shared
    expect([c?.pentatonic?.basis, c?.pentatonic?.title, c?.pentatonic?.ranking.length, c?.pentatonic?.name, c?.pentatonic?.degree, c?.pentatonic?.shared, c?.pentatonic?.level]).toEqual(['chord', 'Dm7 · D Dorian pentatonic ranking', 12, 'E♭m', 1, 0, 6])
  })

  it('builds on the same degree over each chord under the chord basis', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | Cmaj7').value
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan(9)).lines) // on the 6
    expect(chords.map((c) => [c.pentatonic?.name, c.pentatonic?.degree, c.pentatonic?.shared])).toEqual([['Bm', 9, 4], ['Em', 9, 5], ['Am', 9, 5]])
  })

  it('spells the chord basis for the part, and reports the root in concert', () => {
    const doc = parseChart('title: T\nkey: F\n\nsection: A\nbars: 4\n1 | Dm7').value
    const [c] = flat(buildChanges(doc, TENOR, 4, false, 'off', undefined, chordPlan()).lines)
    expect([c?.pentatonic?.name, c?.pentatonic?.pc]).toEqual(['Em', 2]) // written E minor = concert D
    expect(concertPc(TENOR, 4)).toBe(2)
  })

  it('gives a chord with no scale no label under the chord basis', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | N.C.\n3 | Cmaj7').value
    const chords = flat(showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan()).lines))
    expect(chords[1]?.pentatonic).toBeNull()
    expect(chords.map((c) => c.pentatonic?.label ?? null)).toEqual(['Am♪ 5', null, 'Am♪ 5']) // a gap: the label prints again (one static tonic, Lydian, across the rest)
  })

  it('keys each chord by its drawn bar and index, and keeps the key basis’s title and level', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n1 | Dm7\n\nsection: B\nbars: 3\n1 | Cmaj7').value
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 3, side: 'sharp' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(chords.map((c) => c.pentatonic?.chord)).toEqual(['A:1:0', 'A:1:1', 'B:1:0'])
    expect([chords[2]?.pentatonic?.title, chords[2]?.pentatonic?.level, chords[2]?.pentatonic?.degree, chords[2]?.pentatonic?.basis]).toEqual(['B · C major pentatonic ladder', 3, null, 'key'])
  })

  describe('picks', () => {
    const C4 = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | Cmaj7'
    const keyPlan = (picks: Record<string, number> = {}): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, picks: Object.fromEntries(Object.entries(picks).map(([k, pc]) => [k, { pc }])) })
    const shown = (text: string, plan: PentatonicPlan, part = CONCERT) => flat(showPentatonics(buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan).lines))

    it('gives each printed label the run of chords it covers', () => {
      expect(shown(C4, keyPlan()).map((c) => c.pentatonic?.run)).toEqual([['A:1:0', 'A:2:0', 'A:3:0', 'A:4:0'], [], [], []])
    })

    it('plays a picked pentatonic on its chords only, marks it, and turns the counts on', () => {
      const chords = shown(C4, keyPlan({ 'A:2:0': 7, 'A:3:0': 7 })) // concert G: rung 2 flat of C major (home Am)
      expect(chords.map((c) => c.pentatonic?.label)).toEqual(['Am♪ 5', 'Gm♪ 4', '', 'Am♪ 5'])
      expect(chords.map((c) => c.pentatonic?.picked)).toEqual([false, true, true, false])
      expect(chords[1]?.pentatonic?.view).toEqual({ rung: 2, side: 'flat' })
      expect(chords[1]?.pentatonic?.run).toEqual(['A:2:0', 'A:3:0'])
    })

    it('reports a chord-basis pick’s own degree and shared on each chord', () => {
      const plan: PentatonicPlan = { ...keyPlan({ 'A:1:0': 4, 'A:2:0': 4 }), basis: 'chord', degree: 'auto' } // Em on Cmaj7 and Dm7
      const chords = shown(C4, plan)
      expect(chords.slice(0, 2).map((c) => [c.pentatonic?.name, c.pentatonic?.degree, c.pentatonic?.shared, c.pentatonic?.picked])).toEqual([['Em', 4, 5, true], ['Em', 2, 5, true]])
    })

    it('keeps a pick’s sounding pentatonic on a transposed part', () => {
      const chords = shown(C4, keyPlan({ 'A:1:0': 7 }), TENOR) // concert G, written A on a Bb part
      expect([chords[0]?.pentatonic?.name, chords[0]?.pentatonic?.pc, chords[0]?.pentatonic?.picked]).toEqual(['Am', 7, true])
    })

    it('finds a pick in each chord’s own ladder across relative keys', () => {
      const doc = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | Am7\n@key 2 Am'
      const chords = shown(doc, keyPlan({ 'A:1:0': 2, 'A:2:0': 2 })) // Dm: C major rung 1 flat, A minor rung 1 flat
      expect(chords.map((c) => [c.pentatonic?.key, c.pentatonic?.name, c.pentatonic?.view.rung])).toEqual([['C major', 'Dm', 1], ['A minor', 'Dm', 1]])
    })

    it('marks a printed label picked when a chord it stands for is, though the pick merges into the label before', () => {
      const doc = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Dm7\n3 | Dm7'
      const plan: PentatonicPlan = { ...keyPlan({ 'A:2:0': 2 }), basis: 'chord', degree: 'auto' } // Dm, the default, picked on the second Dm7: its label is the first's
      const chords = shown(doc, plan)
      expect(chords.map((c) => c.pentatonic?.label)).toEqual(['Dm♪ 5', '', ''])
      expect(chords[0]?.pentatonic?.run).toContain('A:2:0')
      expect(chords[0]?.pentatonic?.picked).toBe(true)
    })

    it('ignores a stale pick: no counts, nothing picked', () => {
      const chords = shown(C4, keyPlan({ 'Z:9:0': 7 }))
      expect(chords.map((c) => c.pentatonic?.label)).toEqual(['Am♪', '', '', ''])
      expect(chords.some((c) => c.pentatonic?.picked)).toBe(false)
    })

    it('ends a run at a chord with no pentatonic', () => {
      const plan: PentatonicPlan = { ...keyPlan(), basis: 'chord', degree: 'auto' }
      const chords = shown('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | N.C.\n3 | Cmaj7', plan)
      expect(chords.map((c) => c.pentatonic?.run ?? null)).toEqual([['A:1:0'], null, ['A:3:0']])
    })

    it('reads a bad or missing chord basis degree as Auto', () => {
      const degreeOf = (degree?: PentatonicDegree) => shown('title: T\nkey: F\n\nsection: A\nbars: 4\n1 | Dm7', { ...keyPlan(), basis: 'chord', ...(degree === undefined ? {} : { degree }) })[0]?.pentatonic?.degree
      expect([-1, 2.5, undefined, 12, 99, 'auto' as const].map(degreeOf)).toEqual([0, 0, 0, 0, 0, 0]) // Auto on Dm7 (D Dorian): Dm, on the 1
      expect(degreeOf(11)).toBe(11)
    })
  })
})

describe('scales from the resolver', () => {
  const G_MINOR = 'title: T\nkey: Gm\n\nsection: A\n1 | Am7b5\n2 | D7\n3 | Gm7 | G Dorian\n4 | Cm7\n'
  const on = (level: ScaleView['level']): ScaleView => ({ level, seed: 0 })
  const sheet = (view?: ScaleView, line: GuideLine = 'off') => buildChanges(parseChart(G_MINOR).value, CONCERT, 4, false, line, view)
  const labels = (view?: ScaleView) => sheet(view).lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => c.scale)))
  const short = (scale: string) => abbreviateScale(scale)

  it('plays the analysed scale in a blank cell', () => {
    expect(labels(on('standard'))).toEqual([short('A Locrian'), short('D Phrygian Dominant'), 'G Dorian', short('C Dorian')])
  })

  it('plays a written cell as written at every level', () => {
    expect(labels(on('basic'))).toEqual([short('F Major Pentatonic'), short('G Minor Pentatonic'), 'G Dorian', short('C Minor Pentatonic')])
    expect(labels(on('advanced'))[2]).toBe('G Dorian')
  })

  it('plays at Standard without a view', () => {
    expect(labels()).toEqual(labels(on('standard')))
  })

  it('leaves the guide tones alone', () => {
    expect(sheet(on('basic'), 'third').lines.map((l) => l.bars.map((b) => b.voice))).toEqual(sheet(undefined, 'third').lines.map((l) => l.bars.map((b) => b.voice)))
  })
})

describe('endings and navigation', () => {
  const barsOf = (text: string) => buildChanges(parseChart(text).value, CONCERT).lines.flatMap((l) => l.bars)

  it('makes a section with @ending a 2x repeat and brackets each ending', () => {
    const text = ['key: C', '', 'section: A', '1 | Dm7', '2 | G7', '3 | CMaj7', '4 | Am7', '@ending 1 3', '@ending 2 4'].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.repeatStart).toBe(true)
    expect(b[2]?.repeatEnd).toBe(2)
    expect(b[3]?.repeatEnd).toBe(0)
    expect(b.map((x) => x.volta)).toEqual([null, null, { n: 1, start: true, end: true }, { n: 2, start: true, end: true }])
  })

  it('maps @segno, @coda and @nav onto their bars; two @nav join', () => {
    const text = ['key: C', '', 'section: A', 'bars: 4', '1 | Dm7', '2 | G7', '@segno 1', '@nav 2 To Coda', '@nav 2 D.S. al Coda', '', 'section: Coda', 'bars: 4', '1 | CMaj7', '@coda 1'].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.segno).toBe(true)
    expect(b[1]?.nav).toBe('To Coda · D.S. al Coda')
    expect(b.find((x) => x.marker.startsWith('Coda'))?.coda).toBe(true)
  })

  it('ignores a directive whose section or bar is absent, without throwing', () => {
    const text = 'key: C\n\nsection: A\nbars: 4\n1 | Dm7\n@nav 99 x\n'
    const b = barsOf(text)
    expect(b.every((x) => !x.segno && x.nav === '' && x.volta === null)).toBe(true)
  })

  it("with signatures, gives every bar the chart's key; an @key shows only as its key-area label", () => {
    const doc = parseChart('title: T\nkey: Eb\n\nsection: A\n1 | EbMaj7\n\nsection: B\nkey: D\nbars: 3\n1 | DMaj7\n').value
    const bars = buildChanges(doc, TENOR, 4, true).lines.flatMap((l) => l.bars).filter((b) => b.chords.length)
    expect(bars.map((b) => b.keySig)).toEqual(['F', 'F'])
    expect(bars.map((b) => b.keyArea)).toEqual(['F major', 'E major'])
    expect(buildChanges(doc, CONCERT).lines[0]?.bars[0]?.keySig).toBeNull()
    expect(buildChanges(parseChart('title: T\n\nsection: A\nbars: 4\n1 | Cm7\n').value, CONCERT, 4, true).lines[0]?.bars[0]?.keySig).toBeNull()
  })
})

describe('guide tones on the Changes sheet', () => {
  const sheetOf = (text: string, line: GuideLine, barsPerLine = 4, signatures = false) =>
    buildChanges(parseChart(text).value, CONCERT, barsPerLine, signatures, line)
  const barsOf = (text: string, line: GuideLine, barsPerLine = 4) => sheetOf(text, line, barsPerLine).lines.flatMap((l) => l.bars)
  const labels = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars).flatMap((b) => b.chords.map((c) => c.guide))
  const SIXES = 'key: C\n\nsection: A\n1 | C6\n2 | C7sus4\n3 | C\n4 | Cm7\n'
  /** each bar's voice: struck MIDI numbers, ^ tied in, ~ tied on */
  const tied = (b: readonly { voice: readonly GuideNote[] }[]) => b.map((x) => x.voice.map((n) => `${n.tiedIn ? '^' : ''}${n.pitch?.midi ?? 'rest'}${n.tie ? '~' : ''}`).join(' '))

  it("leaves the sheet as it was with the line 'off': no voice, no labels, and no voice leading run", () => {
    vi.mocked(guideVoices).mockClear()
    const doc = library('autumn-leaves')
    const sheet = buildChanges(doc, CONCERT, 4, false, 'off')
    expect(sheet).toEqual(buildChanges(doc, CONCERT))
    const b = sheet.lines.flatMap((l) => l.bars)
    expect(b.every((x) => x.voice.length === 0 && x.chords.every((c) => c.guide === ''))).toBe(true)
    expect(guideVoices).not.toHaveBeenCalled()
  })

  it('labels each chord with its real degree, flats and sharps dropped, one label a chord', () => {
    expect(labels(sheetOf(SIXES, 'third'))).toEqual(['3', '4', '3', '3'])
    expect(labels(sheetOf(SIXES, 'seventh'))).toEqual(['6', '7', '1', '7'])
  })

  it('strikes one note a chord, held for its length and tied across the barline', () => {
    const b = barsOf('key: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n', 'third') // CMaj7 runs to the end of the 4-bar phrase
    expect(b.map((x) => x.voice.map((n) => [n.beat, n.beats, n.tie, n.tiedIn]))).toEqual([
      [[0, 4, false, false]],
      [[0, 4, false, false]],
      [[0, 4, true, false]],
      [[0, 4, false, true]],
    ])
    expect(b[3]?.voice[0]?.pitch).toEqual(b[2]?.voice[0]?.pitch)
    expect(b[3]?.voice[0]?.accidental).toBeNull()
  })

  it('ties a held chord across a line break, the next line starting tied in', () => {
    const text = 'key: C\n\nsection: A\nbars: 8\n1 | Dm7\n2 | G7\n3 | C7\n4 | CMaj7\n6 | Dm7\n' // CMaj7 holds bars 4-5
    const sheet = sheetOf(text, 'third')
    const [first, second] = sheet.lines
    expect([first?.bars.length, tied(first?.bars ?? []).at(-1), tied(second?.bars ?? [])[0]]).toEqual([4, '64~', '^64'])
    expect(tied(barsOf(text, 'third', 2))).toEqual(tied(barsOf(text, 'third', 4)))
  })

  it('rests where a chord has no guide tones, and says so only when a line is on', () => {
    const text = 'key: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Cm7#5#9x\n3 | CMaj7\n'
    const on = sheetOf(text, 'seventh')
    expect(on.lines[0]?.bars[1]?.voice.map((n) => n.pitch)).toEqual([null])
    expect(on.lines[0]?.bars[1]?.chords[0]?.guide).toBe('')
    expect(on.diagnostics.filter((d) => d.startsWith('no guide tones for Cm7#5#9x'))).toHaveLength(1)
    expect(buildChanges(parseChart(text).value, CONCERT).diagnostics.some((d) => d.startsWith('no guide tones'))).toBe(false)
  })

  it('voices a folded repeat once: only the rows drawn, in written order', () => {
    const text = ['key: C', '', 'section: A1', '1 | Dm7', '2 | G7', '3 | CMaj7', '4 | A7', '', 'section: A2', 'copy: A1', '', 'section: B', '1 | Fm7', '2 | Bb7', '3 | EbMaj7', '4 | Ab7'].join('\n') + '\n'
    vi.mocked(guideVoices).mockClear()
    const sheet = sheetOf(text, 'third')
    expect(sheet.lines.map((l) => l.bars[0]?.marker)).toEqual(['A1 · A2', 'B'])
    expect(guideVoices).toHaveBeenCalledTimes(1)
    const [inputs, , beats, keySig, line] = vi.mocked(guideVoices).mock.calls[0]!
    expect(inputs.map((c) => [c.row, c.chord, c.start, c.beats])).toEqual([
      [0, 'Dm7', 0, 4],
      [1, 'G7', 4, 4],
      [2, 'CMaj7', 8, 4],
      [3, 'A7', 12, 4],
      [8, 'Fm7', 32, 4],
      [9, 'Bb7', 36, 4],
      [10, 'EbMaj7', 40, 4],
      [11, 'Ab7', 44, 4],
    ])
    expect([beats, keySig, line]).toEqual([4, null, 'third'])
    expect(sheet.lines.flatMap((l) => l.bars).every((b) => b.voice.length > 0)).toBe(true)
  })

  it("voices a 2nd ending from the 1st ending's last chord, in written order", () => {
    const text = 'key: C\n\nsection: A\nbars: 8\n1 | Dm7\n2 | G7\n3 | Em7\n4 | A7\n5 | Dm7\n6 | G7\n7 | CMaj7\n@ending 1 3 4\n@ending 2 5 6\n'
    const b = barsOf(text, 'third')
    expect(b.map((x) => x.volta?.n ?? 0)).toEqual([0, 0, 1, 1, 2, 2, 0, 0])
    const struck = (i: number) => b[i]?.voice[0]?.pitch?.midi
    expect([struck(3), struck(4)]).toEqual([67, 65]) // A7's G4, then Dm7's F4: a step
  })

  it('holds a repeated chord with a tie inside a section, and strikes it again in the next section or ending', () => {
    expect(tied(barsOf('key: C\n\nsection: A\n1 | C7\n2 | C7b9\n\nsection: B\n1 | C7\n2 | Dm7\n', 'third'))).toEqual(['64~', '^64', '64', '65'])
    const endings = 'key: C\n\nsection: A\n1 | Dm7\n2 | C7\n3 | C7\n4 | C7\n@ending 1 3\n@ending 2 4\n'
    expect(tied(barsOf(endings, 'third'))).toEqual(['65', '64~', '^64', '64']) // into the 1st ending tied; the 2nd ending struck again
    const after = 'key: C\n\nsection: A\nbars: 8\n1 | Dm7\n2 | C7\n3 | C7\n4 | C7\n5 | C7\n@ending 1 3\n@ending 2 4\n'
    expect(tied(barsOf(after, 'third'))).toEqual(['65', '64~', '^64', '64~', '^64~', '^64~', '^64~', '^64']) // from the 2nd ending on, holds tie again (the last C7 fills its phrase)
  })

  it('continues the line into a 2nd ending from the 1st ending, rather than starting it again (rule 9)', () => {
    const text = 'key: C\n\nsection: A\n1 | CMaj7\n2 | A7\n3 | Dm7\n4 | G7\n@ending 1 3\n@ending 2 4\n'
    const b = barsOf(text, 'seventh')
    expect(b.map((x) => x.voice[0]?.pitch?.midi)).toEqual([71, 73, 72, 71]) // G7: B4 from C5; a fresh start would give F5
    expect(b[3]?.chords[0]?.guide).toBe('3')
  })

  it('reads accidentals against the signature when it is drawn, and against C when it is not', () => {
    const text = 'key: F\n\nsection: A\nbars: 4\n1 | Gm7\n2 | C7\n3 | FMaj7\n'
    const struck = (signatures: boolean) =>
      sheetOf(text, 'third', 4, signatures)
        .lines.flatMap((l) => l.bars)
        .flatMap((b) => b.voice)
        .filter((n): n is GuideNote & { pitch: NonNullable<GuideNote['pitch']> } => !n.tiedIn && n.pitch !== null)
        .map((n) => [rootName(n.pitch), n.accidental] as const)
    expect(struck(false).filter(([name]) => name === 'Bb')).toHaveLength(2) // Gm7's 3rd, C7's 7th
    expect(struck(false).every(([name, acc]) => acc === (name === 'Bb' ? 'b' : null))).toBe(true)
    expect(struck(true).every(([, acc]) => acc === null)).toBe(true)
  })

  it('fits 8 lines a page with no line, whatever the rows; 6 with a line; one more when both rows are off', () => {
    const rows = [
      { numerals: true, scales: true },
      { numerals: true, scales: false },
      { numerals: false, scales: true },
      { numerals: false, scales: false },
    ]
    expect(rows.map((r) => changesLinesPerPage('off', r))).toEqual([8, 8, 8, 8])
    expect(rows.map((r) => changesLinesPerPage('third', r))).toEqual([6, 6, 6, 7])
    expect(rows.map((r) => changesLinesPerPage('seventh', r))).toEqual([6, 6, 6, 7])
  })
})

// a sweep of the whole library (200+ charts, several sheets each): ~1 s alone, slower on a busy CI runner (#302)
describe('guide tone lines over the library', { timeout: 30_000 }, () => {
  const LIBRARY = new URL('../../charts/', import.meta.url)
  const docs = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))
  const voiceOf = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars.map((b) => b.voice))
  const plain = (s: ChangesSheet) => s.lines.map((l) => l.bars.map(({ voice: _v, ...b }) => ({ ...b, chords: b.chords.map(({ guide: _g, ...c }) => c) })))
  // each sheet is built once and shared by the tests that read it
  const cache = new Map<string, ChangesSheet>()
  const sheetOf = (f: string, key: string, build: () => ChangesSheet): ChangesSheet => {
    const k = `${f}|${key}`
    if (!cache.has(k)) cache.set(k, build())
    return cache.get(k)!
  }
  const on = (f: string, doc: ChartDoc, bars: 2 | 4, line: 'third' | 'seventh') => sheetOf(f, `${line}:${bars}`, () => buildChanges(doc, CONCERT, bars, false, line))
  const off = (f: string, doc: ChartDoc) => sheetOf(f, 'off', () => buildChanges(doc, CONCERT))

  for (const line of ['third', 'seventh'] as const) {
    it(`from the ${line}: strike (or hold) one note per chord, on its beat, and fill every bar`, () => {
      expect(docs.length).toBeGreaterThan(200)
      for (const { f, doc } of docs) {
        const sheet = on(f, doc, 4, line)
        let resting = false // the chord sounding is a rest (N.C.): its notes are rests
        for (const bar of sheet.lines.flatMap((l) => l.bars)) {
          const restAt = (beat: number): boolean => {
            const c = bar.chords.filter((x) => x.beat <= beat).at(-1)
            return c ? isRest(c.text) : resting
          }
          const voice = bar.voice
          expect(voice.reduce((s, n) => s + n.beats, 0), f).toBe(sheet.beats)
          const beats = bar.chords.map((c) => c.beat) // a held chord's note starts on its beat, tied in
          const struck = voice.filter((n) => n.pitch !== null || !restAt(n.beat)) // a rest's bars rest again each bar
          expect(struck.filter((n) => !n.tiedIn || beats.includes(n.beat)).map((n) => n.beat), f).toEqual(beats.filter((b) => !restAt(b)))
          expect(struck.filter((n) => !n.tiedIn).every((n) => beats.includes(n.beat)), f).toBe(true)
          expect(voice.every((n) => n.pitch !== null || restAt(n.beat)), f).toBe(true)
          for (const c of bar.chords) if (!isRest(c.text)) expect(c.guide, `${f} ${c.text}`).not.toBe('')
          resting = restAt(sheet.beats)
        }
        expect(sheet.diagnostics.filter((d) => d.startsWith('no guide tones')), f).toEqual([])
      }
    })

    it(`from the ${line}: tie only inside a block, across line breaks too: a tie lands on a tiedIn piece of the same pitch, and a block starts fresh`, () => {
      for (const { f, doc } of docs) {
        const all = on(f, doc, 4, line).lines.flatMap((l) => l.bars)
        let prev: GuideNote | undefined
        for (const bar of all) {
          if (bar.marker) {
            expect(prev?.tie ?? false, `${f} ${bar.marker}`).toBe(false)
            prev = undefined
          }
          for (const n of bar.voice) {
            expect(n.tiedIn, f).toBe(prev?.tie ?? false)
            if (n.tiedIn) expect(n.pitch?.midi, f).toBe(prev?.pitch?.midi)
            prev = n
          }
        }
        expect(prev?.tie ?? false, f).toBe(false)
      }
    })

    it(`from the ${line}: voice the same at 2 or 4 bars a line, and change nothing but the voice, labels and diagnostics`, () => {
      for (const { f, doc } of docs) {
        const on4 = on(f, doc, 4, line)
        const plainSheet = off(f, doc)
        expect(voiceOf(on(f, doc, 2, line)), f).toEqual(voiceOf(on4))
        expect(plain(on4), f).toEqual(plain(plainSheet))
        expect(on4.diagnostics, f).toEqual(plainSheet.diagnostics)
      }
    })
  }
})

describe('a drawn chord’s line', () => {
  it('is the line of the chart it was written on; a repeat’s chords point at the rows they repeat', () => {
    const doc = parseChart(['title: T', '', 'section: A', '1 | Cm7', '2 | F7', '', 'section: B', 'bars: 2', '1 | Bbmaj7', '', 'section: C', 'bars: 4', 'copy: A'].join('\n')).value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.map((c) => [c.text, c.at.section, c.line])).toEqual([
      ['Cm7', 'A', 3],
      ['F7', 'A', 4],
      ['Bbmaj7', 'B', 8],
      ['Cm7', 'C', 3],
      ['F7', 'C', 4],
    ])
  })
})

describe('breakLines', () => {
  const sheet = buildChanges(parseChart('section: A\n1 | C\n2 | D\n3 | E\n4 | F\n5 | G\n\nsection: B\nbars: 4\n1 | C\n2 | D\n').value, CONCERT, 4)
  const bars = (lines: ChangesSheet['lines']) => lines.map((l) => [l.bars.map((b) => `${b.at.section}${b.at.bar}`).join(' '), l.sectionEnd])
  it('starts a new line at each bar named, the section still ending on its last', () => {
    expect(bars(sheet.lines)).toEqual([['A1 A2 A3 A4', false], ['A5', true], ['B1 B2 B3 B4', true]])
    expect(bars(breakLines(sheet.lines, new Set(['A 2', 'A 4', 'B 2'])))).toEqual([
      ['A1', false],
      ['A2 A3', false],
      ['A4', false],
      ['A5', true],
      ['B1', false],
      ['B2 B3 B4', true],
    ])
  })
  it("ignores a line's first bar, and leaves the lines as they are with nothing named", () => {
    expect(breakLines(sheet.lines, new Set(['A 1', 'A 5']))).toEqual(sheet.lines)
  })
})

describe('buildChanges with an arpeggio line', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n2 | CMaj7\n').value
  it("fills each bar's voice with the arpeggio, and no guide labels", () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, 'up-root')
    const [bar1, bar2] = sheet.lines[0]?.bars ?? []
    expect(bar1?.voice).toHaveLength(8)
    expect(bar2?.voice).toHaveLength(4)
    expect(sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => c.guide)))).toEqual(['', '', ''])
  })
  it('still draws guide tones for third and seventh, and nothing for off', () => {
    expect(buildChanges(doc, CONCERT, 4, false, 'third').lines[0]?.bars[0]?.voice).toHaveLength(2)
    expect(buildChanges(doc, CONCERT, 4, false, 'off').lines[0]?.bars[0]?.voice).toEqual([])
  })
  it('gives an arpeggio line the page count of a guide tone line', () => {
    const rows = { numerals: true, scales: true }
    expect(changesLinesPerPage('up-root', rows)).toBe(changesLinesPerPage('third', rows))
  })
})

describe('buildChanges with a Pentatonic line (#284)', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n2 | CMaj7\n').value
  const PENT: PentatonicLine = { kind: 'pentatonic', leave: '1', dir: 'up', arpeggio: 'up-root' }
  const keys = (sheet: ChangesSheet) => sheet.lines.flatMap((l) => l.bars.map((b) => b.voice.map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))))
  const flatChords = (sheet: ChangesSheet) => sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
  const pcSet = (root: Spelled) => new Set([0, 3, 5, 7, 10].map((d) => (pcOf(root) + d) % 12))
  it("plays each chord's labelled pentatonic as cells, in the arpeggio's rhythm, each from the note nearest the last", () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, PENT, undefined, one(0, 'flat')) // C major: Am everywhere
    expect(keys(sheet).slice(0, 2)).toEqual([
      ['c/4', 'd/4', 'e/4', 'g/4', 'e/4', 'g/4', 'c/5', 'd/5'],
      ['c/5', 'd/5', 'e/5', 'g/5'],
    ])
    expect(flatChords(sheet).map((c) => c.guide)).toEqual(['', '', ''])
  })
  it('Autumn Leaves, concert, Up: bar 2 starts on the note nearest bar 1’s last, turning down at the range’s top', () => {
    const sheet = buildChanges(library('autumn-leaves'), CONCERT, 4, false, PENT, undefined, one(0, 'flat')) // Gm: B♭ C D F
    expect(keys(sheet)[0]?.slice(0, 4)).toEqual(['bb/4', 'c/5', 'd/5', 'f/5'])
    expect(keys(sheet)[1]?.slice(0, 4)).toEqual(['d/5', 'c/5', 'bb/4', 'f/4']) // D5, 3 below F5; up would pass A5: down from it
  })
  /** the line's cells, four notes each, in order, as MIDI */
  const cellsOf = (sheet: ChangesSheet) => chunk(sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.voice.map((n) => n.pitch?.midi ?? -1))), 4).map((c) => c.join(' '))
  for (const [name, part] of [['concert', CONCERT], ['trumpet', partFor('trumpet')], ['bass', partFor('bass')]] as const) {
    for (const dir of ['up', 'down'] as const) {
      it(`${name}, ${dir}, over a held Gm (Autumn Leaves, key basis): no two cells in a row the same, all in range`, () => {
        const sheet = buildChanges(library('autumn-leaves'), part, 4, false, { ...PENT, dir }, undefined, one(0, 'flat'))
        const cells = cellsOf(sheet)
        expect(cells.length).toBeGreaterThan(20)
        expect(cells.filter((c, k) => k > 0 && c === cells[k - 1])).toEqual([])
        const range = rangeOf(part)
        expect(cells.flatMap((c) => c.split(' ').map(Number)).every((m) => m >= range.lo && m <= range.hi)).toBe(true)
      })
    }
  }
  it('follows the rung the label shows', () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, PENT, undefined, one(1, 'flat')) // Dm
    expect(keys(sheet)[0]?.slice(0, 4)).toEqual(['f/4', 'g/4', 'a/4', 'c/5'])
  })
  it('honours a chord pick', () => {
    const targets = pickTargets(doc, resolveScales(doc, { level: 'standard', seed: 0 }))
    const picks = withPick(NO_PICKS, 'pentatonic', ['A:1:1'], 4, targets).pentatonic // G7: Em
    const sheet = buildChanges(doc, CONCERT, 4, false, PENT, undefined, { ...one(0, 'flat'), picks })
    expect(keys(sheet)[0]?.slice(4).map((k) => k.split('/')[0])).toEqual(['a', 'b', 'd', 'g']) // Em less E, from A4: nearest G4
  })
  it('plays, on the chord basis and on a transposing part, exactly the pentatonic each label names', () => {
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: false, basis: 'chord', degree: 'auto' }
    for (const part of [CONCERT, TENOR]) {
      const sheet = buildChanges(library('autumn-leaves'), part, 4, false, PENT, undefined, plan)
      for (const bar of sheet.lines.flatMap((l) => l.bars)) {
        for (const c of bar.chords) {
          const notes = bar.voice.filter((n) => n.beat >= c.beat && (bar.chords.find((d) => d.beat > c.beat)?.beat ?? Infinity) > n.beat)
          expect(c.pentatonic).not.toBeNull()
          expect(notes.every((n) => n.pitch && pcSet(c.pentatonic!.root).has(pcOf(n.pitch)))).toBe(true)
        }
      }
    }
  })
  it('a transposing part plays the written pentatonic', () => {
    expect(keys(buildChanges(doc, TENOR, 4, false, PENT, undefined, one(0, 'flat')))[1]?.map((k) => k.split('/')[0])).toEqual(['d', 'e', 'f#', 'a']) // Bm, written
  })
  it("leaves out the degree chosen, and goes the way chosen", () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, { ...PENT, leave: 'b7', dir: 'down' }, undefined, one(0, 'flat'))
    expect(keys(sheet)[0]?.slice(0, 4).map((k) => k.split('/')[0])).toEqual(['e', 'd', 'c', 'a'])
  })
  it('with no pentatonic to play (no overlay), plays the 7th chord arpeggio in its pattern', () => {
    expect(keys(buildChanges(doc, CONCERT, 4, false, PENT))).toEqual(keys(buildChanges(doc, CONCERT, 4, false, 'up-root')))
  })
  it('gives a Pentatonic line the page count of an arpeggio line', () => {
    const rows = { numerals: true, scales: true, pentatonics: true }
    expect(changesLinesPerPage(PENT, rows)).toBe(changesLinesPerPage('up-root', rows))
  })
})

describe('buildChanges with a Triad pair line (#325)', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | Cmaj7\n').value
  const HEX = { kind: 'hexatonic' } as const
  const PAIR: TriadPairLine = { kind: 'triad-pair', dir: 'up', arpeggio: 'up-root' }
  const keys = (sheet: ChangesSheet) => sheet.lines.flatMap((l) => l.bars.map((b) => b.voice.map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))))
  it("plays each chord's labelled pair: its lower triad, then its upper from the note nearest the last", () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, PAIR, undefined, HEX) // G/Am, C/Dm, …
    expect(keys(sheet)[0]).toEqual(['g/4', 'b/4', 'd/5', 'c/5'])
    expect(sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords)).map((c) => c.guide)).toEqual(['', '', '', ''])
  })
  it('plays, on a transposing part and with a pick, only the notes of the pair each label names', () => {
    const targets = pickTargets(doc, resolveScales(doc, { level: 'standard', seed: 0 }))
    const picks = withPick(NO_PICKS, 'hexatonic', ['A:2:0'], [5, 7], targets).hexatonic // Dm7: F/G
    for (const part of [CONCERT, TENOR]) {
      const sheet = buildChanges(doc, part, 4, false, PAIR, undefined, { kind: 'hexatonic', picks })
      for (const bar of sheet.lines.flatMap((l) => l.bars)) {
        const c = bar.chords[0]!
        const [lo, hi] = c.hexatonic!.name.split('/').map((n) => parseRoot(n.replace('m', '').replace('♭', 'b').replace('♯', '#')))
        const shapes = c.hexatonic!.name.split('/').map((n) => (n.endsWith('m') ? [0, 3, 7] : [0, 4, 7]))
        const pcs = new Set([...shapes[0]!.map((d) => (pcOf(lo!) + d) % 12), ...shapes[1]!.map((d) => (pcOf(hi!) + d) % 12)])
        expect(bar.voice.every((n) => n.pitch && pcs.has(pcOf(n.pitch))), `${c.text} ${c.hexatonic!.name}`).toBe(true)
      }
      if (part === CONCERT) expect(sheet.lines[0]!.bars[1]!.chords[0]!.hexatonic!.name).toBe('F/G')
    }
  })
  it('with no pair to play (no overlay), plays the 7th chord arpeggio in its pattern', () => {
    expect(keys(buildChanges(doc, CONCERT, 4, false, PAIR))).toEqual(keys(buildChanges(doc, CONCERT, 4, false, 'up-root')))
  })
  it('gives a Triad pair line the page count of an arpeggio line', () => {
    const rows = { numerals: true, scales: true, hexatonics: true }
    expect(changesLinesPerPage(PAIR, rows)).toBe(changesLinesPerPage('up-root', rows))
  })
})

describe('the Hexatonic overlay', () => {
  const HEX = { kind: 'hexatonic' } as const
  const flat = (lines: readonly ChangesLine[]) => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
  const labels = (text: string, part = CONCERT, plan: Parameters<typeof buildChanges>[6] = HEX) =>
    flat(showHexatonics(buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan).lines)).map((c) => c.hexatonic?.label ?? null)

  it('gives each chord the Auto pair of its resolved scale', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | Cmaj7').value
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, HEX).lines)
    expect(chords.map((c) => c.hexatonic)).toEqual([
      expect.objectContaining({ label: 'G/Am', name: 'G/Am' }),
      expect.objectContaining({ label: 'C/Dm', name: 'C/Dm' }),
      expect.objectContaining({ label: 'Dm/Em', name: 'Dm/Em' }),
      expect.objectContaining({ label: 'G/Am', name: 'G/Am' }),
    ])
    expect(chords.every((c) => c.pentatonic === null)).toBe(true)
  })

  it('names the written pair for a transposing part', () => {
    expect(labels('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7', TENOR)).toEqual(['A/Bm'])
  })

  it('has none with no plan, a pentatonic plan, no scale, or a scale with no pairs', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7').value
    expect(flat(buildChanges(doc, CONCERT).lines)[0]?.hexatonic).toBeNull()
    expect(flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines)[0]?.hexatonic).toBeNull()
    expect(labels('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | N.C.')).toEqual([null])
    expect(labels('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C7#5 | C Whole Tone')).toEqual([null])
  })

  it('leaves the pentatonic plan as it was', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7').value
    const sheet = buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(2, 'flat'))
    expect(flat(sheet.lines).map((c) => [c.pentatonic?.label, c.hexatonic])).toEqual([['Gm♪', null], ['Gm♪', null]])
    const fifths: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: true, path: 'fifths' }
    expect(buildChanges(doc, CONCERT, 4, false, 'off', undefined, fifths).pentatonicCaption).not.toBeNull()
    expect(buildChanges(doc, CONCERT, 4, false, 'off', undefined, HEX).pentatonicCaption).toBeNull()
  })

  it('prints a label only where it changes from the previous chord on the line, and again after a gap', () => {
    expect(labels('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Cmaj7\n3 | Dm7\n4 | Cmaj7')).toEqual(['G/Am', '', 'C/Dm', 'G/Am'])
    expect(labels('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | N.C.\n3 | Cmaj7')).toEqual(['G/Am', null, 'G/Am'])
    expect(labels('title: T\nkey: C\n\nsection: A\nbars: 8\n1 | Cmaj7\n2 | Cmaj7\n3 | Cmaj7\n4 | Cmaj7\n5 | Cmaj7')).toEqual(['G/Am', '', '', '', 'G/Am']) // a new line
  })

  it('keeps the name where the label is blanked', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | Cmaj7').value
    expect(flat(showHexatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, HEX).lines))[1]?.hexatonic).toMatchObject({ label: '', name: 'G/Am' })
  })

  it('is idempotent, and gives a blanked label back where a new break starts a line on it', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7\n2 | Cmaj7\n3 | Cmaj7').value
    const once = showHexatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, HEX).lines)
    expect(showHexatonics(once)).toEqual(once)
    expect(flat(showHexatonics(breakLines(once, new Set(['A 2'])))).map((c) => c.hexatonic?.label)).toEqual(['G/Am', 'G/Am', ''])
  })

  it('counts the hexatonic row as the pentatonic row', () => {
    for (const line of ['off', 'third', 'seventh', 'up-root'] as const)
      for (const numerals of [true, false])
        for (const scales of [true, false]) {
          const want = changesLinesPerPage(line, { numerals, scales, pentatonics: true })
          expect(changesLinesPerPage(line, { numerals, scales, hexatonics: true })).toBe(want)
          expect(changesLinesPerPage(line, { numerals, scales, pentatonics: false, hexatonics: true })).toBe(want)
        }
  })
})

const FORM = [
  'title: T', 'key: C',
  'section: A1', '1 | Dm7 | D Dorian', '2 | G7 | G Mixolydian',
  'section: A2', 'copy: A1', // straight after its source: folded, drawn once as A1 · A2
  'section: B', '1 | Dm7 | D Dorian', '2 | E7 | E Phrygian Dominant', '3 | Am7 | A Aeolian', '4 | G7 | G Mixolydian',
  '@ending 1 3 3', '@ending 2 4 4',
  'section: A3', 'copy: A1', // after B: written out, A3 (= A1)
].join('\n') + '\n'

describe('chordPositions', () => {
  it('gives each drawn row its position; a folded repeat’s rows have none', () => {
    const doc = parseChart(FORM).value
    const rows = expandRowLines(doc).value
    const at = chordPositions(doc)
    expect(rows.map((r, i) => `${r.section}:${r.bar}=${at.get(i) ?? '-'}`)).toEqual([
      'A1:1=A1:1:0', 'A1:2=A1:2:0', 'A2:1=-', 'A2:2=-',
      'B:1=B:1:0', 'B:2=B:2:0', 'B:3=B:3:0', 'B:4=B:4:0',
      'A3:1=A3:1:0', 'A3:2=A3:2:0',
    ])
    expect(drawnChords(doc).map((d) => d.at)).toEqual([...at].sort(([a], [b]) => a - b).map(([, k]) => k)) // drawnChords still agrees
  })
  it('targets each position with its chord and resolved scale', () => {
    const doc = parseChart(FORM).value
    const resolved = resolveScales(doc, { level: 'standard', seed: 0 })
    expect(resolved.get(5)?.scale).toBe('E Phrygian Dominant')
    expect(pickTargets(doc, resolved).get('B:2:0')).toBe(pickTarget('E7', resolved.get(5)?.scale ?? null))
  })
})

describe('chord picks (#303)', () => {
  const C4 = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | Cmaj7'
  const doc = parseChart(C4).value
  const flat = (lines: readonly ChangesLine[]) => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
  const target = (at: string) => pickTargets(doc, resolveScales(doc, { level: 'standard', seed: 0 })).get(at)!
  const chordPlan = (picks: Record<string, { pc: number; for?: string }>): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: false, basis: 'chord', degree: 'auto', picks })
  const keyPlan = (picks: Record<string, { pc: number; for?: string }>): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: false, picks })
  const hex = (picks: Record<string, { roots: readonly [number, number]; for?: string }> = {}, part = CONCERT) =>
    flat(showHexatonics(buildChanges(doc, part, 4, false, 'off', undefined, { kind: 'hexatonic', picks }).lines)).map((c) => c.hexatonic)

  it('applies a pentatonic pick made for its position’s chord and scale, on its run only', () => {
    // every chord's Auto here is Dm (5 shared, nearest by fifths: pentatonicRanking), so Em on Dm7 is the only change
    const chords = flat(showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({ 'A:2:0': { pc: 4, for: target('A:2:0') } })).lines))
    expect(chords.map((c) => [c.pentatonic?.name, c.pentatonic?.picked, c.pentatonic?.sheet])).toEqual([['Dm', false, 'Dm'], ['Em', true, 'Dm'], ['Dm', false, 'Dm'], ['Dm', false, 'Dm']])
  })

  it('ignores a pick made for another chord or scale (a stale pick): the sheet’s choice, nothing picked', () => {
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({ 'A:2:0': { pc: 4, for: 'Dm7|D Aeolian' } })).lines)
    expect(chords[1]?.pentatonic).toMatchObject({ name: 'Dm', picked: false })
  })

  it('ignores a stale pick on the Key basis too, with no counts because of it; a live one plays', () => {
    const stale = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, keyPlan({ 'A:2:0': { pc: 7, for: 'Dm7|D Aeolian' } })).lines)
    expect(stale.map((c) => c.pentatonic?.label)).toEqual(['Am♪', 'Am♪', 'Am♪', 'Am♪'])
    const live = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, keyPlan({ 'A:2:0': { pc: 7, for: target('A:2:0') } })).lines)
    expect(live[1]?.pentatonic).toMatchObject({ name: 'Gm', picked: true, sheet: 'Am', scale: 'D Dorian', source: { chord: 'Dm7', scale: 'D Dorian' } })
  })

  it('gives each label its source, concert', () => {
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({})).lines)
    expect(chords[2]?.pentatonic?.source).toEqual({ chord: 'G7', scale: resolveScales(doc, { level: 'standard', seed: 0 }).get(2)?.scale })
    expect(flat(buildChanges(doc, TENOR, 4, false, 'off', undefined, chordPlan({})).lines)[2]?.pentatonic?.source).toEqual({ chord: 'G7', scale: 'G Mixolydian' })
  })

  it('applies a hexatonic pick on its chord; the Auto pair elsewhere; runs like the pentatonic row', () => {
    const h = hex({ 'A:1:0': { roots: [0, 2], for: target('A:1:0') } }) // C/Dm on Cmaj7
    expect(h.map((x) => [x?.name, x?.picked, x?.sheet])).toEqual([['C/Dm', true, 'G/Am'], ['C/Dm', false, 'C/Dm'], ['Dm/Em', false, 'Dm/Em'], ['G/Am', false, 'G/Am']])
    expect(h[0]?.run).toEqual(['A:1:0', 'A:2:0']) // Dm7's Auto is C/Dm too: its label merges into the pick's
    expect(h[1]?.label).toBe('')
    expect(h[0]?.source).toEqual({ chord: 'Cmaj7', scale: 'C Ionian' })
  })

  it('ignores a hexatonic pick whose roots are not among the chord’s pairs, or that is stale', () => {
    expect(hex({ 'A:1:0': { roots: [1, 3], for: target('A:1:0') } })[0]).toMatchObject({ name: 'G/Am', picked: false })
    expect(hex({ 'A:1:0': { roots: [0, 2], for: 'Cmaj7|C Lydian' } })[0]).toMatchObject({ name: 'G/Am', picked: false })
  })

  it('keeps a hexatonic pick’s sounding pair on a B♭ part', () => {
    expect(hex({ 'A:1:0': { roots: [0, 2], for: target('A:1:0') } }, TENOR)[0]).toMatchObject({ name: 'D/Em', picked: true })
  })

  it('ignores a pick while a level change makes it stale, and plays it again when the level comes back', () => {
    const tear = library('a-little-tear')
    const at = (level: 'standard' | 'advanced') => pickTargets(tear, resolveScales(tear, { level, seed: 0 }))
    expect([at('standard').get('A:1:0'), at('advanced').get('A:1:0')]).toEqual(['Eb9|Eb Mixolydian', 'Eb9|Eb Bebop Dominant'])
    const picks = withPick(NO_PICKS, 'pentatonic', ['A:1:0'], 0, at('standard')).pentatonic // Cm, picked at standard
    const first = (level: 'standard' | 'advanced') => flat(buildChanges(tear, CONCERT, 4, false, 'off', { level, seed: 0 }, chordPlan(picks)).lines)[0]?.pentatonic
    expect(first('standard')).toMatchObject({ name: 'Cm', picked: true })
    expect(first('advanced')).toMatchObject({ name: 'B♭m', picked: false, sheet: 'B♭m' })
    expect(first('standard')).toMatchObject({ name: 'Cm', picked: true })
  })

  it('gives a hexatonic pick on a chord whose scale has no pairs nothing to play', () => {
    const wt = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C7#5 | C Whole Tone').value
    const sheet = showHexatonics(buildChanges(wt, CONCERT, 4, false, 'off', undefined, { kind: 'hexatonic', picks: { 'A:1:0': { roots: [0, 2], for: 'C7#5|C Whole Tone' } } }).lines)
    expect(flat(sheet)[0]?.hexatonic).toBeNull()
  })

  it('shows the hexatonic row idempotently, picks and runs included', () => {
    const once = showHexatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, { kind: 'hexatonic', picks: { 'A:1:0': { roots: [0, 2], for: target('A:1:0') } } }).lines)
    expect(showHexatonics(once)).toEqual(once)
  })
})

describe('N.C. on the Changes sheet', () => {
  it('draws a rest as its symbol with no numeral, scale or problem; the guide tone line rests there, with nothing to report', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | N.C.\n3 | G7\n4 | CMaj7\n').value
    const sheet = buildChanges(doc, CONCERT, 4, false, 'third')
    const bars = sheet.lines.flatMap((l) => l.bars)
    expect(bars.map((b) => b.at.bar)).toEqual(['1', '2', '3', '4'])
    expect(bars[0]?.chords[0]).toMatchObject({ text: 'N.C.', written: 'N.C.', numeral: '', scale: null, problem: '', reason: '' })
    expect(bars[0]?.voice.length).toBeGreaterThan(0)
    expect([...(bars[0]?.voice ?? []), ...(bars[1]?.voice ?? [])].every((n) => n.pitch === null)).toBe(true)
    expect(bars[2]?.chords[0]?.numeral).toBe('V7')
    expect(sheet.diagnostics).toEqual([])
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { breakLines, buildChanges, type ChangesLine, type ChangesSheet, changesLinesPerPage, changesSections, type PentatonicPlan, pentatonicContour, showPentatonics } from '../changes'
import { parseChart } from '../chart'
import { type GuideLine, type GuideNote, guideVoices } from '../guideTones'
import { CONCERT, concertPc, type Part } from '../part'
import { rootName } from '../pitch'
import type { ScaleView } from '../resolve'
import { abbreviateScale } from '../scales'
import { isSyncCopy } from '../util'

// a transparent wrapper, so a test can see what buildChanges hands the voice leading
vi.mock('../guideTones', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guideTones')>()
  return { ...actual, guideVoices: vi.fn(actual.guideVoices) }
})

const library = (name: string) => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const bars = (name: string, part = CONCERT) => buildChanges(library(name), part).lines.flatMap((l) => l.bars)
const one = (rung: number, side: 'flat' | 'sharp'): PentatonicPlan => ({ bySection: {}, fallback: { rung, side }, counts: false })

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
    const chords = rows('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 4 | Abm7\n')
    expect(chords.map((c) => [c.text, c.rule, c.fallback])).toEqual([
      ['Dm7', 'm4', false],
      ['G7', 'D4', false],
      ['CMaj7', 'M3', false],
      ['Abm7', 'm8', true],
    ])
  })

  it('a function the author wrote is never a guess on the sheet, though its rule is still named', () => {
    const [a] = buildChanges(parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7 | | II7\nA | 3 | Dm7\nA | 4 | G7\n').value, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords).filter((c) => c.text === 'D7')
    expect([a?.stated, a?.fallback, a?.rule !== '']).toEqual([true, false, true])
  })

  it('heads a coda "after the last chorus"', () => {
    const doc = parseChart('key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n').value
    const markers = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).filter((x) => x.marker).map((x) => x.marker)
    expect(markers).toEqual(['A', 'Coda (after the last chorus)'])
  })

  it('writes chords, scales and key areas for a transposing instrument; numerals stay', () => {
    const [first] = bars('autumn-leaves', TENOR)
    expect([first?.keyArea, first?.chords[0]?.scale, first?.chords[0]?.numeral]).toEqual(['A minor', 'D Dorian', 'ii7/♭III'])
  })

  it('gives each chord its symbol as written for the part, beside the chart\'s concert symbol', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
    const chords = (part: Part) => buildChanges(doc, part).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords(TENOR).map((c) => [c.text, c.written])).toEqual([['Dm7', 'Em7'], ['G7', 'A7'], ['CMaj7', 'DMaj7']])
    expect(chords(CONCERT).map((c) => c.written)).toEqual(['Dm7', 'G7', 'CMaj7'])
  })

  it('gives each chord the chart row it comes from: its section and bar', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nB | 9 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.map((c) => c.at)).toEqual([{ section: 'A', bar: '1' }, { section: 'A', bar: '2' }, { section: 'B', bar: '9' }])
  })

  it('gives each bar its place in the chart (held bars too), the section a written-out copy repeats, and marks a section’s last line', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 4 | CMaj7\nA | 5 | Am7\nA | 6 | D7\nB | 1 | Fm7\n@copy A C 0\n').value
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
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Bb7 | | D: ♭VI7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    const bb7 = chords.find((c) => c.text === 'Bb7')
    expect([bb7?.numeral, bb7?.stated, bb7?.heardIn]).toEqual(['♭VI7', true, 'D major'])
    expect(bb7?.reason).toMatch(/^\* /)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ stated: false, heardIn: 'C major', reason: 'V7 of C: natural tensions' })
  })

  it("keeps the rules' numeral on a chord whose written function doesn't fit, and says why", () => {
    const doc = parseChart('title: T\nkey: Eb\nA | 1 | EbMaj7\nA | 2 | G7 | | Eb: V7/ii\nA | 3 | Fm7\nA | 4 | Bb7 | | V7/q\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ numeral: 'III7', stated: false, problem: 'V7/ii in Eb is on C, not G7' })
    expect(chords.find((c) => c.text === 'Bb7')?.problem).not.toBe('')
    expect(chords.find((c) => c.text === 'Fm7')?.problem).toBe('')
  })

  it('says where the key it is heard in came from: found, an @key, or the function', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Bb7 | | D: ♭VI7\nA | 3 | G7\nA | 4 | CMaj7\n@key B 5 F\nB | 5 | Gm7\nB | 6 | C7\nB | 7 | FMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(['Bb7', 'G7', 'C7'].map((t) => chords.find((c) => c.text === t)?.keyFrom)).toEqual(['function', 'found', 'area'])
  })

  const pents = (sheet: ChangesSheet) => sheet.lines.map((l) => l.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label ?? '')).filter(Boolean))

  it('names each key area’s pentatonic at a rung and side, only where the area changes or a line starts', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Cmaj7\nA | 4 | Cmaj7\nA | 5 | F#m7b5\nA | 6 | B7\nA | 7 | Em7\nA | 8 | Em7\n@key A 5 Em').value
    const sheet = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(2, 'flat')).lines)
    expect(pents({ lines: sheet, beats: 4, diagnostics: [] })).toEqual([['Gm♪'], ['Dm♪']]) // C major ♭2 Gm; E minor (home Em) ♭2 Dm
  })

  it('plays a section named after an Object built-in at the fallback', () => {
    const doc = parseChart('title: T\nkey: C\nconstructor | 1 | Dm7\nconstructor | 2 | G7\ntoString | 3 | Cmaj7\n').value
    const sheet = buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(2, 'flat'))
    expect(pents(sheet).flat().length).toBeGreaterThan(0)
  })

  it('writes the ladder for the part: a B♭ part over concert C major reads D major’s', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7').value
    const [chord] = buildChanges(doc, TENOR, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]?.chords ?? []
    expect([chord?.pentatonic?.label, chord?.pentatonic?.key, chord?.pentatonic?.ladder.length]).toEqual(['Bm♪', 'D major', 12])
  })

  it('spells the title from the ladder’s Home, so a transposed minor area and its Home agree', () => {
    const minor = parseChart('title: T\nkey: Bm\nA | 1 | Bm7').value
    const bar = buildChanges(minor, TENOR, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]
    expect([bar?.chords[0]?.pentatonic?.key, bar?.chords[0]?.pentatonic?.label, bar?.keyArea]).toEqual(['C♯ minor', 'C♯m♪', 'C♯ minor'])
    const major = parseChart('title: T\nkey: C#\nA | 1 | C#maj7').value
    const [chord] = buildChanges(major, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines[0]?.bars[0]?.chords ?? []
    expect([chord?.pentatonic?.key, chord?.pentatonic?.label]).toEqual(['D♭ major', 'B♭m♪'])
  })

  it('does not repeat the label across relative keys, but each chord keeps its own area’s key', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Am7\n@key A 2 Am').value
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(0, 'flat')).lines)
    const chords = lines[0]?.bars.flatMap((b) => b.chords) ?? []
    expect(chords.map((c) => c.pentatonic?.label ?? '')).toEqual(['Am♪', '']) // printed once: the same home
    expect(chords.map((c) => c.pentatonic?.key)).toEqual(['C major', 'A minor'])
  })

  it('labels the first chord of a line the app breaks off', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | C\nA | 2 | F\nA | 3 | G\nA | 4 | C').value
    const built = buildChanges(doc, CONCERT, 4, false, 'off', undefined, one(1, 'sharp'))
    const lines = showPentatonics(breakLines(built.lines, new Set(['A 3'])))
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Em♪'], ['Em♪']])
  })

  it('lists the sections it draws: a repeat drawn once and a section with endings are one each', () => {
    expect(changesSections(library('autumn-leaves')).map((s) => [s.key, s.marker, s.part])).toEqual([['A1', 'A1 · A2', 'form'], ['B', 'B', 'form']])
    expect(changesSections(library('take-the-a-train')).map((s) => [s.key, s.part])).toEqual([['Intro', 'before'], ['A1', 'form'], ['A2', 'form'], ['B', 'form'], ['A3', 'form']])
    expect(changesSections(library('stardust')).filter((s) => s.key === 'Intro')).toHaveLength(1) // played twice, with endings
  })

  it('plays each section at its own rung, with the shared count when asked', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Cmaj7\nB | 3 | Cmaj7\nB | 4 | Cmaj7').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Am♪ 5'], ['B♭m♪ 1']]) // each section starts a line, so its label prints
    const b = lines[1]?.bars[0]?.chords[0]?.pentatonic
    expect([b?.section, b?.view, b?.shared]).toEqual(['B', { rung: 5, side: 'flat' }, 1])
  })

  it('keeps a section’s rung in the key of its own area', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Gmaj7\n@key B 2 G').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Am♪ 5'], ['B♭m♪ 0']]) // G major's home Em, its rung 6 B♭m
  })

  it('gives a merged repeat’s chords the first section’s rung', () => {
    const plan: PentatonicPlan = { bySection: { A1: { rung: 2, side: 'flat' }, A2: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: false }
    const first = buildChanges(library('autumn-leaves'), CONCERT, 4, false, 'off', undefined, plan).lines[0]?.bars[0]?.chords[0]?.pentatonic
    expect([first?.section, first?.view.rung]).toEqual(['A1', 2])
  })

  describe('pentatonicContour', () => {
    const side = (rung: number): PentatonicPlan => ({ bySection: { B: { rung, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true })
    const contour = (text: string, plan: PentatonicPlan | null, breaks: readonly string[] = []) =>
      pentatonicContour(showPentatonics(breakLines(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines, new Set(breaks))))
    const AABA = 'title: T\nkey: C\nA1 | 1 | Cmaj7\nA2 | 2 | Cmaj7\nB | 3 | Dm7\nB | 3 | G7\nA3 | 4 | Cmaj7'

    it('gives each line one run at its section’s rung, and a riser where the rung changed from the line before', () => {
      expect(contour(AABA, side(5))).toEqual([
        { entry: null, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
        { entry: null, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
        { entry: 0, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 1 }, rung: 5 }] },
        { entry: 5, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
      ])
    })

    it('ignores blanked labels: a run spans chords whose label showPentatonics left unprinted', () => {
      const runs = contour('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\nA | 3 | G7', side(5))[0]?.runs
      expect(runs).toEqual([{ from: { bar: 0, chord: 0 }, to: { bar: 2, chord: 0 }, rung: 0 }])
    })

    it('keeps a wrapped section’s rung with no riser on its second line', () => {
      const text = 'title: T\nkey: C\nB | 1 | Cmaj7\nB | 2 | Cmaj7\nB | 3 | Cmaj7\nB | 4 | Cmaj7'
      const lines = contour(text, side(5), ['B 3'])
      expect(lines.map((l) => [l.entry, l.runs.map((r) => r.rung)])).toEqual([[null, [5]], [null, [5]]])
    })

    it('breaks a run at a chord with no key, and gives no riser across a gap at a line’s edge', () => {
      // a keyed chart gives N.C. its area's pentatonic, so the gaps are hand-built: no pentatonic on the N.C. chords
      const text = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | N.C.\nA | 3 | Cmaj7\nB | 4 | N.C.\nB | 5 | Cmaj7'
      const gap = (line: ChangesLine, bar: number): ChangesLine => ({ ...line, bars: line.bars.map((b, i) => (i === bar ? { ...b, chords: b.chords.map((c) => ({ ...c, pentatonic: null })) } : b)) })
      const [a, b] = showPentatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, side(5)).lines)
      const lines = pentatonicContour([gap(a!, 1), gap(b!, 0)])
      expect(lines[0]?.runs.map((r) => [r.from.bar, r.to.bar, r.rung])).toEqual([[0, 0, 0], [2, 2, 0]])
      expect(lines[1]).toEqual({ entry: null, runs: [{ from: { bar: 1, chord: 0 }, to: { bar: 1, chord: 0 }, rung: 5 }] })
    })

    it('steps mid-line where the rung changes inside a line', () => {
      // a hand-built line: two chords at different rungs
      const [line] = showPentatonics(buildChanges(parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 1 | Dm7').value, CONCERT, 4, false, 'off', undefined, side(0)).lines)
      const bar = line!.bars[0]!
      const second = bar.chords[1]!
      const stepped = { ...line!, bars: [{ ...bar, chords: [bar.chords[0]!, { ...second, pentatonic: { ...second.pentatonic!, view: { rung: 3, side: 'sharp' as const }, level: 3 } }] }] }
      expect(pentatonicContour([stepped])[0]?.runs.map((r) => [r.from.chord, r.to.chord, r.rung])).toEqual([[0, 0, 0], [1, 1, 3]])
    })

    it('has no runs with the row off, and resets the riser across a line with no chords', () => {
      expect(contour(AABA, null).every((l) => l.entry === null && l.runs.length === 0)).toBe(true)
      expect(pentatonicContour([{ bars: [], sectionEnd: true }])).toEqual([{ entry: null, runs: [] }])
    })
  })

  it('has no pentatonics with no view, and none where the analysis finds no key', () => {
    expect(bars('autumn-leaves').flatMap((b) => b.chords).every((c) => c.pentatonic === null)).toBe(true)
    const doc = parseChart('title: T\nA | 1 | N.C.').value
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
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | Dm7', 'A | 3 | G7', 'A | 4 | G7'].join('\n') + '\n'
    const line0 = chords(text)[0]!
    expect(line0.map((c) => c[1])).toEqual(['D Dorian', null, 'G Mixo', null])
  })

  it('always shows the first chord of a line, even if it repeats the previous line', () => {
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | Dm7', 'A | 3 | Dm7', 'A | 4 | Dm7', 'A | 5 | Dm7'].join('\n') + '\n'
    const lines = chords(text)
    expect(lines[0]!.map((c) => c[1])).toEqual(['D Dorian', null, null, null])
    expect(lines[1]![0]![1]).toBe('D Dorian')
  })

  const chordPlan = (rank = 1): PentatonicPlan => ({ bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord', rank })
  const flat = (lines: readonly ChangesLine[]) => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))

  it('ranks each chord against its own scale under the chord basis: Waltz for Debby bars 1–4', () => {
    const built = buildChanges(library('waltz-for-debby'), CONCERT, 4, false, 'off', undefined, chordPlan())
    const first4 = flat(built.lines).slice(0, 4)
    // F Ionian from F, D Aeolian, G Dorian, C Mixolydian: all F major's notes, ties by fifths from each chord root
    expect(first4.map((c) => c.pentatonic?.name)).toEqual(['Gm', 'Dm', 'Gm', 'Gm'])
    expect(first4.map((c) => [c.pentatonic?.rank, c.pentatonic?.shared, c.pentatonic?.level])).toEqual([[1, 5, 0], [1, 5, 0], [1, 5, 0], [1, 5, 0]])
    expect(showPentatonics(built.lines)[0]?.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label))).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5', ''])
  })

  it('names the chord basis title and keeps its ranking; rank 12 is the farthest', () => {
    const doc = parseChart('title: T\nkey: F\nA | 1 | Dm7').value
    const [c] = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan(12)).lines)
    expect([c?.pentatonic?.basis, c?.pentatonic?.title, c?.pentatonic?.ranking.length, c?.pentatonic?.rank, c?.pentatonic?.shared, c?.pentatonic?.level]).toEqual(['chord', 'Dm7 · D Dorian pentatonic ranking', 12, 12, 0, 6])
  })

  it('spells the chord basis for the part, and reports the root in concert', () => {
    const doc = parseChart('title: T\nkey: F\nA | 1 | Dm7').value
    const [c] = flat(buildChanges(doc, TENOR, 4, false, 'off', undefined, chordPlan()).lines)
    expect([c?.pentatonic?.name, c?.pentatonic?.pc]).toEqual(['Em', 2]) // written E minor = concert D
    expect(concertPc(TENOR, 4)).toBe(2)
  })

  it('gives a chord with no scale no label under the chord basis', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | N.C.\nA | 3 | Cmaj7').value
    const chords = flat(showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan()).lines))
    expect(chords[1]?.pentatonic).toBeNull()
    expect(chords.map((c) => c.pentatonic?.label ?? null)).toEqual(['Dm♪ 5', null, 'Dm♪ 5']) // a gap: the label prints again
  })

  it('keys each chord by its drawn bar and index, and keeps the key basis’s title and level', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 1 | Dm7\nB | 2 | Cmaj7').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 3, side: 'sharp' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(chords.map((c) => c.pentatonic?.chord)).toEqual(['A:1:0', 'A:1:1', 'B:2:0'])
    expect([chords[2]?.pentatonic?.title, chords[2]?.pentatonic?.level, chords[2]?.pentatonic?.rank, chords[2]?.pentatonic?.basis]).toEqual(['B · C major pentatonic ladder', 3, 0, 'key'])
  })
})

describe('scales from the resolver', () => {
  const G_MINOR = 'title: T\nkey: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm7 | G Dorian\nA | 4 | Cm7\n'
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
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | G7', 'A | 3 | CMaj7', 'A | 4 | Am7', '@ending 1 A 3 3', '@ending 2 A 4 4'].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.repeatStart).toBe(true)
    expect(b[2]?.repeatEnd).toBe(2)
    expect(b[3]?.repeatEnd).toBe(0)
    expect(b.map((x) => x.volta)).toEqual([null, null, { n: 1, start: true, end: true }, { n: 2, start: true, end: true }])
  })

  it('maps @segno, @coda and @nav onto their bars; two @nav join', () => {
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | G7', 'Coda | 1 | CMaj7', '@segno A 1', '@coda Coda 1', '@nav A 2 To Coda', '@nav A 2 D.S. al Coda'].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.segno).toBe(true)
    expect(b[1]?.nav).toBe('To Coda · D.S. al Coda')
    expect(b.find((x) => x.marker.startsWith('Coda'))?.coda).toBe(true)
  })

  it('ignores a directive whose section or bar is absent, without throwing', () => {
    const text = 'key: C\nA | 1 | Dm7\n@segno ZZ 9\n@nav A 99 x\n@ending 1 ZZ 1\n'
    const b = barsOf(text)
    expect(b.every((x) => !x.segno && x.nav === '' && x.volta === null)).toBe(true)
  })

  it("with signatures, gives every bar the chart's key; an @key shows only as its key-area label", () => {
    const doc = parseChart('title: T\nkey: Eb\nA | 1 | EbMaj7\nB | 2 | DMaj7\n@key B 2 D\n').value
    const bars = buildChanges(doc, TENOR, 4, true).lines.flatMap((l) => l.bars).filter((b) => b.chords.length)
    expect(bars.map((b) => b.keySig)).toEqual(['F', 'F'])
    expect(bars.map((b) => b.keyArea)).toEqual(['F major', 'E major'])
    expect(buildChanges(doc, CONCERT).lines[0]?.bars[0]?.keySig).toBeNull()
    expect(buildChanges(parseChart('title: T\nA | 1 | Cm7\n').value, CONCERT, 4, true).lines[0]?.bars[0]?.keySig).toBeNull()
  })
})

describe('guide tones on the Changes sheet', () => {
  const sheetOf = (text: string, line: GuideLine, barsPerLine = 4, signatures = false) =>
    buildChanges(parseChart(text).value, CONCERT, barsPerLine, signatures, line)
  const barsOf = (text: string, line: GuideLine, barsPerLine = 4) => sheetOf(text, line, barsPerLine).lines.flatMap((l) => l.bars)
  const labels = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars).flatMap((b) => b.chords.map((c) => c.guide))
  const SIXES = 'key: C\nA | 1 | C6\nA | 2 | C7sus4\nA | 3 | C\nA | 4 | Cm7\n'
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
    const b = barsOf('key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n', 'third') // CMaj7 runs to the end of the 4-bar phrase
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
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | C7\nA | 4 | CMaj7\nA | 6 | Dm7\n' // CMaj7 holds bars 4-5
    const sheet = sheetOf(text, 'third')
    const [first, second] = sheet.lines
    expect([first?.bars.length, tied(first?.bars ?? []).at(-1), tied(second?.bars ?? [])[0]]).toEqual([4, '64~', '^64'])
    expect(tied(barsOf(text, 'third', 2))).toEqual(tied(barsOf(text, 'third', 4)))
  })

  it('rests where a chord has no guide tones, and says so only when a line is on', () => {
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | CMaj7\n'
    const on = sheetOf(text, 'seventh')
    expect(on.lines[0]?.bars[1]?.voice.map((n) => n.pitch)).toEqual([null])
    expect(on.lines[0]?.bars[1]?.chords[0]?.guide).toBe('')
    expect(on.diagnostics.filter((d) => d.startsWith('no guide tones for Cm7#5#9x'))).toHaveLength(1)
    expect(buildChanges(parseChart(text).value, CONCERT).diagnostics.some((d) => d.startsWith('no guide tones'))).toBe(false)
  })

  it('voices a folded repeat once: only the rows drawn, in written order', () => {
    const text = ['key: C', 'A1 | 1 | Dm7', 'A1 | 2 | G7', 'A1 | 3 | CMaj7', 'A1 | 4 | A7', '@copy A1 A2 4', 'B | 9 | Fm7', 'B | 10 | Bb7', 'B | 11 | EbMaj7', 'B | 12 | Ab7'].join('\n') + '\n'
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
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Em7\nA | 4 | A7\nA | 5 | Dm7\nA | 6 | G7\nA | 7 | CMaj7\n@ending 1 A 3 4\n@ending 2 A 5 6\n'
    const b = barsOf(text, 'third')
    expect(b.map((x) => x.volta?.n ?? 0)).toEqual([0, 0, 1, 1, 2, 2, 0, 0])
    const struck = (i: number) => b[i]?.voice[0]?.pitch?.midi
    expect([struck(3), struck(4)]).toEqual([67, 65]) // A7's G4, then Dm7's F4: a step
  })

  it('holds a repeated chord with a tie inside a section, and strikes it again in the next section or ending', () => {
    expect(tied(barsOf('key: C\nA | 1 | C7\nA | 2 | C7b9\nB | 3 | C7\nB | 4 | Dm7\n', 'third'))).toEqual(['64~', '^64', '64', '65'])
    const endings = 'key: C\nA | 1 | Dm7\nA | 2 | C7\nA | 3 | C7\nA | 4 | C7\n@ending 1 A 3 3\n@ending 2 A 4 4\n'
    expect(tied(barsOf(endings, 'third'))).toEqual(['65', '64~', '^64', '64']) // into the 1st ending tied; the 2nd ending struck again
    const after = 'key: C\nA | 1 | Dm7\nA | 2 | C7\nA | 3 | C7\nA | 4 | C7\nA | 5 | C7\n@ending 1 A 3 3\n@ending 2 A 4 4\n'
    expect(tied(barsOf(after, 'third'))).toEqual(['65', '64~', '^64', '64~', '^64~', '^64~', '^64~', '^64']) // from the 2nd ending on, holds tie again (the last C7 fills its phrase)
  })

  it('continues the line into a 2nd ending from the 1st ending, rather than starting it again (rule 9)', () => {
    const text = 'key: C\nA | 1 | CMaj7\nA | 2 | A7\nA | 3 | Dm7\nA | 4 | G7\n@ending 1 A 3 3\n@ending 2 A 4 4\n'
    const b = barsOf(text, 'seventh')
    expect(b.map((x) => x.voice[0]?.pitch?.midi)).toEqual([71, 73, 72, 71]) // G7: B4 from C5; a fresh start would give F5
    expect(b[3]?.chords[0]?.guide).toBe('3')
  })

  it('reads accidentals against the signature when it is drawn, and against C when it is not', () => {
    const text = 'key: F\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n'
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

describe('guide tone lines over the library', () => {
  const LIBRARY = new URL('../../charts/', import.meta.url)
  const docs = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))
  const voiceOf = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars.map((b) => b.voice))
  const plain = (s: ChangesSheet) => s.lines.map((l) => l.bars.map(({ voice: _v, ...b }) => ({ ...b, chords: b.chords.map(({ guide: _g, ...c }) => c) })))

  for (const line of ['third', 'seventh'] as const) {
    it(`from the ${line}: strike (or hold) one note per chord, on its beat, and fill every bar`, () => {
      expect(docs.length).toBeGreaterThan(200)
      for (const { f, doc } of docs) {
        const sheet = buildChanges(doc, CONCERT, 4, false, line)
        for (const bar of sheet.lines.flatMap((l) => l.bars)) {
          const voice = bar.voice
          expect(voice.reduce((s, n) => s + n.beats, 0), f).toBe(sheet.beats)
          const beats = bar.chords.map((c) => c.beat) // a held chord's note starts on its beat, tied in
          expect(voice.filter((n) => !n.tiedIn || beats.includes(n.beat)).map((n) => n.beat), f).toEqual(beats)
          expect(voice.filter((n) => !n.tiedIn).every((n) => beats.includes(n.beat)), f).toBe(true)
          expect(voice.every((n) => n.pitch !== null), f).toBe(true)
          for (const c of bar.chords) expect(c.guide, `${f} ${c.text}`).not.toBe('')
        }
        expect(sheet.diagnostics.filter((d) => d.startsWith('no guide tones')), f).toEqual([])
      }
    })

    it(`from the ${line}: tie only inside a block, across line breaks too: a tie lands on a tiedIn piece of the same pitch, and a block starts fresh`, () => {
      for (const { f, doc } of docs) {
        const all = buildChanges(doc, CONCERT, 4, false, line).lines.flatMap((l) => l.bars)
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
        const on4 = buildChanges(doc, CONCERT, 4, false, line)
        const on2 = buildChanges(doc, CONCERT, 2, false, line)
        const off = buildChanges(doc, CONCERT)
        expect(voiceOf(on2), f).toEqual(voiceOf(on4))
        expect(plain(on4), f).toEqual(plain(off))
        expect(on4.diagnostics, f).toEqual(off.diagnostics)
      }
    })
  }
})

describe('a drawn chord’s line', () => {
  it('is the line of the chart it was written on; a repeat’s chords point at the rows they repeat', () => {
    const doc = parseChart(['title: T', 'A | 1 | Cm7', 'A | 2 | F7', 'B | 3 | Bbmaj7', '@copy A C 4'].join('\n')).value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(chords.map((c) => [c.text, c.at.section, c.line])).toEqual([
      ['Cm7', 'A', 1],
      ['F7', 'A', 2],
      ['Bbmaj7', 'B', 3],
      ['Cm7', 'C', 1],
      ['F7', 'C', 2],
    ])
  })
})

describe('breakLines', () => {
  const sheet = buildChanges(parseChart('A | 1 | C\nA | 2 | D\nA | 3 | E\nA | 4 | F\nA | 5 | G\nB | 1 | C\nB | 2 | D\n').value, CONCERT, 4)
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
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | CMaj7\n').value
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

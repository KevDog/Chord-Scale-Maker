import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { buildChanges, type ChangesSheet, changesLinesPerPage } from '../changes'
import { parseChart } from '../chart'
import { type GuideNote, type GuideShow, guideVoices, NO_GUIDES } from '../guideTones'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { isSyncCopy } from '../util'

// a transparent wrapper, so a test can see what buildChanges hands the voice leading
vi.mock('../guideTones', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guideTones')>()
  return { ...actual, guideVoices: vi.fn(actual.guideVoices) }
})

const library = (name: string) => parseChart(readFileSync(`../charts/${name}.txt`, 'utf8')).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const bars = (name: string, part = CONCERT) => buildChanges(library(name), part).lines.flatMap((l) => l.bars)
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
const BOTH: GuideShow = { third: true, seventh: true }

describe('the Changes sheet', () => {
  it('lays a chart out four bars a line, each section on a new line, a @copy straight after its source as a repeat', () => {
    const sheet = buildChanges(library('autumn_leaves'), CONCERT)
    expect(sheet.lines.map((l) => l.bars.length)).toEqual([4, 4, 4, 4, 4, 4]) // A1·A2 (8 bars, played twice), B (16)
    const [first] = sheet.lines[0]?.bars ?? []
    expect([first?.marker, first?.keyArea, first?.repeatStart]).toEqual(['A1 · A2', 'G minor', true])
    expect(sheet.lines[1]?.bars[3]?.repeatEnd).toBe(2)
    expect(sheet.lines[2]?.bars[0]?.marker).toBe('B')
    expect(sheet.lines.at(-1)?.bars.at(-1)?.end).toBe('final')
  })

  it('puts each chord on its beat with its numeral and its scale', () => {
    const bar3 = bars('autumn_leaves')[2]
    expect(bar3?.chords.map((c) => [c.text, c.beat, c.numeral, c.scale])).toEqual([
      ['Bm7', 0, 'ii7/II', 'B Dorian'],
      ['E7', 2, 'V7/II', 'E Mixo'],
    ])
  })

  it('prints an intro before the form, writes a later copy out, marks key areas, and closes both with a double bar before a tag', () => {
    const b = bars('a_night_in_tunisia')
    expect(b.filter((x) => x.marker).map((x) => x.marker)).toEqual(['Intro', 'A1 · A2', 'B', 'A3 (= A1)', 'Tag'])
    expect(b.filter((x) => x.keyArea).map((x) => x.keyArea)).toEqual(['D minor', 'F major', 'D minor'])
    expect(b.map((x) => x.end).filter((e) => e !== 'none')).toEqual(['double', 'double', 'final'])
  })

  it('heads a coda "after the last chorus"', () => {
    const doc = parseChart('key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n').value
    const markers = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).filter((x) => x.marker).map((x) => x.marker)
    expect(markers).toEqual(['A', 'Coda (after the last chorus)'])
  })

  it('writes chords, scales and key areas for a transposing instrument; numerals stay', () => {
    const [first] = bars('autumn_leaves', TENOR)
    expect([first?.keyArea, first?.chords[0]?.scale, first?.chords[0]?.numeral]).toEqual(['A minor', 'D Dorian', 'ii7/♭III'])
  })

  it('counts a waltz in 3', () => {
    expect(buildChanges(library('someday_my_prince_will_come'), CONCERT).beats).toBe(3)
  })

  it('gives each chord its reason, the key it is heard in, and whether its function was stated', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Bb7 | | D: ♭VI7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    const bb7 = chords.find((c) => c.text === 'Bb7')
    expect([bb7?.numeral, bb7?.stated, bb7?.heardIn]).toEqual(['♭VI7', true, 'D major'])
    expect(bb7?.reason).toMatch(/^\* /)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ stated: false, heardIn: 'C major', reason: 'V7 of C: natural tensions' })
  })

  it('says where the key it is heard in came from: found, an @key, or the function', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Bb7 | | D: ♭VI7\nA | 3 | G7\nA | 4 | CMaj7\n@key B 5 F\nB | 5 | Gm7\nB | 6 | C7\nB | 7 | FMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    expect(['Bb7', 'G7', 'C7'].map((t) => chords.find((c) => c.text === t)?.keyFrom)).toEqual(['function', 'found', 'area'])
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
  const sheetOf = (text: string, guides: GuideShow, barsPerLine = 4, signatures = false) =>
    buildChanges(parseChart(text).value, CONCERT, barsPerLine, signatures, guides)
  const barsOf = (text: string, guides: GuideShow) => sheetOf(text, guides).lines.flatMap((l) => l.bars)
  const labels = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars).flatMap((b) => b.chords.map((c) => c.guide))
  const SIXES = 'key: C\nA | 1 | C6\nA | 2 | C7sus4\nA | 3 | C\nA | 4 | Cm7\n'

  it('leaves the sheet as it was with both off: no voices, no labels, and no voice leading run', () => {
    vi.mocked(guideVoices).mockClear()
    const doc = library('autumn_leaves')
    const sheet = buildChanges(doc, CONCERT, 4, false, NO_GUIDES)
    expect(sheet).toEqual(buildChanges(doc, CONCERT))
    const b = sheet.lines.flatMap((l) => l.bars)
    expect(b.every((x) => x.voices.length === 0 && x.chords.every((c) => c.guide.length === 0))).toBe(true)
    expect(guideVoices).not.toHaveBeenCalled()
  })

  it('labels each chord with its real degree, flats and sharps dropped', () => {
    expect(labels(sheetOf(SIXES, THIRD))).toEqual([['3'], ['4'], ['3'], ['3']])
    expect(labels(sheetOf(SIXES, SEVENTH))).toEqual([['6'], ['7'], ['1'], ['7']])
    expect(labels(sheetOf(SIXES, BOTH)).map((l) => [...l].sort())).toEqual([['3', '6'], ['4', '7'], ['1', '3'], ['3', '7']])
  })

  it('strikes one note a chord, held for its length and tied across the barline', () => {
    const b = barsOf('key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n', THIRD) // CMaj7 runs to the end of the 4-bar phrase
    expect(b.map((x) => x.voices.length)).toEqual([1, 1, 1, 1])
    expect(b.map((x) => x.voices[0]?.map((n) => [n.beat, n.beats, n.tie, n.tiedIn]))).toEqual([
      [[0, 4, false, false]],
      [[0, 4, false, false]],
      [[0, 4, true, false]],
      [[0, 4, false, true]],
    ])
    expect(b[3]?.voices[0]?.[0]?.pitch).toEqual(b[2]?.voices[0]?.[0]?.pitch)
    expect(b[3]?.voices[0]?.[0]?.accidental).toBeNull()
  })

  it('rests where a chord has no guide tones, and says so only when a guide is on', () => {
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | CMaj7\n'
    const on = sheetOf(text, BOTH)
    expect(on.lines[0]?.bars[1]?.voices.map((v) => v.map((n) => n.pitch))).toEqual([[null], [null]])
    expect(on.diagnostics.filter((d) => d.startsWith('no guide tones for Cm7#5#9x'))).toHaveLength(1)
    expect(buildChanges(parseChart(text).value, CONCERT).diagnostics.some((d) => d.startsWith('no guide tones'))).toBe(false)
  })

  it('voices a folded repeat once: only the rows drawn, in written order', () => {
    const text = ['key: C', 'A1 | 1 | Dm7', 'A1 | 2 | G7', 'A1 | 3 | CMaj7', 'A1 | 4 | A7', '@copy A1 A2 4', 'B | 9 | Fm7', 'B | 10 | Bb7', 'B | 11 | EbMaj7', 'B | 12 | Ab7'].join('\n') + '\n'
    vi.mocked(guideVoices).mockClear()
    const sheet = sheetOf(text, BOTH)
    expect(sheet.lines.map((l) => l.bars[0]?.marker)).toEqual(['A1 · A2', 'B'])
    expect(guideVoices).toHaveBeenCalledTimes(1)
    const [inputs, , beats, keySig, show] = vi.mocked(guideVoices).mock.calls[0]!
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
    expect([beats, keySig, show]).toEqual([4, null, BOTH])
    expect(sheet.lines.flatMap((l) => l.bars).every((b) => b.voices.length === 2)).toBe(true)
  })

  it("voices a 2nd ending from the 1st ending's last chord, in written order", () => {
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Em7\nA | 4 | A7\nA | 5 | Dm7\nA | 6 | G7\nA | 7 | CMaj7\n@ending 1 A 3 4\n@ending 2 A 5 6\n'
    const b = barsOf(text, BOTH)
    expect(b.map((x) => x.volta?.n ?? 0)).toEqual([0, 0, 1, 1, 2, 2, 0, 0])
    const struck = (i: number) => b[i]?.voices.map((v) => v[0]?.pitch?.midi)
    expect([struck(3), struck(4)]).toEqual([
      [73, 67],
      [72, 65],
    ]) // A7's C#5 over G4, then Dm7's C5 over F4: a step in each voice
  })

  it('reads accidentals against the signature when it is drawn, and against C when it is not', () => {
    const text = 'key: F\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n'
    const struck = (signatures: boolean) =>
      sheetOf(text, BOTH, 4, signatures)
        .lines.flatMap((l) => l.bars)
        .flatMap((b) => b.voices.flat())
        .filter((n): n is GuideNote & { pitch: NonNullable<GuideNote['pitch']> } => !n.tiedIn && n.pitch !== null)
        .map((n) => [rootName(n.pitch), n.accidental] as const)
    expect(struck(false).filter(([name]) => name === 'Bb')).toHaveLength(2) // Gm7's 3rd, C7's 7th
    expect(struck(false).every(([name, acc]) => acc === (name === 'Bb' ? 'b' : null))).toBe(true)
    expect(struck(true).every(([, acc]) => acc === null)).toBe(true)
  })

  it('fits 8 lines a page with no guide, whatever the rows; fewer with guides; one more when both rows are off', () => {
    const rows = [
      { numerals: true, scales: true },
      { numerals: true, scales: false },
      { numerals: false, scales: true },
      { numerals: false, scales: false },
    ]
    expect(rows.map((r) => changesLinesPerPage(NO_GUIDES, r))).toEqual([8, 8, 8, 8])
    expect(rows.map((r) => changesLinesPerPage(THIRD, r))).toEqual([6, 6, 6, 7])
    expect(rows.map((r) => changesLinesPerPage(SEVENTH, r))).toEqual([6, 6, 6, 7])
    expect(rows.map((r) => changesLinesPerPage(BOTH, r))).toEqual([5, 5, 5, 6])
  })
})

describe('guide tones over the library, both on', () => {
  const LIBRARY = new URL('../../../charts/', import.meta.url)
  const docs = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))
  const voicesOf = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars.map((b) => b.voices))
  const plain = (s: ChangesSheet) => s.lines.map((l) => l.bars.map(({ voices: _v, ...b }) => ({ ...b, chords: b.chords.map(({ guide: _g, ...c }) => c) })))

  it('strike one note a voice per chord, on its beat, and fill every bar', () => {
    expect(docs.length).toBeGreaterThan(200)
    for (const { f, doc } of docs) {
      const sheet = buildChanges(doc, CONCERT, 4, false, BOTH)
      for (const bar of sheet.lines.flatMap((l) => l.bars)) {
        expect(bar.voices.length, f).toBe(2)
        for (const voice of bar.voices) {
          expect(voice.reduce((s, n) => s + n.beats, 0), f).toBe(sheet.beats)
          expect(voice.filter((n) => !n.tiedIn).map((n) => n.beat), f).toEqual(bar.chords.map((c) => c.beat))
          expect(voice.every((n) => n.pitch !== null), f).toBe(true)
        }
        for (const c of bar.chords) expect(c.guide.length, `${f} ${c.text}`).toBe(2)
      }
      expect(sheet.diagnostics.filter((d) => d.startsWith('no guide tones')), f).toEqual([])
    }
  })

  it('tie only inside a block: a tie lands on a tiedIn piece of the same pitch, and a block starts fresh', () => {
    for (const { f, doc } of docs) {
      const all = buildChanges(doc, CONCERT, 4, false, BOTH).lines.flatMap((l) => l.bars)
      for (const v of [0, 1]) {
        let prev: GuideNote | undefined
        for (const bar of all) {
          if (bar.marker) {
            expect(prev?.tie ?? false, `${f} ${bar.marker}`).toBe(false)
            prev = undefined
          }
          for (const n of bar.voices[v] ?? []) {
            expect(n.tiedIn, f).toBe(prev?.tie ?? false)
            if (n.tiedIn) expect(n.pitch?.midi, f).toBe(prev?.pitch?.midi)
            prev = n
          }
        }
        expect(prev?.tie ?? false, f).toBe(false)
      }
    }
  })

  it('voice the same at 2 or 4 bars a line, and change nothing but voices, labels and diagnostics', () => {
    for (const { f, doc } of docs) {
      const on4 = buildChanges(doc, CONCERT, 4, false, BOTH)
      const on2 = buildChanges(doc, CONCERT, 2, false, BOTH)
      const off = buildChanges(doc, CONCERT)
      expect(voicesOf(on2), f).toEqual(voicesOf(on4))
      expect(plain(on4), f).toEqual(plain(off))
      expect(on4.diagnostics, f).toEqual(off.diagnostics)
    }
  })
})

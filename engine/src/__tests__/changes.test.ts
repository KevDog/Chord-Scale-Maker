import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { buildChanges, type ChangesSheet, changesLinesPerPage } from '../changes'
import { parseChart } from '../chart'
import { type GuideLine, type GuideNote, guideVoices } from '../guideTones'
import { CONCERT, type Part } from '../part'
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
    const [first] = bars('autumn_leaves', TENOR)
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

describe('scales from the resolver', () => {
  const G_MINOR = 'title: T\nkey: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm7 | G Dorian\nA | 4 | Cm7\n'
  const on = (level: ScaleView['level']): ScaleView => ({ level, seed: 0, proposed: true })
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

  it('plays the cell or the quality’s default with the flag off, as before', () => {
    expect(labels({ ...on('basic'), proposed: false })).toEqual(labels())
    expect(labels()[1]).toBe(short('D Mixolydian'))
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
    const doc = library('autumn_leaves')
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

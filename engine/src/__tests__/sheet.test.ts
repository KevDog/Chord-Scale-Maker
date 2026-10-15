import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { expandRows, parseChart, qualityScale, type Row } from '../chart'
import type { ScaleLevel } from '../levels'
import { CONCERT } from '../part'
import { rootName } from '../pitch'
import { resolveScales } from '../resolve'
import { type ModeChoice, type StaffModel, buildSheet, noteText, pageSubtitle, scaleLines, toVexKey } from '../sheet'
import { parseKey } from '../analysis/keys'

const row = (chord: string, scale = '', bar = '1'): Row => ({ section: 'A', bar, chord, scale })

/** n rows that are n different lines: m7 chords on the 12 roots, then 7ths */
const distinct = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => row(`${['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][i % 12]}${i < 12 ? 'm7' : '7'}`, '', String(i + 1)))

/** every staff of the first part, across pages */
const staves = (rows: readonly Row[], mode: ModeChoice = 'root'): StaffModel[] =>
  buildSheet(rows, CONCERT, mode, 'C', 12)[0]?.pages.flat() ?? []

describe('sheet', () => {
  it('letters a diminished staff cleanly but keeps its intervals and practice keys (#279)', () => {
    const [s] = buildSheet([row('Db7#9', 'Db Half-Whole')], CONCERT, 'root', 'C', 12, { preset: 'chordTones' })[0]?.pages.flat() ?? []
    expect(s?.notes.map((n) => rootName(n)).join(' ')).toBe('Db D E F G Ab Bb B')
    expect(s?.intervals).toEqual(['1', 'b9', '#9', '3', '#11', '5', '13', 'b7'])
    expect(s?.keys).toEqual(['1', 'b2', 'b3', '3', '#4', '5', '6', 'b7'])
    expect(s?.selected).toEqual([true, false, false, true, false, false, false, true])
  })

  it('letters a bebop staff cleanly but keeps its intervals (#281)', () => {
    const [s] = buildSheet([row('Db7', 'Db Bebop Dominant')], CONCERT, 'root', 'C', 12)[0]?.pages.flat() ?? []
    expect(s?.notes.map((n) => rootName(n)).join(' ')).toBe('Db Eb F Gb Ab Bb B C')
    expect(s?.intervals).toEqual(['1', '9', '3', '11', '5', '13', 'b7', '7'])
  })

  it('converts pitched notes to VexFlow keys', () => {
    expect(toVexKey({ letter: 2, acc: -1, midi: 63 })).toBe('eb/4')
    expect(toVexKey({ letter: 0, acc: -1, midi: 59 })).toBe('cb/4') // Cb4 sounds as B3
    expect(toVexKey({ letter: 6, acc: 1, midi: 72 })).toBe('b#/4') // B#4 sounds as C5
    expect(toVexKey({ letter: 4, acc: 0, midi: 43 })).toBe('g/2')
  })

  it('formats start notes for headings', () => {
    expect(noteText('Eb')).toBe('E♭')
    expect(noteText('F#3')).toBe('F♯')
    expect(noteText('Ebb')).toBe('E♭♭')
  })

  it('builds one part per mode with pages of perPage staves', () => {
    const rows = distinct(13)
    const sheet = buildSheet(rows, CONCERT, 'both', 'C', 12)
    expect(sheet.map((p) => [p.mode, p.heading, p.pages.map((pg) => pg.length)])).toEqual([
      ['from', 'Spelled from C', [12, 1]],
      ['root', 'Spelled from the Root', [12, 1]],
    ])
    const first = sheet[0]?.pages.flat() ?? []
    expect(first.map((s) => s.last)).toEqual([...Array(12).fill(false), true])
  })

  it('fills in default scales and spells the notes', () => {
    const [s] = staves([row('Cm7')])
    if (!s) throw new Error('no staff')
    expect(s.scale).toEqual({ root: { letter: 0, acc: 0 }, name: 'Dorian' })
    expect(s.notes.map(toVexKey)).toEqual(['c/4', 'd/4', 'eb/4', 'f/4', 'g/4', 'a/4', 'bb/4'])
    expect(s.chords).toEqual([[{ kind: 'text', text: 'C–7' }]])
    expect(s.error).toBeNull()
  })

  it('labels each note against the chord root, in any mode and for any instrument', () => {
    expect(staves([row('G7', 'Db Major Pentatonic')])[0]?.intervals).toEqual(['b5', 'b13', 'b7', 'b9', '#9'])
    const [from] = staves([row('Dm7')], 'from') // D Dorian from C: C D E F G A B
    expect(from?.intervals).toEqual(['b7', '1', '9', 'b3', '11', '5', '13'])
    const tenor = buildSheet([row('C7#9', 'C Altered')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages[0]?.[0]
    expect(tenor?.intervals).toEqual(['1', 'b9', '#9', '3', '#11', 'b13', 'b7']) // written D Altered over D7#9
    expect(staves([row('Cm7#5#9x', 'C Dorian')])[0]?.intervals).toEqual(['1', '9', 'b3', '11', '5', '13', 'b7']) // unknown quality
    expect(staves([row('???', 'C Dorian')])[0]?.intervals).toBeNull()
  })

  it('reports staves that need attention instead of throwing', () => {
    const [unknown, bad, typo] = staves([row('Cm7#5#9x'), row('Xyz'), row('Cm7', 'C Dorain')])
    expect(unknown).toMatchObject({ error: 'Choose a scale' })
    expect(unknown?.chords[0]).not.toBeNull()
    expect(bad).toMatchObject({ chords: [null], error: "Can't read this chord" })
    expect(typo).toMatchObject({ scale: null, error: 'unknown scale "Dorain"', chords: [[{ kind: 'text', text: 'C–7' }]] })
  })

  it('rejects a pitch that does not match its spelling', () => {
    expect(() => toVexKey({ letter: 0, acc: 0, midi: 61 })).toThrow(/does not match/)
  })

  it('never throws for a bad start note or page size', () => {
    const rows = [row('Cm7'), row('F7')]
    expect(buildSheet(rows, CONCERT, 'root', 'H', 12)[0]?.pages.flat()).toHaveLength(2) // start unused in root mode
    const [from] = buildSheet(rows, CONCERT, 'from', 'H', 12)
    expect(from?.heading).toBe('Spelled from H')
    expect(from?.pages.flat().map((s) => s.error)).toEqual(['bad start note "H" (try C, Eb, F#3)', 'bad start note "H" (try C, Eb, F#3)'])
    for (const perPage of [0, -3, Number.NaN, 1.5])
      expect(buildSheet(rows, CONCERT, 'root', 'C', perPage)[0]?.pages.map((p) => p.length)).toEqual([1, 1])
    expect(buildSheet([], CONCERT, 'both', 'C', 12).map((p) => p.pages)).toEqual([[], []])
  })

  it('gives staves stable ids that change with their content', () => {
    const id = (rows: readonly Row[]): string[] => staves(rows).map((s) => s.id)
    expect(id([row('Cm7')])).toEqual(id([row('Cm7')]))
    expect(id([row('Cm7')])).not.toEqual(id([row('Cm7', 'C Aeolian')]))
    const [a, b] = id([row('Cm7'), row('F7')])
    expect(a).not.toBe(b)
    const bb = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat()[0]?.id
    expect(bb).not.toBe(id([row('Cm7')])[0]) // a different instrument redraws
  })

  it('draws each line once, listing its chords', () => {
    const s = staves([row('Cm7'), row('F7'), row('Cm9'), row('F7')])
    expect(s.map((st) => st.chords.length)).toEqual([2, 1])
    expect(s[0]?.chords[1]).toEqual([{ kind: 'text', text: 'C–9' }])
    expect(s.map((st) => st.last)).toEqual([false, true])
  })

  it('keeps ids when a repeat is added', () => {
    const ids = (rows: readonly Row[]) => staves(rows).map((s) => s.id)
    expect(ids([row('Cm7'), row('F7'), row('Cm7')])).toEqual(ids([row('Cm7'), row('F7')]))
  })

  it('gives Autumn Leaves 14 lines', () => {
    const doc = parseChart(readFileSync(new URL('../../charts/autumn-leaves.txt', import.meta.url), 'utf8')).value
    const sheet = buildSheet(expandRows(doc).value, CONCERT, 'root', 'C', 12, null, undefined, resolveScales(doc, { level: 'standard', seed: 0 }))
    expect(sheet[0]?.pages.map((p) => p.length)).toEqual([12, 2])
  })

  it('builds page subtitles', () => {
    expect(pageSubtitle('Full Form', 'Tenor Sax (Bb)', 'Spelled from C')).toBe('Full Form – Tenor Sax (Bb) (Spelled from C)')
    expect(pageSubtitle('Full Form', '', 'Spelled from the Root')).toBe('Full Form (Spelled from the Root)')
    expect(pageSubtitle('', 'Trombone', 'Spelled from C')).toBe('Trombone (Spelled from C)')
    expect(pageSubtitle('', '', 'Spelled from C')).toBe('Spelled from C')
  })

  it('writes the sheet for a transposing instrument', () => {
    const [s] = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat() ?? []
    expect(s?.chords).toEqual([[{ kind: 'text', text: 'D–7' }]])
    expect(s?.scale?.name).toBe('Dorian')
    expect(s?.notes.map(toVexKey)).toEqual(['d/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'])
    const [b] = buildSheet([row('Cm7')], { clef: 'bass', trans: 'C' }, 'from', 'C', 12)[0]?.pages.flat() ?? []
    expect(b?.notes.map(toVexKey)[0]).toBe('c/3') // bass clef starts an octave lower
  })

  it("with the chart's key, gives every staff its written signature and only the accidentals that leave it", () => {
    const rows = [row('Dm7', 'D Dorian'), row('DMaj7', 'D Ionian', '2')] // the D major bar takes accidentals against Eb, as after an @key
    const all = buildSheet(rows, CONCERT, 'root', 'C', 12, null, parseKey('Eb')).flatMap((p) => p.pages.flat())
    expect(all.map((s) => s.keySig)).toEqual(['Eb', 'Eb'])
    const spelled = (s: StaffModel | undefined) => s?.notes.map((n, i) => (s.accidentals[i] ?? '') + 'CDEFGAB'[n.letter])
    expect(spelled(all[0])).toEqual(['D', 'nE', 'F', 'G', 'nA', 'nB', 'C'])
    expect(spelled(all[1])).toEqual(['D', 'nE', '#F', 'G', 'nA', 'nB', '#C'])
    const [plain] = buildSheet(rows, CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect([plain?.keySig, plain?.accidentals.every((a) => a === null)]).toEqual([null, true])
  })
  it('with a null key (no key: line), keeps explicit accidentals as without a key', () => {
    const rows = [row('C7', 'C Half-Whole')]
    const [a] = buildSheet(rows, CONCERT, 'root', 'C', 12, null, null).flatMap((p) => p.pages.flat())
    const [b] = buildSheet(rows, CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect([a?.keySig, a?.accidentals]).toEqual([null, b?.accidentals])
  })
  it('without a key, follows the bar rule: a natural cancels an earlier flat in the octave', () => {
    const spelled = (s: StaffModel | undefined) => s?.notes.map((n, i) => (s.accidentals[i] ?? '') + 'CDEFGAB'[n.letter])
    const [bebop] = buildSheet([row('C7', 'C Bebop Dominant')], CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect(spelled(bebop)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'bB', 'nB'])
    const [locrian] = buildSheet([row('Cm7b5', 'C Locrian')], CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect(spelled(locrian)).toEqual(['C', 'bD', 'bE', 'F', 'bG', 'bA', 'bB'])
  })
  it('writes the signature for a transposing part', () => {
    const rows = [row('EbMaj7', 'Eb Ionian')]
    const [staff] = buildSheet(rows, { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12, null, parseKey('Eb')).flatMap((p) => p.pages.flat())
    expect([staff?.keySig, staff?.accidentals.every((a) => a === null)]).toEqual(['F', true]) // F Ionian in F: no accidentals
  })
  it("with the chart's key, starts only each part's first staff with the clef and signature", () => {
    const rows = [row('Cm7'), row('F7', '', '2'), row('BbMaj7', '', '3')]
    const shown = (key?: ReturnType<typeof parseKey>) =>
      buildSheet(rows, CONCERT, 'both', 'C', 2, null, key).map((p) => p.pages.flat().map((s) => s.showClefAndKey))
    expect(shown(parseKey('Bb'))).toEqual([[true, false, false], [true, false, false]])
    expect(shown(null)).toEqual([[true, false, false], [true, false, false]]) // no key: line: the clef once, no signature
    expect(shown()).toEqual([[true, true, true], [true, true, true]]) // signatures off: a clef on every staff, as before
  })
  it('gives a staff a new id when its clef comes or goes', () => {
    const ids = (key?: null) => buildSheet([row('Cm7'), row('F7', '', '2')], CONCERT, 'root', 'C', 12, null, key).flatMap((p) => p.pages.flat().map((s) => s.id))
    expect(ids(null)[1]).not.toBe(ids()[1])
  })

  describe('reading resolveScales', () => {
    const doc = parseChart('title: T\nkey: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm7 | G Dorian\n').value
    const played = (level: ScaleLevel): (string | null)[] =>
      (buildSheet(expandRows(doc).value, CONCERT, 'root', 'C', 12, null, undefined, resolveScales(doc, { level, seed: 0 }))[0]?.pages.flat() ?? []).map((s) =>
        s.scale ? `${rootName(s.scale.root)} ${s.scale.name}` : null,
      )

    it('plays the analysed scale in a blank cell', () => {
      expect(played('standard')).toEqual(['A Locrian', 'D Phrygian Dominant', 'G Dorian'])
    })

    it('plays a written cell as written at every level', () => {
      expect(played('basic')).toEqual(['F Major Pentatonic', 'G Minor Pentatonic', 'G Dorian'])
      expect(played('advanced')[2]).toBe('G Dorian')
    })

    it('gives a staff a new id when the scale it plays changes', () => {
      const ids = (level: ScaleLevel) => buildSheet(expandRows(doc).value, CONCERT, 'root', 'C', 12, null, undefined, resolveScales(doc, { level, seed: 0 }))[0]?.pages.flat().map((s) => s.id) ?? []
      const [std, basic] = [ids('standard'), ids('basic')]
      expect(std[1]).not.toBe(basic[1])
      expect(std[2]).toBe(basic[2]) // written: the same at every level
    })

    it('plays each row’s own scale or its quality’s default with nothing resolved', () => {
      expect((staves(expandRows(doc).value) ?? []).map((s) => s.scale && `${rootName(s.scale.root)} ${s.scale.name}`)).toEqual(['A Locrian', 'D Mixolydian', 'G Dorian'])
    })
  })
})

describe('scaleLines', () => {
  const lines = (rows: readonly Row[]) => scaleLines(rows, (r) => qualityScale(r))

  it('gives each scale use one line, in order of first appearance', () => {
    expect(lines([row('Cm7'), row('F7'), row('Cm7'), row('BbMaj7'), row('F7')])).toEqual([
      { row: 0, chords: ['Cm7'] },
      { row: 1, chords: ['F7'] },
      { row: 3, chords: ['BbMaj7'] },
    ])
    expect(lines([])).toEqual([])
  })

  it('merges chords of one root and canonical quality over one scale, listing each symbol once', () => {
    expect(lines([row('Cm9'), row('Cm7'), row('Cm9')])).toEqual([{ row: 0, chords: ['Cm9', 'Cm7'] }])
    expect(lines([row('C#m7', 'C# Dorian'), row('Dbm7', 'Db Dorian')])).toEqual([{ row: 0, chords: ['C#m7', 'Dbm7'] }])
    expect(lines([row('D7'), row('D7/F#')])).toEqual([{ row: 0, chords: ['D7', 'D7/F#'] }])
  })

  it('splits a scale over different qualities or roots', () => {
    expect(lines([row('CmMaj7', 'C Melodic Minor'), row('Cm6', 'C Melodic Minor')])).toHaveLength(2)
    expect(lines([row('C7', 'C Half-Whole'), row('C7b9', 'C Half-Whole')])).toHaveLength(2)
    expect(lines([row('DbMaj7/C', 'C Phrygian'), row('C7sus4b9', 'C Phrygian')])).toHaveLength(2) // a slash chord counts as written
  })

  it('keeps one chord on two lines when it plays two scales', () => {
    expect(lines([row('E7', 'E Mixolydian'), row('E7', 'E Altered'), row('E7', 'E Mixolydian')])).toEqual([
      { row: 0, chords: ['E7'] },
      { row: 1, chords: ['E7'] },
    ])
  })

  it('keeps rows it cannot read apart, merging only the same chord and scale text', () => {
    expect(lines([row('Cm7'), row('Xyz'), row('Cm7', 'C Dorain'), row('Xyz'), row('Cm7#5#9x'), row('Cm7', 'C Dorain')])).toEqual([
      { row: 0, chords: ['Cm7'] },
      { row: 1, chords: ['Xyz'] },
      { row: 2, chords: ['Cm7'] },
      { row: 4, chords: ['Cm7#5#9x'] },
    ])
  })
})

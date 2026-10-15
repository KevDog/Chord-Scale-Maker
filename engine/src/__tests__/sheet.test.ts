import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chordPositions, pickTargets } from '../changes'
import { type ChordPicks, NO_PICKS, withPick } from '../chordPicks'
import type { PracticeSelection } from '../practice'
import { expandRowLines, expandRows, parseChart, qualityScale, type Row } from '../chart'
import type { ScaleLevel } from '../levels'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { resolveScales } from '../resolve'
import { type ModeChoice, type StaffModel, buildSheet, linePositions, noteText, pageSubtitle, scaleLines, toVexKey } from '../sheet'
import { parseKey } from '../analysis/keys'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
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
      { row: 0, rows: [0, 2], chords: ['Cm7'] },
      { row: 1, rows: [1, 4], chords: ['F7'] },
      { row: 3, rows: [3], chords: ['BbMaj7'] },
    ])
    expect(lines([])).toEqual([])
  })

  it('merges chords of one root and canonical quality over one scale, listing each symbol once', () => {
    expect(lines([row('Cm9'), row('Cm7'), row('Cm9')])).toEqual([{ row: 0, rows: [0, 1, 2], chords: ['Cm9', 'Cm7'] }])
    expect(lines([row('C#m7', 'C# Dorian'), row('Dbm7', 'Db Dorian')])).toEqual([{ row: 0, rows: [0, 1], chords: ['C#m7', 'Dbm7'] }])
    expect(lines([row('D7'), row('D7/F#')])).toEqual([{ row: 0, rows: [0, 1], chords: ['D7', 'D7/F#'] }])
  })

  it('splits a scale over different qualities or roots', () => {
    expect(lines([row('CmMaj7', 'C Melodic Minor'), row('Cm6', 'C Melodic Minor')])).toHaveLength(2)
    expect(lines([row('C7', 'C Half-Whole'), row('C7b9', 'C Half-Whole')])).toHaveLength(2)
    expect(lines([row('DbMaj7/C', 'C Phrygian'), row('C7sus4b9', 'C Phrygian')])).toHaveLength(2) // a slash chord counts as written
  })

  it('keeps one chord on two lines when it plays two scales', () => {
    expect(lines([row('E7', 'E Mixolydian'), row('E7', 'E Altered'), row('E7', 'E Mixolydian')])).toEqual([
      { row: 0, rows: [0, 2], chords: ['E7'] },
      { row: 1, rows: [1], chords: ['E7'] },
    ])
  })

  it('keeps rows it cannot read apart, merging only the same chord and scale text', () => {
    expect(lines([row('Cm7'), row('Xyz'), row('Cm7', 'C Dorain'), row('Xyz'), row('Cm7#5#9x'), row('Cm7', 'C Dorain')])).toEqual([
      { row: 0, rows: [0], chords: ['Cm7'] },
      { row: 1, rows: [1, 3], chords: ['Xyz'] },
      { row: 2, rows: [2, 5], chords: ['Cm7'] },
      { row: 4, rows: [4], chords: ['Cm7#5#9x'] },
    ])
  })
})

const FORM = [
  'title: T', 'key: C',
  'A1 | 1 | Dm7 | D Dorian', 'A1 | 2 | G7 | G Mixolydian',
  '@copy A1 A2 2', // straight after its source: folded, drawn once as A1 · A2
  'B | 5 | Dm7 | D Dorian', 'B | 6 | E7 | E Phrygian Dominant', 'B | 7 | Am7 | A Aeolian', 'B | 8 | G7 | G Mixolydian',
  '@ending 1 B 7 7', '@ending 2 B 8 8',
  '@copy A1 A3 8', // after B: written out, A3 (= A1)
].join('\n') + '\n'

describe('linePositions', () => {
  const doc = parseChart(FORM).value
  const rows = expandRowLines(doc).value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const lines = scaleLines(rows, (_, i) => res.get(i)?.scale ?? null)
  const at = chordPositions(doc)
  const of = (chord: string) => linePositions(lines.find((l) => l.chords.includes(chord))!, at)

  it('covers every drawn position of its chord and scale, in form order: the source, a 2nd ending, a written-out copy', () => {
    expect(of('Dm7')).toEqual(['A1:1:0', 'B:5:0', 'A3:9:0'])
    expect(of('G7')).toEqual(['A1:2:0', 'B:8:0', 'A3:10:0'])
  })
  it('lists each row on its line', () => {
    expect(lines.find((l) => l.chords.includes('Dm7'))!.rows).toEqual([0, 2, 4, 8]) // A2's row 2 is folded: no position
  })
  it('gives a line whose rows are all in a folded repeat no positions', () => {
    // two bars (a one-bar copy is written out, not folded); blank cells: A2's G7 goes on to Cm7, so it resolves to its own scale
    const d = parseChart('title: T\nkey: C\nA1 | 1 | Dm7\nA1 | 2 | G7\n@copy A1 A2 2\nB | 5 | Cm7\nB | 6 | Cm7\n').value
    const r = resolveScales(d, { level: 'standard', seed: 0 })
    expect([r.get(1)?.scale, r.get(3)?.scale]).toEqual(['G Mixolydian', 'G Phrygian Dominant'])
    const only = scaleLines(expandRowLines(d).value, (_, i) => r.get(i)?.scale ?? null).find((l) => l.rows.includes(3))!
    expect(only.rows).toEqual([3]) // the copy's row alone
    expect(linePositions(only, chordPositions(d))).toEqual([])
  })
})

describe('chord picks on the Scales sheet (#303)', () => {
  const doc = parseChart(FORM).value
  const rows = expandRows(doc).value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const at = chordPositions(doc)
  const targets = pickTargets(doc, res)
  const PENT = { preset: 'pentatonic', degree: 'auto' } as const
  const staves = (picks: ChordPicks, practice: PracticeSelection = PENT, part = CONCERT) =>
    buildSheet(rows, part, 'root', 'C', 12, practice, undefined, res, { picks, at })[0]!.pages.flat()
  const dm = (s: readonly StaffModel[]) => s[0]! // lines in order of first appearance: Dm7 first
  const g7 = (s: readonly StaffModel[]) => s[1]!

  it('lists the positions it covers and its concert source', () => {
    expect(rows.length).toBe(expandRowLines(doc).value.length)
    expect(dm(staves(NO_PICKS))).toMatchObject({ positions: ['A1:1:0', 'B:5:0', 'A3:9:0'], varies: false, source: { chord: 'Dm7', scale: res.get(0)?.scale } })
    expect(g7(staves(NO_PICKS))).toMatchObject({ positions: ['A1:2:0', 'B:8:0', 'A3:10:0'], source: { chord: 'G7', scale: 'G Mixolydian' } }) // a 2nd ending and a written-out copy
    expect(dm(staves(NO_PICKS, PENT, TENOR)).source).toEqual({ chord: 'Dm7', scale: 'D Dorian' })
  })
  it('takes its first position’s pick', () => {
    const picks = withPick(NO_PICKS, 'pentatonic', ['A1:1:0'], 4, targets) // Em
    expect(dm(staves(picks)).pentatonic).toMatchObject({ name: 'Em', picked: true, sheet: 'Dm' })
    expect(dm(staves(picks)).selected).toEqual(dm(staves(NO_PICKS, { preset: 'pentatonic', degree: 2 })).selected) // Em is on the 2 of D Dorian
  })
  it('varies where its positions’ picks differ (a pick and none count as different)', () => {
    const picks = withPick(NO_PICKS, 'pentatonic', ['B:5:0'], 4, targets)
    const s = dm(staves(picks))
    expect([s.pentatonic?.name, s.pentatonic?.picked, s.varies]).toEqual(['Dm', false, true]) // first position A1:1:0 has none
    expect(dm(staves(withPick(picks, 'pentatonic', ['A1:1:0'], 9, targets))).varies).toBe(true) // two different picks
  })
  it('does not vary when every position has the same pick', () => {
    expect(dm(staves(withPick(NO_PICKS, 'pentatonic', ['A1:1:0', 'B:5:0', 'A3:9:0'], 4, targets))).varies).toBe(false)
  })
  it('ignores a stale pick and the other kind’s picks', () => {
    expect(dm(staves({ pentatonic: { 'A1:1:0': { pc: 4, for: 'Dm7|D Aeolian' } }, hexatonic: {} })).pentatonic?.picked).toBe(false)
    expect(dm(staves({ pentatonic: { 'B:5:0': { pc: 4, for: 'Dm7|D Aeolian' } }, hexatonic: {} })).varies).toBe(false) // stale: counts as none
    expect(dm(staves(withPick(NO_PICKS, 'hexatonic', ['A1:1:0'], [0, 2], targets))).varies).toBe(false)
  })
  it('applies a hexatonic pick under the Hexatonic preset', () => {
    const s = dm(staves(withPick(NO_PICKS, 'hexatonic', ['A1:1:0', 'B:5:0', 'A3:9:0'], [5, 7], targets), { preset: 'hexatonic', pair: 0, grouping: 'triads' }))
    expect(s.hexatonic).toMatchObject({ name: 'F/G', picked: true })
    expect(s.varies).toBe(false)
    const one = dm(staves(withPick(NO_PICKS, 'hexatonic', ['B:5:0'], [5, 7], targets), { preset: 'hexatonic', pair: 0, grouping: 'triads' }))
    expect([one.hexatonic?.picked, one.varies]).toEqual([false, true])
  })
  it('does not vary for a hexatonic pick whose roots are not among the staff’s pairs (it plays the sheet’s pair)', () => {
    const HEX = { preset: 'hexatonic', pair: 0, grouping: 'triads' } as const
    const one = dm(staves(withPick(NO_PICKS, 'hexatonic', ['B:5:0'], [1, 3], targets), HEX))
    expect([one.hexatonic?.picked, one.varies]).toEqual([false, false])
    const mixed = dm(staves(withPick(withPick(NO_PICKS, 'hexatonic', ['A1:1:0'], [1, 3], targets), 'hexatonic', ['B:5:0', 'A3:9:0'], [5, 7], targets), HEX))
    expect([mixed.hexatonic?.name, mixed.hexatonic?.picked, mixed.varies]).toEqual([dm(staves(NO_PICKS, HEX)).hexatonic?.name, false, true]) // the damaged one counts as none
  })
  it('keeps the sounding pick on a B♭ part', () => {
    expect(dm(staves(withPick(NO_PICKS, 'pentatonic', ['A1:1:0'], 4, targets), PENT, TENOR)).pentatonic).toMatchObject({ name: 'F♯m', picked: true })
    expect(dm(staves(withPick(NO_PICKS, 'hexatonic', ['A1:1:0'], [5, 7], targets), { preset: 'hexatonic', pair: 0, grouping: 'triads' }, TENOR)).hexatonic).toMatchObject({ name: 'G/A', picked: true })
  })
  it('without picks or positions, staves have positions [] and varies false; error staves too', () => {
    const s = buildSheet(rows, CONCERT, 'root', 'C', 12, PENT, undefined, res)[0]!.pages.flat()
    expect(s.every((x) => x.positions.length === 0 && !x.varies && x.source !== null)).toBe(true)
    const bad = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Xyz\n').value
    const br = resolveScales(bad, { level: 'standard', seed: 0 })
    const err = buildSheet(expandRows(bad).value, CONCERT, 'root', 'C', 12, PENT, undefined, br, { picks: NO_PICKS, at: chordPositions(bad) })[0]!.pages.flat()
    expect(err.map((x) => [x.error !== null, x.positions, x.varies, x.source])).toEqual([[false, ['A:1:0'], false, { chord: 'Dm7', scale: 'D Dorian' }], [true, ['A:2:0'], false, null]])
  })
  it('gives a staff whose rows are all in a folded repeat no positions and no varies', () => {
    const d = parseChart('title: T\nkey: C\nA1 | 1 | Dm7\nA1 | 2 | G7\n@copy A1 A2 2\nB | 5 | Cm7\nB | 6 | Cm7\n').value
    const r = resolveScales(d, { level: 'standard', seed: 0 })
    const picks = withPick(NO_PICKS, 'pentatonic', ['A1:2:0'], 2, pickTargets(d, r))
    const s = buildSheet(expandRows(d).value, CONCERT, 'root', 'C', 12, PENT, undefined, r, { picks, at: chordPositions(d) })[0]!.pages.flat()
    const copy = s.find((x) => x.scale?.name === 'Phrygian Dominant')!
    expect([copy.positions, copy.varies, copy.pentatonic?.picked]).toEqual([[], false, false])
  })
})

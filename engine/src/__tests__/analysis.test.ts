import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse, applyAnalysis, parseKey, pins, refreshAnalysis } from '../analysis'
import { keyText, makeKey, tonicName } from '../analysis/keys'
import { hiddenDominant, passingReason } from '../analysis/rules'
import { familyOf } from '../analysis/stream'
import { chordTokens } from '../chord'
import { type ChartDoc, expandRowLines, formPart, parseChart, serializeChart } from '../chart'
import { setMeta } from '../edit'
import { scaleAtLevel } from '../levels'
import { CONCERT, writtenScale } from '../part'
import { parseRoot, pcOf } from '../pitch'
import { readChord, resolveQuality } from '../qualities'
import { transposeChart } from '../transpose'
import { isSyncCopy } from '../util'

describe('analyse', () => {
  it('analyses a document once: the sheets, the notes and the grid share the result', () => {
    const doc = parseChart('key: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n').value
    expect(analyse(doc)).toBe(analyse(doc))
    expect(analyse(parseChart('key: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n').value)).not.toBe(analyse(doc)) // by revision, not by text
  })
})

describe('keyText', () => {
  it('drops the " major" suffix but keeps " minor"', () => {
    expect(keyText(makeKey(parseRoot('C'), false))).toBe('C')
    expect(keyText(makeKey(parseRoot('A'), true))).toBe('A minor')
    expect(keyText(makeKey(parseRoot('Bb'), false))).toBe('Bb')
  })

  it('tonicName: the tonic as written', () => {
    expect(tonicName(makeKey(parseRoot('Bb'), true))).toBe('Bb')
    expect(tonicName(makeKey(parseRoot('F#'), false))).toBe('F#')
  })
})

/** a chart from `key` and `bar chord` pairs: "1 Dm7, 2 G7, 3 CMaj7" */
const chart = (key: string, rows: string, extra = ''): string =>
  `title: T\n${key ? `key: ${key}\n` : ''}${extra}section: A\n` +
  rows
    .split(',')
    .map((r) => r.trim().split(/\s+/))
    .map(([bar, chord]) => `${bar} | ${chord}`)
    .join('\n') +
  '\n'

/** each analysed row with its keys: "bar chord" and, for a chart of several sections, "section bar chord" */
function sectioned(text: string) {
  const doc = parseChart(text).value
  const rows = expandRowLines(doc).value
  return analyse(doc).rows.map((r) => ({ r, keys: [`${r.bar} ${r.chord}`, `${rows[r.row]?.section} ${r.bar} ${r.chord}`] }))
}
const findRow = (text: string, barChord: string) => sectioned(text).find((x) => x.keys.includes(barChord))?.r
/** "G7: G Altered (D1)" for every row, or just the chord asked for */
function verdicts(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { r, keys } of sectioned(text)) for (const k of keys) out[k] ??= `${r.scale} (${r.rule})`
  return out
}
const verdict = (text: string, barChord: string): string | undefined => verdicts(text)[barChord]
const library = (name: string): string => readFileSync(`charts/${name}.txt`, 'utf8')

describe('analysis: dominants (§7.1)', () => {
  it('D1 the symbol pins it: 7alt is Altered anywhere', () => {
    expect(verdict(chart('C', '1 Dm7, 2 G7alt, 3 CMaj7'), '2 G7alt')).toBe('G Altered (D1)')
  })

  it('D2 a tritone substitute is Lydian Dominant', () => {
    expect(verdict(chart('C', '1 Dm7, 2 Db7, 3 CMaj7'), '2 Db7')).toBe('Db Lydian Dominant (D2)')
  })

  it('D2 not into a half-diminished chord: Fm7 Bb7 | Am7b5 is the ii–V of Eb (Autumn Leaves)', () => {
    expect(verdict(chart('Gm', '1 Fm7, 1 Bb7, 2 Am7b5, 3 D7, 4 Gm'), '1 Bb7')).toBe('Bb Mixolydian (D4)')
  })

  it('D3 an extended dominant is Mixolydian (the Rhythm Changes bridge)', () => {
    const v = verdicts(chart('Bb', '1 D7, 3 G7, 5 C7, 7 F7, 9 BbMaj7'))
    expect([v['1 D7'], v['3 G7'], v['5 C7'], v['7 F7']]).toEqual(['D Mixolydian (D3)', 'G Mixolydian (D3)', 'C Mixolydian (D3)', 'F Mixolydian (D4)'])
  })

  it('D8 a chain into a minor chord takes that key, last link included (Stella)', () => {
    const v = verdicts(chart('Bb', '1 Am7b5, 2 D7b9, 3 G7#5, 5 Cm7, 7 F7, 8 BbMaj7'))
    expect([v['2 D7b9'], v['3 G7#5']]).toEqual(['D Phrygian Dominant (D8)', 'G Altered (D1+D8)'])
  })

  it('D4 V7 of a minor key is Phrygian Dominant (decision 1)', () => {
    expect(verdict(chart('Gm', '1 Am7b5, 2 D7, 3 Gm'), '2 D7')).toBe('D Phrygian Dominant (D4)')
  })

  it('D4 V7/ii in major is Mixolydian b6 (decision 2)', () => {
    expect(verdict(chart('F', '1 FMaj7, 2 D7, 3 Gm7, 4 C7'), '2 D7')).toBe('D Mixolydian b6 (D4)')
  })

  it('D4 a 13b9 keeps its natural 13: Half-Whole', () => {
    expect(verdict(chart('Gm', '1 Am7b5, 2 D13b9, 3 Gm'), '2 D13b9')).toBe('D Half-Whole Diminished (D1+D4)')
  })

  it('D4 a #5 is Whole Tone where the 9 is in the key, Altered where the b9 is', () => {
    expect(verdict(chart('C', '1 Dm7, 2 G7#5, 3 CMaj7'), '2 G7#5')).toBe('G Whole Tone (D1+D4)')
    expect(verdict(chart('Cm', '1 Dm7b5, 2 G7#5, 3 Cm7'), '2 G7#5')).toBe('G Altered (D1+D4)')
  })

  it('D4 V7 of the chord before it (Autumn Leaves bar 27, decision 3)', () => {
    expect(verdict(chart('Gm', '1 Gm, 2 D7/F#, 3 Fm7, 3 Bb7, 4 EbMaj7'), '2 D7/F#')).toBe('D Phrygian Dominant (D4)')
  })

  it('§7.5 a passing ii–V is its own key: Mixolydian', () => {
    const v = verdicts(chart('Gm', '1 Cm7, 2 F7, 3 Bm7, 3 E7, 4 Bbm7, 4 Eb7, 5 Am7b5, 6 D7, 7 Gm'))
    expect([v['3 E7'], v['4 Eb7']]).toEqual(['E Mixolydian (D4)', 'Eb Mixolydian (D4)'])
  })

  it('§7.5 an implied target in the key makes a secondary dominant (Cm7 F7 in Eb is V7/V)', () => {
    expect(analyse(parseChart(chart('Eb', '1 EbMaj7, 3 Cm7, 4 F7, 5 Fm7, 6 Bb7')).value).rows.find((r) => r.chord === 'F7')?.fn).toBe('V7/V in Eb (the V never arrives)')
  })

  it('D5 the back door is Lydian Dominant (Lady Bird)', () => {
    expect(verdict(chart('C', '1 CMaj7, 3 Fm7, 4 Bb7, 5 CMaj7, 7 Dm7, 8 G7'), '4 Bb7')).toBe('Bb Lydian Dominant (D5)')
  })

  it('D5 IV7 of a blues is Mixolydian, I7 Mixolydian, both D5 (R2)', () => {
    const v = verdicts(library('f-blues'))
    expect([v['1 F7'], v['2 Bb7']]).toEqual(['F Mixolydian (D5)', 'Bb Mixolydian (D5)'])
    expect(analyse(parseChart(library('f-blues')).value).context).toBe('blues')
  })

  it('D6 a chromatic dominant that goes nowhere is Lydian Dominant (Killer Joe)', () => {
    expect(verdict(chart('C', '1 C7, 2 Bb7, 3 C7, 4 Bb7'), '2 Bb7')).toBe('Bb Lydian Dominant (D6)')
  })

  it('D7 a static dominant is its own mode', () => {
    expect(verdict(chart('C', '1 CMaj7, 3 E7, 7 CMaj7'), '3 E7')).toBe('E Mixolydian (D7)')
  })

  it('reads a symbol’s tensions', () => {
    expect(pins('13b9')).toEqual({ n9: 'b9', n13: '13' })
    expect(pins('7#5')).toEqual({ n11: '#11', n13: 'b13' })
    expect(pins('7(#9)')).toEqual({ n9: 'b9#9', n11: '#11' })
    expect(pins('9#11')).toEqual({ n9: '9', n11: '#11', n13: '13' })
    expect(pins('7#11')).toEqual({ n9: '9', n11: '#11', n13: '13' }) // Lydian Dominant, whatever the key
    expect(pins('7b9#11')).toEqual({ n9: 'b9', n11: '#11', n13: '13' })
    expect(pins('7')).toEqual({})
  })
})

describe('analysis: the other families (§7.2–7.6)', () => {
  it('M1–M4 major chords: tonic Ionian, IV Lydian, bIII of minor Ionian, #11 Lydian', () => {
    const v = verdicts(chart('C', '1 CMaj7, 2 FMaj7, 3 Dm7, 4 G7, 5 CMaj7#11'))
    expect([v['1 CMaj7'], v['2 FMaj7'], v['5 CMaj7#11']]).toEqual(['C Ionian (M3)', 'F Lydian (M4)', 'C Lydian (M1)'])
    expect(verdict(chart('Gm', '1 Cm7, 2 F7, 3 BbMaj7, 4 EbMaj7, 5 Am7b5, 6 D7, 7 Gm'), '3 BbMaj7')).toBe('Bb Ionian (M3)')
  })

  it('m1–m8 minor chords', () => {
    const v = verdicts(chart('C', '1 CMaj7, 2 Am7, 3 Dm7, 4 G7, 5 Em7, 6 Fm6, 7 CmMaj7'))
    expect([v['2 Am7'], v['3 Dm7'], v['5 Em7'], v['6 Fm6'], v['7 CmMaj7']]).toEqual([
      'A Aeolian (m7)', // vi: the b13 is in the key
      'D Dorian (m4)', // related ii
      'E Phrygian (m9)', // iii (R4)
      'F Dorian (m2)',
      'C Melodic Minor (m1)',
    ])
    expect(verdict(chart('Gm', '1 Am7b5, 2 D7, 3 Gm'), '3 Gm')).toBe('G Dorian (m5)')
    expect(verdict(chart('Gm', '1 Gm, 2 Dm7, 3 Gm'), '2 Dm7')).toBe('D Phrygian (m7)') // v of a minor key
  })

  it('h2 half-diminished: Locrian, in a modal chart too (Footprints; h1 is gone, R6)', () => {
    expect(verdict(chart('Gm', '1 Am7b5, 2 D7, 3 Gm'), '1 Am7b5')).toBe('A Locrian (h2)')
    expect(analyse(parseChart(library('footprints')).value).context).toBe('modal')
    expect(verdict(library('footprints'), 'A 9 F#m7b5')).toBe('F# Locrian (h2)')
  })

  it('d1 diminished: a vii°7 is Diatonic Diminished (R3b)', () => {
    expect(verdict(chart('Bb', '1 BbMaj7, 2 Bdim7, 3 Cm7, 4 F7'), '2 Bdim7')).toBe('B Diatonic Diminished (d1)')
  })

  it('s1–s3 sus chords', () => {
    expect(verdict(chart('C', '1 DbMaj7/C, 3 CMaj7'), '1 DbMaj7/C')).toBe('C Phrygian (s1)')
    expect(verdict(chart('C', '1 Dm7, 2 G7sus4, 3 CMaj7'), '2 G7sus4')).toBe('G Mixolydian (s2)')
    expect(verdict(chart('', '1 D7sus4, 5 F7sus4, 9 D7sus4, 13 F7sus4'), '1 D7sus4')).toBe('D Mixolydian (s3)')
  })
})

describe('reasons from the sources (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md R3a, R6)', () => {
  /** "A Aeolian (m7): vi: …" for the chord asked for */
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = findRow(text, barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('d1 a vii°7 names the dominant it hides', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 C#dim7, 3 Dm7, 4 G7'), '2 C#dim7')).toBe('C# Diatonic Diminished (d1): vii°7 of Dm7: A7♭9 without its root')
  })

  it('d1 a passing °7 names the dominant it hides, past a related ii (Wave)', () => {
    expect(reasoned(chart('D', '1 DMaj7, 2 Bbdim7, 3 Am7, 3 D7'), '2 Bbdim7')).toBe("Bb Diatonic Diminished bVI (d1): passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)")
  })

  it('d1 a passing °7 whose hidden dominant is the next chord’s V', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 Edim7, 3 Dm7, 4 G7'), '2 Edim7')).toBe("E Whole-Half Diminished (d1): passing diminished: A7♭9 without its A, the Dm7's dominant; not functioning diatonically: the symmetric scale")
  })

  it('d1 an auxiliary °7 decorates the chord', () => {
    expect(reasoned(chart('C', '1 C7, 2 Cdim7, 3 C6'), '2 Cdim7')).toBe('C Diatonic Diminished I (d1): auxiliary diminished: it decorates the chord and returns to it')
  })

  it('d1 a passing °7 that hides no dominant of what follows', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 F#dim7, 3 FMaj7'), '2 F#dim7')).toBe('F# Whole-Half Diminished (d1): passing diminished: a rootless dominant ♭9; not functioning diatonically: the symmetric scale')
  })

  it('d1 R3b: the diatonic diminished scale by function, M&H figs. 7.22–7.34', () => {
    const scale = (key: string, rows: string, barChord: string) => verdict(chart(key, rows), barChord)
    expect(scale('C', '1 CMaj7, 2 C#dim7, 3 Dm7', '2 C#dim7')).toBe('C# Diatonic Diminished (d1)') // ascending
    expect(scale('Cm', '1 Cm, 2 Bdim7, 3 Cm', '2 Bdim7')).toBe('B Diatonic Diminished (d1)') // ascending, in a minor key too
    expect(scale('C', '1 Em7, 2 Ebdim7, 3 Dm7', '2 Ebdim7')).toBe('Eb Diatonic Diminished bIII (d1)') // passing on ♭3 (Q1a)
    expect(scale('D', '1 DMaj7, 2 Bbdim7, 3 Am7, 3 D7', '2 Bbdim7')).toBe('Bb Diatonic Diminished bVI (d1)') // passing on ♭6
    expect(scale('C', '1 Dm7, 2 G7, 3 Cdim7, 4 C6', '3 Cdim7')).toBe('C Diatonic Diminished I (d1)') // auxiliary on 1 (Q2a)
    expect(scale('C', '1 CMaj7, 2 Gdim7, 3 G7', '2 Gdim7')).toBe('G Diatonic Diminished V (d1)') // auxiliary on 5
  })

  it('d1 R3b: ♯IV°7 to the tonic, over its 5th or not, takes fig. 7.13’s scale', () => {
    expect(reasoned(chart('C', '1 FMaj7, 2 F#dim7, 3 C/G, 4 G7'), '2 F#dim7')).toBe("F# Diatonic Diminished #IV (d1): ♯IV°7 to I over its 5th: B7♭9 without its root, the ♯II°7's notes")
    expect(reasoned(chart('Bb', '1 Bb7, 2 Eb7, 2 Edim7, 3 Bb7, 4 G7'), '2 Edim7')).toBe("E Diatonic Diminished #IV (d1): ♯IV°7 to I: A7♭9 without its root, the ♯II°7's notes") // blues bar 6, fig. 7.15
  })

  it('d1 R3b: a °7 a half step below the next chord’s bass ascends to it (♯II°7 to I/3, fig. 7.9)', () => {
    expect(reasoned(chart('Ab', '1 Bbm7, 2 Bdim7, 3 Ab/C, 4 Bbm7'), '2 Bdim7')).toBe('B Diatonic Diminished (d1): vii°7 to Ab/C, up to its bass: G7♭9 without its root')
    expect(verdict(chart('Bb', '1 Cm7, 2 Dbdim7, 3 Bb/D, 4 Cm7'), '2 Dbdim7')).toBe('C# Diatonic Diminished (d1)')
  })

  it('d1 R16: a °7 a half step below the next chord’s root ascends to it, whatever its bass', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 C#dim7, 3 Dm7/A, 4 G7'), '2 C#dim7')).toBe('C# Diatonic Diminished (d1): vii°7 of Dm7/A: A7♭9 without its root')
    expect(reasoned(chart('C', '1 Dm7, 2 Bdim7, 3 C/G, 4 G7'), '2 Bdim7')).toBe('B Diatonic Diminished (d1): vii°7 of C/G: G7♭9 without its root') // vii°7 to I6/4
  })

  it('d1 R16: the bass reading still holds, and ♯IV°7 to I is tested first', () => {
    expect(reasoned(chart('C', '1 Em7, 2 D#dim7, 3 C/E, 4 FMaj7'), '2 D#dim7')).toBe('D# Diatonic Diminished (d1): vii°7 to C/E, up to its bass: B7♭9 without its root') // ♯II°7 to I/3 (Q6)
    expect(verdict(chart('C', '1 FMaj7, 2 F#dim7, 3 C/G, 4 G7'), '2 F#dim7')).toBe('F# Diatonic Diminished #IV (d1)') // fig. 7.13, not vii°7 of G
    expect(reasoned(chart('Cm', '1 Fm7, 2 F#dim7, 3 Cm/G, 4 G7'), '2 F#dim7')).toBe('F# Diatonic Diminished (d1): vii°7 to Cm/G, up to its bass: D7♭9 without its root') // in a minor key, no ♯IV°7 figure
  })

  it('d1 R7: a Q5 comment past the chart-comment limit drops the "(X its ii)" aside, and any comment is cut to fit', () => {
    const text = chart('Bb', '1 Bb7, 2 Eb7, 2 Edim7, 3 Cm7, 3 F7, 4 Bb6')
    const saved = (t: string) => {
      const doc = parseChart(t).value
      return parseChart(serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'none', save: true, date: '2026-10-10' }).doc))
    }
    const bare = saved(text)
    expect(bare.diagnostics).toEqual([])
    expect(bare.value.lines.find((l) => l.kind === 'row' && l.chord === 'Edim7')).toMatchObject({ comment: "passing diminished: C7♭9 without its C, the F7's dominant; not functioning diatonically: the symmetric scale" })
    // a written scale the rules disagree with wraps the reason ("≠ rules: …"): still within the limit
    const differs = saved(text.replace('2 | Edim7', '2 | Edim7 | E Diatonic Diminished #IV'))
    expect(differs.diagnostics).toEqual([])
    const comment = differs.value.lines.find((l) => l.kind === 'row' && l.chord === 'Edim7')
    expect(comment).toMatchObject({ scale: 'E Diatonic Diminished #IV', comment: expect.stringMatching(/^≠ rules: E Whole-Half Diminished \(passing diminished: .*…\)$/) })
    for (const name of ['body-and-soul', 'rhythm-changes']) expect(parseChart(library(name)).diagnostics, name).toEqual([])
    expect(verdict(library('body-and-soul'), 'B 6 Ebdim7')).toBe('Eb Whole-Half Diminished (d1)')
    expect(verdict(library('rhythm-changes'), 'A2 6 Edim7')).toBe('E Whole-Half Diminished (d1)')
  })

  it('d1 R9: a °7’s scale root is spelled by the project rule, on the concert sheet too (no double accidental, no B♯ E♯ C♭ F♭)', () => {
    const ugly = (n: { letter: number; acc: number }) => Math.abs(n.acc) > 1 || (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3))
    const cases: [string, string, string][] = [
      ['below-zero', 'B 6 Ebdim7', 'D# Diatonic Diminished'],
      ['meditation', 'A 6 Ebdim7', 'D# Diatonic Diminished'],
      ['meditation', 'C 6 Ebdim7', 'D# Diatonic Diminished'],
      ['slow-boat-to-china', 'A1 4 Dbdim7', 'C# Diatonic Diminished'],
      ['slow-boat-to-china', 'A2 4 Dbdim7', 'C# Diatonic Diminished'],
      ['all-the-things-you-are', 'C 8 Bdim7', 'B Diatonic Diminished'], // ♭III°7 lettered as ♯II°7 (fig. 7.22's pitches)
      ['baubles-bangles-and-beads', 'A 4 Bdim7', 'B Diatonic Diminished'],
      ['our-delight', 'A1 7 Bdim7', 'B Diatonic Diminished'],
      ['our-delight', 'A2 7 Bdim7', 'B Diatonic Diminished'],
      ['our-delight', 'A3 7 Bdim7', 'B Diatonic Diminished'],
      ['body-and-soul', 'A1 4 Edim7', 'E Diatonic Diminished'],
      ['body-and-soul', 'A2 4 Edim7', 'E Diatonic Diminished'],
      ['body-and-soul', 'C 4 Edim7', 'E Diatonic Diminished'],
    ]
    for (const [name, barChord, want] of cases) {
      const scale = verdict(library(name), barChord)?.replace(/ \(d1\)$/, '') ?? ''
      expect(scale, `${name} ${barChord}`).toBe(want)
      expect(writtenScale(CONCERT, scale).notes.filter(ugly), `${name} ${barChord}`).toEqual([])
    }
    // the chord symbol follows its scale's spelling where they share a root (CLAUDE.md)
    expect(chordTokens(CONCERT, 'Ebdim7', 'D# Diatonic Diminished')).toEqual([{ kind: 'text', text: 'D' }, { kind: 'acc', acc: '#' }, { kind: 'text', text: 'dim7' }])
    // a C♭ root never reaches a scale it can't spell
    expect(verdict(chart('C', '1 CMaj7, 2 Cbdim7, 3 Cm7'), '2 Cbdim7')).toBe('B Diatonic Diminished (d1)')
  })

  it('d1 R3b: a °7 the figures don’t cover is not functioning diatonically: Whole-Half (Q5)', () => {
    const q5 = (key: string, rows: string, barChord: string) => reasoned(chart(key, rows), barChord)
    expect(q5('C', '1 FMaj7, 2 Fdim7, 3 FMaj7', '2 Fdim7')).toBe('F Whole-Half Diminished (d1): auxiliary diminished: it decorates the chord and returns to it; not functioning diatonically: the symmetric scale') // auxiliary on 4
    expect(q5('Cm', '1 Cm7, 2 Cdim7, 3 Cm7', '2 Cdim7')).toBe('C Whole-Half Diminished (d1): auxiliary diminished: it decorates the chord and returns to it; not functioning diatonically: the symmetric scale') // in a minor key
    expect(q5('Cm', '1 Fm7, 2 Ebdim7, 3 Dm7b5, 4 G7', '2 Ebdim7')).toMatch(/^Eb Whole-Half Diminished \(d1\): passing diminished: .*; not functioning diatonically: the symmetric scale$/) // passing in a minor key
  })

  it('d1 R3b: Wave bar 2 is the ♭VI°7 scale at Standard, Whole-Half at Advanced', () => {
    expect(verdict(library('wave'), 'A1 2 Bbdim7')).toBe('Bb Diatonic Diminished bVI (d1)')
    expect(scaleAtLevel('Bbdim7', 'advanced', 0, '', 'Bb Diatonic Diminished bVI')).toBe('Bb Whole-Half Diminished')
  })

  it('m7 vi and v of a minor key: the avoid note is a passing note, not "in the key"', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 Am7, 3 FMaj7'), '2 Am7')).toBe("A Aeolian (m7): vi: Aeolian, the key's own notes (the ♭6 is a passing note)")
    expect(reasoned(chart('Gm', '1 Gm, 2 Dm7, 3 Gm'), '2 Dm7')).toBe("D Phrygian (m7): v of a minor key: Phrygian, the key's own notes (its ♭2 is a passing note)")
  })

  it('h2 the iiø7 of a minor ii–V: its ♭2 is a passing note', () => {
    expect(reasoned(chart('Gm', '1 Am7b5, 2 D7, 3 Gm7'), '1 Am7b5')).toBe("A Locrian (h2): iiø7 of G minor: Locrian, the key's own notes (its ♭2 is a passing note)")
  })

  it('m5 prints no note to the plan', () => {
    expect(reasoned(chart('Gm', '1 Am7b5, 2 D7, 3 Gm'), '3 Gm')).toBe('G Dorian (m5): tonic minor: Dorian by convention')
  })

  it('s2 a resolving sus: the 4th is a chord tone; the derived ♭6 stays', () => {
    expect(reasoned(chart('C', '1 Dm7, 2 G7sus4, 3 CMaj7'), '2 G7sus4')).toBe('G Mixolydian (s2): V7sus4 resolving down a fifth: Mixolydian, the 4th is a chord tone here')
    expect(reasoned(chart('Cm', '1 Dm7b5, 2 G7sus4, 3 Cm7'), '2 G7sus4')).toMatch(/^G Mixolydian b6 \(s2\): /)
  })

  it('chord_scales.json: Aeolian on a minor chord is for vi, or a written ♭6 (iv is Dorian)', () => {
    const json = JSON.parse(readFileSync('chord_scales.json', 'utf8')) as { qualities: Record<string, { scale: string; note?: string }[]> }
    for (const q of ['m', 'm7']) expect(json.qualities[q]?.find((o) => o.scale === 'Aeolian')?.note).toBe('when the chord is vi, or the symbol has a ♭6')
  })
})

describe('hiddenDominant (R3a): the V7♭9 a °7 is, without its root', () => {
  const at = (chord: string) => {
    const r = readChord(chord)
    if (!r) throw new Error(chord)
    return { chord, root: r.root, pc: pcOf(r.root), family: familyOf(r.quality), quality: r.quality }
  }

  it('Wave: Bb°7 → Am7 D7 hides A7♭9, the D7’s dominant, not E7♭9', () => {
    expect(hiddenDominant(at('Bbdim7').pc, at('Am7'), at('D7'))).toEqual({ root: 'A', target: 'D7', ii: 'Am7' })
  })

  it('C#°7 → Dm7 hides A7♭9', () => {
    expect(hiddenDominant(at('C#dim7').pc, at('Dm7'), at('G7'))).toEqual({ root: 'A', target: 'Dm7' })
  })

  it('spells the dominant a fifth above its target', () => {
    expect(hiddenDominant(at('Ddim7').pc, at('Ebm7'), at('Ab7'))).toEqual({ root: 'Bb', target: 'Ebm7' })
  })

  it('no match: null, and the fallback reason', () => {
    expect(hiddenDominant(at('F#dim7').pc, at('FMaj7'), at('Dm7'))).toBeNull()
    expect(hiddenDominant(at('F#dim7').pc, undefined, undefined)).toBeNull()
    expect(passingReason(null)).toBe('passing diminished: a rootless dominant ♭9')
    expect(passingReason({ root: 'A', target: 'D7', ii: 'Am7' })).toBe("passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)")
  })
})

describe('R1: a IV reached by its own dominant is Ionian (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = findRow(text, barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('V7/IV → IV: Ionian, M3 (Stella bars 5–7)', () => {
    expect(reasoned(library('stella-by-starlight'), 'A 7 EbMaj7')).toBe('Eb Ionian (M3): the Bb7 before it makes Eb the key of the moment: the 4th is in the key')
    expect(reasoned(chart('Bb', '5 Fm7, 6 Bb7, 7 EbMaj7, 8 Ab7, 9 BbMaj7'), '7 EbMaj7')).toBe('Eb Ionian (M3): the Bb7 before it makes Eb the key of the moment: the 4th is in the key')
  })

  it('V7/IV → IV: Ionian (Moment’s Notice bars 10–11 and 26–27)', () => {
    expect([verdict(library('moments-notice'), 'A1 11 AbMaj7'), verdict(library('moments-notice'), 'A2 11 AbMaj7')]).toEqual(['Ab Ionian (M3)', 'Ab Ionian (M3)'])
  })

  it('subV7/IV → IV: Ionian (E7 is a half step above Eb)', () => {
    expect(reasoned(chart('Bb', '1 BbMaj7, 2 E7, 3 EbMaj7, 4 F7, 5 BbMaj7'), '3 EbMaj7')).toBe('Eb Ionian (M3): the E7 before it makes Eb the key of the moment: the 4th is in the key')
  })

  it('a IV not so prepared stays Lydian (All the Things bar 5: DbMaj7 after AbMaj7)', () => {
    expect(verdict(library('all-the-things-you-are'), 'A1 5 DbMaj7')).toBe('Db Lydian (M4)')
    expect(verdict(chart('C', '1 CMaj7, 2 FMaj7, 3 Dm7, 4 G7, 5 CMaj7'), '2 FMaj7')).toBe('F Lydian (M4)')
  })

  it('a # keep: Eb Lydian row stays Lydian', () => {
    const text = 'title: T\nkey: Bb\n\nsection: A\n1 | Fm7\n2 | Bb7\n3 | EbMaj7 | Eb Lydian  # keep: the melody\n4 | BbMaj7\n'
    const doc = parseChart(text).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'strip', save: false, date: '2026-10-10' }).doc)
    expect(out).toContain('Eb Lydian  # keep: the melody')
  })
})

describe('R2: the blues I7 and IV7 by D5 before D3 (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = findRow(text, barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }
  const fJazzBlues = library('f-jazz-blues')

  it('I7 of the blues is D5, not an extended dominant (F Jazz Blues bar 1)', () => {
    expect(reasoned(fJazzBlues, '1 F7')).toBe('F Mixolydian (D5): I7 of the blues: a tonic with dominant colour, natural tensions')
  })

  it('IV7 of the blues is Mixolydian, D5 (F Jazz Blues bar 5)', () => {
    expect(reasoned(fJazzBlues, '5 Bb7')).toBe('Bb Mixolydian (D5): IV7 of the blues: a subdominant with dominant colour, Mixolydian (the #11 is an extra colour)')
  })

  it('a IV7 whose symbol moves it off Mixolydian drops the Mixolydian clause (Ab7#11 in an Eb blues)', () => {
    const text = chart('', '1 Eb7, 5 Ab7#11, 7 Eb7, 9 Bb7, 10 Ab7, 11 Eb7, 12 Bb7')
    expect(analyse(parseChart(text).value).context).toBe('blues')
    expect(reasoned(text, '5 Ab7#11')).toBe('Ab Lydian Dominant (D1+D5): IV7 of the blues: a subdominant with dominant colour; #11 from the symbol')
    expect(reasoned(library('blue-trane'), 'A 5 Ab7#11')).toBe('Ab Lydian Dominant (D1+D5): IV7 of the blues: a subdominant with dominant colour; #11 from the symbol')
  })

  it('an I7 whose symbol moves it names the symbol’s notes, not natural tensions (Eb7#9)', () => {
    expect(reasoned(library('blue-trane'), 'A 1 Eb7#9')).toBe('Eb Half-Whole Diminished (D1+D5): I7 of the blues: a tonic with dominant colour, b9, #9 and #11 from the symbol')
  })

  it('no I7 row of any library blues is reasoned by D3', () => {
    const files = readdirSync('charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    const blues = files.map((f) => [f, analyse(parseChart(readFileSync(`charts/${f}`, 'utf8')).value)] as const).filter(([, a]) => a.context === 'blues')
    expect(blues.map(([f]) => f)).toContain('f-jazz-blues.txt')
    const d3 = blues.flatMap(([f, a]) =>
      a.rows.filter((r) => { const c = readChord(r.chord); return c && c.quality === '7' && a.key && pcOf(c.root) === a.key.tonic && r.rule.includes('D3') }).map((r) => `${f} ${r.bar} ${r.chord}`),
    )
    expect(d3).toEqual([])
  })

  it('a stated function wins over R2: V7/IV on the blues I7 of bar 4 (principle 1)', () => {
    const text = fJazzBlues.replace(/^(4 +\| F7) +#.*$/m, '$1 | | V7/IV')
    expect(parseChart(text).diagnostics).toEqual([])
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === '4 F7')
    expect([r?.scale, r?.rule, r?.fn, r?.numeral, r?.stated]).toEqual(['F Mixolydian', 'D4', 'V7/IV in F', 'V7/IV', true])
    expect(r?.reason).toMatch(/^\* V7\/IV in F: /)
    expect(verdict(text, '1 F7')).toBe('F Mixolydian (D5)') // the unstated I7s keep R2
  })

  it('a stated function that names no target leaves R2 its degree: a stated I7 is still the blues I7', () => {
    const text = fJazzBlues.replace(/^(1 +\| F7) +#.*$/m, '$1 | | I7')
    expect(parseChart(text).diagnostics).toEqual([])
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === '1 F7')
    expect([r?.scale, r?.rule, r?.fn, r?.stated]).toEqual(['F Mixolydian', 'D5', 'I7 of the blues', true])
  })

  it('a # keep: Bb Lydian Dominant on the blues IV7 stays', () => {
    const text = fJazzBlues.replace(/^(5 +\| Bb7) +#.*$/m, '$1 | Bb Lydian Dominant  # keep: the melody')
    const doc = parseChart(text).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'strip', save: false, date: '2026-10-10' }).doc)
    expect(out).toMatch(/^5 +\| Bb7 +\| Bb Lydian Dominant +# keep: the melody$/m)
  })

  it('the 7 menu still lists Lydian Dominant', () => {
    expect(resolveQuality('C7')?.options.map((o) => o.scale)).toContain('C Lydian Dominant')
  })
})

describe('R4: iii7 is Phrygian, m9 (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const row = (text: string, barChord: string) => findRow(text, barChord)
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = row(text, barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('iii7 of a major key: Phrygian, the key\'s own notes', () => {
    expect(reasoned(chart('C', '1 Cmaj7, 2 Em7, 3 Am7, 4 Dm7, 5 G7'), '2 Em7')).toBe("E Phrygian (m9): iii: Phrygian, the key's own notes (the ♭2 is a passing note)")
  })

  it('iii7 as the related ii of the next dominant keeps Phrygian (m4 does not override a diatonic iii)', () => {
    const r = row(chart('C', '1 Cmaj7, 2 Em7, 3 A7, 4 Dm7'), '2 Em7')
    expect([r?.scale, r?.rule, r?.numeral]).toEqual(['E Phrygian', 'm9', 'iii7'])
  })

  it('chord_scales.json: Phrygian on a minor chord is for iii, or v of a minor key', () => {
    const json = JSON.parse(readFileSync('chord_scales.json', 'utf8')) as { qualities: Record<string, { scale: string; note?: string }[]> }
    for (const q of ['m', 'm7']) expect(json.qualities[q]?.find((o) => o.scale === 'Phrygian')?.note).toBe('iii, or v of a minor key')
  })

  it('a # keep: E Dorian on iii7 stays', () => {
    const text = 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | CMaj7\n2 | Em7 | E Dorian  # keep: the melody\n3 | Am7\n4 | Dm7\n5 | G7\n'
    const doc = parseChart(text).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'strip', save: false, date: '2026-10-10' }).doc)
    expect(out).toContain('E Dorian  # keep: the melody')
  })

  it('a ii of a ii–V stays Dorian (m4)', () => {
    expect(verdict(chart('C', '1 Cmaj7, 2 Dm7, 3 G7, 4 Cmaj7'), '2 Dm7')).toBe('D Dorian (m4)')
  })
})

describe('R6: the small bundle (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = findRow(text, barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('m2 a tonic minor sixth chord is Melodic Minor (A Night in Tunisia)', () => {
    expect(reasoned(library('a-night-in-tunisia'), '2 Dm6/9')).toBe('D Melodic Minor (m2): tonic minor sixth chord: melodic minor, the raised 7th is a tension')
    expect(reasoned(chart('Dm', '1 Eb7, 2 Dm6/9'), '2 Dm6/9')).toBe('D Melodic Minor (m2): tonic minor sixth chord: melodic minor, the raised 7th is a tension')
  })

  it('a # keep: D Dorian on a tonic m6 stays', () => {
    const text = 'title: T\nkey: Dm\n\nsection: A\nbars: 4\n1 | Eb7\n2 | Dm6 | D Dorian  # keep: the melody\n'
    const doc = parseChart(text).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'strip', save: false, date: '2026-10-10' }).doc)
    expect(verdict(text, '2 Dm6')).toBe('D Melodic Minor (m2)')
    expect(out).toContain('D Dorian  # keep: the melody')
  })

  it('m2 any other minor sixth chord is Dorian (Wave: iv6 in D)', () => {
    const wave = library('wave').replace(/^(A1 \| 6 +\| )Gm7 .*$/m, '$1Gm6')
    expect(reasoned(wave, '6 Gm6')).toBe('G Dorian (m2): a minor sixth chord: Dorian')
    expect(reasoned(chart('C', '1 CMaj7, 2 Fm6, 3 CMaj7'), '2 Fm6')).toBe('F Dorian (m2): a minor sixth chord: Dorian')
  })

  it('m2 a tonic minor sixth chord in a modal chart stays Dorian (§5.4: no functional rules there; Africa)', () => {
    expect(reasoned(library('africa'), 'A1 1 Dm6/9/E')).toBe('D Dorian (m2): a minor sixth chord: Dorian')
  })

  it('h2 a ø7 that is neither related nor diatonic is its own mode, not the key\'s notes (Footprints)', () => {
    const fp = findRow(library('footprints'), 'A 9 F#m7b5')
    expect([fp?.scale, fp?.rule, fp?.reason, fp?.fallback]).toEqual(['F# Locrian', 'h2', '#ivø7 in C minor: Locrian, its own mode (the chord is outside the key)', true])
    expect(reasoned(chart('C', '1 CMaj7, 2 F#m7b5, 3 FMaj7'), '2 F#m7b5')).toBe('F# Locrian (h2): #ivø7 in C: Locrian, its own mode (the chord is outside the key)')
    expect(reasoned(chart('C', '1 CMaj7, 2 Bm7b5, 3 CMaj7'), '2 Bm7b5')).toBe("B Locrian (h2): viiø7 in C: Locrian, the key's own notes (its ♭2 is a passing note)")
  })

  it('M3 ♭VII of a minor key is Ionian, the notes of the tonic’s Dorian; ♭VI stays Lydian (M4)', () => {
    const text = chart('Cm', '1 Cm7, 2 BbMaj7, 3 AbMaj7')
    expect(reasoned(text, '2 BbMaj7')).toBe('Bb Ionian (M3): ♭VII of C minor: B♭ major, the notes of C Dorian')
    expect(verdict(text, '3 AbMaj7')).toBe('Ab Lydian (M4)')
    expect(reasoned(chart('Fm', '1 Fm7, 2 EbMaj7, 3 DbMaj7'), '2 EbMaj7')).toBe('Eb Ionian (M3): ♭VII of F minor: E♭ major, the notes of F Dorian')
  })
})

describe('analysis: keys (§5)', () => {
  it('reads key: lines', () => {
    expect(['Eb', 'F#m', 'Bb minor', 'C-', 'NC'].map((k) => parseKey(k)?.name ?? null)).toEqual(['Eb major', 'F# minor', 'Bb minor', 'C minor', null])
  })

  it('scores the key when the chart doesn’t say (Autumn Leaves: G minor)', () => {
    const a = analyse(parseChart(library('autumn-leaves').replace(/^key:.*\n/m, '')).value)
    expect([a.key?.name, a.keyFrom]).toEqual(['G minor', 'scored'])
  })

  it('opens key areas from cadences, and the top of the form takes the turnaround’s key (Giant Steps)', () => {
    const a = analyse(parseChart(library('giant-steps')).value)
    expect(new Set(a.areas.map((x) => x.key.name))).toEqual(new Set(['Eb major', 'G major', 'B major']))
    expect(verdict(library('giant-steps'), 'A 1 BMaj7')).toBe('B Ionian (M3)')
  })

  it('a minor ii of the next ii–V opens no area (Bird Blues: G7 | Cm7 F7 is V7/V)', () => {
    expect(verdict(library('f-bird-blues'), 'A 3 G7')).toBe('G Mixolydian (D4)')
  })

  it('a cadence into the home tonic comes home (Long Ago and Far Away: C7 | FMaj7 after a bridge in C)', () => {
    expect(verdict(library('long-ago-and-far-away'), 'C 1 FMaj7')).toBe('F Ionian (M3)')
  })

  it('a section that starts on the home tonic is home again (Nardis: the last A after a bridge in C)', () => {
    expect(verdict(library('nardis'), 'A3 4 CMaj7')).toBe('C Lydian (M4)')
    expect(verdict(library('nardis'), 'B 7 CMaj7')).toBe('C Ionian (M3)') // the bridge's own C
  })

  it('in a minor key, a ii–V–I into a major chord opens its key (Bernie’s Tune’s bridge is in Bb)', () => {
    expect(verdict(library('bernies-tune'), 'B 3 G7')).toBe('G Mixolydian b6 (D4)') // V7/ii in Bb
    expect(verdict(library('autumn-leaves'), 'B 8 EbMaj7')).toBe('Eb Lydian (M4)') // a tritone cadence doesn't
  })

  it('in a major area, a ii–V that doesn’t land but implies a chord of home brings home back (Lady Bird bars 11–12)', () => {
    const rows = analyse(parseChart(library('lady-bird')).value).rows
    expect(rows.filter((r) => r.bar === '11' || r.bar === '12').map((r) => `${r.numeral} ${r.key.name}`)).toEqual(['vi7 C major', 'V7/V C major'])
    expect(verdict(library('whisper-not'), 'B 3 Gm')).toMatch(/^G Dorian/) // a minor area keeps its own reading, not v Phrygian
  })

  it('finds modal tunes', () => {
    for (const name of ['so-what', 'maiden-voyage', 'footprints']) expect(analyse(parseChart(library(name)).value).context, name).toBe('modal')
    expect(analyse(parseChart(library('stella-by-starlight')).value).context).toBe('functional')
  })
})

describe('analysis: intros and codas outside the form', () => {
  const text = 'title: T\nkey: C\n\nsection: Intro\nbars: 4\n1 | Dm7\n2 | G7\n\nsection: A\n1 | CMaj7\n2 | A7\n3 | Dm7\n4 | G7\n\nsection: Coda\nbars: 4\n1 | Db7\n2 | CMaj7\n'
  const rows = () => analyse(parseChart(text).value).rows

  it('an intro leads into bar 1, the form wraps to its own top, a coda follows the form and leads nowhere', () => {
    const fn = (section: number) => rows()[section]?.fn
    expect([fn(1), fn(5), fn(6), fn(7)]).toEqual(['V7 of C', 'V7 of C', 'subV7 of CMaj7', 'I in C'])
  })

  it('names them by section: Intro, Coda, Tag, Ending, with a number or not', () => {
    expect(['Intro', 'coda', 'Tag 2', 'Ending', 'A', 'Introduction', 'B2'].map(formPart)).toEqual(['before', 'after', 'after', 'after', 'form', 'form', 'form'])
  })
})

describe('analysis: numerals', () => {
  /** the numerals at bars named "section bar" */
  const numerals = (name: string, bars: readonly string[]) =>
    sectioned(library(name)).filter((x) => bars.some((b) => x.keys.includes(`${b} ${x.r.chord}`))).map(({ r }) => `${r.chord} ${r.numeral}`)

  it('name each chord’s degree and quality in its key area, and what a dominant or a ii leads to', () => {
    expect(numerals('rhythm-changes', ['A1 1', 'A1 2', 'B 1', 'B 3', 'B 5', 'B 7'])).toEqual(['Bb6 I6', 'G7b9 V7/ii', 'Cm7 ii7', 'F7 V7', 'D7 →', 'G7 →', 'C7 V7/V', 'F7 V7'])
    expect(numerals('stella-by-starlight', ['A 1', 'A 2', 'B 4', 'B 5', 'D 5', 'D 6'])).toEqual([
      'Em7b5 iiø7/iii', 'A7b9 V7/iii', 'Bbm7 iv7/V', 'Eb7 ♭VII7/V', 'FMaj7 Vmaj7', 'Cm7b5 iiø7', 'F7b9 V7',
    ])
    expect(numerals('autumn-leaves', ['A1 1', 'A1 2', 'A1 5', 'A1 6', 'A1 7', 'B 7', 'B 8'])).toEqual([
      'Cm7 ii7/♭III', 'F7 V7/♭III', 'Am7b5 iiø7', 'D7 V7', 'Gm i', 'Bm7 ii7/II', 'E7 subV7/♭VI', 'EbMaj7 ♭VImaj7',
    ])
  })
})

describe('analysis: writing it back (§12.1)', () => {
  const text = 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7 | G Bebop Dominant\n3 | CMaj7\n4 | Am7 | A Dorian  # keep: the melody\n'
  const run = (t: string, scales: 'strip' | 'none', save: boolean, date = '2026-10-08') => {
    const doc = parseChart(t).value
    return applyAnalysis(doc, analyse(doc), { scales, save, date })
  }
  const written = 'title: T\nkey: C\n\nsection: A\n1 | Dm7 | D Dorian\n2 | G7 | G Bebop Dominant\n3 | CMaj7 | C Ionian\n4 | Am7 | A Dorian  # keep: the melody\n'

  it('strips the written scales the rules reproduce, and lists the ones they do not', () => {
    const strip = run(written, 'strip', false)
    expect(strip.changes.map((c) => `${c.chord} ${c.from} -> ${c.to || '-'}`)).toEqual(['Dm7 D Dorian -> -', 'CMaj7 C Ionian -> -'])
    expect(strip.overrides.map((o) => `${o.bar} ${o.chord}: ${o.scale} / ${o.rules}`)).toEqual(['2 G7: G Bebop Dominant / G Mixolydian'])
    const out = serializeChart(strip.doc)
    expect(out).toContain('\n1 | Dm7\n')
    expect(out).toContain('G Bebop Dominant')
    expect(out).toContain('A Dorian  # keep: the melody')
  })

  it('strip keeps a spelling the rules write differently', () => {
    const strip = run('title: T\nkey: Db\n\nsection: A\nbars: 4\n1 | Ebm7 | D# Dorian\n2 | Ab7\n3 | DbMaj7\n', 'strip', false)
    expect(strip.changes).toEqual([])
    expect(strip.overrides.map((o) => `${o.scale} / ${o.rules}`)).toEqual(['D# Dorian / Eb Dorian'])
  })

  it('strip keeps a @copy source whose repeat the rules read otherwise, and lists the repeat', () => {
    const t = 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7 | G Mixolydian\n\nsection: B\ncopy: A\n\nsection: C\nbars: 4\n1 | Cm7\n3 | Ab7\n'
    const strip = run(t, 'strip', false)
    expect(strip.changes).toEqual([])
    expect(strip.overrides.map((o) => `${o.bar} ${o.chord}: ${o.scale} / ${o.rules}`)).toEqual(['2 G7: G Mixolydian / G Phrygian Dominant'])
  })

  it('strip leaves a chart of blank cells as it is', () => {
    expect(serializeChart(run(text, 'strip', false).doc)).toBe(serializeChart(parseChart(text).value))
  })

  it('saves reasons, marks where a written scale differs, and reruns as a no-op', () => {
    const saved = serializeChart(run(written, 'none', true).doc)
    expect(saved).toContain('# analysis: 2026-10-08, rules v1; C')
    expect(saved).toMatch(/Dm7\s+\| D Dorian\s+# ii of the ii–V to C\n/)
    expect(saved).toMatch(/G Bebop Dominant\s+# ≠ rules: G Mixolydian \(V7 of C: natural tensions\)/)
    expect(serializeChart(run(saved, 'none', true, '2027-01-01').doc)).toBe(saved) // same analysis: the old date stays
  })

  it('reports a @copy repeat whose analysis differs from its source row', () => {
    // the first G7 goes to the repeat's Dm7 (V7 in C, implied); the repeat's resolves to Cm7 (V7 of C minor)
    const t = 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n\nsection: B\ncopy: A\n\nsection: C\nbars: 4\n1 | Cm7\n3 | Ab7\n'
    expect(run(t, 'none', false).conflicts.map((c) => `${c.chord}: ${c.source} / ${c.copy}`)).toEqual(['G7: G Mixolydian / G Phrygian Dominant'])
    expect(serializeChart(run(t, 'none', true).doc)).toContain('the repeat at B bar 2 would be G Phrygian Dominant')
  })
})

describe('stated functions and @key (docs/superpowers/specs/2026-10-09-chart-functions-design.md)', () => {
  /** a chart from its rows (and section lines); one section A unless they start with their own */
  const lines = (key: string, rows: readonly string[]): string => `title: T\nkey: ${key}\n${rows[0]?.startsWith('section:') ? '' : 'section: A\n'}${rows.join('\n')}\n`
  const rowOf = (text: string, barChord: string) => analyse(parseChart(text).value).rows.find((r) => `${r.bar} ${r.chord}` === barChord)
  const C_TUNE = ['1 | CMaj7', '2 | D7', '3 | Dm7', '4 | G7', '5 | Am7', '6 | Dm7', '7 | G7', '8 | CMaj7']

  it('a stated target overrides the neighbour: D7 going nowhere, stated V7/V', () => {
    const plain = lines('C', C_TUNE)
    expect(verdict(plain, '2 D7')).toBe('D Mixolydian (D5)')
    expect(rowOf(plain, '2 D7')?.fallback).toBe(true)
    const r = rowOf(plain.replace('2 | D7', '2 | D7 | | V7/V'), '2 D7')
    expect([r?.scale, r?.rule, r?.numeral, r?.stated, r?.fallback]).toEqual(['D Mixolydian', 'D4', 'V7/V', true, undefined])
    expect(r?.reason).toBe('* V7/V in C: natural tensions')
  })

  it('a key prefix decides its row only, and opens no key area', () => {
    const plain = lines('D', ['1 | DMaj7', '2 | Em7', '3 | Bb7', '4 | DMaj7'])
    expect(verdict(plain, '3 Bb7')).toBe('Bb Lydian Dominant (D6)')
    const a = analyse(parseChart(plain.replace('3 | Bb7', '3 | Bb7 | | Db: V7/ii')).value)
    const r = a.rows.find((x) => x.chord === 'Bb7')
    expect([r?.scale, r?.rule, r?.statedKey?.name, r?.key.name]).toEqual(['Bb Mixolydian b6', 'D4', 'Db major', 'D major'])
    expect(a.areas.map((x) => x.key.name)).toEqual(['D major'])
  })

  it('subV7 and ♭VII7 reach their own rules', () => {
    const sub = lines('C', ['1 | CMaj7', '2 | Db7 | | subV7', '3 | Am7', '4 | Dm7', '5 | G7', '6 | CMaj7'])
    expect(verdict(sub, '2 Db7')).toBe('Db Lydian Dominant (D2)')
    const back = lines('C', ['1 | CMaj7', '2 | Bb7 | | ♭VII7', '3 | Am7', '4 | Dm7', '5 | G7', '6 | CMaj7'])
    expect(verdict(back, '2 Bb7')).toBe('Bb Lydian Dominant (D5)')
    expect(rowOf(back, '2 Bb7')?.fn).toBe('back door bVII7 to C')
  })

  it('the ii of a stated ii–V is named for its target', () => {
    const text = lines('C', ['1 | CMaj7', '2 | Am7 | | ii7/V', '3 | FMaj7', '4 | G7'])
    const r = rowOf(text, '2 Am7')
    expect([r?.scale, r?.rule, r?.fn]).toEqual(['A Dorian', 'm4', 'ii of the ii–V to G; also vi of C'])
  })

  it('a section’s key: states its key for that section', () => {
    const rows = ['section: A', '1 | EbMaj7', '2 | Cm7', 'section: B', 'key: D', '1 | DMaj7', '2 | Em7', '3 | DMaj7', 'section: C', 'key: Eb', '1 | EbMaj7', '2 | Fm7', '3 | Bb7']
    const text = lines('Eb', rows)
    const a = analyse(parseChart(text).value)
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.from}–${x.to} ${x.stated ? 'stated' : 'found'}`)).toEqual([
      'Eb major A 1–2 found',
      'D major B 1–3 stated',
      'Eb major C 1–3 stated',
    ])
    expect(verdict(text, 'B 1 DMaj7')).toBe('D Ionian (M3)')
    expect(a.problems).toEqual([])
  })

  it('a stated key reverts at its section’s end: the next section is found again', () => {
    const rows = ['section: A', 'key: D', '1 | DMaj7', '2 | Em7', '3 | A7', '4 | DMaj7', 'section: B', '1 | EbMaj7', '2 | Fm7', '3 | Bb7', '4 | EbMaj7']
    const a = analyse(parseChart(lines('Eb', rows)).value)
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.stated ? 'stated' : 'found'}`)).toEqual(['D major A stated', 'Eb major B found'])
  })

  it('an @key on a bar a chord is held through starts at that chord, and bars compare as numbers', () => {
    const rows = ['section: A', '1 | EbMaj7', '2 | Cm7', 'section: B', '1 | DMaj7', '@key 2 D', '3 | Em7', '4 | A7', '5 | DMaj7', 'section: C', '01 | EbMaj7', '@key 1 Eb', '2 | Fm7', '3 | Bb7']
    const a = analyse(parseChart(lines('Eb', rows)).value)
    expect(a.problems).toEqual([])
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.from}–${x.to} ${x.stated ? 'stated' : 'found'}`)).toEqual([
      'Eb major A 1–2 found',
      'D major B 1–5 stated',
      'Eb major C 01–3 stated',
    ])
  })

  it("reports a function that won't read, doesn't fit, or sits on a chord it can't read, and ignores it", () => {
    const text = lines('C', ['1 | CMaj7', '2 | D7 | | X7', '3 | Bb7 | | V7/V', '4 | Hm7 | | ii7'])
    const a = analyse(parseChart(text).value)
    expect(a.problems.map((p) => `${p.line} ${p.message}`)).toEqual([
      '4 "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)',
      '5 V7/V in C is on D, not Bb7',
      "6 Hm7 can't be read, so its function can't be checked",
    ])
    expect(a.rows.filter((r) => r.stated)).toEqual([])
  })

  it('an @key on a bar that is not there is a problem; the areas stay as found', () => {
    const text = lines('C', [...C_TUNE, '@key 99 D'])
    const a = analyse(parseChart(text).value)
    expect(a.problems).toEqual([{ line: 11, message: '@key 99: no bar 99 in section A' }])
    expect(a.areas.map((x) => x.key.name)).toEqual(analyse(parseChart(lines('C', C_TUNE)).value).areas.map((x) => x.key.name))
  })

  it('a function on a @copy source states its repeats too, and a bad one is reported once', () => {
    const good = analyse(parseChart(lines('C', ['1 | CMaj7', '2 | D7 | | V7/V', '3 | Dm7', '4 | G7', 'section: B', 'copy: A'])).value)
    expect(good.rows.filter((r) => r.chord === 'D7').map((r) => `${r.bar} ${r.stated}`)).toEqual(['2 true', '2 true'])
    const bad = analyse(parseChart(lines('C', ['1 | CMaj7', '2 | D7 | | X7', '3 | Dm7', '4 | G7', 'section: B', 'copy: A'])).value)
    expect(bad.problems).toHaveLength(1)
  })

  it('held chords merge unless the later one states a different function', () => {
    const held = (second: string) => analyse(parseChart(lines('C', ['1 | CMaj7', '2 | D7 | | V7/V', second, '4 | G7'])).value).rows.filter((r) => r.chord === 'D7').map((r) => r.held)
    expect(held('3 | D7')).toEqual([false, true])
    expect(held('3 | D7 | | II7')).toEqual([false, false])
  })

  it('applyAnalysis never writes a function or an @key, and strip lists a stated row its function disagrees with', () => {
    const doc = parseChart(lines('C', ['1 | CMaj7', '2 | D7 | D Lydian Dominant | V7/V', '3 | Dm7', '4 | G7', '@key 1 C'])).value
    const { doc: next, overrides } = applyAnalysis(doc, analyse(doc), { scales: 'strip', save: true, date: '2026-10-10' })
    const out = serializeChart(next)
    expect(out).toContain('@key 1 C\n')
    expect(out).toMatch(/2 \| D7\s+\| D Lydian Dominant\s+\| V7\/V\s+# ≠ rules: D Mixolydian/)
    expect(overrides.map((o) => `${o.chord}: ${o.scale} / ${o.rules}`)).toEqual(['D7: D Lydian Dominant / D Mixolydian'])
  })
})

describe('refreshAnalysis', () => {
  const comments = (doc: ChartDoc): string[] =>
    doc.lines.flatMap((l) => (l.kind === 'comment' ? [l.text] : l.kind === 'row' && l.comment ? [l.comment] : []))
  const moved = (text: string, from: string, to: string): ChartDoc => setMeta(transposeChart(parseChart(text).value, from, to).doc, 'key', to)

  it('rewrites a transposed chart’s analysis for its new key, keeping the header’s date', () => {
    const doc = refreshAnalysis(moved(library('round-midnight'), 'Ebm', 'Cm'))
    const text = comments(doc)
    const date = /# analysis: ([^,]+),/.exec(library('round-midnight'))?.[1]
    expect(text).toContain(`# analysis: ${date}, rules v1; C minor`)
    expect(text).toContain('# area: C minor (Intro 1–3)')
    expect(text).toContain('# area: C major (Intro 3–4)')
    expect(text).toContain('# area: Eb major (A1 5–6)') // was Gb major
    expect(doc.lines.find((l) => l.kind === 'row' && l.chord === 'F7b9')).toMatchObject({ comment: expect.stringMatching(/^IV7 in C minor/) })
    expect(text.filter((t) => /\b(Gb|Ab minor)\b/.test(t))).toEqual([])
    expect(serializeChart(doc)).toBe(serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'none', save: true, date: date ?? '' }).doc))
  })

  it('leaves a chart without an analysis header as it is: its comments are the user’s', () => {
    const doc = moved('key: Eb\n\nsection: A\nbars: 4\n1 | Fm7  # my own note on Eb\n2 | Bb7\n', 'Eb', 'C')
    expect(refreshAnalysis(doc)).toBe(doc)
  })

  it('keeps a # keep: row’s comment as written', () => {
    const text = 'key: Eb\n# analysis: 2026-01-02, rules v1; Eb\n\nsection: A\nbars: 4\n1 | Fm7 | F Phrygian  # keep: the melody’s Gb in Eb\n2 | Bb7\n3 | EbMaj7\n'
    const row = refreshAnalysis(moved(text, 'Eb', 'C')).lines.find((l) => l.kind === 'row' && l.chord === 'Dm7')
    expect(row).toMatchObject({ scale: 'D Phrygian', comment: 'keep: the melody’s Gb in Eb' })
  })
})

describe('N.C. in the analysis', () => {
  it('leaves a rest out of the stream: it gets no row and no problem, and the chords around it are neighbours', () => {
    const a = analyse(parseChart('title: T\nkey: F\n\nsection: A\nbars: 4\n1 | C7\n2 | N.C.\n3 | FMaj7\n').value)
    expect(a.rows.map((r) => r.chord)).toEqual(['C7', 'FMaj7'])
    expect(a.rows[0]).toMatchObject({ rule: 'D4', reason: 'V7 of F: natural tensions' })
    expect(a.problems).toEqual([])
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse, applyAnalysis, parseKey, pins } from '../analysis'
import { keyText, makeKey, tonicName } from '../analysis/keys'
import { hiddenDominant, passingReason } from '../analysis/rules'
import { familyOf } from '../analysis/stream'
import { formPart, parseChart, serializeChart } from '../chart'
import { parseRoot, pcOf } from '../pitch'
import { readChord, resolveQuality } from '../qualities'
import { isSyncCopy } from '../util'

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
  `title: T\n${key ? `key: ${key}\n` : ''}${extra}` +
  rows
    .split(',')
    .map((r) => r.trim().split(/\s+/))
    .map(([bar, chord]) => `A | ${bar} | ${chord}`)
    .join('\n') +
  '\n'

/** "G7: G Altered (D1)" for every row, or just the chord asked for */
function verdicts(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of analyse(parseChart(text).value).rows) out[`${r.bar} ${r.chord}`] ??= `${r.scale} (${r.rule})`
  return out
}
const verdict = (text: string, barChord: string): string | undefined => verdicts(text)[barChord]
const library = (name: string): string => readFileSync(`../charts/${name}.txt`, 'utf8')

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
    const v = verdicts(library('f_blues').replace(/ \| [A-G][b#]? [A-Za-z ]+$/gm, ''))
    expect([v['1 F7'], v['2 Bb7']]).toEqual(['F Mixolydian (D5)', 'Bb Mixolydian (D5)'])
    expect(analyse(parseChart(library('f_blues')).value).context).toBe('blues')
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
    expect(verdict(library('footprints'), '9 F#m7b5')).toBe('F# Locrian (h2)')
  })

  it('d1 diminished: Whole-Half', () => {
    expect(verdict(chart('Bb', '1 BbMaj7, 2 Bdim7, 3 Cm7, 4 F7'), '2 Bdim7')).toBe('B Whole-Half Diminished (d1)')
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
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('d1 a vii°7 names the dominant it hides', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 C#dim7, 3 Dm7, 4 G7'), '2 C#dim7')).toBe('C# Whole-Half Diminished (d1): vii°7 of Dm7: A7♭9 without its root')
  })

  it('d1 a passing °7 names the dominant it hides, past a related ii (Wave)', () => {
    expect(reasoned(chart('D', '1 DMaj7, 2 Bbdim7, 3 Am7, 3 D7'), '2 Bbdim7')).toBe("Bb Whole-Half Diminished (d1): passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)")
  })

  it('d1 a passing °7 whose hidden dominant is the next chord’s V', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 Edim7, 3 Dm7, 4 G7'), '2 Edim7')).toBe("E Whole-Half Diminished (d1): passing diminished: A7♭9 without its A, the Dm7's dominant")
  })

  it('d1 an auxiliary °7 decorates the chord', () => {
    expect(reasoned(chart('C', '1 C7, 2 Cdim7, 3 C6'), '2 Cdim7')).toBe('C Whole-Half Diminished (d1): auxiliary diminished: it decorates the chord and returns to it')
  })

  it('d1 a passing °7 that hides no dominant of what follows', () => {
    expect(reasoned(chart('C', '1 CMaj7, 2 F#dim7, 3 FMaj7'), '2 F#dim7')).toBe('F# Whole-Half Diminished (d1): passing diminished: a rootless dominant ♭9')
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
    const json = JSON.parse(readFileSync('../chord_scales.json', 'utf8')) as { qualities: Record<string, { scale: string; note?: string }[]> }
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
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('V7/IV → IV: Ionian, M3 (Stella bars 5–7)', () => {
    expect(reasoned(library('stella_by_starlight'), '7 EbMaj7')).toBe('Eb Ionian (M3): the Bb7 before it makes Eb the key of the moment: the 4th is in the key')
    expect(reasoned(chart('Bb', '5 Fm7, 6 Bb7, 7 EbMaj7, 8 Ab7, 9 BbMaj7'), '7 EbMaj7')).toBe('Eb Ionian (M3): the Bb7 before it makes Eb the key of the moment: the 4th is in the key')
  })

  it('V7/IV → IV: Ionian (Moment’s Notice bars 10–11 and 26–27)', () => {
    expect([verdict(library('moments_notice'), '11 AbMaj7'), verdict(library('moments_notice'), '27 AbMaj7')]).toEqual(['Ab Ionian (M3)', 'Ab Ionian (M3)'])
  })

  it('subV7/IV → IV: Ionian (E7 is a half step above Eb)', () => {
    expect(reasoned(chart('Bb', '1 BbMaj7, 2 E7, 3 EbMaj7, 4 F7, 5 BbMaj7'), '3 EbMaj7')).toBe('Eb Ionian (M3): the E7 before it makes Eb the key of the moment: the 4th is in the key')
  })

  it('a IV not so prepared stays Lydian (All the Things bar 5: DbMaj7 after AbMaj7)', () => {
    expect(verdict(library('all_the_things_you_are'), '5 DbMaj7')).toBe('Db Lydian (M4)')
    expect(verdict(chart('C', '1 CMaj7, 2 FMaj7, 3 Dm7, 4 G7, 5 CMaj7'), '2 FMaj7')).toBe('F Lydian (M4)')
  })

  it('a # keep: Eb Lydian row stays Lydian', () => {
    const text = 'title: T\nkey: Bb\n\nA | 1 | Fm7\nA | 2 | Bb7\nA | 3 | EbMaj7 | Eb Lydian  # keep: the melody\nA | 4 | BbMaj7\n'
    const doc = parseChart(text).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'force', save: false, date: '2026-10-10' }).doc)
    expect(out).toContain('Eb Lydian  # keep: the melody')
  })
})

describe('R2: the blues I7 and IV7 by D5 before D3 (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }
  const fJazzBlues = library('f_jazz_blues')

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
    expect(reasoned(library('blue_trane'), '5 Ab7#11')).toBe('Ab Lydian Dominant (D1+D5): IV7 of the blues: a subdominant with dominant colour; #11 from the symbol')
  })

  it('an I7 whose symbol moves it names the symbol’s notes, not natural tensions (Eb7#9)', () => {
    expect(reasoned(library('blue_trane'), '1 Eb7#9')).toBe('Eb Half-Whole Diminished (D1+D5): I7 of the blues: a tonic with dominant colour, b9, #9 and #11 from the symbol')
  })

  it('no I7 row of any library blues is reasoned by D3', () => {
    const files = readdirSync('../charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    const blues = files.map((f) => [f, analyse(parseChart(readFileSync(`../charts/${f}`, 'utf8')).value)] as const).filter(([, a]) => a.context === 'blues')
    expect(blues.map(([f]) => f)).toContain('f_jazz_blues.txt')
    const d3 = blues.flatMap(([f, a]) =>
      a.rows.filter((r) => { const c = readChord(r.chord); return c && c.quality === '7' && a.key && pcOf(c.root) === a.key.tonic && r.rule.includes('D3') }).map((r) => `${f} ${r.bar} ${r.chord}`),
    )
    expect(d3).toEqual([])
  })

  it('the 7 menu still lists Lydian Dominant', () => {
    expect(resolveQuality('C7')?.options.map((o) => o.scale)).toContain('C Lydian Dominant')
  })
})

describe('R4: iii7 is Phrygian, m9 (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const row = (text: string, barChord: string) => analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
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
    const json = JSON.parse(readFileSync('../chord_scales.json', 'utf8')) as { qualities: Record<string, { scale: string; note?: string }[]> }
    for (const q of ['m', 'm7']) expect(json.qualities[q]?.find((o) => o.scale === 'Phrygian')?.note).toBe('iii, or v of a minor key')
  })

  it('a ii of a ii–V stays Dorian (m4)', () => {
    expect(verdict(chart('C', '1 Cmaj7, 2 Dm7, 3 G7, 4 Cmaj7'), '2 Dm7')).toBe('D Dorian (m4)')
  })
})

describe('R6: the small bundle (docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md)', () => {
  const reasoned = (text: string, barChord: string): string | undefined => {
    const r = analyse(parseChart(text).value).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
    return r && `${r.scale} (${r.rule}): ${r.reason}`
  }

  it('m2 a tonic minor sixth chord is Melodic Minor (A Night in Tunisia)', () => {
    expect(reasoned(library('a_night_in_tunisia'), '2 Dm6/9')).toBe('D Melodic Minor (m2): tonic minor sixth chord: melodic minor, the raised 7th is a tension')
    expect(reasoned(chart('Dm', '1 Eb7, 2 Dm6/9'), '2 Dm6/9')).toBe('D Melodic Minor (m2): tonic minor sixth chord: melodic minor, the raised 7th is a tension')
  })

  it('m2 any other minor sixth chord is Dorian (Wave: iv6 in D)', () => {
    const wave = library('wave').replace(/^(A1 \| 6 +\| )Gm7 .*$/m, '$1Gm6')
    expect(reasoned(wave, '6 Gm6')).toBe('G Dorian (m2): a minor sixth chord: Dorian')
    expect(reasoned(chart('C', '1 CMaj7, 2 Fm6, 3 CMaj7'), '2 Fm6')).toBe('F Dorian (m2): a minor sixth chord: Dorian')
  })

  it('m2 a tonic minor sixth chord in a modal chart stays Dorian (§5.4: no functional rules there; Africa)', () => {
    expect(reasoned(library('africa'), '1 Dm6/9/E')).toBe('D Dorian (m2): a minor sixth chord: Dorian')
  })

  it('h2 a ø7 that is neither related nor diatonic is its own mode, not the key\'s notes (Footprints)', () => {
    const fp = analyse(parseChart(library('footprints')).value).rows.find((x) => `${x.bar} ${x.chord}` === '9 F#m7b5')
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
    const a = analyse(parseChart(library('autumn_leaves').replace(/^key:.*\n/m, '')).value)
    expect([a.key?.name, a.keyFrom]).toEqual(['G minor', 'scored'])
  })

  it('opens key areas from cadences, and the top of the form takes the turnaround’s key (Giant Steps)', () => {
    const a = analyse(parseChart(library('giant_steps')).value)
    expect(new Set(a.areas.map((x) => x.key.name))).toEqual(new Set(['Eb major', 'G major', 'B major']))
    expect(verdict(library('giant_steps'), '1 BMaj7')).toBe('B Ionian (M3)')
  })

  it('a minor ii of the next ii–V opens no area (Bird Blues: G7 | Cm7 F7 is V7/V)', () => {
    expect(verdict(library('f_bird_blues'), '3 G7')).toBe('G Mixolydian (D4)')
  })

  it('a cadence into the home tonic comes home (Long Ago and Far Away: C7 | FMaj7 after a bridge in C)', () => {
    expect(verdict(library('long_ago_and_far_away'), '17 FMaj7')).toBe('F Ionian (M3)')
  })

  it('a section that starts on the home tonic is home again (Nardis: the last A after a bridge in C)', () => {
    expect(verdict(library('nardis'), '28 CMaj7')).toBe('C Lydian (M4)')
    expect(verdict(library('nardis'), '23 CMaj7')).toBe('C Ionian (M3)') // the bridge's own C
  })

  it('in a minor key, a ii–V–I into a major chord opens its key (Bernie’s Tune’s bridge is in Bb)', () => {
    expect(verdict(library('bernies_tune'), '19 G7')).toBe('G Mixolydian b6 (D4)') // V7/ii in Bb
    expect(verdict(library('autumn_leaves'), '24 EbMaj7')).toBe('Eb Lydian (M4)') // a tritone cadence doesn't
  })

  it('in a major area, a ii–V that doesn’t land but implies a chord of home brings home back (Lady Bird bars 11–12)', () => {
    const rows = analyse(parseChart(library('lady_bird')).value).rows
    expect(rows.filter((r) => r.bar === '11' || r.bar === '12').map((r) => `${r.numeral} ${r.key.name}`)).toEqual(['vi7 C major', 'V7/V C major'])
    expect(verdict(library('whisper_not'), '19 Gm')).toMatch(/^G Dorian/) // a minor area keeps its own reading, not v Phrygian
  })

  it('finds modal tunes', () => {
    for (const name of ['so_what', 'maiden_voyage', 'footprints']) expect(analyse(parseChart(library(name)).value).context, name).toBe('modal')
    expect(analyse(parseChart(library('stella_by_starlight')).value).context).toBe('functional')
  })
})

describe('analysis: intros and codas outside the form', () => {
  const text = 'title: T\nkey: C\nIntro | 1 | Dm7\nIntro | 2 | G7\nA | 1 | CMaj7\nA | 2 | A7\nA | 3 | Dm7\nA | 4 | G7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n'
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
  const numerals = (name: string, bars: readonly string[]) =>
    analyse(parseChart(library(name)).value).rows.filter((r) => bars.includes(r.bar)).map((r) => `${r.chord} ${r.numeral}`)

  it('name each chord’s degree and quality in its key area, and what a dominant or a ii leads to', () => {
    expect(numerals('rhythm_changes', ['1', '2', '17', '19', '21', '23'])).toEqual(['Bb6 I6', 'G7b9 V7/ii', 'Cm7 ii7', 'F7 V7', 'D7 →', 'G7 →', 'C7 V7/V', 'F7 V7'])
    expect(numerals('stella_by_starlight', ['1', '2', '12', '13', '29', '30'])).toEqual([
      'Em7b5 iiø7/iii', 'A7b9 V7/iii', 'Bbm7 iv7/V', 'Eb7 ♭VII7/V', 'FMaj7 Vmaj7', 'Cm7b5 iiø7', 'F7b9 V7',
    ])
    expect(numerals('autumn_leaves', ['1', '2', '5', '6', '7', '23', '24'])).toEqual([
      'Cm7 ii7/♭III', 'F7 V7/♭III', 'Am7b5 iiø7', 'D7 V7', 'Gm i', 'Bm7 ii7/II', 'E7 subV7/♭VI', 'EbMaj7 ♭VImaj7',
    ])
  })
})

describe('analysis: writing it back (§12.1)', () => {
  const text = 'title: T\nkey: C\n\nA | 1 | Dm7\nA | 2 | G7 | G Bebop Dominant\nA | 3 | CMaj7\nA | 4 | Am7 | A Dorian  # keep: the melody\n'
  const run = (t: string, scales: 'fill' | 'force' | 'none', save: boolean, date = '2026-10-08') => {
    const doc = parseChart(t).value
    return applyAnalysis(doc, analyse(doc), { scales, save, date })
  }

  it('fills blank cells only, or forces all but # keep rows', () => {
    const fill = serializeChart(run(text, 'fill', false).doc)
    expect(fill).toContain('A | 1 | Dm7   | D Dorian\n')
    expect(fill).toContain('G Bebop Dominant')
    const force = run(text, 'force', false)
    expect(force.changes.map((c) => `${c.chord} ${c.from || '-'} -> ${c.to}`)).toEqual(['Dm7 - -> D Dorian', 'G7 G Bebop Dominant -> G Mixolydian', 'CMaj7 - -> C Ionian'])
    expect(serializeChart(force.doc)).toContain('A Dorian  # keep: the melody')
  })

  it('saves reasons, marks where a written scale differs, and reruns as a no-op', () => {
    const saved = serializeChart(run(text, 'fill', true).doc)
    expect(saved).toContain('# analysis: 2026-10-08, rules v1; C')
    expect(saved).toMatch(/Dm7\s+\| D Dorian\s+# ii of the ii–V to C\n/)
    expect(saved).toMatch(/G Bebop Dominant\s+# ≠ rules: G Mixolydian \(V7 of C: natural tensions\)/)
    expect(serializeChart(run(saved, 'fill', true, '2027-01-01').doc)).toBe(saved) // same analysis: the old date stays
  })

  it('reports a @copy repeat whose analysis differs from its source row', () => {
    // the first G7 goes to the repeat's Dm7 (V7 in C, implied); the repeat's resolves to Cm7 (V7 of C minor)
    const t = 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\n@copy A B 2\nC | 5 | Cm7\nC | 7 | Ab7\n'
    expect(run(t, 'fill', false).conflicts.map((c) => `${c.chord}: ${c.source} / ${c.copy}`)).toEqual(['G7: G Mixolydian / G Phrygian Dominant'])
    expect(serializeChart(run(t, 'fill', true).doc)).toContain('the repeat at bar 4 would be G Phrygian Dominant')
  })
})

describe('stated functions and @key (docs/superpowers/specs/2026-10-09-chart-functions-design.md)', () => {
  const lines = (key: string, rows: readonly string[], extra = ''): string => `title: T\nkey: ${key}\n${extra}${rows.join('\n')}\n`
  const rowOf = (text: string, barChord: string) => analyse(parseChart(text).value).rows.find((r) => `${r.bar} ${r.chord}` === barChord)
  const C_TUNE = ['A | 1 | CMaj7', 'A | 2 | D7', 'A | 3 | Dm7', 'A | 4 | G7', 'A | 5 | Am7', 'A | 6 | Dm7', 'A | 7 | G7', 'A | 8 | CMaj7']

  it('a stated target overrides the neighbour: D7 going nowhere, stated V7/V', () => {
    const plain = lines('C', C_TUNE)
    expect(verdict(plain, '2 D7')).toBe('D Mixolydian (D5)')
    expect(rowOf(plain, '2 D7')?.fallback).toBe(true)
    const r = rowOf(plain.replace('A | 2 | D7', 'A | 2 | D7 | | V7/V'), '2 D7')
    expect([r?.scale, r?.rule, r?.numeral, r?.stated, r?.fallback]).toEqual(['D Mixolydian', 'D4', 'V7/V', true, undefined])
    expect(r?.reason).toBe('* V7/V in C: natural tensions')
  })

  it('a key prefix decides its row only, and opens no key area', () => {
    const plain = lines('D', ['A | 1 | DMaj7', 'A | 2 | Em7', 'A | 3 | Bb7', 'A | 4 | DMaj7'])
    expect(verdict(plain, '3 Bb7')).toBe('Bb Lydian Dominant (D6)')
    const a = analyse(parseChart(plain.replace('A | 3 | Bb7', 'A | 3 | Bb7 | | Db: V7/ii')).value)
    const r = a.rows.find((x) => x.chord === 'Bb7')
    expect([r?.scale, r?.rule, r?.statedKey?.name, r?.key.name]).toEqual(['Bb Mixolydian b6', 'D4', 'Db major', 'D major'])
    expect(a.areas.map((x) => x.key.name)).toEqual(['D major'])
  })

  it('subV7 and ♭VII7 reach their own rules', () => {
    const sub = lines('C', ['A | 1 | CMaj7', 'A | 2 | Db7 | | subV7', 'A | 3 | Am7', 'A | 4 | Dm7', 'A | 5 | G7', 'A | 6 | CMaj7'])
    expect(verdict(sub, '2 Db7')).toBe('Db Lydian Dominant (D2)')
    const back = lines('C', ['A | 1 | CMaj7', 'A | 2 | Bb7 | | ♭VII7', 'A | 3 | Am7', 'A | 4 | Dm7', 'A | 5 | G7', 'A | 6 | CMaj7'])
    expect(verdict(back, '2 Bb7')).toBe('Bb Lydian Dominant (D5)')
    expect(rowOf(back, '2 Bb7')?.fn).toBe('back door bVII7 to C')
  })

  it('the ii of a stated ii–V is named for its target', () => {
    const text = lines('C', ['A | 1 | CMaj7', 'A | 2 | Am7 | | ii7/V', 'A | 3 | FMaj7', 'A | 4 | G7'])
    const r = rowOf(text, '2 Am7')
    expect([r?.scale, r?.rule, r?.fn]).toEqual(['A Dorian', 'm4', 'ii of the ii–V to G; also vi of C'])
  })

  it('@key holds from its bar until the next', () => {
    const rows = ['A | 1 | EbMaj7', 'A | 2 | Cm7', 'B | 3 | DMaj7', 'B | 4 | Em7', 'B | 5 | DMaj7', 'C | 6 | EbMaj7', 'C | 7 | Fm7', 'C | 8 | Bb7']
    const text = lines('Eb', rows, '@key B 3 D\n@key C 6 Eb\n')
    const a = analyse(parseChart(text).value)
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.from}–${x.to} ${x.stated ? 'stated' : 'found'}`)).toEqual([
      'Eb major A 1–2 found',
      'D major B 3–5 stated',
      'Eb major C 6–8 stated',
    ])
    expect(verdict(text, '3 DMaj7')).toBe('D Ionian (M3)')
    expect(a.problems).toEqual([])
  })

  it('an @key on a bar a chord is held through starts at that chord, and bars compare as numbers', () => {
    const rows = ['A | 1 | EbMaj7', 'A | 2 | Cm7', 'B | 3 | DMaj7', 'B | 5 | Em7', 'B | 6 | A7', 'B | 7 | DMaj7', 'C | 08 | EbMaj7', 'C | 9 | Fm7', 'C | 10 | Bb7']
    const a = analyse(parseChart(lines('Eb', rows, '@key B 4 D\n@key C 8 Eb\n')).value)
    expect(a.problems).toEqual([])
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.from}–${x.to} ${x.stated ? 'stated' : 'found'}`)).toEqual([
      'Eb major A 1–2 found',
      'D major B 3–7 stated',
      'Eb major C 08–10 stated',
    ])
  })

  it("reports a function that won't read, doesn't fit, or sits on a chord it can't read, and ignores it", () => {
    const text = lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | X7', 'A | 3 | Bb7 | | V7/V', 'A | 4 | Hm7 | | ii7'])
    const a = analyse(parseChart(text).value)
    expect(a.problems.map((p) => `${p.line} ${p.message}`)).toEqual([
      '3 "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)',
      '4 V7/V in C is on D, not Bb7',
      "5 Hm7 can't be read, so its function can't be checked",
    ])
    expect(a.rows.filter((r) => r.stated)).toEqual([])
  })

  it('an @key on a bar that is not there is a problem; the areas stay as found', () => {
    const text = lines('C', C_TUNE, '@key B 99 D\n')
    const a = analyse(parseChart(text).value)
    expect(a.problems).toEqual([{ line: 2, message: '@key B 99: no bar 99 in section B' }])
    expect(a.areas.map((x) => x.key.name)).toEqual(analyse(parseChart(lines('C', C_TUNE)).value).areas.map((x) => x.key.name))
  })

  it('a function on a @copy source states its repeats too, and a bad one is reported once', () => {
    const good = analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | V7/V', 'A | 3 | Dm7', 'A | 4 | G7', '@copy A B 4'])).value)
    expect(good.rows.filter((r) => r.chord === 'D7').map((r) => `${r.bar} ${r.stated}`)).toEqual(['2 true', '6 true'])
    const bad = analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | X7', 'A | 3 | Dm7', 'A | 4 | G7', '@copy A B 4'])).value)
    expect(bad.problems).toHaveLength(1)
  })

  it('held chords merge unless the later one states a different function', () => {
    const held = (second: string) => analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | V7/V', second, 'A | 4 | G7'])).value).rows.filter((r) => r.chord === 'D7').map((r) => r.held)
    expect(held('A | 3 | D7')).toEqual([false, true])
    expect(held('A | 3 | D7 | | II7')).toEqual([false, false])
  })

  it('applyAnalysis never writes a function or an @key, and --force rewrites a stated row from its function', () => {
    const doc = parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | D Lydian Dominant | V7/V', 'A | 3 | Dm7', 'A | 4 | G7'], '@key A 1 C\n')).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'force', save: true, date: '2026-10-10' }).doc)
    expect(out).toContain('@key A 1 C\n')
    expect(out).toMatch(/A \| 2 \| D7\s+\| D Mixolydian\s+\| V7\/V\s+# \* V7\/V in C: natural tensions\n/)
  })
})

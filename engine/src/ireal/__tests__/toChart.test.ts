import { describe, expect, it } from 'vitest'
import { parseChart } from '../../chart'
import type { IRealSong } from '../decode'
import { irealBars, irealToChart } from '../toChart'

const song = (music: string, over: Partial<IRealSong> = {}): IRealSong => ({ title: 'Tune', composer: 'Jim Hall', style: 'Medium Swing', key: 'C', music, ...over })
const valid = (text: string) => expect(parseChart(text).diagnostics.filter((d) => d.fatal)).toEqual([])

describe('irealToChart', () => {
  it('writes the header and one section with rows from bar 1', () => {
    const { value, diagnostics } = irealToChart(song('[*AT44C^7 A-7 |D-7 G7 |C^7 |x Z'))
    expect(diagnostics).toEqual([])
    expect(value).toBe([
      'title: Tune', 'composer: Jim Hall', 'style: Medium Swing', 'key: C', 'form: A, 4 bars', 'source: iReal Pro', '',
      'section: A', '1 | CMaj7', '1 | Am7', '2 | Dm7', '2 | G7', '3 | CMaj7', '4 | CMaj7', '',
    ].join('\n'))
    valid(value)
  })

  it('AABA: repeated letters are numbered, a {…} with endings becomes @ending, the form counts it twice', () => {
    const music = '{*AC^7 |A-7 |D-7 |N1G7 }|N2G7 |C^7 ][*BE-7 |A7 |D-7 |G7 ][*AC^7 |A-7 |D-7 G7 |C^7 Z'
    const { value } = irealToChart(song(music))
    expect(value).toContain('form: AABA, 17 bars') // A1: body 3 twice + endings 1 + 2; B 4; A2 4
    expect(value).toContain('section: A1\n1 | CMaj7\n2 | Am7\n3 | Dm7\n4 | G7\n5 | G7\n6 | CMaj7\n@ending 1 4\n@ending 2 5 6\n')
    expect(value).toContain('section: B\n')
    expect(value).toContain('section: A2\n')
    valid(value)
  })

  it('a {…} without endings is the section then a copy of it', () => {
    const { value } = irealToChart(song('{*AC7 |F7 |C7 |G7 }[*BF7 |C7 Z'))
    expect(value).toContain('section: A1\n1 | C7\n2 | F7\n3 | C7\n4 | G7\n\nsection: A2\ncopy: A1\n\nsection: B\n')
    expect(value).toContain('form: AAB, 10 bars')
    valid(value)
  })

  it('intro and verse are outside the form', () => {
    const { value } = irealToChart(song('[*iC7 |F7 ][*VG7 |C7 ][*AC^7 |D-7 G7 Z'))
    expect(value).toContain('section: Intro\n')
    expect(value).toContain('section: Verse\noutside: yes\n')
    expect(value).toContain('form: A, 2 bars')
    valid(value)
  })

  it('a verse marked *v (as iReal writes it) is outside the form too', () => {
    const { value } = irealToChart(song('[*vG7 |C7 ][*AC^7 |D-7 G7 Z'))
    expect(value).toContain('section: Verse\noutside: yes\n')
    expect(value).toContain('form: A, 2 bars')
    valid(value)
  })

  it('a } with no { before it repeats from the section’s start (Five Brothers: AABA, not ABA)', () => {
    const music = '[*AC^7 |D-7 G7 |N1C^7 }|N2C^7 ][*BE^7 |E-7 A7 ][*AC^7 |D-7 G7 |C^7 |x Z'
    const { value, diagnostics } = irealToChart(song(music))
    expect(diagnostics).toEqual([])
    expect(value).toContain('section: A1\n1 | CMaj7\n2 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n@ending 1 3\n@ending 2 4\n')
    expect(value).toContain('form: AABA, 12 bars') // A1: body 2 twice + endings 1 + 1; B 2; A2 4
    valid(value)
  })

  it('a } with no { before it and no endings is the section then a copy', () => {
    const { value } = irealToChart(song('[*AC7 |F7 }[*BG7 |C7 Z'))
    expect(value).toContain('section: A1\n1 | C7\n2 | F7\n\nsection: A2\ncopy: A1\n')
    expect(value).toContain('form: AAB, 6 bars')
  })

  it('a { that spans sections is still written out once, and said so', () => {
    const { diagnostics } = irealToChart(song('{*AC7 |F7 ][*BG7 |C7 }Z'))
    expect(diagnostics.map((d) => d.message)).toEqual([
      'A bar 1: a repeat that isn’t a whole section is written out once',
      'B bar 2: a repeat that isn’t a whole section is written out once',
    ])
  })

  it('a coda after the form (a Q stretch with no section letter) is its own Coda section, outside the form', () => {
    const music = '{*ASC^7 |A-7 |D-7 |G7 |C^7 |A-7 |D-7 |N1G7 }|N2C^7 ][*BE-7 |A7 |D-7 |G7 |E-7 |A7 |D-7 |G7 ]'
      + '[*AC^7 |A-7 |D-7 |G7 |C^7 |A-7 |D-7 |G7 <D.S. al Coda>]Y[QD-7 |G7 |C^7 |x Z'
    const { value } = irealToChart(song(music))
    expect(value).toContain('section: Coda\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n@coda 1\n')
    expect(value).toContain('form: AABA, 32 bars')
    valid(value)
  })

  it('two coda stretches are Coda1 and Coda2', () => {
    const { value } = irealToChart(song('[*AC7 |F7 Z[QG7 |C7 ][QD7 |G7 Z'))
    expect(value).toContain('section: Coda1\n1 | G7\n2 | C7\n@coda 1\n\nsection: Coda2\n1 | D7\n2 | G7\n@coda 1\n')
    expect(value).toContain('form: A, 2 bars')
    valid(value)
  })

  it('a Q bar with a section after it stays in its section', () => {
    const { value } = irealToChart(song('[*AC7 |F7 ][QG7 |C7 ][*BD7 Z'))
    expect(value).not.toContain('Coda')
    expect(value).toContain('form: AB, 5 bars')
  })

  it('a stand-alone alternate chord is reported as left out; the chord after it is read', () => {
    const { value, diagnostics } = irealToChart(song('[*A(C7)F7 |(Db7)Q G7 Z'))
    expect(value).toContain('1 | F7\n2 | G7\n')
    expect(diagnostics.map((d) => d.message)).toEqual(['A bar 1: the alternate chord C7 is left out', 'A bar 2: the alternate chord Db7 is left out'])
  })

  it('a token it can’t read is reported by section and bar', () => {
    const { diagnostics } = irealToChart(song('[*AC7 ][*BF7 ?? Z'))
    expect(diagnostics).toEqual([{ line: 2, message: 'B bar 1: "??" not read' }])
  })

  it('held chords: an empty bar writes no row, a held last chord gives bars: N, slashes hold', () => {
    const { value } = irealToChart(song('[*AC7 p p p|    |F7 |    Z'))
    expect(value).toContain('section: A\nbars: 4\n1 | C7\n3 | F7\n')
  })

  it('x and r repeat the bars before; N.C. is a rest', () => {
    const { value } = irealToChart(song('[*AC7 |F7 |r|   |n |x Z'))
    expect(value).toContain('1 | C7\n2 | F7\n3 | C7\n4 | F7\n5 | N.C.\n6 | N.C.\n')
  })

  it('a repeat with nothing before holds', () => {
    const { value, diagnostics } = irealToChart(song('[*Ax |C7 Z'))
    expect(value).toContain('section: A\n2 | C7\n')
    expect(diagnostics).toEqual([{ line: 1, message: 'A bar 1: a repeat sign with no bar before it, left empty' }])
  })

  it('segno, coda and the jumps we know become marks; other comments are reported', () => {
    const { value, diagnostics } = irealToChart(song('[*ASC7 |F7 <D.S. al Coda>|QG7 <play softly>|C7 Z'))
    expect(value).toContain('@segno 1\n@nav 2 D.S. al Coda\n@coda 3\n')
    expect(diagnostics).toEqual([{ line: 3, message: 'A bar 3: the comment "play softly" is left out' }])
  })

  it('metre: the song’s first is time:, a change is @time, a later section restates it', () => {
    const { value } = irealToChart(song('[*AT34C7 |F7 |T44G7 |C7 ][*BF7 |C7 Z'))
    expect(value).toContain('time: 3/4\n')
    expect(value).toContain('4 | C7\n@time 3 4/4\n')
    expect(value).toContain('section: B\ntime: 4/4\n')
    valid(value)
  })

  it('reports what it can’t write: 6/8, alternate chords, a bass alone, an unknown chord, a third time through', () => {
    const { diagnostics } = irealToChart(song('{*AT68C7(Db7) |W/E |Co^7 |<3x>F7 }Z'))
    expect(diagnostics.map((d) => d.message)).toEqual([
      'A bar 1: the alternate chord Db7 is left out',
      'A bar 1: 6/8 is not a metre the sheets have; read as 4/4',
      'A bar 2: a bass note with no chord (W/E) is left out',
      'A bar 3: Co^7: no chord like it here, left out',
      'A bar 4: played 3 times; written as twice',
    ])
  })

  it('approximations are reported and written', () => {
    const { value, diagnostics } = irealToChart(song('[*AC^13 Z'))
    expect(value).toContain('1 | CMaj9\n')
    expect(diagnostics).toEqual([{ line: 1, message: 'A bar 1: C^13 written as CMaj9' }])
  })

  it('no chords at all is still a valid chart', () => {
    const { value } = irealToChart(song('[*AW/C |n Z'))
    valid(value)
  })

  it('a section that opens on a held bar writes the chord held into it (a chord holds only within its section)', () => {
    const { value } = irealToChart(song('[*AC7 |F7 ][*B    |G7 Z'))
    expect(value).toContain('section: B\n1 | F7\n2 | G7\n')
    valid(value)
  })

  it('a section with no chord at all keeps its length', () => {
    const { value } = irealToChart(song('[*iW/C |W/D ][*AC7 Z'))
    expect(value).toContain('section: Intro\nbars: 2\n\nsection: A\n1 | C7\n')
    expect(value).toContain('form: A, 1 bar\n')
    valid(value)
  })

  it('a repeat inside a section is written out once, and said so', () => {
    const { value, diagnostics } = irealToChart(song('[*AC7 |{F7 |G7 }|C7 Z'))
    expect(value).toContain('section: A\n1 | C7\n2 | F7\n3 | G7\n4 | C7\n')
    expect(diagnostics).toEqual([{ line: 2, message: 'A bar 2: a repeat that isn’t a whole section is written out once' }])
  })

  it('a count of 2 is the usual repeat, not reported', () => {
    expect(irealToChart(song('{*A<2x>C7 |F7 }Z')).diagnostics).toEqual([])
  })

  it('a 3rd ending is plain bars after the 2nd; the form plays the section twice and those bars once', () => {
    const { value, diagnostics } = irealToChart(song('{*AC7 |F7 |N1G7 }|N2D7 }|N3C7 Z'))
    expect(value).toContain('section: A\n1 | C7\n2 | F7\n3 | G7\n4 | D7\n5 | C7\n@ending 1 3\n@ending 2 4\n')
    expect(value).not.toContain('@ending 3')
    expect(value).toContain('form: AA, 7 bars') // 2 body bars twice, each ending once, the 3rd ending's bar once
    expect(diagnostics).toEqual([{ line: 5, message: 'A bar 5: a 3rd ending is written as plain bars after the 2nd' }])
    expect(parseChart(value).diagnostics).toEqual([])
  })

  it('an unnumbered ending (N0) takes the next number', () => {
    const { value, diagnostics } = irealToChart(song('{*AC7 |F7 |N1G7 }|N0D7 Z'))
    expect(value).toContain('@ending 1 3\n@ending 2 4\n')
    expect(diagnostics).toEqual([{ line: 4, message: 'A bar 4: an unnumbered ending read as ending 2' }])
    valid(value)
  })

  it('an r whose second bar has chords of its own is cut short, and said so', () => {
    const { value, diagnostics } = irealToChart(song('[*AC7 |F7 |r|G7 Z'))
    expect(value).toContain('3 | C7\n4 | G7\n')
    expect(diagnostics).toEqual([{ line: 4, message: 'A bar 4: a two-bar repeat cut short by chords in its second bar' }])
  })

  it('a minor key and no composer', () => {
    const { value } = irealToChart(song('[*AC-7 Z', { key: 'Cm', composer: '' }))
    expect(value).toMatch(/^title: Tune\nstyle: Medium Swing\nkey: Cm\n/)
  })
})

describe('irealBars', () => {
  it('the bars as Paste bars takes them, repeats filled in, sections and endings flat', () => {
    expect(irealBars(song('{*AC7 |x |N1F7 }|N2G7 |    Z')).value).toEqual([['C7'], ['C7'], ['F7'], ['G7'], []])
  })
})

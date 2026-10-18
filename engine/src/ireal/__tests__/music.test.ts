import { describe, expect, it } from 'vitest'
import { readMusic } from '../music'

const chords = (music: string) => readMusic(music).value.map((b) => b.items.map((i) => (i.kind === 'chord' ? i.text : i.kind === 'repeat' ? `x${i.bars}` : i.kind === 'rest' ? 'NC' : `W/${i.bass}`)))

describe('readMusic', () => {
  it('splits bars on every bar line; commas and spaces separate chords', () => {
    expect(chords('[T44C^7 A-7,|D-7 G7 |C6   Z')).toEqual([['C^7', 'A-7'], ['D-7', 'G7'], ['C6']])
  })

  it('an empty bar between plain bar lines is a held bar; space between ] and [ is not a bar', () => {
    expect(chords('[C7 |    |F7 ] [G7 Z')).toEqual([['C7'], [], ['F7'], ['G7']])
  })

  it('marks: section, time, repeats with endings and count, segno, coda, comments, final', () => {
    const bars = readMusic('{*AT34C7 |N1F7 }|N2<3x>G7 Z[*BSQC <D.S. al Coda>Z').value
    expect(bars[0]).toMatchObject({ section: 'A', time: '3/4', open: true })
    expect(bars[1]).toMatchObject({ ending: 1, close: true })
    expect(bars[2]).toMatchObject({ ending: 2, count: 3, final: true })
    expect(bars[3]).toMatchObject({ section: 'B', segno: true, coda: true, comments: ['D.S. al Coda'], final: true })
  })

  it('12/8 and 6/8', () => {
    expect(readMusic('[T12C7 |T68F7 Z').value.map((b) => b.time)).toEqual(['12/8', '6/8'])
  })

  it('repeat signs, N.C., slashes, invisible roots and alternate chords', () => {
    const bars = readMusic('[C7 |x |r|   |n |C7 p p p|W/E Z|D-7(Ab7) Z').value
    expect(bars.map((b) => b.items.map((i) => i.kind))).toEqual([['chord'], ['repeat'], ['repeat'], [], ['rest'], ['chord'], ['bass'], ['chord']])
    expect(bars[2]?.items[0]).toEqual({ kind: 'repeat', bars: 2 })
    expect(bars[7]?.items[0]).toEqual({ kind: 'chord', text: 'D-7', alt: 'Ab7' })
  })

  it('layout marks are ignored silently: sizes, spacing, fermata, end, comment heights', () => {
    const r = readMusic('[sC7lF7 |YYfG7 U|<*72Fine>C Z')
    expect(r.diagnostics).toEqual([])
    expect(r.value.map((b) => b.items.length)).toEqual([2, 1, 1])
    expect(r.value[2]?.comments).toEqual(['Fine'])
  })

  it('an unreadable token is a diagnostic naming its bar', () => {
    const r = readMusic('[C7 |F7 ?? Z')
    expect(r.diagnostics).toEqual([{ line: 2, message: 'bar 2: "??" not read' }])
  })
})

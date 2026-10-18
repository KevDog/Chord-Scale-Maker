import { describe, expect, it } from 'vitest'
import { decodeIReal, unscramble } from '../decode'
import { irealLink } from './link'

const BLUES = '{*AT44C7 |F7 |C7 |C7 |F7 |F7 |C7 |A7 |D-7 |G7 |C7 A7 |D-7 G7 }'

describe('decodeIReal', () => {
  it('unscramble is its own inverse and leaves a tail of 51 or fewer alone', () => {
    const s = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{};:,./<>?~'
    expect(unscramble(unscramble(s))).toBe(s)
    expect(unscramble(s.slice(0, 51))).toBe(s.slice(0, 51))
    expect(unscramble(s.slice(0, 52)).slice(0, 5)).toBe(s.slice(45, 50).split('').reverse().join(''))
  })

  it('reads one song: title and composer tidied, key, music unscrambled', () => {
    const { value, diagnostics } = decodeIReal(irealLink([{ title: 'Gentle Rain, The', composer: 'Bonfa Luiz', key: 'A-', style: 'Bossa Nova', music: BLUES }]))
    expect(diagnostics).toEqual([])
    expect(value.name).toBeUndefined()
    expect(value.songs).toEqual([{ title: 'The Gentle Rain', composer: 'Luiz Bonfa', style: 'Bossa Nova', key: 'Am', music: BLUES }])
  })

  it('expands the scrambler’s shorthands', () => {
    const { value } = decodeIReal(irealLink([{ title: 'T', music: '[C7XyQKcl LZF7 Z' }]))
    expect(value.songs[0]?.music).toBe('[C7   | x  |F7 Z')
  })

  it('reads a playlist, its name last, and percent-encoded = from the app’s html', () => {
    const link = irealLink([{ title: 'One', music: BLUES }, { title: 'Two', music: BLUES }], 'My Set', true)
    const { value } = decodeIReal(link)
    expect(value.name).toBe('My Set')
    expect(value.songs.map((s) => s.title)).toEqual(['One', 'Two'])
  })

  it('an empty composer doesn’t split the song', () => {
    const { value } = decodeIReal(irealLink([{ title: 'One', composer: '', music: BLUES }, { title: 'Two', music: BLUES }], 'Set'))
    expect(value.songs.map((s) => [s.title, s.composer])).toEqual([['One', ''], ['Two', 'Composer Unknown']])
  })

  it('finds the link inside html and prose', () => {
    const link = irealLink([{ title: 'One', music: BLUES }], undefined, true)
    const html = `<html><body><h3><a href="${link}">One</a></h3><p>Made with iReal Pro</p></body></html>`
    expect(decodeIReal(html).value.songs).toHaveLength(1)
    expect(decodeIReal(`try this: ${irealLink([{ title: 'One', music: BLUES }])} thanks!`).value.songs).toHaveLength(1)
  })

  it('reads the legacy irealbook:// six-field form', () => {
    const { value } = decodeIReal(encodeURI('irealbook://Tune=Hall Jim=Ballad=F=n=[F^7 |G-7 C7 Z=Two=X Y=Waltz=C=n=[C |C Z'))
    expect(value.songs.map((s) => [s.title, s.composer, s.key, s.music])).toEqual([['Tune', 'Jim Hall', 'F', '[F^7 |G-7 C7 Z'], ['Two', 'Y X', 'C', '[C |C Z']])
  })

  it('a malformed link is a diagnostic', () => {
    for (const text of ['no link here', 'irealb://%E0%A4%A', 'irealb://Title=Comp==Style=C==not music=x=0=0']) {
      const { value, diagnostics } = decodeIReal(text)
      expect(value.songs).toEqual([])
      expect(diagnostics[0]).toMatchObject({ fatal: true })
    }
  })
})

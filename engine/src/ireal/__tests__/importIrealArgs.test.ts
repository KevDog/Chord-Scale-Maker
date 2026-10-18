import { describe, expect, it } from 'vitest'
import { chartSlug, parseImportArgs, pickSong, saveName } from '../../../scripts/importIrealArgs'

const list = { songs: [{ title: 'Blue Bossa' }, { title: "'Round Midnight" }].map((s) => ({ ...s, composer: '', style: '', key: 'C', music: '' })) }

describe('import-ireal arguments', () => {
  it('reads the input and flags', () => {
    expect(parseImportArgs(['x.html', '--song', '2', '--save'])).toEqual({ input: 'x.html', list: false, song: '2', save: true, force: false })
    expect(parseImportArgs(['irealb://…', '--list'])).toMatchObject({ list: true })
    expect(parseImportArgs([])).toMatch(/usage/i)
    expect(parseImportArgs(['x', '--song'])).toMatch(/--song/)
    expect(parseImportArgs(['x', '--nope'])).toMatch(/--nope/)
  })

  it('picks a song by number or title, and needs one when there are several', () => {
    expect(pickSong(list, '2')).toBe(1)
    expect(pickSong(list, 'blue bossa')).toBe(0)
    expect(pickSong(list, undefined)).toMatch(/--song/)
    expect(pickSong(list, '9')).toMatch(/no song/)
    expect(pickSong({ songs: list.songs.slice(0, 1) }, undefined)).toBe(0)
  })

  it('does not let --song swallow a flag', () => {
    expect(parseImportArgs(['x', '--song', '--save'])).toMatch(/--song needs a number or a title/)
  })

  it('matches a digits-only title when the number is out of range', () => {
    const l = { songs: [{ title: 'A' }, { title: '1999' }].map((s) => ({ ...s, composer: '', style: '', key: 'C', music: '' })) }
    expect(pickSong(l, '1999')).toBe(1)
    expect(pickSong(l, '2')).toBe(1)
    expect(pickSong(l, '77')).toMatch(/no song/)
  })

  it('refuses a file name from a title with no letters or digits', () => {
    expect(chartSlug('東京')).toBe('')
    expect(saveName('東京')).toEqual({ error: 'no file name from the title "東京"' })
    expect(saveName('Blue Bossa')).toEqual({ slug: 'blue-bossa' })
  })

  it('names the file as the library does', () => {
    expect(chartSlug("'Round Midnight")).toBe('round-midnight')
    expect(chartSlug('Here’s That Rainy Day')).toBe('heres-that-rainy-day')
    expect(chartSlug('Chega de Saudade (No More Blues)')).toBe('chega-de-saudade-no-more-blues')
  })
})

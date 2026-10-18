import { describe, expect, it } from 'vitest'
import { chartSlug, parseImportArgs, pickSong } from '../../../scripts/importIrealArgs'

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

  it('names the file as the library does', () => {
    expect(chartSlug("'Round Midnight")).toBe('round-midnight')
    expect(chartSlug('Here’s That Rainy Day')).toBe('heres-that-rainy-day')
    expect(chartSlug('Chega de Saudade (No More Blues)')).toBe('chega-de-saudade-no-more-blues')
  })
})

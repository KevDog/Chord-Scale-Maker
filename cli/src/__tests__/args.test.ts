import { describe, expect, it } from 'vitest'
import { chartSlug, parseAddArgs, pickSong, saveName } from '../args'

const list = { songs: [{ title: 'Blue Bossa' }, { title: "'Round Midnight" }].map((s) => ({ ...s, composer: '', style: '', key: 'C', music: '' })) }

describe('csm add arguments', () => {
  it('reads the input and flags', () => {
    expect(parseAddArgs(['x.html', '--song', '2', '--force'])).toEqual({ input: 'x.html', list: false, song: '2', force: true, print: false, overrides: {} })
    expect(parseAddArgs(['irealb://…', '--list'])).toMatchObject({ list: true })
    expect(parseAddArgs(['x', '--print'])).toMatchObject({ print: true })
    expect(parseAddArgs([])).toMatch(/usage/i)
    expect(parseAddArgs(['x', '--song'])).toMatch(/--song/)
    expect(parseAddArgs(['x', '--nope'])).toMatch(/--nope/)
  })

  it('takes the header flags as overrides', () => {
    expect(parseAddArgs(['x', '--composer', 'Jim Hall', '--form', 'AABA', '--aka', 'Other', '--recording', 'A; B; C; 1961', '--source', 'Book', '--style', 'Ballad', '--kind', 'form', '--version', 'JLA'])).toMatchObject({
      overrides: { composer: 'Jim Hall', form: 'AABA', aka: 'Other', recording: 'A; B; C; 1961', source: 'Book', style: 'Ballad', kind: 'form', version: 'JLA' },
    })
  })

  it('refuses a kind that is not tune, form or exercise', () => {
    expect(parseAddArgs(['x', '--kind', 'song'])).toMatch(/--kind/)
  })

  it('does not let --song swallow a flag', () => {
    expect(parseAddArgs(['x', '--song', '--print'])).toMatch(/--song/)
  })

  it('picks a song by number or title, and needs one when there are several', () => {
    expect(pickSong(list, '2')).toBe(1)
    expect(pickSong(list, 'blue bossa')).toBe(0)
    expect(pickSong(list, undefined)).toMatch(/--song/)
    expect(pickSong(list, '9')).toMatch(/no song/)
    expect(pickSong({ songs: list.songs.slice(0, 1) }, undefined)).toBe(0)
  })

  it('matches a digits-only title when the number is out of range', () => {
    const l = { songs: [{ title: 'A' }, { title: '1999' }].map((s) => ({ ...s, composer: '', style: '', key: 'C', music: '' })) }
    expect(pickSong(l, '1999')).toBe(1)
    expect(pickSong(l, '2')).toBe(1)
    expect(pickSong(l, '77')).toMatch(/no song/)
  })

  it('names the file as the library does, and refuses a title with no letters or digits', () => {
    expect(chartSlug("'Round Midnight")).toBe('round-midnight')
    expect(chartSlug('Here’s That Rainy Day')).toBe('heres-that-rainy-day')
    expect(chartSlug('Chega de Saudade (No More Blues)')).toBe('chega-de-saudade-no-more-blues')
    expect(saveName('東京')).toEqual({ error: 'no file name from the title "東京"' })
    expect(saveName('Blue Bossa')).toEqual({ slug: 'blue-bossa' })
  })
})

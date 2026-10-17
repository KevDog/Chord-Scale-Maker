import { describe, expect, it } from 'vitest'
import { recordingParts, youtubeUrl } from '~/utils/recording'

const R = { artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1958' }

describe('recordingParts: "Artist, Album (Label, Year)."', () => {
  it('closes with the label and year', () => {
    expect(recordingParts(R)).toEqual({ artist: 'John Coltrane', album: 'Blue Train', tail: ' (Blue Note, 1958).' })
  })
  it('drops an empty label or year with its punctuation', () => {
    expect(recordingParts({ ...R, year: '' }).tail).toBe(' (Blue Note).')
    expect(recordingParts({ ...R, label: '' }).tail).toBe(' (1958).')
    expect(recordingParts({ ...R, label: '', year: '' }).tail).toBe('.')
  })
})

describe('youtubeUrl', () => {
  it('is the watch page', () => {
    expect(youtubeUrl('XpZHUVjQydI')).toBe('https://www.youtube.com/watch?v=XpZHUVjQydI')
  })
})

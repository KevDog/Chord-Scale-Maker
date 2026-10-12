import { describe, expect, it } from 'vitest'
import { letterIndex, letterOf, libraryDetails } from '~/utils/libraryIndex'

describe('libraryDetails', () => {
  it('reads style · key · form, built the same for every chart', () => {
    expect(libraryDetails({ style: 'Ballad', keyLabel: 'E♭ minor', form: 'AABC' })).toBe('Ballad · E♭ minor · AABC')
  })

  it('drops the parts a chart leaves out', () => {
    expect(libraryDetails({ style: '', keyLabel: 'C', form: 'Blues' })).toBe('C · Blues')
    expect(libraryDetails({ style: '', keyLabel: '', form: '' })).toBe('')
  })
})

describe('letterOf', () => {
  it('files a title under its first letter, a leading apostrophe ignored, digits under #', () => {
    expect(["'Round Midnight", 'A Night in Tunisia', 'Été', '502 Blues', 'blue', '¡Ay!'].map(letterOf)).toEqual(['R', 'A', 'E', '#', 'B', 'A'])
  })
})

describe('letterIndex', () => {
  it('links each letter with tunes to its first tune, in the library’s order, # first', () => {
    const charts = [
      { slug: '502-blues', title: '502 Blues' },
      { slug: 'a-night-in-tunisia', title: 'A Night in Tunisia' },
      { slug: 'africa', title: 'Africa' },
      { slug: 'blue-trane', title: 'Blue Trane' },
      { slug: 'round-midnight', title: "'Round Midnight" },
      { slug: 'ruby', title: 'Ruby' },
    ]
    expect(letterIndex(charts)).toEqual([
      { letter: '#', slug: '502-blues' },
      { letter: 'A', slug: 'a-night-in-tunisia' },
      { letter: 'B', slug: 'blue-trane' },
      { letter: 'R', slug: 'round-midnight' },
    ])
  })
})

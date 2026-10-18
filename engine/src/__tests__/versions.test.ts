import { describe, expect, it } from 'vitest'
import { tuneGroups, tuneKey, versionProblems } from '../versions'

const chart = (slug: string, head: string) => ({ slug, text: `${head}\n\nsection: A\nbars: 4\n1 | C\n` })
const main = chart('summertime', 'title: Summertime')
const jla = chart('summertime-jazz-lab-accelerator', 'title: Summertime\nversion: Jazz Lab Accelerator')
const alt = chart('summertime-alt', 'title: Summertime\nversion: Alt')

describe('tuneKey', () => {
  it('ignores case, accents, apostrophes and punctuation', () => {
    expect(tuneKey("'Round Midnight")).toBe(tuneKey('Round Midnight'))
    expect(tuneKey('Here’s That Rainy Day')).toBe('heres that rainy day')
    expect(tuneKey('Café  Society!')).toBe('cafe society')
  })
})

describe('tuneGroups', () => {
  it('gathers a main and its versions, main first, then by label', () => {
    expect(tuneGroups([jla, chart('autumn-leaves', 'title: Autumn Leaves'), alt, main])).toEqual([
      { key: 'summertime', main: 'summertime', versions: [{ slug: 'summertime', label: '' }, { slug: 'summertime-alt', label: 'Alt' }, { slug: 'summertime-jazz-lab-accelerator', label: 'Jazz Lab Accelerator' }] },
      { key: 'autumn leaves', main: 'autumn-leaves', versions: [{ slug: 'autumn-leaves', label: '' }] },
    ])
  })

  it('joins by aka, a title match first', () => {
    const blueTrain = chart('blue-train', 'title: Blue Train')
    const trane = chart('blue-trane', 'title: Blue Trane\naka: Blue Train\nversion: Book')
    expect(tuneGroups([blueTrain, trane]).map((g) => g.versions.map((v) => v.slug))).toEqual([['blue-train', 'blue-trane']])
    expect(tuneGroups([trane, blueTrain]).map((g) => g.versions.map((v) => v.slug))).toEqual([['blue-train', 'blue-trane']])
  })

  it('a group of versions only: the first by label is its main', () => {
    expect(tuneGroups([jla, alt])[0]!.main).toBe('summertime-alt')
  })
})

describe('versionProblems', () => {
  it('is quiet for a main and distinct versions, and for versions only', () => {
    expect(versionProblems([main, jla, alt])).toEqual([])
    expect(versionProblems([jla, alt])).toEqual([])
  })

  it('names two mains, a repeated label, and a version titled unlike its main', () => {
    expect(versionProblems([main, chart('summertime-2', 'title: Summertime')])).toEqual(['summertime, summertime-2: two charts of "Summertime" without version: (give all but one a version:)'])
    expect(versionProblems([main, jla, chart('summertime-jla', 'title: Summertime\nversion: Jazz Lab Accelerator')])).toEqual(['summertime-jazz-lab-accelerator, summertime-jla: two versions of "Summertime" labelled "Jazz Lab Accelerator"'])
    expect(versionProblems([main, chart('summertime-x', 'title: Summertime!\nversion: X')])).toEqual(['summertime-x: title "Summertime!" differs from its main chart\'s "Summertime"'])
  })
})

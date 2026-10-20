import { describe, expect, it } from 'vitest'
import { ofTune, type SavedVersion, savedVersion, tuneAt, versionChoices } from '~/utils/songVersions'

const MAIN = { path: '/song/summertime', label: 'Main' }
const JLA = { path: '/song/summertime-jazz-mind-accelerator', label: 'Jazz Mind Accelerator' }
const saved = (id: string, title: string, more: Partial<SavedVersion> = {}): SavedVersion => ({ id, title, kind: 'copy', createdAt: 1, version: '', ...more })
const choices = (slug: string, mine: readonly SavedVersion[] = []) => versionChoices(tuneAt({ slug }), mine)

describe('versionChoices (#411)', () => {
  it('lists a tune\'s library versions, the main first as "Main"', () => {
    expect(choices('summertime')).toEqual({ library: [MAIN, JLA], mine: [] })
    expect(choices('summertime-jazz-mind-accelerator')).toEqual({ library: [MAIN, JLA], mine: [] })
  })

  it('offers nothing for a tune with one chart, or no library chart', () => {
    const none = { library: [], mine: [] }
    expect(choices('blue-trane')).toEqual(none)
    expect(choices('nope')).toEqual(none)
    expect(versionChoices(tuneAt({ mine: saved('a1b2c3', 'My Tune') }), [saved('a1b2c3', 'My Tune')])).toEqual(none)
  })

  it('adds your saved charts of the tune, by what they are based on or by title, labelled by version: or "My chart"', () => {
    const mine = [
      saved('aaaaaa', 'Summertime', { kind: 'new', version: 'Ballad' }),
      saved('bbbbbb', 'Mine', { basedOn: 'summertime-jazz-mind-accelerator', createdAt: 2 }),
      saved('cccccc', 'Blue Trane'),
    ]
    expect(choices('summertime', mine).mine).toEqual([
      { path: '/song?mine=aaaaaa', label: 'Ballad' },
      { path: '/song?mine=bbbbbb', label: 'My chart' },
    ])
  })

  it('numbers "My chart" when there are several, oldest first, so an edit doesn\'t renumber them', () => {
    const mine = [saved('bbbbbb', 'summertime', { createdAt: 5 }), saved('aaaaaa', 'Summertime', { createdAt: 3 })]
    expect(choices('summertime', mine).mine).toEqual([
      { path: '/song?mine=aaaaaa', label: 'My chart 1' },
      { path: '/song?mine=bbbbbb', label: 'My chart 2' },
    ])
  })

  it('tells your charts apart from the library\'s and from each other when they share a label', () => {
    const mine = [
      saved('aaaaaa', 'Summertime', { version: 'Jazz Mind Accelerator', createdAt: 1 }),
      saved('bbbbbb', 'Summertime', { version: 'Ballad', createdAt: 2 }),
      saved('cccccc', 'Summertime', { version: 'Ballad', createdAt: 3 }),
      saved('dddddd', 'Summertime', { version: 'Main', createdAt: 4 }),
    ]
    expect(choices('summertime', mine).mine.map((c) => c.label)).toEqual(['Jazz Mind Accelerator (mine)', 'Ballad 1', 'Ballad 2', 'Main (mine)'])
  })

  it('leaves out your edits of a library chart: its own page already shows them', () => {
    expect(choices('summertime', [saved('aaaaaa', 'Summertime', { kind: 'edited', basedOn: 'summertime' })]).mine).toEqual([])
  })

  it('shows a tune of one library chart once you have a chart of it', () => {
    expect(choices('blue-trane', [saved('cccccc', 'Blue Trane')])).toEqual({
      library: [{ path: '/song/blue-trane', label: 'Main' }],
      mine: [{ path: '/song?mine=cccccc', label: 'My chart' }],
    })
  })

  it('finds the tune from one of your charts, on its own page', () => {
    const mine = [saved('bbbbbb', 'Mine', { basedOn: 'summertime' }), saved('aaaaaa', 'Summertime', { createdAt: 2 })]
    expect(versionChoices(tuneAt({ mine: mine[0]! }), mine)).toEqual({
      library: [MAIN, JLA],
      mine: [{ path: '/song?mine=bbbbbb', label: 'My chart 1' }, { path: '/song?mine=aaaaaa', label: 'My chart 2' }],
    })
    expect(versionChoices(tuneAt({ mine: mine[1]! }), mine).library).toEqual([MAIN, JLA])
  })

  it('knows a saved chart titled by one of the tune\'s other titles, or as a copy (#426)', () => {
    const tune = tuneAt({ slug: 'autumn-leaves' })!
    expect(ofTune(tune, saved('a', 'Les Feuilles mortes'))).toBe(true)
    expect(ofTune(tune, saved('b', 'les feuilles mortes (copy)'))).toBe(true)
    expect(ofTune(tuneAt({ slug: 'summertime' })!, saved('c', 'Summertime (copy) (copy)'))).toBe(true)
    expect(ofTune(tune, saved('d', 'Autumn Leaves copy'))).toBe(false)
    expect(tuneAt({ mine: saved('e', 'Les Feuilles mortes') })?.main).toBe('autumn-leaves')
  })

  it('has no tune on the page of your edit of a library chart (its own page shows it)', () => {
    expect(tuneAt({ mine: saved('aaaaaa', 'Summertime', { kind: 'edited', basedOn: 'summertime' }) })).toBeNull()
  })

  it('picks a tune\'s saved charts from their index entries alone, before any text is read', () => {
    const tune = tuneAt({ slug: 'summertime' })!
    expect(ofTune(tune, saved('a', 'Summertime'))).toBe(true)
    expect(ofTune(tune, saved('b', 'Other', { basedOn: 'summertime-jazz-mind-accelerator' }))).toBe(true)
    expect(ofTune(tune, saved('c', 'Blue Trane'))).toBe(false)
    expect(ofTune(tune, saved('d', 'Summertime', { kind: 'edited', basedOn: 'summertime' }))).toBe(false)
  })

  it('reads a saved chart\'s version: line', () => {
    const meta = { id: 'aaaaaa', title: 'Summertime', kind: 'copy' as const, basedOn: 'summertime', createdAt: 1, updatedAt: 2 }
    expect(savedVersion(meta, 'title: Summertime\nversion: Ballad\n')).toEqual({ id: 'aaaaaa', title: 'Summertime', kind: 'copy', basedOn: 'summertime', createdAt: 1, version: 'Ballad' })
    expect(savedVersion({ ...meta, kind: 'new', basedOn: undefined }, 'title: Summertime\n')).toEqual({ id: 'aaaaaa', title: 'Summertime', kind: 'new', createdAt: 1, version: '' })
  })
})

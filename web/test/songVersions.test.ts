import { describe, expect, it } from 'vitest'
import { type SavedVersion, savedVersion, versionChoices } from '~/utils/songVersions'

const MAIN = { path: '/song/summertime', label: 'Main' }
const JLA = { path: '/song/summertime-jazz-lab-accelerator', label: 'Jazz Lab Accelerator' }
const saved = (id: string, title: string, more: Partial<SavedVersion> = {}): SavedVersion => ({ id, title, kind: 'copy', version: '', ...more })

describe('versionChoices (#411)', () => {
  it('lists a tune\'s library versions, the main first as "Main"', () => {
    expect(versionChoices({ slug: 'summertime' }, [])).toEqual({ library: [MAIN, JLA], mine: [] })
    expect(versionChoices({ slug: 'summertime-jazz-lab-accelerator' }, [])).toEqual({ library: [MAIN, JLA], mine: [] })
  })

  it('offers nothing for a tune with one chart, or no library chart', () => {
    const none = { library: [], mine: [] }
    expect(versionChoices({ slug: 'blue-trane' }, [])).toEqual(none)
    expect(versionChoices({ slug: 'nope' }, [])).toEqual(none)
    expect(versionChoices({ mine: saved('a1b2c3', 'My Tune') }, [saved('a1b2c3', 'My Tune')])).toEqual(none)
  })

  it('adds your saved charts of the tune, by what they are based on or by title, labelled by version: or "My chart"', () => {
    const mine = [
      saved('aaaaaa', 'Summertime', { kind: 'new', version: 'Ballad' }),
      saved('bbbbbb', 'Mine', { basedOn: 'summertime-jazz-lab-accelerator' }),
      saved('cccccc', 'Blue Trane'),
    ]
    expect(versionChoices({ slug: 'summertime' }, mine).mine).toEqual([
      { path: '/song?mine=aaaaaa', label: 'Ballad' },
      { path: '/song?mine=bbbbbb', label: 'My chart' },
    ])
  })

  it('numbers "My chart" when there are several', () => {
    const mine = [saved('aaaaaa', 'Summertime'), saved('bbbbbb', 'summertime')]
    expect(versionChoices({ slug: 'summertime' }, mine).mine.map((c) => c.label)).toEqual(['My chart 1', 'My chart 2'])
  })

  it('leaves out your edits of a library chart: its own page already shows them', () => {
    expect(versionChoices({ slug: 'summertime' }, [saved('aaaaaa', 'Summertime', { kind: 'edited', basedOn: 'summertime' })]).mine).toEqual([])
  })

  it('shows a tune of one library chart once you have a chart of it', () => {
    const mine = [saved('cccccc', 'Blue Trane')]
    expect(versionChoices({ slug: 'blue-trane' }, mine)).toEqual({ library: [{ path: '/song/blue-trane', label: 'Main' }], mine: [{ path: '/song?mine=cccccc', label: 'My chart' }] })
  })

  it('reads a saved chart\'s version: line', () => {
    const meta = { id: 'aaaaaa', title: 'Summertime', kind: 'copy' as const, basedOn: 'summertime', createdAt: 1, updatedAt: 2 }
    expect(savedVersion({ meta, text: 'title: Summertime\nversion: Ballad\n' })).toEqual({ id: 'aaaaaa', title: 'Summertime', kind: 'copy', basedOn: 'summertime', version: 'Ballad' })
    expect(savedVersion({ meta: { ...meta, kind: 'new', basedOn: undefined }, text: 'title: Summertime\n' })).toEqual({ id: 'aaaaaa', title: 'Summertime', kind: 'new', version: '' })
  })

  it('finds the tune from one of your charts, on its own page', () => {
    const mine = [saved('bbbbbb', 'Mine', { basedOn: 'summertime' }), saved('aaaaaa', 'Summertime')]
    expect(versionChoices({ mine: mine[0]! }, mine)).toEqual({
      library: [MAIN, JLA],
      mine: [{ path: '/song?mine=bbbbbb', label: 'My chart 1' }, { path: '/song?mine=aaaaaa', label: 'My chart 2' }],
    })
    expect(versionChoices({ mine: mine[1]! }, mine).library).toEqual([MAIN, JLA])
  })
})

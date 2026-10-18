import { describe, expect, it } from 'vitest'
import { versionChoices } from '~/utils/songVersions'

describe('versionChoices (#411)', () => {
  it('lists a tune\'s library versions, the main first as "Main"', () => {
    const choices = [{ path: '/song/summertime', label: 'Main' }, { path: '/song/summertime-jazz-lab-accelerator', label: 'Jazz Lab Accelerator' }]
    expect(versionChoices('summertime')).toEqual(choices)
    expect(versionChoices('summertime-jazz-lab-accelerator')).toEqual(choices)
  })

  it('offers nothing for a tune with one chart, or no library chart', () => {
    expect(versionChoices('blue-trane')).toEqual([])
    expect(versionChoices('nope')).toEqual([])
  })
})

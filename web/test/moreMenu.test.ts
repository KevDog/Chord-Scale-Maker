import { describe, expect, it } from 'vitest'
import { moreMenuItems } from '~/utils/moreMenu'

const at = { saved: true, edited: false, fatal: false, picks: false }

describe('moreMenuItems', () => {
  it('a library chart as published: a copy, the download, a report', () => {
    expect(moreMenuItems(at)).toEqual(['copy', 'download', 'report'])
  })

  it('edited: revert to the library version too', () => {
    expect(moreMenuItems({ ...at, edited: true })).toEqual(['copy', 'download', 'revert', 'report'])
  })

  it('a shared chart, not saved here: no copy until it is saved', () => {
    expect(moreMenuItems({ ...at, saved: false })).toEqual(['download', 'report'])
  })

  it('over a size limit: no copy; the text still downloads, to shorten it elsewhere', () => {
    expect(moreMenuItems({ ...at, edited: true, fatal: true })).toEqual(['download', 'revert', 'report'])
  })

  it('with live chord picks: Reset chord picks, after revert', () => {
    expect(moreMenuItems({ ...at, picks: true })).toEqual(['copy', 'download', 'reset-picks', 'report'])
    expect(moreMenuItems({ ...at, edited: true, picks: true })).toEqual(['copy', 'download', 'revert', 'reset-picks', 'report'])
  })
})

describe('moreMenuItems, with chart submissions', () => {
  it('a new chart: Send to the library, before the report', () => {
    expect(moreMenuItems({ ...at, chart: { send: true, suggest: false, report: true } })).toEqual(['copy', 'download', 'send', 'report'])
  })

  it('an edited library chart: Suggest these changes, in place of the report', () => {
    expect(moreMenuItems({ ...at, edited: true, chart: { send: false, suggest: true, report: false } })).toEqual(['copy', 'download', 'revert', 'suggest'])
  })
})

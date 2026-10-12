import { describe, expect, it } from 'vitest'
import { moreMenuItems } from '~/utils/moreMenu'

const at = { saved: true, edited: false, shared: false, fatal: false }

describe('moreMenuItems', () => {
  it('a library chart as published: a copy, the download, a report', () => {
    expect(moreMenuItems(at)).toEqual(['copy', 'download', 'report'])
  })

  it('edited: revert to the library version too', () => {
    expect(moreMenuItems({ ...at, edited: true })).toEqual(['copy', 'download', 'revert', 'report'])
  })

  it('a shared chart, not saved here: no copy until it is saved', () => {
    expect(moreMenuItems({ ...at, saved: false, shared: true })).toEqual(['download', 'report'])
  })

  it('over a size limit: no copy; the text still downloads, to shorten it elsewhere', () => {
    expect(moreMenuItems({ ...at, edited: true, fatal: true })).toEqual(['download', 'revert', 'report'])
  })
})

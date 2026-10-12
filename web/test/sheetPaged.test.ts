import { describe, expect, it } from 'vitest'
import { PAGE_WIDTH, pageZoom } from '~/utils/sheetPaged'

describe('pageZoom', () => {
  it('fits the tallest page into the window’s height', () => {
    expect(pageZoom({ width: 1280, height: 700 }, 1400)).toBe(0.5)
  })

  it('or its width, on a narrow window', () => {
    expect(pageZoom({ width: PAGE_WIDTH / 2, height: 2000 }, 1000)).toBe(0.5)
  })

  it('grows a short page, but not past 1.5', () => {
    expect(pageZoom({ width: 4000, height: 4000 }, 1000)).toBe(1.5)
  })

  it('leaves pages not yet measured alone', () => {
    expect(pageZoom({ width: 1280, height: 700 }, 0)).toBe(1)
  })
})

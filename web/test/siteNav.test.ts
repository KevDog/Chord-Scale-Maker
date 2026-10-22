import { describe, expect, it } from 'vitest'
import { isCurrent, NAV, navLinks } from '~/utils/siteNav'

describe('the site navigation', () => {
  it('runs Library, Scales, then a Help menu', () => {
    expect(NAV.map((e) => e.label)).toEqual(['Library', 'Scales', 'Help'])
  })

  it('puts How it works, How it decides, Functions, About and Contact under Help', () => {
    const help = NAV.find((e) => e.label === 'Help')
    expect(help && 'items' in help ? help.items.map((i) => [i.label, i.href]) : null).toEqual([
      ['How it works', '/help'],
      ['How it decides', '/how-it-decides'],
      ['Functions', '/functions'],
      ['About', '/about'],
      ['Contact', '/contact'],
    ])
  })

  it('flattens to every link, in order, for the phone menu', () => {
    expect(navLinks(NAV).map((l) => l.href)).toEqual(['/library', '/scales', '/help', '/how-it-decides', '/functions', '/about', '/contact'])
  })

  it('a link is current on its page and the pages under it; a menu, on any of its items', () => {
    const scales = NAV.find((e) => e.label === 'Scales')!
    const help = NAV.find((e) => e.label === 'Help')!
    expect(isCurrent(scales, '/scales')).toBe(true)
    expect(isCurrent(scales, '/scales/dorian')).toBe(true)
    expect(isCurrent(scales, '/scalesx')).toBe(false)
    expect(isCurrent(help, '/functions')).toBe(true)
    expect(isCurrent(help, '/library')).toBe(false)
  })
})

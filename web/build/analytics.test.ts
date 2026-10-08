import { describe, expect, it } from 'vitest'
import { analyticsScripts } from './analytics'

describe('analyticsScripts', () => {
  it('adds the script only to Vercel production builds', () => {
    expect(analyticsScripts({})).toEqual([])
    expect(analyticsScripts({ VERCEL_ENV: 'preview' })).toEqual([])
    expect(analyticsScripts({ VERCEL_ENV: 'development' })).toEqual([])
    expect(analyticsScripts({ VERCEL_ENV: 'production' })).toEqual([
      { src: '/analytics-before-send.js', defer: true }, // first: strips a share link's "#…" before anything is sent
      { src: '/_vercel/insights/script.js', defer: true },
    ])
  })

  it("uses the project's own base path when Vercel sets one, from this origin", () => {
    expect(analyticsScripts({ VERCEL_ENV: 'production', VERCEL_OBSERVABILITY_BASEPATH: '/a1b2c3/' })).toEqual([
      { src: '/analytics-before-send.js', defer: true },
      { src: '/a1b2c3/insights/script.js', defer: true, 'data-endpoint': '/a1b2c3/insights' },
    ])
    expect(analyticsScripts({ VERCEL_ENV: 'production', VERCEL_OBSERVABILITY_BASEPATH: 'a1b2c3' })[1]?.src).toBe('/a1b2c3/insights/script.js')
  })
})

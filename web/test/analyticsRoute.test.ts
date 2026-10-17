import { describe, expect, it } from 'vitest'
import { vercelRoute } from '~/utils/analyticsRoute'

describe('vercelRoute', () => {
  it("writes Nuxt's route patterns the way Vercel groups them", () => {
    expect(vercelRoute('/song/:slug?')).toBe('/song/[slug]')
    expect(vercelRoute('/tunes/:slug')).toBe('/tunes/[slug]')
    expect(vercelRoute('/')).toBe('/')
    expect(vercelRoute('/about')).toBe('/about')
    expect(vercelRoute('/:path(.*)*')).toBe('/[...path]')
  })
})

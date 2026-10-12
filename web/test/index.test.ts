import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { LIBRARY } from '~/utils/library'
import Index from '~/pages/index.vue'

describe('library page', () => {
  it('requests a chart through the contact form', async () => {
    const w = await mountSuspended(Index)
    const link = w.findAll('a').find((a) => a.text() === 'Request a chart')
    expect(link?.attributes('href')).toBe('/contact')
  })

  it('links each tune title to its song page, with no separate editor link', async () => {
    const w = await mountSuspended(Index)
    const links = w.findAll('tbody a')
    expect(links.length).toBe(LIBRARY.length)
    for (const c of LIBRARY) expect(links.find((a) => a.text() === c.title && a.attributes('href') === `/song/${c.slug}`)).toBeDefined()
    expect(w.findAll('a').filter((a) => /^Open .* in the editor$/.test(a.attributes('aria-label') ?? ''))).toEqual([])
  })
})

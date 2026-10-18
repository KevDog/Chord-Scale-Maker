import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { LIBRARY, TUNES } from '~/utils/library'
import Library from '~/pages/library.vue'

describe('library page', () => {
  it('requests a chart through the contact form', async () => {
    const w = await mountSuspended(Library)
    const link = w.findAll('a').find((a) => a.text() === 'Request a chart')
    expect(link?.attributes('href')).toBe('/contact')
  })

  it('links each tune title to its song page, with no separate editor link', async () => {
    const w = await mountSuspended(Library)
    const links = w.findAll('tbody td:first-child a')
    expect(links.length).toBe(TUNES.length) // one row per tune, its versions folded in (#411)
    for (const c of TUNES) expect(links.find((a) => a.text() === c.title && a.attributes('href') === `/song/${c.slug}`)).toBeDefined()
    expect(w.findAll('a').filter((a) => /^Open .* in the editor$/.test(a.attributes('aria-label') ?? ''))).toEqual([])
  })

  it("links each composer in a tune's credit to their page (#164)", async () => {
    const w = await mountSuspended(Library)
    const row = w.findAll('tbody tr').find((r) => r.find('td a').attributes('href') === '/song/round-midnight')
    expect(row?.findAll('td')[1]?.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Thelonious Monk', '/composers/thelonious-monk'],
      ['Cootie Williams', '/composers/cootie-williams'],
    ])
  })
})

describe('library page search', () => {
  it('starts from the search in its address', async () => {
    const w = await mountSuspended(Library, { route: '/library?q=stella' })
    await flushPromises()
    expect((w.find('input[type=search]').element as HTMLInputElement).value).toBe('stella')
    expect(w.findAll('tbody a').map((a) => a.text())).toContain('Stella by Starlight')
    expect(w.findAll('tbody a').length).toBeLessThan(LIBRARY.length)
  })
})

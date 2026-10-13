import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import Index from '~/pages/index.vue'

async function search(text: string) {
  const w = await mountSuspended(Index)
  await flushPromises()
  await w.find('input[type=search]').setValue(text)
  await flushPromises()
  return w
}

describe('home page', () => {
  afterEach(() => localStorage.clear())

  it('links to the whole library', async () => {
    const w = await mountSuspended(Index)
    expect(w.findAll('a').some((a) => a.attributes('href') === '/library' && a.text() === 'browse the library A–Z')).toBe(true)
  })

  it("suggests tunes as you type, each in the key written for this browser's instrument", async () => {
    localStorage.setItem('csm-instrument', 'tenor-sax')
    const w = await search('stella by')
    const [first] = w.findAll('[role=option]')
    expect(first?.text()).toContain('Stella by Starlight')
    expect(first?.text()).toContain('in C, concert B♭')
  })

  it('writes keys at concert pitch on a first visit', async () => {
    const w = await search('stella by')
    expect(w.findAll('[role=option]')[0]?.text()).toContain('in B♭')
    expect(w.findAll('[role=option]')[0]?.text()).not.toContain('concert B♭')
  })

  it('ends the suggestions with every match in the library', async () => {
    const w = await search('blue')
    expect(w.findAll('[role=option]').at(-1)?.text()).toMatch(/^See all \d+ in the library/)
  })

  it('offers no "See all" when every match is already shown', async () => {
    const w = await search('stella by')
    expect(w.findAll('[role=option]').map((o) => o.text())).not.toContainEqual(expect.stringMatching(/^See all/))
  })

  it('says when nothing matches', async () => {
    const w = await search('zzzz')
    expect(w.text()).toContain('No tune matches “zzzz”')
  })

  it('lists recently opened tunes from this browser', async () => {
    localStorage.setItem('csm-recent', JSON.stringify([{ kind: 'library', id: 'stella-by-starlight', at: 1 }]))
    const w = await mountSuspended(Index)
    await flushPromises()
    const recent = w.find('section[aria-labelledby="recent-heading"]')
    expect(recent.find('h2').text()).toBe('Recently opened')
    expect(recent.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([['Stella by Starlight', '/song/stella-by-starlight']])
  })

  it('shows no recents section on a first visit', async () => {
    const w = await mountSuspended(Index)
    await flushPromises()
    expect(w.text()).not.toContain('Recently opened')
  })
})

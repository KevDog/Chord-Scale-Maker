import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Help from '~/pages/help.vue'

describe('Help', () => {
  it('keeps #guide-lines for old links, pointing at How it decides', async () => {
    const page = await mountSuspended(Help)
    expect(page.findAll('[id="guide-lines"]')).toHaveLength(1)
    expect(page.find('a[href="/how-it-decides#guide.tones"]').exists()).toBe(true)
  })

  it('names its sections for what they hold', async () => {
    const page = await mountSuspended(Help)
    expect(page.find('#sheets').text()).toBe('The sheets')
    expect(page.find('#controls').text()).toBe('The controls')
  })

  it('no longer says a level is written into the chart', async () => {
    expect((await mountSuspended(Help)).text()).not.toContain('writes the scales into the chart')
  })

  it('ends each group of controls with its link into How it decides', async () => {
    const groups = (await mountSuspended(Help)).findAll('[aria-labelledby="controls"] [data-controls-group]')
    expect(groups.map((g) => g.find('h3').text())).toEqual(['Reading it on your instrument', 'Seeing the analysis', 'Superimposing', 'Choosing a level', 'Alternate changes', 'Rhythm', 'How much shows', 'Practicing with a click'])
    for (const g of groups.slice(0, 4)) expect(g.findAll('a').at(-1)?.attributes('href'), g.find('h3').text()).toMatch(/^\/how-it-decides#/)
  })

  it('doesn’t name the cells while they’re off (review)', async () => {
    const features = useRuntimeConfig().public.features as Record<string, unknown>
    const was = { ...features }
    Object.assign(features, { cells: false, approaches: true })
    try {
      expect((await mountSuspended(Help)).find('[aria-labelledby="controls"]').text()).not.toContain('the cells')
    } finally {
      Object.assign(features, was)
    }
  })

  it('links the Practice and editing choices to their reasons', async () => {
    const hrefs = (await mountSuspended(Help)).findAll('a').map((a) => a.attributes('href'))
    for (const id of ['pent.auto', 'hex.auto', 'pick.order', 'scale.unknown', 'spell.transpose']) expect(hrefs, id).toContain(`/how-it-decides#${id}`)
  })
})

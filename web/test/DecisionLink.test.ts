import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { decisionOf } from '@chord-scale-maker/engine'
import DecisionLink from '~/components/DecisionLink.vue'

describe('DecisionLink', () => {
  it('links to the decision’s anchor, its summary as the title', async () => {
    const a = (await mountSuspended(DecisionLink, { props: { id: 'guide.move' } })).find('a')
    expect(a.attributes('href')).toBe('/how-it-decides#guide.move')
    expect(a.attributes('title')).toBe(decisionOf('guide.move').summary)
    expect(a.text()).toBe('How this is chosen')
  })

  it('takes its label from the slot', async () => {
    const w = await mountSuspended(DecisionLink, { props: { id: 'rule-M3' }, slots: { default: 'Why?' } })
    expect(w.find('a').attributes('href')).toBe('/functions#rule-M3')
    expect(w.text()).toBe('Why?')
  })
})

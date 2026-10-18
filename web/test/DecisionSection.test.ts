import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DecisionSection from '~/components/DecisionSection.vue'

describe('DecisionSection', () => {
  it('heads the section with the decision’s title, its id the anchor', async () => {
    const w = await mountSuspended(DecisionSection, { props: { id: 'guide.move' }, slots: { default: 'The rule.' } })
    expect(w.find('[id="guide.move"]').text()).toBe('How a line moves')
    const section = w.find('section')
    expect(section.attributes('data-decision')).toBe('guide.move')
    expect(section.attributes('aria-labelledby')).toBe('guide.move')
    expect(section.text()).toContain('The rule.')
  })

  it('takes a heading level', async () => {
    const w = await mountSuspended(DecisionSection, { props: { id: 'pent.auto', level: 3 } })
    expect(w.find('h3').attributes('id')).toBe('pent.auto')
  })
})

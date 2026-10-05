import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HelpTip from '~/components/HelpTip.vue'

describe('HelpTip', () => {
  it('is a labelled button described by its tooltip', async () => {
    const w = await mountSuspended(HelpTip, { props: { label: 'How it works' }, slots: { default: 'Explanation' } })
    const button = w.find('button')
    const tip = w.find('[role=tooltip]')
    expect(button.attributes('aria-label')).toBe('How it works')
    expect(button.attributes('aria-describedby')).toBe(tip.attributes('id'))
    expect(tip.text()).toBe('Explanation')
  })

  it('hides on Escape until the pointer or focus leaves', async () => {
    const w = await mountSuspended(HelpTip, { props: { label: 'x' }, slots: { default: 'y' } })
    const tip = () => w.find('[role=tooltip]').classes()
    expect(tip()).toContain('group-hover/tip:visible')
    await w.find('button').trigger('keydown', { key: 'Escape' })
    expect(tip()).not.toContain('group-hover/tip:visible')
    await w.find('span').trigger('focusout')
    expect(tip()).toContain('group-hover/tip:visible')
  })
})

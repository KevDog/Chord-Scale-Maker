import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EaseReveal from '~/components/EaseReveal.vue'

describe('EaseReveal', () => {
  it('shows its content in a collapsing wrapper while show is on, and drops it when off', async () => {
    const w = await mountSuspended(EaseReveal, { props: { show: true, innerClass: 'flex gap-2' }, slots: { default: '<button>Pair</button>' } })
    expect(w.get('.ease-grid > .ease-inner').classes()).toEqual(expect.arrayContaining(['flex', 'gap-2']))
    expect(w.get('.ease-inner button').text()).toBe('Pair')
    await w.setProps({ show: false })
    expect(w.find('button').exists()).toBe(false)
  })

  it('takes class on its wrapper, so a margin eases with it', async () => {
    const w = await mountSuspended(EaseReveal, { props: { show: true }, attrs: { class: 'mt-4' }, slots: { default: 'Notice' } })
    expect(w.get('.ease-grid').classes()).toContain('mt-4')
  })
})

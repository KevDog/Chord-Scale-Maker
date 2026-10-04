import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiButton from '~/components/ui/Button.vue'

describe('UiButton', () => {
  it('is a solid dark/zinc button by default', async () => {
    const w = await mountSuspended(UiButton, { slots: { default: 'Save' } })
    const b = w.find('button')
    expect(b.attributes('type')).toBe('button')
    expect(b.text()).toBe('Save')
    expect(b.classes()).toContain('[--btn-bg:var(--color-zinc-900)]')
    expect(b.classes()).toContain('cursor-default')
  })

  it('takes a colour, or the outline / plain styles', async () => {
    const teal = await mountSuspended(UiButton, { props: { color: 'teal' }, slots: { default: 'Go' } })
    expect(teal.find('button').classes()).toContain('[--btn-bg:var(--color-teal-600)]')
    const outline = await mountSuspended(UiButton, { props: { outline: true }, slots: { default: 'Go' } })
    expect(outline.find('button').classes()).toContain('border-zinc-950/10')
    expect(outline.find('button').classes()).not.toContain('[--btn-bg:var(--color-zinc-900)]')
    const plain = await mountSuspended(UiButton, { props: { plain: true }, slots: { default: 'Go' } })
    expect(plain.find('button').classes()).toContain('border-transparent')
  })

  it('renders a link when given an href', async () => {
    const w = await mountSuspended(UiButton, { props: { href: '/editor' }, slots: { default: 'Open' } })
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('a').attributes('href')).toBe('/editor')
  })

  it('marks disabled buttons for Catalyst styles', async () => {
    const w = await mountSuspended(UiButton, { props: { disabled: true }, slots: { default: 'No' } })
    expect(w.find('button').attributes('disabled')).toBeDefined()
    expect(w.find('button').attributes('data-disabled')).toBe('')
  })
})

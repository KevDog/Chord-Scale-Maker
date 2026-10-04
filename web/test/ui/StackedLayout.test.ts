import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import UiStackedLayout from '~/components/ui/StackedLayout.vue'

const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}

describe('UiStackedLayout', () => {
  it('renders the navbar and content, and opens the menu drawer on small screens', async () => {
    const w = await mountSuspended(UiStackedLayout, {
      slots: {
        navbar: () => h('span', 'NAVBAR'),
        sidebar: () => h('a', { href: '#library' }, 'Library'),
        default: () => h('p', 'CONTENT'),
      },
      attachTo: document.body,
    })
    expect(w.text()).toContain('NAVBAR')
    expect(w.text()).toContain('CONTENT')
    expect(document.body.textContent).not.toContain('Library')
    await w.find('button[aria-label="Open navigation"]').trigger('click') // the name is on the button itself
    await settle()
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Library')
    ;(document.querySelector('[role=dialog] a') as HTMLElement).click() // following a link closes the menu
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).toBeNull()) // after the leave transition
    w.unmount()
  })
})

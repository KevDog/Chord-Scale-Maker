import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import UiDialog from '~/components/ui/Dialog.vue'
import UiDialogTitle from '~/components/ui/DialogTitle.vue'

const body = () => document.body.innerHTML

describe('UiDialog', () => {
  it('renders its content only while open, as a labelled dialog', async () => {
    const w = await mountSuspended(UiDialog, {
      props: { open: false },
      slots: { default: () => [h(UiDialogTitle, () => 'Choose a scale'), h('button', 'Set')] },
      attachTo: document.body,
    })
    expect(body()).not.toContain('Choose a scale')
    await w.setProps({ open: true })
    await nextTick()
    await nextTick()
    const dialog = document.querySelector('[role=dialog]')
    expect(dialog).not.toBeNull()
    expect(document.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Choose a scale')
    w.unmount()
  })

  it('asks to close on Escape', async () => {
    const w = await mountSuspended(UiDialog, {
      props: { open: true },
      slots: { default: () => [h(UiDialogTitle, () => 'T'), h('button', 'Set')] },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })
})

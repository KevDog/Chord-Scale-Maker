import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiCheckbox from '~/components/ui/Checkbox.vue'

describe('UiCheckbox', () => {
  it('is a native checkbox inside its label, named by the slot', async () => {
    const w = await mountSuspended(UiCheckbox, { props: { modelValue: false, name: 'credit' }, slots: { default: 'Credit me' } })
    const input = w.find('label input[type=checkbox]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('name')).toBe('credit')
    expect(w.find('label').text()).toBe('Credit me')
  })

  it('ticks and unticks its model', async () => {
    const w = await mountSuspended(UiCheckbox, { props: { modelValue: false }, slots: { default: 'Credit me' } })
    await w.find('input').setValue(true)
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    await w.setProps({ modelValue: true })
    expect((w.find('input').element as HTMLInputElement).checked).toBe(true)
  })
})

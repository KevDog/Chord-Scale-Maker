import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ToggleButton from '~/components/ToggleButton.vue'

describe('ToggleButton', () => {
  it('is a pressed-state button that flips its model', async () => {
    const w = await mountSuspended(ToggleButton, { props: { modelValue: false, 'onUpdate:modelValue': (v: boolean) => w.setProps({ modelValue: v }) }, slots: { default: 'Numerals' } })
    const b = w.get('button')
    expect(b.attributes('aria-pressed')).toBe('false')
    await b.trigger('click')
    expect(b.attributes('aria-pressed')).toBe('true')
    expect(b.attributes('type')).toBe('button')
    expect(b.text()).toBe('Numerals')
  })

  it('reads as expanded, not pressed, when it shows a panel', async () => {
    const w = await mountSuspended(ToggleButton, { props: { modelValue: true, expands: true }, slots: { default: 'Done' } })
    const b = w.get('button')
    expect(b.attributes('aria-expanded')).toBe('true')
    expect(b.attributes('aria-pressed')).toBeUndefined()
  })

  it('stays put when disabled', async () => {
    const w = await mountSuspended(ToggleButton, { props: { modelValue: true, disabled: true }, slots: { default: 'Scales' } })
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.get('button').attributes('data-disabled')).toBe('')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, withDirectives } from 'vue'
import { dataFlag, vInteractive } from '~/utils/interactive'

const Probe = (arg?: string) =>
  defineComponent({ render: () => withDirectives(h('button', 'x'), [[vInteractive, undefined, arg]]) })

describe('v-interactive', () => {
  it('flags hover (not for touch) and active, like Headless UI', async () => {
    const w = mount(Probe())
    const el = w.find('button')
    await el.trigger('pointerenter', { pointerType: 'mouse' })
    expect(el.attributes('data-hover')).toBe('')
    await el.trigger('pointerdown')
    expect(el.attributes('data-active')).toBe('')
    await el.trigger('pointerup')
    expect(el.attributes('data-active')).toBeUndefined()
    await el.trigger('pointerleave')
    expect(el.attributes('data-hover')).toBeUndefined()
    await el.trigger('pointerenter', { pointerType: 'touch' })
    expect(el.attributes('data-hover')).toBeUndefined()
  })

  it('any-focus flags every focus; blur clears it', async () => {
    const w = mount(Probe('any-focus'), { attachTo: document.body })
    const el = w.find('button')
    await el.trigger('focus')
    expect(el.attributes('data-focus')).toBe('')
    await el.trigger('blur')
    expect(el.attributes('data-focus')).toBeUndefined()
    w.unmount()
  })

  it('ignores hover and press on disabled elements', async () => {
    const Disabled = defineComponent({ render: () => withDirectives(h('button', { disabled: true }, 'x'), [[vInteractive]]) })
    const el = mount(Disabled).find('button')
    await el.trigger('pointerenter', { pointerType: 'mouse' })
    await el.trigger('pointerdown')
    expect([el.attributes('data-hover'), el.attributes('data-active')]).toEqual([undefined, undefined])
  })

  it('dataFlag renders an empty attribute or none', () => {
    expect([dataFlag(true), dataFlag(false), dataFlag(undefined)]).toEqual(['', undefined, undefined])
  })
})

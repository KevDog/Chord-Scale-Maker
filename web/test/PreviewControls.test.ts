import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', pentatonics: false, pentRung: 0, pentSide: 'flat', ...props } })

describe('the pentatonic controls', () => {
  afterEach(() => (useRuntimeConfig().public.features.pentatonics = false))

  it('hides the toggle with the flag off', async () => {
    const w = await mount()
    expect(w.text()).not.toContain('Pentatonics')
  })

  it('shows Rung, and Side away from Home and 6, once the row is on', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    expect((await mount()).find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    const home = await mount({ pentatonics: true, pentRung: 0 })
    expect(home.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    expect(home.text()).not.toContain('♯')
    const two = await mount({ pentatonics: true, pentRung: 2 })
    expect(two.text()).toContain('♯')
  })

  it('keeps the toggle while editing, when Numerals and Scales hide', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ lockLabels: true })
    expect(w.text()).toContain('Pentatonics')
    expect(w.text()).not.toContain('Numerals')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', pentatonics: false, pentRung: 0, pentSide: 'flat', pentPath: 'one', pentBasis: 'key', pentRank: 1, ...props } })

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

  it('offers the paths, Custom only while current, and Rung and Side only with One rung', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const one = await mount({ pentatonics: true, pentPath: 'one' })
    expect(one.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
    expect(one.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    const slip = await mount({ pentatonics: true, pentPath: 'side-slip', pentRung: 2 })
    expect(slip.find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic side"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic path"]').text()).toContain('Side-slip')
    const custom = await mount({ pentatonics: true, pentPath: 'custom' })
    expect(custom.find('[aria-label="Pentatonic path"]').text()).toContain('Custom')
  })

  it('shows Rank in place of Path under the chord basis', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ pentatonics: true, pentBasis: 'chord' })
    expect(w.find('[aria-label="Pentatonic rank"]').exists()).toBe(true)
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
    expect(w.find('[aria-label="Pentatonics ranked against"]').exists()).toBe(true)
    const key = await mount({ pentatonics: true })
    expect(key.find('[aria-label="Pentatonic rank"]').exists()).toBe(false)
    expect(key.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
  })

  it('keeps the toggle while editing, when Numerals and Scales hide', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ lockLabels: true })
    expect(w.text()).toContain('Pentatonics')
    expect(w.text()).not.toContain('Numerals')
  })
})

describe('interface levels', () => {
  const withLevel = (props: Record<string, unknown> = {}) =>
    mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', ...props }, slots: { level: () => 'level-slot' } })
  const at = (level: 'essentials' | 'intermediate' | 'everything') => {
    useRuntimeConfig().public.features.interfaceLevels = true
    useInterface().level.value = level
  }
  afterEach(() => {
    useRuntimeConfig().public.features.interfaceLevels = false
    useRuntimeConfig().public.features.pentatonics = false
    useInterface().level.value = 'everything'
  })

  it('Essentials hides Level, Analysis, Line and Spell Scale, and keeps Intervals', async () => {
    at('essentials')
    const changes = await withLevel()
    expect(changes.text()).not.toMatch(/level-slot|Analysis|Line|Numerals/)
    expect(changes.text()).toContain('Instrument')
    const scales = await withLevel({ sheet: 'scales' })
    expect(scales.text()).not.toContain('Spell Scale')
    expect(scales.text()).toContain('Intervals')
  })

  it('Intermediate shows them but not Pentatonics', async () => {
    at('intermediate')
    useRuntimeConfig().public.features.pentatonics = true
    const w = await withLevel()
    expect(w.text()).toMatch(/level-slot[\s\S]*Analysis[\s\S]*Numerals[\s\S]*Line/)
    expect(w.text()).not.toContain('Pentatonics')
    expect((await withLevel({ sheet: 'scales' })).text()).toContain('Spell Scale')
  })

  it('Everything shows Pentatonics', async () => {
    at('everything')
    useRuntimeConfig().public.features.pentatonics = true
    expect((await withLevel()).text()).toContain('Pentatonics')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', overlay: 'off', pentRung: 0, pentSide: 'flat', pentPath: 'one', pentBasis: 'key', pentRank: 1, ...props } })

describe('the pentatonic controls', () => {
  afterEach(() => {
    useRuntimeConfig().public.features.pentatonics = false
    useRuntimeConfig().public.features.hexatonics = false
  })
  const overlay = (w: Awaited<ReturnType<typeof mount>>) => w.find('[aria-label="Overlay"]')
  const options = async (w: Awaited<ReturnType<typeof mount>>) => {
    await overlay(w).trigger('click')
    return w.findAll('[role=option]').map((o) => o.text())
  }

  it('has no Overlay with neither flag on', async () => {
    const w = await mount()
    expect(overlay(w).exists()).toBe(false)
    expect(w.text()).not.toContain('Pentatonic')
  })

  it('offers Off and each overlay whose flag is on', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    expect(await options(await mount())).toEqual(['Off', 'Pentatonic'])
    useRuntimeConfig().public.features.hexatonics = true
    expect(await options(await mount())).toEqual(['Off', 'Pentatonic', 'Hexatonic'])
    useRuntimeConfig().public.features.pentatonics = false
    expect(await options(await mount())).toEqual(['Off', 'Hexatonic'])
  })

  it('shows the overlay in force: one whose flag is off reads Off, with no sub-controls', async () => {
    useRuntimeConfig().public.features.hexatonics = true
    const w = await mount({ overlay: 'pentatonic' })
    expect(overlay(w).text()).toContain('Off')
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
  })

  it('adds no control for Hexatonic', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    useRuntimeConfig().public.features.hexatonics = true
    const w = await mount({ overlay: 'hexatonic' })
    expect(overlay(w).text()).toContain('Hexatonic')
    for (const label of ['Pentatonic path', 'Pentatonic rung', 'Pentatonic side', 'Pentatonic rank', 'Pentatonics ranked against']) expect(w.find(`[aria-label="${label}"]`).exists()).toBe(false)
  })

  it('picks an overlay', async () => {
    useRuntimeConfig().public.features.hexatonics = true
    const w = await mount()
    await overlay(w).trigger('click')
    await w.findAll('[role=option]')[1]?.trigger('click')
    expect(w.emitted('update:overlay')?.[0]).toEqual(['hexatonic'])
  })

  it('shows Rung, and Side away from Home and 6, once the row is on', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    expect((await mount()).find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    const home = await mount({ overlay: 'pentatonic', pentRung: 0 })
    expect(home.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    expect(home.text()).not.toContain('♯')
    const two = await mount({ overlay: 'pentatonic', pentRung: 2 })
    expect(two.text()).toContain('♯')
  })

  it('offers the paths, Custom only while current, and Rung and Side only with One rung', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const one = await mount({ overlay: 'pentatonic', pentPath: 'one' })
    expect(one.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
    expect(one.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    const slip = await mount({ overlay: 'pentatonic', pentPath: 'side-slip', pentRung: 2 })
    expect(slip.find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic side"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic path"]').text()).toContain('Side-slip')
    const custom = await mount({ overlay: 'pentatonic', pentPath: 'custom' })
    expect(custom.find('[aria-label="Pentatonic path"]').text()).toContain('Custom')
  })

  it('shows Rank in place of Path under the chord basis', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ overlay: 'pentatonic', pentBasis: 'chord' })
    expect(w.find('[aria-label="Pentatonic rank"]').exists()).toBe(true)
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
    expect(w.find('[aria-label="Pentatonics ranked against"]').exists()).toBe(true)
    const key = await mount({ overlay: 'pentatonic' })
    expect(key.find('[aria-label="Pentatonic rank"]').exists()).toBe(false)
    expect(key.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
  })

  it('keeps the Overlay while editing, when Numerals and Scales hide', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ lockLabels: true })
    expect(overlay(w).exists()).toBe(true)
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

  it('Intermediate shows them but not the Overlay', async () => {
    at('intermediate')
    useRuntimeConfig().public.features.pentatonics = true
    const w = await withLevel()
    expect(w.text()).toMatch(/level-slot[\s\S]*Analysis[\s\S]*Numerals[\s\S]*Line/)
    expect(w.find('[aria-label="Overlay"]').exists()).toBe(false)
    expect((await withLevel({ sheet: 'scales' })).text()).toContain('Spell Scale')
  })

  it('Everything shows the Overlay', async () => {
    at('everything')
    useRuntimeConfig().public.features.pentatonics = true
    expect((await withLevel()).find('[aria-label="Overlay"]').exists()).toBe(true)
  })
})

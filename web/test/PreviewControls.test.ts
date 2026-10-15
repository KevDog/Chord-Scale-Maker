import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', overlay: 'off', pentRung: 0, pentSide: 'flat', pentPath: 'one', pentBasis: 'key', pentDegree: 'auto', ...props } })

/** mounted with the Pentatonic options' popover opened from its chevron (#293) */
const opened = async (props: Record<string, unknown> = {}) => {
  const w = await mount(props)
  await w.find('button[aria-label="Pentatonic options"]').trigger('click')
  return w
}

describe('the pentatonic controls', () => {
  const overlay = (w: Awaited<ReturnType<typeof mount>>) => w.find('[aria-label="Superimpose"]')
  const options = async (w: Awaited<ReturnType<typeof mount>>) => {
    await overlay(w).trigger('click')
    return w.findAll('[role=option]').map((o) => o.text())
  }

  it('offers Off, Pentatonic and Hexatonic', async () => {
    expect(await options(await mount())).toEqual(['Off', 'Pentatonic', 'Hexatonic'])
  })

  it('adds no control for Hexatonic', async () => {
    const w = await mount({ overlay: 'hexatonic' })
    expect(overlay(w).text()).toContain('Hexatonic')
    for (const label of ['Pentatonic path', 'Pentatonic rung', 'Pentatonic side', 'Pentatonic built on', 'Pentatonics ranked against']) expect(w.find(`[aria-label="${label}"]`).exists()).toBe(false)
  })

  it('picks an overlay', async () => {
    const w = await mount()
    await overlay(w).trigger('click')
    await w.findAll('[role=option]')[2]?.trigger('click')
    expect(w.emitted('update:overlay')?.[0]).toEqual(['hexatonic'])
  })

  it('opens the Pentatonic options beside the Superimpose as it turns to Pentatonic, and closes them with Escape or a click outside (#293)', async () => {
    const w = await mount({ 'onUpdate:overlay': (o: string) => w.setProps({ overlay: o }) })
    const panel = () => w.find('[role="dialog"][aria-label="Pentatonic options"]')
    await overlay(w).trigger('click')
    await w.findAll('[role=option]').find((o) => o.text() === 'Pentatonic')!.trigger('click')
    expect(panel().exists()).toBe(true)
    expect(panel().find('[aria-label="Pentatonic path"]').exists()).toBe(true)
    await panel().trigger('keydown', { key: 'Escape' })
    expect(panel().exists()).toBe(false)
    await w.find('button[aria-label="Pentatonic options"]').trigger('click')
    expect(panel().exists()).toBe(true)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(panel().exists()).toBe(false)
  })

  it('starts the Pentatonic options closed when the overlay is already on (a reload)', async () => {
    const w = await mount({ overlay: 'pentatonic' })
    expect(w.find('button[aria-label="Pentatonic options"]').attributes('aria-expanded')).toBe('false')
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
  })

  it('shows Rung, and Side away from Home and 6, once the row is on', async () => {
    expect((await mount()).find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    const home = await opened({ overlay: 'pentatonic', pentRung: 0 })
    expect(home.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    expect(home.text()).not.toContain('♯')
    const two = await opened({ overlay: 'pentatonic', pentRung: 2 })
    expect(two.text()).toContain('♯')
  })

  it('offers the paths, Custom only while current, and Rung and Side only with One rung', async () => {
    const one = await opened({ overlay: 'pentatonic', pentPath: 'one' })
    expect(one.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
    expect(one.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    const slip = await opened({ overlay: 'pentatonic', pentPath: 'side-slip', pentRung: 2 })
    expect(slip.find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic side"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic path"]').text()).toContain('Side-slip')
    const custom = await opened({ overlay: 'pentatonic', pentPath: 'custom' })
    expect(custom.find('[aria-label="Pentatonic path"]').text()).toContain('Custom')
  })

  it('shows Built on in place of Path under the chord basis', async () => {
    const w = await opened({ overlay: 'pentatonic', pentBasis: 'chord', pentDegree: 9 })
    expect(w.find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: 6')
    expect((await opened({ overlay: 'pentatonic', pentBasis: 'chord' })).find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: Auto')
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
    expect(w.find('[aria-label="Pentatonics ranked against"]').exists()).toBe(true)
    const key = await opened({ overlay: 'pentatonic' })
    expect(key.find('[aria-label="Pentatonic built on"]').exists()).toBe(false)
    expect(key.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
  })

  it('keeps the Superimpose while editing, when Numerals and Scales hide', async () => {
    const w = await mount({ lockLabels: true })
    expect(overlay(w).exists()).toBe(true)
    expect(w.text()).not.toContain('Numerals')
  })
})

describe('interface levels', () => {
  const withLevel = (props: Record<string, unknown> = {}) =>
    mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', ...props }, slots: { level: () => 'level-slot' } })
  const at = (level: 'essentials' | 'intermediate' | 'everything') => {
    useInterface().level.value = level
  }
  afterEach(() => {
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

  it('Intermediate shows them but not the Superimpose', async () => {
    at('intermediate')
    const w = await withLevel()
    expect(w.text()).toMatch(/level-slot[\s\S]*Analysis[\s\S]*Numerals[\s\S]*Line/)
    expect(w.find('[aria-label="Superimpose"]').exists()).toBe(false)
    expect((await withLevel({ sheet: 'scales' })).text()).toContain('Spell Scale')
  })

  it('Everything shows the Superimpose', async () => {
    at('everything')
    expect((await withLevel()).find('[aria-label="Superimpose"]').exists()).toBe(true)
  })
})

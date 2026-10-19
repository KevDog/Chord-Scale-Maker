import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PracticePanel from '~/components/PracticePanel.vue'
import { PENT_INSIDE_HELP } from '~/utils/pentatonics'

const boxes = [
  { key: '1', label: '1' },
  { key: 'b3', label: '♭3' },
  { key: '3', label: '3' },
  { key: 'b7', label: '♭7' },
]
const mount = (props: Record<string, unknown>) =>
  mountSuspended(PracticePanel, { props: { mode: 'root', startText: 'C', boxes, selection: null, lit: [], ...props } })

describe('PracticePanel', () => {
  it('offers per-chord presets from the root, All from a start note', async () => {
    expect((await mount({})).findAll('button').map((b) => b.text())).toEqual(['Chord tones', 'Guide tones', 'Tensions', 'Pentatonic', 'Hexatonic', 'Quartal', 'Clear'])
    const from = await mount({ mode: 'from', startText: 'Eb' })
    expect(from.findAll('button').map((b) => b.text())).toEqual(['All', 'Pentatonic', 'Hexatonic', 'Quartal', 'Clear'])
    expect(from.text()).toContain('pitches spelled from E♭')
  })

  it('shows what a preset lights, and editing a box starts a custom selection from it', async () => {
    const w = await mount({ selection: { preset: 'guideTones' }, lit: ['b3', '3', 'b7'] })
    const boxesEl = w.findAll('input[type=checkbox]')
    expect(boxesEl.map((b) => (b.element as HTMLInputElement).checked)).toEqual([false, true, true, true])
    expect(w.find('button[aria-pressed=true]').text()).toBe('Guide tones')
    await boxesEl[2]?.trigger('change')
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['b3', 'b7'] }]])
  })

  it('toggles a preset off, and clears', async () => {
    const w = await mount({ selection: { preset: 'chordTones' }, lit: ['1', '3'] })
    await w.findAll('button')[0]?.trigger('click') // the active preset
    await w.findAll('button').at(-1)?.trigger('click') // Clear
    expect(w.emitted('update:selection')).toEqual([[null], [null]])
    const off = await mount({})
    expect(off.findAll('button').at(-1)?.attributes('disabled')).toBeDefined()
    await off.findAll('input[type=checkbox]')[1]?.trigger('change')
    expect(off.emitted('update:selection')).toEqual([[{ keys: ['b3'] }]])
  })
})

describe('PracticePanel’s Pentatonic preset (#266)', () => {
  it('starts at Auto and shows the Built on picker while on', async () => {
    const off = await mount({})
    expect(off.find('[aria-label="Pentatonic built on"]').exists()).toBe(false)
    await off.findAll('button').find((b) => b.text() === 'Pentatonic')?.trigger('click')
    expect(off.emitted('update:selection')).toEqual([[{ preset: 'pentatonic', degree: 'auto' }]])
    const auto = await mount({ selection: { preset: 'pentatonic', degree: 'auto' }, lit: ['1'] })
    expect(auto.find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: Auto')
    const on = await mount({ selection: { preset: 'pentatonic', degree: 10 }, lit: ['1'] })
    expect(on.find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: ♭7')
    expect(on.find('button[aria-pressed=true]').text()).toBe('Pentatonic')
  })

  it('picks a degree from Auto, 1, ♭2 … 7', async () => {
    const w = await mount({ selection: { preset: 'pentatonic', degree: 'auto' }, lit: ['1'] })
    await w.find('[aria-label="Pentatonic built on"]').trigger('click')
    const options = w.findAll('[role="option"]')
    expect(options.map((o) => o.text())).toEqual(['Auto', '1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'])
    await options[3]?.trigger('click')
    expect(w.emitted('update:selection')?.at(-1)).toEqual([{ preset: 'pentatonic', degree: 2 }])
  })

  it('says how Built on works, with the usual inside choices', async () => {
    const text = (await mount({})).text()
    expect(text).toContain('Built on')
    expect(text).toContain(PENT_INSIDE_HELP)
  })

  it('presses no box, and says a click starts a custom pick (#308)', async () => {
    for (const selection of [{ preset: 'pentatonic', degree: 'auto' }, { preset: 'hexatonic', pair: 0, grouping: 'triads' }]) {
      const w = await mount({ selection, lit: ['1', 'b3'] })
      expect(w.findAll('input[type=checkbox]').some((b) => (b.element as HTMLInputElement).checked)).toBe(false)
      expect(w.text()).toContain('Click a box to start a custom pick from these notes')
    }
    expect((await mount({ selection: { preset: 'guideTones' }, lit: ['b3'] })).text()).not.toContain('Click a box')
  })

  it('turns a lit box on, not off, as it seeds the custom pick: it showed unpressed', async () => {
    const w = await mount({ selection: { preset: 'pentatonic', degree: 'auto' }, lit: ['1', 'b3'] })
    await w.findAll('input[type=checkbox]')[1]?.trigger('change') // ♭3
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['1', 'b3'] }]])
  })

  it('names its added notes in a legend (#308)', async () => {
    const w = await mount({ selection: { preset: 'pentatonic', degree: 'auto' }, lit: ['1'] })
    expect(w.findAll('[data-slot="pent-legend"] li').map((l) => l.text())).toEqual(['In the scale', 'Outside the scale'])
    expect((await mount({})).find('[data-slot="pent-legend"]').exists()).toBe(false)
  })

  it('edits a box into a custom selection from what it lit', async () => {
    const w = await mount({ selection: { preset: 'pentatonic', degree: 'auto' }, lit: ['1', 'b3'] })
    await w.findAll('input[type=checkbox]')[3]?.trigger('change') // ♭7
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['1', 'b3', 'b7'] }]])
  })
})

describe('PracticePanel interface levels', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('offers the Pentatonic preset only at Everything', async () => {
    useInterface().level.value = 'intermediate'
    expect((await mount({})).text()).not.toContain('Pentatonic')
    useInterface().level.value = 'everything'
    expect((await mount({})).text()).toContain('Pentatonic')
  })
})

describe('PracticePanel’s Hexatonic preset', () => {
  const texts = async (props: Record<string, unknown>) => (await mount(props)).findAll('button[aria-pressed]').map((b) => b.text())
  const hex = (pair: number, grouping: string) => ({ selection: { preset: 'hexatonic', pair, grouping }, lit: ['1', '3'] })

  it('is offered after Pentatonic', async () => {
    expect(await texts({})).toEqual(['Chord tones', 'Guide tones', 'Tensions', 'Pentatonic', 'Hexatonic', 'Quartal'])
    expect(await texts({ mode: 'from', startText: 'Eb' })).toEqual(['All', 'Pentatonic', 'Hexatonic', 'Quartal'])
  })

  it('starts at Auto and Triad pair, and shows its two listboxes only while it is the selection', async () => {
    const off = await mount({})
    expect(off.find('[aria-label="Hexatonic pair"]').exists()).toBe(false)
    expect(off.find('[aria-label="Hexatonic grouping"]').exists()).toBe(false)
    await off.findAll('button').find((b) => b.text() === 'Hexatonic')?.trigger('click')
    expect(off.emitted('update:selection')).toEqual([[{ preset: 'hexatonic', pair: 0, grouping: 'triads' }]])
    const on = await mount({ ...hex(0, 'triads') })
    expect(on.find('button[aria-pressed=true]').text()).toBe('Hexatonic')
    expect(on.find('[aria-label="Hexatonic pair"]').text()).toContain('Pair: Auto')
    expect((await mount({ ...hex(5, 'triads') })).find('[aria-label="Hexatonic pair"]').text()).toContain('Pair: 5')
    expect(on.find('[aria-label="Hexatonic grouping"]').text()).toContain('Triad pair')
    expect((await mount({ selection: { preset: 'pentatonic', degree: 'auto' } })).find('[aria-label="Hexatonic pair"]').exists()).toBe(false)
  })

  it('offers Auto and pairs 1 … 8, and the four groupings; a pick keeps the other value', async () => {
    const w = await mount({ ...hex(3, 'pent') })
    await w.find('[aria-label="Hexatonic pair"]').trigger('click')
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['Auto', '1', '2', '3', '4', '5', '6', '7', '8'])
    await w.findAll('[role=option]')[5]?.trigger('click')
    await w.find('[aria-label="Hexatonic grouping"]').trigger('click')
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['Triad pair', 'Chord tones + color', 'Pentatonic + 1', 'Trichords 3+3'])
    await w.findAll('[role=option]')[3]?.trigger('click')
    expect(w.emitted('update:selection')).toEqual([[{ preset: 'hexatonic', pair: 5, grouping: 'pent' }], [{ preset: 'hexatonic', pair: 3, grouping: 'trichords' }]])
  })

  it('ranks against Chord until Key is chosen, which hides Pair and keeps the grouping (#432)', async () => {
    const w = await mount({ ...hex(3, 'tones') })
    const basis = w.find('[aria-label="Hexatonics ranked against"]')
    expect(basis.find('input[value="chord"]').element).toHaveProperty('checked', true)
    await basis.find('input[value="key"]').setValue(true)
    expect(w.emitted('update:selection')).toEqual([[{ preset: 'hexatonic', pair: 3, grouping: 'tones', basis: 'key' }]])
    const key = await mount({ selection: { preset: 'hexatonic', pair: 3, grouping: 'tones', basis: 'key' }, lit: [] })
    expect(key.find('[aria-label="Hexatonic pair"]').exists()).toBe(false)
    await key.find('[aria-label="Hexatonics ranked against"] input[value="chord"]').setValue(true)
    expect(key.emitted('update:selection')).toEqual([[{ preset: 'hexatonic', pair: 3, grouping: 'tones' }]])
  })

  it('names the grouping’s two groups in a legend (never “+1”)', async () => {
    const legend = async (grouping: string) => (await mount({ ...hex(0, grouping) })).findAll('[data-slot="hex-legend"] li').map((l) => l.text())
    expect(await legend('triads')).toEqual(['Lower triad', 'Upper triad'])
    expect(await legend('tones')).toEqual(['Chord tones', 'Color'])
    expect(await legend('pent')).toEqual(['Pentatonic', 'Other'])
    expect(await legend('trichords')).toEqual(['Lower three', 'Upper three'])
  })

  it('explains the pairs in its help text', async () => {
    expect((await mount({})).text()).toContain('leaves out degree')
  })

  it('edits a box into a custom selection from what it lit', async () => {
    const w = await mount({ ...hex(0, 'triads') })
    await w.findAll('input[type=checkbox]')[3]?.trigger('change') // ♭7
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['1', '3', 'b7'] }]])
  })
})

describe('PracticePanel’s Hexatonic preset and interface levels', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('is offered only at Everything', async () => {
    useInterface().level.value = 'intermediate'
    expect((await mount({})).text()).not.toContain('Hexatonic')
    useInterface().level.value = 'everything'
    expect((await mount({})).text()).toContain('Hexatonic')
  })
})

describe('PracticePanel’s links to How it decides', () => {
  it('links the Pentatonic and Hexatonic text to how Auto chooses', async () => {
    const w = await mount({})
    expect(w.find('a[href="/how-it-decides#pent.auto"]').exists()).toBe(true)
    expect(w.find('a[href="/how-it-decides#hex.auto"]').exists()).toBe(true)
  })
})

describe('PracticePanel’s Quartal preset (#432)', () => {
  const quartal = (over: Record<string, unknown> = {}) => ({ selection: { preset: 'quartal', degree: 'auto', notes: 4, ...over }, lit: [] })

  it('starts at Auto, four notes, augmented allowed; its controls show only while it is the selection', async () => {
    const off = await mount({})
    expect(off.find('[aria-label="Quartal built on"]').exists()).toBe(false)
    await off.findAll('button').find((b) => b.text() === 'Quartal')?.trigger('click')
    expect(off.emitted('update:selection')).toEqual([[{ preset: 'quartal', degree: 'auto', notes: 4 }]])
    const on = await mount(quartal())
    expect(on.find('[aria-label="Quartal built on"]').text()).toContain('Built on: Auto')
    expect(on.find('[aria-label="Quartal notes"] input[value="4"]').element).toHaveProperty('checked', true)
  })

  it('offers Auto and degrees 1 … 7; a change keeps the other values', async () => {
    const w = await mount(quartal({ notes: 3, perfect: true }))
    await w.find('[aria-label="Quartal built on"]').trigger('click')
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['Auto', '1', '2', '3', '4', '5', '6', '7'])
    await w.findAll('[role=option]')[2]?.trigger('click')
    await w.find('[aria-label="Quartal notes"] input[value="4"]').setValue(true)
    await w.findAll('button').find((b) => b.text() === 'Perfect only')?.trigger('click')
    expect(w.emitted('update:selection')).toEqual([
      [{ preset: 'quartal', degree: 2, notes: 3, perfect: true }],
      [{ preset: 'quartal', degree: 'auto', notes: 4, perfect: true }],
      [{ preset: 'quartal', degree: 'auto', notes: 3 }],
    ])
  })
})

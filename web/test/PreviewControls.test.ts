import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { openPanel } from './railPanels'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', overlay: 'off', pentRung: 0, pentSide: 'flat', pentPath: 'one', pentBasis: 'key', pentDegree: 'auto', ...props } })

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

  it('offers Off, Pentatonic, Hexatonic and Quartal', async () => {
    expect(await options(await mount())).toEqual(['Off', 'Pentatonic', 'Hexatonic', 'Quartal'])
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

  it('offers Hexatonic options, Ranked against Key or Chord, only under the Hexatonic overlay (#432)', async () => {
    expect((await mount({ overlay: 'pentatonic' })).find('button[aria-label="Hexatonic options"]').exists()).toBe(false)
    const w = await mount({ overlay: 'hexatonic', hexBasis: 'chord' })
    await w.find('button[aria-label="Hexatonic options"]').trigger('click')
    const basis = w.find('[aria-label="Hexatonics ranked against"]')
    expect(basis.findAll('label').map((l) => l.text())).toEqual(['Key', 'Chord'])
    await basis.find('input[value="key"]').setValue(true)
    expect(w.emitted('update:hexBasis')).toEqual([['key']])
  })

  it('offers Quartal options, Notes and Perfect only, only under the Quartal overlay (#432)', async () => {
    expect((await mount({ overlay: 'hexatonic' })).find('button[aria-label="Quartal options"]').exists()).toBe(false)
    const w = await mount({ overlay: 'quartal', quartNotes: 4, quartPerfect: false })
    await w.find('button[aria-label="Quartal options"]').trigger('click')
    const notes = w.find('[aria-label="Quartal notes"]')
    expect(notes.findAll('label').map((l) => l.text())).toEqual(['Auto', '3', '4'])
    await notes.find('input[value="3"]').setValue(true)
    expect(w.emitted('update:quartNotes')).toEqual([[3]])
    const perfect = w.findAll('button').find((b) => b.text() === 'Perfect only')!
    await perfect.trigger('click')
    expect(w.emitted('update:quartPerfect')).toEqual([[true]])
  })

  it('keeps the Superimpose while editing, when Numerals and Scales hide', async () => {
    const w = await mount({ lockLabels: true })
    expect(overlay(w).exists()).toBe(true)
    expect(w.text()).not.toContain('Numerals')
  })
})

describe('the Line under the Pentatonic overlay (#284)', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('names the 7th Chords slot Pentatonic while Superimpose is Pentatonic', async () => {
    expect((await mount({ overlay: 'pentatonic' })).text()).toContain('Pentatonic')
    expect((await mount({ overlay: 'pentatonic' })).text()).not.toContain('7th Chords')
    expect((await mount({ overlay: 'off' })).text()).toContain('7th Chords')
    expect((await mount({ overlay: 'hexatonic' })).text()).toContain('Triad pair') // #325
    expect((await mount({ overlay: 'hexatonic' })).text()).not.toContain('7th Chords')
  })

  it('offers the direction, and no Leave out, in place of the arpeggio pattern while the line is Triad pair (#325)', async () => {
    const w = await mount({ overlay: 'hexatonic', lineMode: 'arpeggio', arpDir: 'up-down' })
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Triad pair direction"]').text()).toBe('Up & down')
    expect(w.find('[aria-label="Leave out"]').exists()).toBe(false)
    expect(w.find('[aria-label="Arpeggio pattern"]').exists()).toBe(false)
  })

  it('offers the Triad pair line’s shape while the line is Triad pair, and not under another overlay (#432)', async () => {
    const w = await mount({ overlay: 'hexatonic', lineMode: 'arpeggio', pairLine: 'nearest' })
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Triad pair shape"]').text()).toBe('Shape: Nearest')
    const q = await mount({ overlay: 'quartal', lineMode: 'arpeggio' })
    await openPanel(q, 'Line options')
    expect(q.find('[aria-label="Triad pair shape"]').exists()).toBe(false)
  })

  it('offers the direction in place of the arpeggio pattern while the line is Quartal (#432)', async () => {
    const w = await mount({ overlay: 'quartal', lineMode: 'arpeggio', arpDir: 'down' })
    expect(w.text()).toContain('Quartal')
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Quartal direction"]').text()).toBe('Down')
    expect(w.find('[aria-label="Leave out"]').exists()).toBe(false)
    expect(w.find('[aria-label="Arpeggio pattern"]').exists()).toBe(false)
  })

  it('offers Leave out and the direction in place of the arpeggio pattern while the line is Pentatonic', async () => {
    const w = await mount({ overlay: 'pentatonic', lineMode: 'arpeggio', pentLeave: 'b3', arpDir: 'down' })
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Leave out"]').text()).toBe('Leave out: ♭3')
    expect(w.find('[aria-label="Pentatonic direction"]').text()).toBe('Down')
    expect(w.find('[aria-label="Arpeggio pattern"]').exists()).toBe(false)
    await w.find('[aria-label="Leave out"]').trigger('click')
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['1', '♭3', '4', '5', '♭7'])
  })

  it('keeps the arpeggio pattern, and no Leave out, under 7th Chords', async () => {
    const w = await mount({ overlay: 'off', lineMode: 'arpeggio' })
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Arpeggio pattern"]').exists()).toBe(true)
    expect(w.find('[aria-label="Leave out"]').exists()).toBe(false)
    expect((await mount({ overlay: 'pentatonic', lineMode: 'guide' })).find('[aria-label="Leave out"]').exists()).toBe(false)
  })

  it('shows Leave out only where the Superimpose shows (Everything)', async () => {
    useInterface().level.value = 'intermediate'
    const w = await mount({ overlay: 'pentatonic', lineMode: 'arpeggio' })
    expect(w.find('[aria-label="Leave out"]').exists()).toBe(false)
  })

  it('picks a Leave out', async () => {
    const w = await mount({ overlay: 'pentatonic', lineMode: 'arpeggio' })
    await openPanel(w, 'Line options')
    await w.find('[aria-label="Leave out"]').trigger('click')
    await w.findAll('[role=option]')[4]?.trigger('click')
    expect(w.emitted('update:pentLeave')?.[0]).toEqual(['b7'])
  })
})

describe('interface levels', () => {
  const withLevel = (props: Record<string, unknown> = {}) =>
    mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', ...props }, slots: { level: () => 'level-slot' } })
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

describe('the Arpeggios sheet’s Triad pairs (#436)', () => {
  const dir = (w: Awaited<ReturnType<typeof mount>>) => w.find('[aria-label="Arpeggio direction"]')

  it('offers Triad pairs beside 7th Chord and Extended', async () => {
    const w = await mount({ sheet: 'arpeggios', arpNotes: 'seventh', arpDir: 'up' })
    expect(w.find('fieldset').text()).toContain('Triad pairs')
  })

  it('adds Block to the direction under Triad pairs only', async () => {
    const seventh = await mount({ sheet: 'arpeggios', arpNotes: 'seventh', arpDir: 'up' })
    await dir(seventh).trigger('click')
    expect(seventh.findAll('[role=option]').map((o) => o.text())).toEqual(['Up', 'Down', 'Up & down'])
    const pairs = await mount({ sheet: 'arpeggios', arpNotes: 'pairs', arpDir: 'up', arpShape: 'arpeggiated' })
    await dir(pairs).trigger('click')
    expect(pairs.findAll('[role=option]').map((o) => o.text())).toEqual(['Up', 'Down', 'Up & down', 'Block'])
  })

  it('shows Block while the shape is Block, and sets the shape or the direction', async () => {
    const block = await mount({ sheet: 'arpeggios', arpNotes: 'pairs', arpDir: 'down', arpShape: 'block' })
    expect(dir(block).text()).toBe('Block')
    await dir(block).trigger('click')
    await block.findAll('[role=option]')[2]?.trigger('click')
    expect([block.emitted('update:arpShape')?.[0], block.emitted('update:arpDir')?.[0]]).toEqual([['arpeggiated'], ['up-down']])
    const w = await mount({ sheet: 'arpeggios', arpNotes: 'pairs', arpDir: 'up', arpShape: 'arpeggiated' })
    await dir(w).trigger('click')
    await w.findAll('[role=option]')[3]?.trigger('click')
    expect(w.emitted('update:arpShape')?.[0]).toEqual(['block'])
    expect(w.emitted('update:arpDir')).toBeUndefined()
  })

  it('shows the direction, not Block, under 7th Chord whatever the shape', async () => {
    expect(dir(await mount({ sheet: 'arpeggios', arpNotes: 'seventh', arpDir: 'down', arpShape: 'block' })).text()).toBe('Down')
  })
})

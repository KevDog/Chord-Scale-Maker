import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { openPanel } from './railPanels'
import PreviewControls from '~/components/PreviewControls.vue'

mockNuxtImport('useFeature', () => () => true)

const mount = () =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', lineMode: 'off', rhythm: 'off' } })

describe('the Rhythm controls (rhythm spec §9)', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('reads Off again after a reset from the hidden-settings notice, with Your rhythm… holding text that doesn’t read', async () => {
    useInterface().level.value = 'intermediate'
    const w = await mount()
    await openPanel(w, 'Line options')
    await w.find('[aria-label="Rhythm"]').trigger('click')
    await w.findAll('[role=option]').find((o) => o.text() === 'Your rhythm…')!.trigger('click')
    await w.find('input[aria-label="Your rhythm"]').setValue('8: xq')
    await nextTick()
    expect(w.find('[aria-label="Rhythm"]').text()).toContain('Your rhythm…') // it plays Off, and stays chosen
    useInterface().level.value = 'essentials' // the notice offers the reset where these controls hide
    await nextTick()
    await w.setProps({ rhythm: 'off' }) // the reset: Off, as it already was
    useInterface().level.value = 'intermediate'
    await nextTick()
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Rhythm"]').text()).toContain('Rhythm: Off')
  })

  it('keeps Your rhythm…’s text that doesn’t read when Line options closes and opens again', async () => {
    const w = await mount()
    await openPanel(w, 'Line options')
    await w.find('[aria-label="Rhythm"]').trigger('click')
    await w.findAll('[role=option]').find((o) => o.text() === 'Your rhythm…')!.trigger('click')
    await w.find('input[aria-label="Your rhythm"]').setValue('8: xq')
    await nextTick()
    await w.findAll('button').find((b) => b.attributes('aria-label') === 'Line options')!.trigger('click') // close
    await nextTick()
    expect(w.find('input[aria-label="Your rhythm"]').exists()).toBe(false)
    await openPanel(w, 'Line options')
    expect(w.find('[aria-label="Rhythm"]').text()).toContain('Your rhythm…')
    expect((w.find('input[aria-label="Your rhythm"]').element as HTMLInputElement).value).toBe('8: xq')
  })

  it('lists the tuplet pulses as Units families at Everything only (Phase 4 spec §7, D22)', async () => {
    const units = async (): Promise<string[]> => {
      const w = await mount()
      await openPanel(w, 'Line options')
      await w.find('[aria-label="Rhythm"]').trigger('click')
      return w.findAll('[role=option]').map((o) => o.text())
    }
    const tuplets = ['Quarter-note triplets', 'Quarter-note quintuplets', '8th-note quintuplets', '16th quintuplets', 'Sextuplets', 'Septuplets']
    expect(await units()).toEqual(expect.arrayContaining(['Triplets', ...tuplets]))
    useInterface().level.value = 'intermediate'
    const fewer = await units()
    expect(fewer).toContain('Triplets')
    expect(fewer.filter((o) => tuplets.includes(o))).toEqual([])
  })

  it('reads a typed tuplet pulse at Everything only: below it the field shows its error and nothing applies (Phase 4 spec D22)', async () => {
    const typed = async (level: 'everything' | 'intermediate') => {
      useInterface().level.value = level
      const w = await mount()
      await openPanel(w, 'Line options')
      await w.find('[aria-label="Rhythm"]').trigger('click')
      await w.findAll('[role=option]').find((o) => o.text() === 'Your rhythm…')!.trigger('click')
      await w.find('input[aria-label="Your rhythm"]').setValue('8q: x_x__')
      await nextTick()
      return w
    }
    const at = await typed('everything')
    expect(at.find('#rhythm-error').exists()).toBe(false)
    expect(at.emitted('update:rhythm')?.at(-1)).toEqual(['custom:8q:x_x__'])
    const below = await typed('intermediate')
    expect(below.find('#rhythm-error').text()).toContain('Use x, ., _ and > after')
    expect((below.emitted('update:rhythm') ?? []).flat()).not.toContain('custom:8q:x_x__')
  })

  describe('the Groups and Step (Phase 4 spec §7)', () => {
    const OFF = { groups: null, gears: null, step: { unit: 'section', bars: 4 } } as const
    const UP = { ...OFF, groups: [3, 4, 5, 6, 7] }
    const at = async (rhythm: string, rhythmPath: object = OFF) => {
      const w = await mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', lineMode: 'off', rhythm, rhythmPath } })
      await openPanel(w, 'Line options')
      return w
    }
    const choose = async (w: Awaited<ReturnType<typeof at>>, box: string, option: string) => {
      await w.find(`[aria-label="${box}"]`).trigger('click')
      await w.findAll('[role=option]').find((o) => o.text() === option)!.trigger('click')
      await nextTick()
    }

    it('shows Groups for a unit, and the Step only while a path is on', async () => {
      const w = await at('unit:8:3:accents')
      expect(w.find('[aria-label="Groups"]').text()).toContain('Groups: One')
      expect(w.find('[aria-label="Step"]').exists()).toBe(false)
      await choose(w, 'Groups', 'Up')
      expect(w.emitted('update:rhythmPath')?.at(-1)).toEqual([UP])
      const on = await at('unit:8:3:accents', UP)
      expect(on.find('[aria-label="Groups"]').text()).toContain('Groups: Up')
      expect(on.find('[aria-label="Step"]').text()).toContain('Step: By section')
      await choose(on, 'Step', 'Every 2 bars')
      expect(on.emitted('update:rhythmPath')?.at(-1)).toEqual([{ ...UP, step: { unit: 'bars', bars: 2 } }])
    })

    it('hides Groups for your rhythm and a per-bar rhythm, and below Everything', async () => {
      expect((await at('custom:8:>xx', UP)).find('[aria-label="Groups"]').exists()).toBe(false)
      expect((await at('custom:8:>xx', UP)).find('[aria-label="Step"]').exists()).toBe(false) // Groups don't act on it
      expect((await at('run:8:4:0', UP)).find('[aria-label="Groups"]').exists()).toBe(false)
      useInterface().level.value = 'intermediate'
      expect((await at('unit:8:3:accents', UP)).find('[aria-label="Groups"]').exists()).toBe(false)
    })

    it('reads Your list…, with an error under it for a list that doesn’t read', async () => {
      const w = await at('unit:8:3:accents')
      await choose(w, 'Groups', 'Your list…')
      const input = w.find('input[aria-label="Your groups"]')
      expect(input.attributes('placeholder')).toBe('3 4 5')
      await input.setValue('3 5')
      await nextTick()
      expect(w.emitted('update:rhythmPath')?.at(-1)).toEqual([{ ...OFF, groups: [3, 5] }])
      await input.setValue('3 9')
      await nextTick()
      expect(w.find('#groups-error').text()).toContain('Groups of 2 to 7')
      expect(w.find('[aria-label="Groups"]').text()).toContain('Your list…')
    })

    it('shows Gears for a unit and your rhythm, and the Step while it acts; not for a per-bar rhythm', async () => {
      const w = await at('unit:8:3:accents')
      expect(w.find('[aria-label="Gears"]').text()).toContain('Gears: One')
      await choose(w, 'Gears', 'Up the gears')
      expect(w.emitted('update:rhythmPath')?.at(-1)).toEqual([{ ...OFF, gears: ['4t', '8', '8t', '16', '16t'] }])
      const custom = await at('custom:8:>xx', { ...OFF, gears: ['16t', '16', '8t', '8', '4t'] })
      expect(custom.find('[aria-label="Groups"]').exists()).toBe(false)
      expect(custom.find('[aria-label="Gears"]').text()).toContain('Gears: Down the gears')
      expect(custom.find('[aria-label="Step"]').exists()).toBe(true)
      expect((await at('run:8:4:0', { ...OFF, gears: ['8', '16'] })).find('[aria-label="Gears"]').exists()).toBe(false)
      expect((await at('card:downbeats', { ...OFF, gears: ['8', '16'] })).find('[aria-label="Gears"]').exists()).toBe(false)
    })

    it('reads Gears’ Your list… by the pulses’ spellings, with an error under it', async () => {
      const w = await at('unit:8:3:accents')
      await choose(w, 'Gears', 'Your list…')
      const input = w.find('input[aria-label="Your gears"]')
      await input.setValue('8 16s')
      await nextTick()
      expect(w.emitted('update:rhythmPath')?.at(-1)).toEqual([{ ...OFF, gears: ['8', '16s'] }])
      await input.setValue('8 32')
      await nextTick()
      expect(w.find('#gears-error').text()).toContain('Pulses from 4, 8')
      expect(w.find('[aria-label="Gears"]').text()).toContain('Your list…')
    })

    it('keeps Your list…’s text that doesn’t read, in Groups and Gears, when Line options closes and opens again (#553)', async () => {
      const w = await at('unit:8:3:accents')
      await choose(w, 'Groups', 'Your list…')
      await w.find('input[aria-label="Your groups"]').setValue('3 9')
      await choose(w, 'Gears', 'Your list…')
      await w.find('input[aria-label="Your gears"]').setValue('8 32')
      await nextTick()
      await w.findAll('button').find((b) => b.attributes('aria-label') === 'Line options')!.trigger('click') // close
      await nextTick()
      expect(w.find('input[aria-label="Your groups"]').exists()).toBe(false)
      await openPanel(w, 'Line options')
      expect(w.find('[aria-label="Groups"]').text()).toContain('Your list…')
      expect((w.find('input[aria-label="Your groups"]').element as HTMLInputElement).value).toBe('3 9')
      expect(w.find('[aria-label="Gears"]').text()).toContain('Your list…')
      expect((w.find('input[aria-label="Your gears"]').element as HTMLInputElement).value).toBe('8 32')
    })
  })

  it('ties the Start and Timing help to their buttons, for a screen reader (#505)', async () => {
    const w = await mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', lineMode: 'arpeggio', rhythm: 'card:downbeats', lineTakesRhythm: true } })
    await openPanel(w, 'Line options')
    for (const [name, says] of [['Start', /pick-up/], ['Timing', /anticipate/]] as const) {
      const id = w.find(`button[aria-label="${name}"]`).attributes('aria-describedby')
      expect(id).toBeTruthy()
      expect(w.find(`#${id}`).text()).toMatch(says)
    }
  })
})

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

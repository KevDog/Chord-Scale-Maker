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
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import { parseRoot, pentatonicLadder } from '@chord-scale-maker/engine'

const props = { label: 'Gm♪', keyName: 'C major', ladder: pentatonicLadder(parseRoot('A')), current: { rung: 2, side: 'flat' as const } }

describe('the pentatonic ladder popover', () => {
  it('is a button naming the pentatonic, its shared notes and the key', async () => {
    const w = await mountSuspended(PentatonicLadder, { props })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: Gm, 4 of 5 notes in C major. Show the ladder')
    expect(w.find('button').text()).toBe('Gm♪')
  })

  it('lists all 12 by rung, marks the current one, and picks another', async () => {
    const w = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    const picks = w.findAll('[data-pent]')
    expect(picks).toHaveLength(12)
    expect(w.find('[aria-current="true"]').text()).toBe('Gm')
    await picks.find((p) => p.text() === 'F♯m')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual([{ rung: 3, side: 'sharp' }])
    w.unmount()
  })
})

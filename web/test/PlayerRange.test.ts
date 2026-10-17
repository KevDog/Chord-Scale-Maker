import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

mockNuxtImport('useFeature', () => (name: string) => name === 'playerRange')

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'trumpet', range: { lo: 55, hi: 79, centre: 70 }, spell: 'key', intervals: true, keyStart: 'C', ...props } })

describe('the player’s range (#359)', () => {
  const low = (w: Awaited<ReturnType<typeof mount>>) => w.find('[aria-label="Lowest note"]')
  const high = (w: Awaited<ReturnType<typeof mount>>) => w.find('[aria-label="Highest note"]')

  it('shows the range’s two ends, by the Instrument', async () => {
    const w = await mount()
    expect(low(w).text()).toContain('G3')
    expect(high(w).text()).toContain('G5')
  })

  it('offers each end the notes it can take, inside the full range', async () => {
    const w = await mount()
    await low(w).trigger('click')
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['F♯3', 'G3', 'A♭3', 'A3', 'B♭3', 'B3', 'C4'])
  })

  it('pushes the other end along to keep two octaves', async () => {
    const w = await mount()
    await low(w).trigger('click')
    await w.findAll('[role=option]').find((o) => o.text() === 'B♭3')!.trigger('click')
    expect(w.emitted('update:range')?.[0]).toEqual([{ lo: 58, hi: 82, centre: 70 }])
    await high(w).trigger('click')
    await w.findAll('[role=option]').find((o) => o.text() === 'F♯5')!.trigger('click')
    expect(w.emitted('update:range')?.[1]).toEqual([{ lo: 54, hi: 78, centre: 70 }])
  })
})

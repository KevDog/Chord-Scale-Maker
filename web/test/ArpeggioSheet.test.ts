import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CONCERT, type Row } from '@chord-scale-maker/engine'
import ArpeggioSheet from '~/components/ArpeggioSheet.vue'

const rows: Row[] = [{ section: 'A', bar: '1', chord: 'Cm7', scale: '' }, { section: 'A', bar: '2', chord: 'F7', scale: '' }]
const props = { rows, title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '', perPage: 12, notes: 'extended' as const, dir: 'up' as const }

describe('ArpeggioSheet', () => {
  it('draws a staff per line under its heading', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.findAll('arpeggio-staff-stub')).toHaveLength(2)
    expect(w.find('section p').text()).toBe('S (Extended arpeggios)')
  })

  it('draws a pattern over each line, headed Patterns, when given moves', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props: { ...props, notes: 'scale', moves: [2, -1] }, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.findAll('arpeggio-staff-stub')).toHaveLength(2)
    expect(w.find('section p').text()).toBe('S (Patterns)')
  })

  it('heads Triad pairs, and passes a staff’s pick up (#436)', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props: { ...props, notes: 'pairs', shape: 'block' }, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.find('section p').text()).toBe('S (Triad pairs)')
    w.findComponent({ name: 'ArpeggioStaff' }).vm.$emit('pick', 'hexatonic', ['A:1:0'], [5, 7])
    expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:1:0'], [5, 7]])
  })
})

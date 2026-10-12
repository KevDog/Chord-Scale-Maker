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
})

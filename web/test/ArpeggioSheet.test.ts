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

  // rhythm-scales-arpeggios spec §4, §6: the rhythm pours each run and the subtitle names it; Block and Patterns take none
  it('pours each run into the rhythm and names it in the subtitle', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props: { ...props, rhythm: 'unit:8:3:accents', beatsOf: () => 3 }, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.find('section p').text()).toBe('S (Extended arpeggios) · Rhythm: 8ths in 3, with accents')
    const staves = w.findAllComponents({ name: 'ArpeggioStaff' })
    expect(staves.map((s) => s.props('staff').timeSig)).toEqual(['3/4', '3/4'])
    expect(staves.map((s) => s.props('rhythm'))).toEqual(['unit:8:3:accents', 'unit:8:3:accents'])
  })

  // spec §8's fallback: a poured sheet prints rhythmPerPage a page; an unpoured one keeps perPage
  it('pages a poured sheet at rhythmPerPage', async () => {
    const many: Row[] = Array.from({ length: 3 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: ['Cm7', 'F7', 'BbMaj7'][i]!, scale: '' }))
    const sections = async (rhythm: 'off' | 'unit:8t:4:accents') => {
      const w = await mountSuspended(ArpeggioSheet, { props: { ...props, rows: many, perPage: 3, rhythmPerPage: 2, rhythm }, global: { stubs: { ArpeggioStaff: true } } })
      return w.findAll('section').length
    }
    expect(await sections('unit:8t:4:accents')).toBe(2)
    expect(await sections('off')).toBe(1)
  })

  it('names no rhythm where no staff pours it: Off, Block, Patterns', async () => {
    for (const extra of [{ rhythm: 'off' }, { notes: 'pairs', shape: 'block', rhythm: 'unit:8:3:accents' }, { notes: 'scale', moves: [2, -1], rhythm: 'unit:8:3:accents' }] as const) {
      const w = await mountSuspended(ArpeggioSheet, { props: { ...props, ...extra }, global: { stubs: { ArpeggioStaff: true } } })
      expect(w.find('section p').text()).not.toContain('Rhythm')
    }
  })

  it('heads Triad pairs, and passes a staff’s pick up (#436)', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props: { ...props, notes: 'pairs', shape: 'block' }, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.find('section p').text()).toBe('S (Triad pairs)')
    w.findComponent({ name: 'ArpeggioStaff' }).vm.$emit('pick', 'hexatonic', ['A:1:0'], [5, 7])
    expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:1:0'], [5, 7]])
  })
})

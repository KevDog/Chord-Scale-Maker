import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CONCERT, type Row } from '~~/engine'
import ScaleSheet from '~/components/ScaleSheet.vue'

const rows: Row[] = Array.from({ length: 13 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: 'Cm7', scale: '' }))
const stubs = { ScaleStaff: true } // VexFlow needs a real browser

describe('ScaleSheet', () => {
  it('lays out pages of perPage staves for each mode, each with a heading', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: { rows, title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '', start: 'C', mode: 'both', perPage: 12 },
      global: { stubs },
    })
    const pages = w.findAll('section')
    expect(pages.map((p) => p.findAll('scale-staff-stub').length)).toEqual([12, 1, 12, 1])
    expect(pages.map((p) => p.find('p').text())).toEqual([
      'S (Spelled from C)',
      'S (Spelled from C)',
      'S (Spelled from the Root)',
      'S (Spelled from the Root)',
    ])
    // one continuous card on screen; the header shows only where the subtitle changes (every printed page still has
    // its own, for print)
    expect(pages.map((p) => p.find('header').classes().includes('hidden'))).toEqual([false, true, false, true])
    expect(pages.every((p) => p.classes().includes('print:break-after-page'))).toBe(true)
  })

  it('names the instrument and start note, and passes the clef to every staff', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: {
        rows: rows.slice(0, 1),
        title: 'T',
        subtitle: '',
        part: { clef: 'bass', trans: 'C' },
        instrumentLabel: 'Trombone',
        start: 'Eb',
        mode: 'from',
        perPage: 12,
      },
      global: { stubs },
    })
    expect(w.find('section p').text()).toBe('Trombone (Spelled from E♭)')
    expect(w.find('scale-staff-stub').attributes('clef')).toBe('bass')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { Row } from '~~/engine'
import ScaleSheet from '~/components/ScaleSheet.vue'

const rows: Row[] = Array.from({ length: 13 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: 'Cm7', scale: '' }))

describe('ScaleSheet', () => {
  it('lays out pages of perPage staves for each mode, each with a heading', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: { rows, title: 'T', subtitle: 'S', mode: 'both', perPage: 12 },
      global: { stubs: { ScaleStaff: true } }, // VexFlow needs a real browser
    })
    const pages = w.findAll('section')
    expect(pages.map((p) => p.findAll('scale-staff-stub').length)).toEqual([12, 1, 12, 1])
    expect(pages.map((p) => p.find('p').text())).toEqual([
      'S (Spelled from C)',
      'S (Spelled from C)',
      'S (Spelled from the Root)',
      'S (Spelled from the Root)',
    ])
    expect(w.text()).toContain('Page 4 of 4')
  })
})

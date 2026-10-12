import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { buildSheet, CONCERT, type Row } from '@chord-scale-maker/engine'
import ScaleStaff from '~/components/ScaleStaff.vue'

vi.mock('~/utils/vexflow', async (importOriginal) => ({ ...(await importOriginal<object>()), drawStaff: () => [] }))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const row = (chord: string, bar: string): Row => ({ section: 'A', bar, chord, scale: '' })

describe('ScaleStaff', () => {
  it('labels a line with its scale, then every chord on it, and no bar', async () => {
    const [staff] = buildSheet([row('Cm7', '1'), row('Cm9', '5')], CONCERT, 'root', 'C', 12)[0]?.pages.flat() ?? []
    const w = await mountSuspended(ScaleStaff, { props: { staff, clef: 'treble' } })
    const label = w.find('.text-right').text()
    expect(label).toMatch(/^C\s*Dorian/)
    expect(label).toContain('C–7 · C–9')
    expect(label).not.toContain('Bar')
  })
})

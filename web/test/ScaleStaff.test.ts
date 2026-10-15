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
    expect(label).toContain('C–7, · C–9') // the sr-only comma separates the chords for a screen reader; the dot is for the eye
    expect(label).not.toContain('Bar')
  })

  it('captions the staff with its pentatonic under the Pentatonic preset', async () => {
    const sheet = (scale: string, rank: number) =>
      buildSheet([{ section: 'A', bar: '1', chord: 'C7#5', scale }], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', rank })[0]?.pages.flat()[0]
    const fits = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', rank: 1 })[0]?.pages.flat()[0], clef: 'treble' } })
    expect(fits.find('[data-slot="pentatonic"]').text()).toBe('Dm pent')
    const wt = await mountSuspended(ScaleStaff, { props: { staff: sheet('C Whole Tone', 2), clef: 'treble' } })
    expect(wt.find('[data-slot="pentatonic"]').text()).toMatch(/ pent · #2 · \d shared$/)
    const none = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12)[0]?.pages.flat()[0], clef: 'treble' } })
    expect(none.find('[data-slot="pentatonic"]').exists()).toBe(false)
  })

  it('captions the staff with its triad pair under the Hexatonic preset, or says it has none', async () => {
    const hex = { preset: 'hexatonic', pair: 0, grouping: 'triads' } as const
    const staffOf = (chord: string, scale = '') => buildSheet([{ section: 'A', bar: '1', chord, scale }], CONCERT, 'root', 'C', 12, hex)[0]?.pages.flat()[0]
    const g7 = await mountSuspended(ScaleStaff, { props: { staff: staffOf('G7'), clef: 'treble' } })
    expect(g7.find('[data-slot="hexatonic"]').text()).toBe('Dm/Em hex')
    const wt = await mountSuspended(ScaleStaff, { props: { staff: staffOf('C7#5', 'C Whole Tone'), clef: 'treble' } })
    expect(wt.find('[data-slot="hexatonic"]').text()).toBe('no triad pair')
    const none = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12)[0]?.pages.flat()[0], clef: 'treble' } })
    expect(none.find('[data-slot="hexatonic"]').exists()).toBe(false)
  })
})

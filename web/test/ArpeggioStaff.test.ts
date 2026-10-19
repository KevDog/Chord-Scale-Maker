import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { buildArpeggioSheet, type ChordPicks, chordPositions, CONCERT, expandRows, hexatonicChoices, NO_PICKS, parseChart, partFor, pickTargets, resolveScales, withPick } from '@chord-scale-maker/engine'
import ArpeggioStaff from '~/components/ArpeggioStaff.vue'

vi.mock('~/utils/vexflow', async (importOriginal) => ({ ...(await importOriginal<object>()), drawArpeggioStaff: () => [] }))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

describe('ArpeggioStaff under Triad pairs (#436)', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n\nsection: B\n1 | Dm7\n2 | G7\n').value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const targets = pickTargets(doc, res)
  const dm = (picks: ChordPicks = NO_PICKS, part = CONCERT) =>
    buildArpeggioSheet(expandRows(doc).value, part, 12, 'pairs', 'up', undefined, res, { picks: { picks, at: chordPositions(doc) } }).pages.flat()[0]!
  const mount = (staff: ReturnType<typeof dm>, extra: object = {}) =>
    mountSuspended(ArpeggioStaff, { props: { staff, clef: 'treble', part: CONCERT, pickable: true, ...extra }, attachTo: document.body })
  const open = async (w: Awaited<ReturnType<typeof mount>>) => {
    await w.find('[data-slot="hexatonic"] button').trigger('click')
    await flushPromises()
    return w.find('[role="dialog"]')
  }

  it('captions the pair and what it covers', async () => {
    const auto = hexatonicChoices('Dm7', 'D Dorian', CONCERT)[0]!
    const w = await mount(dm())
    expect(w.find('[data-slot="hexatonic"] button').text()).toBe(auto.label)
    expect(w.find('[data-slot="hexatonic"] button').attributes('aria-label')).toBe(`Triad pair: ${auto.name}, covers ${auto.coverage} chord tones. Show the choices`)
    w.unmount()
  })

  it('opens the chord pick popover and emits a concert pick for every position', async () => {
    const w = await mount(dm())
    const d = await open(w)
    expect(d.text().endsWith('Sets A bar 1 and B bar 1 on the Changes sheet too. Why this order?')).toBe(true)
    await w.findAll('[data-choice]').find((r) => r.text().startsWith('F/G · covers'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:1:0', 'B:1:0'], [5, 7]])
    w.unmount()
  })

  it('shows a pick as the pick, and varies where the positions differ', async () => {
    const picked = await mount(dm(withPick(NO_PICKS, 'hexatonic', ['A:1:0', 'B:1:0'], [5, 7], targets)))
    expect(picked.find('[data-slot="hexatonic"] button').text()).toMatch(/^F\/G · covers \d$/)
    picked.unmount()
    const varies = await mount(dm(withPick(NO_PICKS, 'hexatonic', ['B:1:0'], [5, 7], targets)))
    expect(varies.find('[data-slot="hexatonic"] button').text()).toMatch(/ · varies$/)
    varies.unmount()
  })

  it('writes the pick for the part, and emits it concert', async () => {
    const tenor = partFor('tenor-sax')
    const w = await mount(dm(NO_PICKS, tenor), { part: tenor })
    await open(w)
    await w.findAll('[data-choice]').find((r) => r.text().startsWith('G/A · covers'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:1:0', 'B:1:0'], [5, 7]]) // written G/A sounds F/G
    w.unmount()
  })

  it('stays plain text when not pickable, and says when a line has no pair', async () => {
    const off = await mountSuspended(ArpeggioStaff, { props: { staff: dm(), clef: 'treble', part: CONCERT } })
    expect(off.find('[data-slot="hexatonic"] button').exists()).toBe(false)
    const [none] = buildArpeggioSheet([{ section: 'A', bar: '1', chord: 'C6', scale: 'C Major Pentatonic' }], CONCERT, 12, 'pairs', 'up').pages.flat()
    const w = await mountSuspended(ArpeggioStaff, { props: { staff: none!, clef: 'treble', part: CONCERT, pickable: true } })
    expect(w.find('[data-slot="hexatonic"]').text()).toBe('no triad pair')
    expect(w.find('[data-slot="hexatonic"] button').exists()).toBe(false)
  })

  it('has no caption off Triad pairs', async () => {
    const [s] = buildArpeggioSheet(expandRows(doc).value, CONCERT, 12, 'seventh', 'up').pages.flat()
    const w = await mountSuspended(ArpeggioStaff, { props: { staff: s!, clef: 'treble' } })
    expect(w.find('[data-slot="hexatonic"]').exists()).toBe(false)
  })
})

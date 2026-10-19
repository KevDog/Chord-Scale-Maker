import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { buildSheet, type ChordPicks, chordPositions, CONCERT, expandRows, NO_PICKS, parseChart, partFor, type PracticeSelection, pickTargets, resolveScales, type Row, withPick } from '@chord-scale-maker/engine'
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
    const sheet = (scale: string, degree: number | 'auto') =>
      buildSheet([{ section: 'A', bar: '1', chord: 'C7#5', scale }], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', degree })[0]?.pages.flat()[0]
    const fits = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', degree: 'auto' })[0]?.pages.flat()[0], clef: 'treble' } })
    expect(fits.find('[data-slot="pentatonic"]').text()).toBe('Dm pent · 5 shared')
    const out = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', degree: 6 })[0]?.pages.flat()[0], clef: 'treble' } })
    expect(out.find('[data-slot="pentatonic"]').text()).toBe('G♯m pent · 1 shared')
    const wt = await mountSuspended(ScaleStaff, { props: { staff: sheet('C Whole Tone', 'auto'), clef: 'treble' } })
    expect(wt.find('[data-slot="pentatonic"]').text()).toMatch(/ pent · 3 shared$/)
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

  it('captions the staff with its stack of fourths under the Quartal preset, or says it has none (#432)', async () => {
    const quartal = { preset: 'quartal', degree: 'auto', notes: 4 } as const
    const staffOf = (chord: string, scale = '') => buildSheet([{ section: 'A', bar: '1', chord, scale }], CONCERT, 'root', 'C', 12, quartal)[0]?.pages.flat()[0]
    const g7 = await mountSuspended(ScaleStaff, { props: { staff: staffOf('G7'), clef: 'treble', quartal: true } })
    expect(g7.find('[data-slot="quartal"]').text()).toBe('F B E A · 4ths')
    const hw = await mountSuspended(ScaleStaff, { props: { staff: staffOf('C7', 'C Half-Whole'), clef: 'treble', quartal: true } })
    expect(hw.find('[data-slot="quartal"]').text()).toBe('no 4ths stack')
    expect((await mountSuspended(ScaleStaff, { props: { staff: staffOf('G7'), clef: 'treble' } })).find('[data-slot="quartal"]').exists()).toBe(false)
  })

  describe('the caption opens the chord pick popover (#303)', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | Cmaj7\n4 | Cmaj7\n\nsection: B\n1 | Dm7\n2 | G7\n3 | Cmaj7\n4 | Cmaj7\n').value
    const res = resolveScales(doc, { level: 'standard', seed: 0 })
    const targets = pickTargets(doc, res)
    const PENT: PracticeSelection = { preset: 'pentatonic', degree: 'auto' }
    const HEX: PracticeSelection = { preset: 'hexatonic', pair: 0, grouping: 'triads' }
    const dm = (picks: ChordPicks = NO_PICKS, practice = PENT, at = chordPositions(doc), part = CONCERT) =>
      buildSheet(expandRows(doc).value, part, 'root', 'C', 12, practice, undefined, res, { picks, at })[0]!.pages.flat()[0]!
    const mount = (staff: ReturnType<typeof dm>, extra: object = {}) =>
      mountSuspended(ScaleStaff, { props: { staff, clef: 'treble', part: CONCERT, pickable: true, ...extra }, attachTo: document.body })
    const open = async (w: Awaited<ReturnType<typeof mount>>) => {
      await w.find('[data-slot] button').trigger('click')
      await flushPromises()
      return w.find('[role="dialog"]')
    }

    it('makes the pentatonic caption a trigger: header, footer, 12 rows ranked', async () => {
      const w = await mount(dm())
      const slot = w.find('[data-slot="pentatonic"]')
      expect(slot.classes()).toEqual(expect.arrayContaining(['print:whitespace-nowrap', 'print:tracking-tight'])) // a varies caption fits 8.5rem in print
      const b = slot.find('button')
      expect(b.text()).toBe('Dm pent · 5 shared')
      expect(b.classes()).toContain('print:no-underline')
      expect(b.attributes('aria-label')).toBe('Pentatonic: D minor, built on 1, 5 of 5 notes in D Dorian. Show the choices')
      const d = await open(w)
      expect(d.find(`[id="${d.attributes('aria-labelledby')}"]`).text()).toBe('Dm7 Dorian · A bar 1, B bar 1')
      expect(d.text().endsWith('Sets A bar 1 and B bar 1 on the Changes sheet too. Why this order?')).toBe(true)
      const rows = w.findAll('[data-choice]')
      expect(rows).toHaveLength(12)
      expect(rows[0]!.text()).toBe('Dm pent · on 1 · 5 shared')
      w.unmount()
    })

    it('emits a concert pick for every position, or null from the sheet’s choice', async () => {
      const w = await mount(dm())
      await open(w)
      await w.findAll('[data-choice]').find((r) => r.text().startsWith('Em pent'))!.trigger('click')
      expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['A:1:0', 'B:1:0'], 4])
      await open(w)
      await w.find('[data-sheet-choice]').trigger('click')
      expect(w.emitted('pick')?.[1]).toEqual(['pentatonic', ['A:1:0', 'B:1:0'], null])
      w.unmount()
    })

    it('on a B♭ tenor part: a written header and rows, the pick still concert', async () => {
      const tenor = partFor('tenor-sax')
      const w = await mount(dm(NO_PICKS, PENT, chordPositions(doc), tenor), { part: tenor })
      expect(w.find('[data-slot="pentatonic"] button').attributes('aria-label')).toBe('Pentatonic: E minor, built on 1, 5 of 5 notes in E Dorian. Show the choices')
      const d = await open(w)
      expect(d.find(`[id="${d.attributes('aria-labelledby')}"]`).text()).toBe('Em7 Dorian · A bar 1, B bar 1')
      await w.findAll('[data-choice]').find((r) => r.text().startsWith('F♯m pent'))!.trigger('click')
      expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['A:1:0', 'B:1:0'], 4]) // written F♯m sounds Em
      w.unmount()
    })

    it('says varies, and that a pick replaces the different picks', async () => {
      const w = await mount(dm(withPick(NO_PICKS, 'pentatonic', ['B:1:0'], 4, targets)))
      expect(w.find('[data-slot="pentatonic"] button').attributes('aria-label')).toBe('Pentatonic: D minor, built on 1, 5 of 5 notes in D Dorian, varies. Show the choices')
      expect(w.find('[data-slot="pentatonic"] button').text()).toBe('Dm pent · 5 shared · varies')
      const d = await open(w)
      expect(d.text().endsWith('Replaces the different picks in A bar 1 and B bar 1. Why this order?')).toBe(true)
      w.unmount()
    })

    it('makes the hexatonic caption a trigger too', async () => {
      const w = await mount(dm(NO_PICKS, HEX))
      const picked = await mount(dm(withPick(NO_PICKS, 'hexatonic', ['A:1:0', 'B:1:0'], [0, 2], targets), HEX))
      expect(picked.find('[data-slot="hexatonic"] button').attributes('aria-label')).toMatch(/^Triad pair: C\/Dm, covers \d chord tones, your pick\. Show the choices$/)
      picked.unmount()
      await open(w)
      const rows = w.findAll('[data-choice]')
      expect(rows.every((r) => / · covers \d$/.test(r.text()))).toBe(true)
      await rows.find((r) => r.text().startsWith('C/Dm · covers'))!.trigger('click')
      expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:1:0', 'B:1:0'], [0, 2]])
      w.unmount()
    })

    it('stays plain text when not pickable, or with no positions', async () => {
      const off = await mountSuspended(ScaleStaff, { props: { staff: dm(), clef: 'treble', part: CONCERT } })
      expect(off.find('[data-slot="pentatonic"] button').exists()).toBe(false)
      expect(off.find('[data-slot="pentatonic"]').text()).toBe('Dm pent · 5 shared')
      const none = await mount(dm(NO_PICKS, PENT, new Map()))
      expect(none.find('[data-slot="pentatonic"] button').exists()).toBe(false)
      const hex = await mountSuspended(ScaleStaff, { props: { staff: dm(NO_PICKS, HEX), clef: 'treble', part: CONCERT } })
      expect(hex.find('[data-slot="hexatonic"] button').exists()).toBe(false)
      none.unmount()
    })

    it('stays plain text under Hexatonic on a staff with no triad pair', async () => {
      const wd = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C7#5 | C Whole Tone\n').value
      const wr = resolveScales(wd, { level: 'standard', seed: 0 })
      const staff = buildSheet(expandRows(wd).value, CONCERT, 'root', 'C', 12, HEX, undefined, wr, { picks: NO_PICKS, at: chordPositions(wd) })[0]!.pages.flat()[0]!
      const w = await mount(staff)
      expect(w.find('[data-slot="hexatonic"]').text()).toBe('no triad pair')
      expect(w.find('[data-slot="hexatonic"] button').exists()).toBe(false)
      w.unmount()
    })
  })
})

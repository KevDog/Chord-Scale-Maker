import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { PAGE_ZOOM } from '~/utils/sheetPaged'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import { buildChanges, CONCERT, type ChangesPentatonic, parseChart, type PentatonicPlan, showPentatonics } from '@chord-scale-maker/engine'

const pentOf = (text: string, plan: PentatonicPlan): ChangesPentatonic =>
  showPentatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines)[0]!.bars[0]!.chords[0]!.pentatonic!
const KEY = pentOf('title: T\nkey: C\nA | 1 | Cmaj7', { kind: 'pentatonic', bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false })
const CHORD = pentOf('title: T\nkey: F\nA | 1 | Dm7', { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord', degree: 2 }) // Em, on the 2 of D Dorian
const PICKED = pentOf('title: T\nkey: C\nA | 1 | Cmaj7', { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, picks: { 'A:1:0': 7 } })
const props = { p: KEY }

describe('the pentatonic ladder popover', () => {
  it('is a button naming the pentatonic, its shared notes and the key', async () => {
    const w = await mountSuspended(PentatonicLadder, { props })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: G minor, 4 of 5 notes in C major. Show the ladder')
    expect(w.find('button').text()).toBe('Gm♪')
  })

  it('lists the ladder’s 12 by rung, marks the current one, and emits the written pc of a pick', async () => {
    const w = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('A · C major pentatonic ladder')
    expect(w.findAll('[data-pent]')).toHaveLength(12)
    expect(w.find('[aria-current="true"]').text()).toBe('Gm')
    await w.findAll('[data-pent]').find((x) => x.text() === 'F♯m')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual([6])
    w.unmount()
  })

  it('lists a chord’s ranking, 12 rows with the degree each is built on and shared', async () => {
    const w = await mountSuspended(PentatonicLadder, { props: { p: CHORD }, attachTo: document.body })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: E minor, built on 2, 5 of 5 notes in D Dorian. Show the ranking')
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe(CHORD.title)
    const rows = w.findAll('li')
    expect(rows).toHaveLength(12)
    expect(rows.slice(0, 3).map((r) => r.text())).toEqual(['1 · 5 sharedDm', '5 · 5 sharedAm', '2 · 5 sharedEm'])
    expect(w.find('[aria-current="true"]').text()).toBe(CHORD.name)
    w.unmount()
  })

  it('marks a pick, and offers Reset only on one', async () => {
    const picked = await mountSuspended(PentatonicLadder, { props: { p: PICKED }, attachTo: document.body })
    expect(picked.find('button').attributes('aria-label')).toContain(', your pick.')
    expect(picked.find('button').classes()).toContain('decoration-solid')
    await picked.find('button').trigger('click')
    await flushPromises()
    await picked.find('[data-reset]').trigger('click')
    expect(picked.emitted('reset')).toHaveLength(1)
    picked.unmount()
    const plain = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await plain.find('button').trigger('click')
    await flushPromises()
    expect(plain.find('[data-reset]').exists()).toBe(false)
    plain.unmount()
  })

  it('undoes the zoom of a zoomed page, and not otherwise', async () => {
    const panelStyle = async (zoom?: number) => {
      const w = await mountSuspended(PentatonicLadder, { props, attachTo: document.body, ...(zoom ? { global: { provide: { [PAGE_ZOOM as symbol]: ref(zoom) } } } : {}) })
      await w.find('button').trigger('click')
      await flushPromises()
      const style = w.find('[role=dialog]').attributes('style') ?? ''
      w.unmount()
      return style
    }
    expect(await panelStyle(0.5)).toContain('zoom: 2')
    expect(await panelStyle()).not.toContain('zoom')
  })
})

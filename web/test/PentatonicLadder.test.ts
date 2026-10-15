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
const PICKED = pentOf('title: T\nkey: C\nA | 1 | Cmaj7', { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, picks: { 'A:1:0': { pc: 7 } } })
const HEADER = 'Cmaj7 Ionian · bar 1'
const FOOTER = 'Sets bar 1.'
const props = { p: KEY, header: HEADER, footer: FOOTER }

describe('the pentatonic ladder popover', () => {
  it('is a button naming the pentatonic, its shared notes and the key', async () => {
    const w = await mountSuspended(PentatonicLadder, { props })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: G minor, 4 of 5 notes in C major. Show the ladder')
    expect(w.find('button').text()).toBe('Gm♪')
  })

  it('lists the ladder’s 12 by rung under the header and the ladder’s title, marks the current one, and emits the written pc of a pick', async () => {
    const w = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    const d = w.find('[role="dialog"]')
    expect(d.attributes('aria-label')).toBeUndefined()
    expect(d.find(`[id="${d.attributes('aria-labelledby')}"]`).text()).toBe(HEADER)
    expect(d.text().startsWith(`${HEADER}${KEY.title}`)).toBe(true)
    expect(d.text().endsWith(FOOTER)).toBe(true)
    expect(w.findAll('[data-pent]')).toHaveLength(12)
    expect(w.findAll('[aria-current]').map((x) => x.attributes('data-sheet-choice'))).toEqual(['']) // nothing picked: only the sheet's choice is current
    await w.findAll('[data-pent]').find((x) => x.text() === 'F♯m')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual([6])
    w.unmount()
  })

  it('offers the sheet’s choice first: current with no pick, a reset under one', async () => {
    const plain = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await plain.find('button').trigger('click')
    await flushPromises()
    expect(plain.find('[data-sheet-choice]').text()).toBe(`Sheet’s choice (${KEY.sheet})`)
    expect(plain.find('[data-sheet-choice]').attributes('aria-current')).toBe('true')
    plain.unmount()
    const picked = await mountSuspended(PentatonicLadder, { props: { ...props, p: PICKED }, attachTo: document.body })
    expect(picked.find('button').attributes('aria-label')).toContain(', your pick.')
    expect(picked.find('button').classes()).toContain('decoration-solid')
    await picked.find('button').trigger('click')
    await flushPromises()
    const sheet = picked.find('[data-sheet-choice]')
    expect(sheet.text()).toBe('Sheet’s choice (Am)')
    expect(sheet.attributes('aria-current')).toBeUndefined()
    expect(picked.findAll('[aria-current]').map((x) => x.text())).toEqual(['G'.concat('m')])
    expect(sheet.classes()).toEqual(expect.arrayContaining(['font-display', 'font-semibold'])) // styled as the rung rows' picks
    await sheet.trigger('click')
    expect(picked.emitted('reset')).toHaveLength(1)
    picked.unmount()
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

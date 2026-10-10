import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesSheet from '~/components/ChangesSheet.vue'
import { changesLinesPerPage, type ChartDoc, type GuideShow, NO_GUIDES, parseChart } from '~~/engine'

const doc = parseChart('title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n').value
// 64 bars: more lines than any page holds, at 2 or 4 bars a line
const long = parseChart(`title: L\nkey: C\n${Array.from({ length: 64 }, (_, i) => `A | ${i + 1} | ${['Dm7', 'G7', 'CMaj7', 'A7'][i % 4]}`).join('\n')}\n`).value
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
const BOTH: GuideShow = { third: true, seventh: true }

const mountSheet = (over: Readonly<{ doc?: ChartDoc; signatures?: boolean; guides?: GuideShow; numerals?: boolean; scales?: boolean }> = {}) =>
  mountSuspended(ChangesSheet, {
    props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, ...over },
    global: { stubs: { ChangesSystem: true } },
  })
const systemOf = async (signatures: boolean, guides?: GuideShow) =>
  (await mountSheet({ signatures, ...(guides ? { guides } : {}) })).findComponent({ name: 'ChangesSystem' })

describe('ChangesSheet', () => {
  it("with signatures, gives the lines the chart's key and the part's clef (drawn on the first line only)", async () => {
    const line = await systemOf(true)
    expect(line.props('clef')).toBe('bass')
    expect(line.props('line').bars[0].keySig).toBe('Bb')
  })

  it('without, neither (drawn as before)', async () => {
    const line = await systemOf(false)
    expect(line.props('clef')).toBeUndefined()
    expect(line.props('line').bars[0].keySig).toBeNull()
  })

  it('keeps the print gap between lines unless signatures are on', async () => {
    const gap = async (signatures: boolean) => (await systemOf(signatures)).element.parentElement?.className
    expect(await gap(false)).toContain('print:space-y-1')
    expect(await gap(true)).toContain('print:space-y-0')
    expect(await gap(true)).not.toContain('print:space-y-1')
  })

  it('with no guide, draws slashes: no voices, no labels', async () => {
    const bar = (await systemOf(false, NO_GUIDES)).props('line').bars[0]
    expect(bar.voices).toEqual([])
    expect(bar.chords[0].guide).toEqual([])
  })

  it('with a guide on, gives the first line the clef even without signatures, and the notes and labels', async () => {
    const third = await systemOf(false, THIRD)
    expect(third.props('clef')).toBe('bass')
    expect(third.props('line').bars[0].keySig).toBeNull()
    expect(third.props('line').bars[0].voices).toHaveLength(1)
    expect(third.props('line').bars[0].chords[0].guide).toEqual(['3'])
    const both = await systemOf(false, BOTH)
    expect(both.props('line').bars[0].voices).toHaveLength(2)
    expect([...both.props('line').bars[0].chords[0].guide].sort()).toEqual(['3', '7'])
  })

  it('closes the print gap when a guide is on', async () => {
    const className = (await systemOf(false, SEVENTH)).element.parentElement?.className
    expect(className).toContain('print:space-y-0')
    expect(className).not.toContain('print:space-y-1')
  })

  it('pages the lines by changesLinesPerPage', async () => {
    for (const guides of [NO_GUIDES, THIRD, BOTH])
      for (const rows of [{ numerals: true, scales: true }, { numerals: false, scales: false }]) {
        const w = await mountSheet({ doc: long, guides, ...rows })
        const per = changesLinesPerPage(guides, rows)
        const total = w.findAllComponents({ name: 'ChangesSystem' }).length
        const pages = w.findAll('section')
        expect(total, `${JSON.stringify(guides)} ${JSON.stringify(rows)}`).toBeGreaterThan(per)
        expect(pages[0]?.findAll('changes-system-stub')).toHaveLength(per)
        expect(pages).toHaveLength(Math.ceil(total / per))
        w.unmount()
      }
  })
})

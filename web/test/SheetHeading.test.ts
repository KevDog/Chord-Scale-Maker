import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetHeading from '~/components/SheetHeading.vue'

const doc = parseChart('title: Autumn Leaves\nsubtitle: Full Form\nkey: Gm\ncomposer: Joseph Kosma\nA | 1 | Cm7\n').value
const mount = (d = doc) => mountSuspended(SheetHeading, { props: { doc: d } })
type W = Awaited<ReturnType<typeof mount>>
const value = (w: W, selector: string): string => (w.find(selector).element as HTMLInputElement | HTMLSelectElement).value
const lastDoc = (w: W): ChartDoc => (w.emitted('update:doc')?.at(-1) as [ChartDoc])[0]

describe('SheetHeading', () => {
  it('shows the title, subtitle, key and composer as fields reading as the printed heading', async () => {
    const w = await mount()
    expect(value(w, 'input[aria-label=Title]')).toBe('Autumn Leaves')
    expect(value(w, 'input[aria-label=Subtitle]')).toBe('Full Form')
    expect(value(w, 'input[aria-label=Composer]')).toBe('Joseph Kosma')
    expect(value(w, 'select[aria-label=Key]')).toBe('Gm')
  })

  it('shows the time next to the key, 4/4 when the chart has none, and writes a change', async () => {
    const w = await mount()
    expect(value(w, 'select[aria-label=Time]')).toBe('4/4')
    await w.find('select[aria-label=Time]').setValue('3/4')
    expect(serializeChart(lastDoc(w))).toMatch(/^time: 3\/4$/m)
  })

  it('writes a changed title into the doc, and a key', async () => {
    const w = await mount()
    await w.find('input[aria-label=Title]').setValue('Les Feuilles Mortes')
    expect(serializeChart(lastDoc(w))).toMatch(/^title: Les Feuilles Mortes$/m)
    await w.find('select[aria-label=Key]').setValue('Em')
    expect(serializeChart(lastDoc(w))).toMatch(/^key: Em$/m)
  })

  it('keeps a refused value visible and flagged, and the doc unchanged', async () => {
    const w = await mount()
    const t = w.find('input[aria-label=Title]')
    await t.setValue('# nope')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(t.attributes('aria-invalid')).toBe('true')
    expect(w.text()).toMatch(/can’t|#/)
  })

  it('asks for a key when the chart has none, and offers the empty fields with their names', async () => {
    const w = await mount(parseChart('title: T\nA | 1 | Cm7\n').value)
    expect(w.text()).toContain('Pick the chart’s key')
    expect(w.find('input[aria-label=Composer]').attributes('placeholder')).toBe('Composer')
  })
})

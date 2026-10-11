import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import ChartHeadingFields from '~/components/ChartHeadingFields.vue'

const doc = parseChart('title: T\nkey: C\ncomposer: X\nA | 1 | C\n').value
const lastText = (w: { emitted: (e: string) => unknown[][] | undefined }): string => serializeChart(w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc)

describe('ChartHeadingFields', () => {
  it('shows the time and, folded away, the details, only with `details`', async () => {
    expect((await mountSuspended(ChartHeadingFields, { props: { doc } })).find('select[aria-label=Time]').exists()).toBe(false)
    const w = await mountSuspended(ChartHeadingFields, { props: { doc, details: true } })
    expect((w.find('select[aria-label=Time]').element as HTMLSelectElement).value).toBe('4/4')
    await w.find('select[aria-label=Time]').setValue('3/4')
    expect(lastText(w)).toMatch(/^time: 3\/4$/m)
    const toggle = w.findAll('button').find((b) => b.text() === 'Details')
    expect(toggle?.attributes('aria-expanded')).toBe('false')
    await toggle?.trigger('click')
    const composer = w.findAll('#chart-details input')[0]
    expect((composer?.element as HTMLInputElement).value).toBe('X')
    await composer?.setValue('Y')
    expect(lastText(w)).toMatch(/^composer: Y$/m)
  })
})

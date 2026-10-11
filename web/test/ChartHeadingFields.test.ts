import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import ChartHeadingFields from '~/components/ChartHeadingFields.vue'

const doc = parseChart('title: T\nkey: C\ncomposer: X\nA | 1 | C\n').value
const lastText = (w: { emitted: (e: string) => unknown[][] | undefined }): string => serializeChart(w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc)

describe('ChartHeadingFields', () => {
  it('shows the time and, folded away, the details', async () => {
    const w = await mountSuspended(ChartHeadingFields, { props: { doc } })
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

  it('writes a good title, and keeps a bad one in its field, flagged with why, until fixed', async () => {
    const w = await mountSuspended(ChartHeadingFields, { props: { doc } })
    const title = w.find('input')
    await title.setValue('Blue Bossa')
    expect(lastText(w)).toMatch(/^title: Blue Bossa$/m)
    const emits = w.emitted('update:doc')?.length
    await title.setValue('a | b')
    expect(w.emitted('update:doc')?.length).toBe(emits)
    expect((title.element as HTMLInputElement).value).toBe('a | b')
    expect(title.attributes('aria-invalid')).toBe('true')
    expect(title.attributes('title')).toBe('may not contain | or line breaks')
    await title.setValue('A # B') // a # is fine in a heading
    expect(lastText(w)).toMatch(/^title: A # B$/m)
    expect(title.attributes('aria-invalid')).toBeUndefined()
  })
})

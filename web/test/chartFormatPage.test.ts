import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChartFormat from '~/pages/chart-format.vue'
import { META_KEYS, parseChart, SECTION_FIELDS, sectionLayout } from '@chord-scale-maker/engine'

const lines = (w: Awaited<ReturnType<typeof mountSuspended>>, group: string): string[] =>
  w.findAll(`section[aria-labelledby="${group}"] [data-field] td:first-child`).map((c) => c.text())

describe('the chart format page', () => {
  it('its example reads without a message', async () => {
    const w = await mountSuspended(ChartFormat)
    const parsed = parseChart(w.find('[data-example]').text())
    expect([...parsed.diagnostics, ...sectionLayout(parsed.value).diagnostics]).toEqual([])
  })

  it('lists every header field the parser reads (bars: belongs to a section)', async () => {
    const w = await mountSuspended(ChartFormat)
    expect(lines(w, 'header').sort()).toEqual(META_KEYS.filter((k) => k !== 'bars').map((k) => `${k}:`).sort())
  })

  it('lists every section field', async () => {
    const w = await mountSuspended(ChartFormat)
    const fields = lines(w, 'sections').map((l) => l.split(':')[0])
    for (const f of SECTION_FIELDS) expect(fields, f).toContain(f)
  })

  it('lists every @ directive', async () => {
    const w = await mountSuspended(ChartFormat)
    const shown = [...lines(w, 'directives'), w.find('section[aria-labelledby="directives"]').text()].join(' ')
    for (const d of ['@key', '@time', '@ending', '@segno', '@coda', '@nav', '@context']) expect(shown, d).toContain(d)
  })

  it('shows the parser’s own messages, a different one each row', async () => {
    const w = await mountSuspended(ChartFormat)
    const messages = w.findAll('[data-error]').map((c) => c.text())
    expect(messages.length).toBeGreaterThan(25)
    expect(messages.every(Boolean)).toBe(true)
    expect(new Set(messages).size).toBe(messages.length)
  })

  it('has one anchor per section and field', async () => {
    const w = await mountSuspended(ChartFormat)
    for (const id of ['example', 'header', 'sections', 'rows', 'directives', 'chords', 'errors', 'field-copy', 'field-alt']) expect(w.findAll(`[id="${id}"]`), id).toHaveLength(1)
  })
})

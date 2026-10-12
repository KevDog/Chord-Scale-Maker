import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetBarToolbar from '~/components/SheetBarToolbar.vue'

const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n@copy A B 4\n').value
const rows = (d: ChartDoc) => serializeChart(d).split('\n').filter((l) => /^A \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim())
const mount = (over: Partial<{ bar: number; repeatOf: string | null }> = {}) =>
  mountSuspended(SheetBarToolbar, { props: { doc, section: 'A', bar: 2, repeatOf: null, ...over }, attachTo: document.body })
type W = Awaited<ReturnType<typeof mount>>
const next = (w: W): ChartDoc => (w.emitted('update:doc')?.at(-1) as [ChartDoc])[0]
const press = async (w: W, name: string) => {
  const b = w.findAll('button').find((x) => x.attributes('aria-label') === name || x.text() === name)
  if (!b) throw new Error(`no ${name}`)
  await b.trigger('click')
}

describe('SheetBarToolbar', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('is a toolbar named for the bar, inserting a held bar before and after', async () => {
    const w = await mount()
    expect(w.find('[role=toolbar]').attributes('aria-label')).toBe('Bar 2 of A')
    await press(w, 'Insert a held bar before A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 3 | G7', 'A | 4 | CMaj7'])
    await press(w, 'Insert a held bar after A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 4 | CMaj7'])
    expect(w.emitted('said')?.map((e) => e[0])).toEqual(['A: bar 2 added', 'A: bar 3 added'])
  })

  it('splits a bar into the chord twice', async () => {
    const w = await mount()
    await press(w, 'Split A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 2 | G7', 'A | 3 | CMaj7'])
  })

  it('deletes a bar, and refuses to delete a section’s first with why', async () => {
    const w = await mount()
    await press(w, 'Delete A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | CMaj7'])
    const held = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\n').value // bar 2 holds Dm7
    const first = await mountSuspended(SheetBarToolbar, { props: { doc: held, section: 'A', bar: 1, repeatOf: null } })
    await press(first, 'Delete A bar 1')
    expect(first.emitted('update:doc')).toBeUndefined()
    expect(first.emitted('refused')?.[0]?.[0]).toMatch(/can’t start with a held bar/)
    expect(first.text()).toMatch(/can’t start with a held bar/) // shown under the toolbar, not only announced (review: Important 5)
  })

  it('on a repeat’s bar offers Write out only', async () => {
    const w = await mountSuspended(SheetBarToolbar, { props: { doc, section: 'B', bar: 1, repeatOf: 'A' } })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Write out'])
    await press(w, 'Write out')
    expect(serializeChart(next(w))).not.toContain('@copy')
  })

  it('offers the rest under ⋯, and asks for the dialogs for a jump and a new section', async () => {
    const w = await mount()
    await press(w, 'More actions for A bar 2')
    await nextTick()
    const items = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
    expect(items.map((m) => m.textContent?.trim())).toEqual(['Key change here', '1st ending', '2nd ending', 'Segno', 'Coda', 'Jump…', 'New section here…'])
    items.at(-1)?.click()
    await nextTick()
    expect(w.emitted('dialog')?.[0]).toEqual(['split', 'A', 2])
  })

  it('toggles an ending from the menu', async () => {
    const w = await mount()
    await press(w, 'More actions for A bar 2')
    await nextTick()
    ;[...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((m) => m.textContent?.trim() === '1st ending')?.click()
    await nextTick()
    expect(serializeChart(next(w))).toContain('@ending 1 A 2')
  })
})

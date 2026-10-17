import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetBarToolbar from '~/components/SheetBarToolbar.vue'

const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n\nsection: B\ncopy: A\n').value
const rows = (d: ChartDoc) => serializeChart(d).split('\n').filter((l) => /^\d+ +\|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim())
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
    expect(rows(next(w))).toEqual(['1 | Dm7', '3 | G7', '4 | CMaj7'])
    await press(w, 'Insert a held bar after A bar 2')
    expect(rows(next(w))).toEqual(['1 | Dm7', '2 | G7', '4 | CMaj7'])
    expect(w.emitted('said')?.map((e) => e[0])).toEqual(['A: bar 2 added', 'A: bar 3 added'])
  })

  it('splits a bar into the chord twice', async () => {
    const w = await mount()
    await press(w, 'Split A bar 2')
    expect(rows(next(w))).toEqual(['1 | Dm7', '2 | G7', '2 | G7', '3 | CMaj7'])
  })

  it('deletes a bar, and refuses to delete a section’s first with why', async () => {
    const w = await mount()
    await press(w, 'Delete A bar 2')
    expect(rows(next(w))).toEqual(['1 | Dm7', '2 | CMaj7'])
    const held = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n3 | G7\n').value // bar 2 holds Dm7
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

  it('offers the rest under ⋯, and asks for the dialogs for a jump, a new section and pasted bars', async () => {
    const w = await mount()
    await press(w, 'More actions for A bar 2')
    await nextTick()
    const items = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
    expect(items.map((m) => m.textContent?.trim())).toEqual(['Key change here', '1st ending', '2nd ending', 'Segno', 'Coda', 'Jump…', 'New section here…', 'Paste bars…'])
    items.at(-2)?.click()
    await nextTick()
    expect(w.emitted('dialog')?.[0]).toEqual(['split', 'A', 2])
    await press(w, 'More actions for A bar 2')
    await nextTick()
    ;[...document.querySelectorAll<HTMLElement>('[role=menuitem]')].at(-1)?.click()
    await nextTick()
    expect(w.emitted('dialog')?.[1]).toEqual(['paste', 'A', 2])
  })

  it('toggles an ending from the menu', async () => {
    const w = await mount()
    await press(w, 'More actions for A bar 2')
    await nextTick()
    ;[...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((m) => m.textContent?.trim() === '1st ending')?.click()
    await nextTick()
    expect(serializeChart(next(w))).toContain('@ending 1 2')
  })
})

describe('SheetBarToolbar interface levels', () => {
  const at = (level: 'essentials' | 'intermediate' | 'everything') => {
    useInterface().level.value = level
  }
  const labels = (w: W) => w.findAll('button').map((b) => b.attributes('aria-label') ?? b.text())
  const openMore = async (w: W) => {
    await w.find('button[aria-label="More actions for A bar 2"]').trigger('click')
    await nextTick()
    return document.body.textContent ?? ''
  }
  beforeEach(() => (document.body.innerHTML = ''))
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('Essentials keeps the bar actions and drops the ⋯ and Write out', async () => {
    at('essentials')
    const w = await mount()
    expect(labels(w)).toEqual(['Insert a held bar before A bar 2', 'Insert a held bar after A bar 2', 'Split A bar 2', 'Delete A bar 2'])
    const repeat = await mount({ repeatOf: 'A' })
    expect(repeat.find('[role=toolbar]').exists()).toBe(false)
  })

  it('Intermediate adds form editing but not Key change here', async () => {
    at('intermediate')
    const text = await openMore(await mount())
    expect(text).toContain('1st ending')
    expect(text).toContain('Paste bars…')
    expect(text).not.toContain('Key change here')
  })

  it('Everything adds Key change here', async () => {
    at('everything')
    expect(await openMore(await mount())).toContain('Key change here')
  })
})

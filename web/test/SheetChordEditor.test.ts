import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { changesFor, type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetChordEditor from '~/components/SheetChordEditor.vue'
import type { SheetChordEdit } from '~/utils/sheetChordEdit'

// lines: 5 A1 Dm7, 6 A2 G7, 7 A3 CMaj7; B copies A
const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n\nsection: B\ncopy: A\n').value
const target = (line: number, section = 'A', bar = String(line - 4)): SheetChordEdit => ({ line, section, bar })
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^\d+ +\|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const dialog = () => document.querySelector<HTMLElement>('[role=dialog]')
const chordInput = () => {
  const id = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent === 'Chord')?.getAttribute('for')
  return document.getElementById(id ?? '') as HTMLInputElement
}
async function type(value: string) {
  const el = chordInput()
  el.value = value
  el.dispatchEvent(new Event('input'))
  await settle()
  el.dispatchEvent(new Event('change'))
  await settle()
}
const mount = (t: SheetChordEdit | null) => mountSuspended(SheetChordEditor, { props: { doc, target: t }, attachTo: document.body })

describe('SheetChordEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '' // Headless UI portals linger between tests
    localStorage.clear()
  })

  it('keeps the scale and the function open, with nothing to fold', async () => {
    await mount(target(6))
    await settle()
    expect(document.querySelector('[role=dialog] [aria-expanded]')).toBeNull()
    expect(document.querySelector('[role=dialog] [role=radiogroup][aria-label="Scale"]')).not.toBeNull()
  })

  it('is closed with no chord', async () => {
    await mount(null)
    expect(dialog()).toBeNull()
  })

  it('shows the chord in concert pitch, with its place and its scales', async () => {
    await mount(target(6))
    await settle()
    expect(dialog()?.textContent).toContain('A, bar 2')
    expect(dialog()?.textContent).toContain('Concert pitch')
    expect(chordInput().value).toBe('G7')
    expect(dialog()?.querySelector('[role=radiogroup][aria-label=Scale]')).not.toBeNull()
  })

  it('writes a changed chord into its row, its default scale following', async () => {
    const w = await mount(target(6))
    await settle()
    await type('Db7')
    expect(rows(w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc)).toEqual(['1 | Dm7', '2 | Db7', '3 | CMaj7'])
    expect(w.emitted('update:doc')).toHaveLength(1)
  })

  it('says why a chord can’t go in the chart, and writes nothing', async () => {
    const w = await mount(target(6))
    await settle()
    await type('G7 | x')
    expect(dialog()?.textContent).toContain('can’t go in a chart: may not contain | or line breaks')
    expect(w.emitted('said')?.at(-1)?.[0]).toContain('can’t go in a chart') // said, not only shown (#143)
    await type('')
    expect(w.emitted('update:doc')).toHaveLength(1) // the second chord can go
    w.unmount()
    const first = await mount(target(5, 'A', '1'))
    await settle()
    await type('')
    expect(first.emitted('update:doc')).toBeUndefined()
    expect(dialog()?.textContent).toContain('A section’s first bar needs a chord.')
    expect(first.emitted('said')?.at(-1)).toEqual(['A section’s first bar needs a chord.'])
  })

  it('says a repeat’s chord changes the section it repeats', async () => {
    await mount(target(5, 'B', '1'))
    await settle()
    expect(dialog()?.textContent).toContain('B repeats A: a change here changes A and every repeat of it.')
  })

  it('closes on Done', async () => {
    const w = await mount(target(6))
    await settle()
    ;[...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === 'Done')?.click()
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('SheetChordEditor on a set of a chart with alternates (#469)', () => {
  // lines: 5 A1 Dm7, 6 A2 G7, 7 alt A2 Db7, 8 A3 CMaj7
  const real = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\nalt 2 | Db7\n3 | CMaj7\n').value
  const all = (d: ChartDoc | undefined): string => (d ? serializeChart(d).replace(/[ \t]*\|[ \t]*/g, ' | ') : '')
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  it('a chord typed on a shared bar in Alternate writes it an alt row', async () => {
    const w = await mountSuspended(SheetChordEditor, { props: { doc: changesFor(real, 'alternate'), source: real, set: 'alternate', target: { line: 8, section: 'A', bar: '3' } }, attachTo: document.body })
    await settle()
    await type('Em7')
    const next = all(w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc | undefined)
    expect(next).toMatch(/\n3 \| CMaj7\nalt 3 \| Em7\n/)
    expect(next).toMatch(/\nalt 2 \| Db7\n/)
  })

  it('refuses blanking a shared bar in Alternate, saying an alternate can’t be held', async () => {
    const w = await mountSuspended(SheetChordEditor, { props: { doc: changesFor(real, 'alternate'), source: real, set: 'alternate', target: { line: 8, section: 'A', bar: '3' } }, attachTo: document.body })
    await settle()
    await type('')
    const why = 'An alternate can’t be held: type its chords, or switch to Standard to edit the bar.'
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(dialog()?.textContent).toContain(why)
    expect(w.emitted('said')?.at(-1)).toEqual([why])
  })
})

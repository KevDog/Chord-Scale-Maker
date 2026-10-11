import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetChord from '~/components/SheetChord.vue'
import type { SheetEdit } from '~/utils/sheetChordEdit'

// lines: 0 title, 1 key, 2 A1 Dm7, 3 A2 G7, 4 A3 CMaj7
const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^A \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (editing: SheetEdit | null, over: Partial<{ line: number; bar: string; text: string; slot: boolean }> = {}) =>
  mountSuspended(SheetChord, {
    props: { doc, line: 3, section: 'A', bar: '2', text: 'G7', tokens: null, label: 'Edit G7, A bar 2', editing, selected: false, ...over },
    attachTo: document.body,
  })
type W = Awaited<ReturnType<typeof mount>>
const field = (w: W) => w.find<HTMLInputElement>('input')
async function type(w: W, value: string) {
  await field(w).setValue(value)
  await settle()
}
const lastDoc = (w: W): ChartDoc | undefined => (w.emitted('update:doc')?.at(-1) as [ChartDoc] | undefined)?.[0]

describe('SheetChord', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('is a labelled button when not editing, and asks to edit on click', async () => {
    const w = await mount(null)
    const b = w.find('button')
    expect(b.attributes('aria-label')).toBe('Edit G7, A bar 2')
    await b.trigger('click')
    expect(w.emitted('edit')?.[0]).toEqual([{ kind: 'chord', line: 3 }])
  })

  it('is a field with the chord selected when editing', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await settle()
    const el = field(w)
    expect(el.attributes('aria-label')).toBe('Chord, A bar 2')
    expect(el.element.value).toBe('G7')
    expect(document.activeElement).toBe(el.element)
    expect(el.element.selectionStart).toBe(0)
    expect(el.element.selectionEnd).toBe(2)
  })

  it('lists completions with each one’s reading in this bar, the typed text first', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b')
    const options = w.findAll('[role=option]').map((o) => o.text().replace(/\s+/g, ' '))
    expect(options[0]).toMatch(/^G7b/)
    expect(options[1]).toMatch(/^G7\(♭9\).*→ G /) // the sheet's own spelling of G7b9
    expect(w.find('[role=listbox]').attributes('aria-label')).toBe('Completions')
  })

  it('reports the draft’s reading as it changes, and nothing once done', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b9')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ numeral: 'V7', readable: true })
    await type(w, 'Gxyz')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ readable: false })
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('preview')?.at(-1)?.[0]).toBeNull()
  })

  it('commits on Enter once, and says so', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['A | 1 | Dm7', 'A | 2 | Db7', 'A | 3 | CMaj7'])
    expect(w.emitted('update:doc')).toHaveLength(1)
    expect(w.emitted('said')?.[0]).toEqual(['A, bar 2: Db7'])
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('takes the active completion on Enter', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b')
    await field(w).trigger('keydown', { key: 'ArrowDown' })
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | G7b9')
  })

  it('commits and moves on Tab and ⇧Tab, commits and adds on Space', async () => {
    for (const [key, shift, then] of [['Tab', false, 'next'], ['Tab', true, 'prev'], [' ', false, 'add']] as const) {
      document.body.innerHTML = ''
      const w = await mount({ kind: 'chord', line: 3 })
      await type(w, 'G13')
      await field(w).trigger('keydown', { key, shiftKey: shift })
      await settle()
      expect(rows(lastDoc(w))[1], key).toBe('A | 2 | G13')
      expect(w.emitted('done')?.[0], key).toEqual([then])
    }
  })

  it('cancels on Escape without writing', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')?.[0]).toEqual(['cancel'])
  })

  it('refuses a draft the chart can’t hold, and keeps the field open with why (Review Focus 4)', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7 | x')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')).toBeUndefined()
    expect(w.text()).toContain('can’t go in a chart')
  })

  it('refuses taking out a section’s first chord', async () => {
    const w = await mount({ kind: 'chord', line: 2 }, { line: 2, bar: '1', text: 'Dm7' })
    await type(w, '')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.text()).toContain('first bar needs a chord')
  })

  it('% is the bar before', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, '%')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | Dm7')
  })

  it('a slot: opens empty, commits as the bar’s added chord, adds nothing on an empty commit', async () => {
    const w = await mount({ kind: 'slot', section: 'A', bar: '2' }, { slot: true, text: '' })
    await settle()
    expect(field(w).element.value).toBe('')
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 2 | Db7', 'A | 3 | CMaj7'])
    document.body.innerHTML = ''
    const w2 = await mount({ kind: 'slot', section: 'A', bar: '2' }, { slot: true, text: '' })
    await field(w2).trigger('keydown', { key: 'Enter' })
    expect(w2.emitted('update:doc')).toBeUndefined()
    expect(w2.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('refuses a fifth chord in a 4/4 bar on Space (Review Focus 1)', async () => {
    const full = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 1 | Em7\nA | 1 | A7\nA | 2 | CMaj7\n').value
    const w = await mountSuspended(SheetChord, { props: { doc: full, line: 5, section: 'A', bar: '1', text: 'A7', tokens: null, label: 'Edit A7, A bar 1', editing: { kind: 'chord', line: 5 }, selected: false }, attachTo: document.body })
    await settle()
    await field(w).trigger('keydown', { key: ' ' })
    await settle()
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
    expect(w.emitted('said')?.at(-1)).toEqual(['A bar holds at most 4 chords.'])
  })
})

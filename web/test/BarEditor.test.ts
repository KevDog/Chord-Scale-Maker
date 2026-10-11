import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { barView, type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import BarEditor from '~/components/BarEditor.vue'
import BarInspector from '~/components/BarInspector.vue'

const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 3 | A7\n@copy A B 4\nbad line\n').value
const lastDoc = (w: { emitted: (e: string) => unknown[][] | undefined }): ChartDoc | undefined => w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc | undefined
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^[AB] \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])

const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const field = (label: string) => {
  const id = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent === label)?.getAttribute('for')
  return document.getElementById(id ?? '') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
}
async function fill(label: string, value: string) {
  const el = field(label)
  el.value = value
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'))
  await settle()
}
async function press(name: string) {
  ;[...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === name)?.click()
  await settle()
}
const text = (d: ChartDoc | undefined): string => (d ? serializeChart(d).replace(/[ \t]*\|[ \t]*/g, ' | ').replace(/[ \t]+$/gm, '') : '')
const button = (w: { findAll: (s: string) => { text: () => string; attributes: (a: string) => string | undefined; trigger: (e: string) => Promise<void> }[] }, name: string) =>
  w.findAll('button').find((b) => b.text().trim() === name || b.attributes('aria-label') === name)

async function mount(d: ChartDoc = doc) {
  const w = await mountSuspended(BarEditor, { props: { doc: d }, attachTo: document.body })
  const cell = (name: RegExp) => w.findAll('[role=gridcell]').find((c) => name.test(c.attributes('aria-label') ?? ''))
  return { w, cell }
}

describe('BarEditor', () => {
  beforeEach(() => localStorage.clear())

  it('shows written sections as bars, a held bar as %, and a repeat as one line', async () => {
    const { w, cell } = await mount()
    expect(w.findAll('[role=grid]')).toHaveLength(1)
    expect(cell(/^A, bar 1: Dm7$/)?.attributes('tabindex')).toBe('0') // the selection: one Tab stop
    expect(cell(/^A, bar 3: CMaj7, A7/)?.attributes('tabindex')).toBe('-1')
    expect(cell(/^A, bar 4: held$/)?.text()).toContain('%')
    expect(w.text()).toContain('repeats A · bars 5–8')
    expect(w.text()).toContain('Line 8: can\'t read this line')
    w.unmount()
  })

  it('typing replaces the selected chord, and Enter writes it', async () => {
    const { w, cell } = await mount()
    await cell(/^A, bar 1/)?.trigger('keydown', { key: 'E' })
    await nextTick()
    const input = w.find('input[aria-label=Chord]')
    await input.setValue('Em7')
    await input.trigger('keydown', { key: 'Enter' })
    expect(rows(lastDoc(w))[0]).toBe('A | 1 | Em7')
    w.unmount()
  })

  it('Space adds a chord to the bar', async () => {
    const { w, cell } = await mount()
    await cell(/^A, bar 2/)?.trigger('click')
    await cell(/^A, bar 2/)?.trigger('keydown', { key: ' ' })
    await nextTick()
    const input = w.find('input[aria-label=Chord]')
    await input.setValue('Db7')
    await input.trigger('keydown', { key: 'Enter' })
    expect(rows(lastDoc(w)).filter((r) => r.startsWith('A | 2 '))).toEqual(['A | 2 | G7', 'A | 2 | Db7'])
    w.unmount()
  })

  it('% is the bar before; ⌫ clears a chord but not a section’s first', async () => {
    const { w, cell } = await mount()
    await cell(/^A, bar 4/)?.trigger('click')
    await cell(/^A, bar 4/)?.trigger('keydown', { key: '%' })
    await nextTick()
    await w.find('input[aria-label=Chord]').trigger('keydown', { key: 'Enter' })
    expect(rows(lastDoc(w)).filter((r) => r.startsWith('A | 4 '))).toEqual(['A | 4 | CMaj7', 'A | 4 | A7'])
    await cell(/^A, bar 1/)?.trigger('click')
    await cell(/^A, bar 1/)?.trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:doc')).toHaveLength(1)
    expect(w.find('[role=alert]').text()).toBe('A section’s first bar needs a chord.')
    await cell(/^A, bar 2/)?.trigger('click')
    await cell(/^A, bar 2/)?.trigger('keydown', { key: 'Delete' })
    expect(rows(lastDoc(w)).some((r) => r.startsWith('A | 2 '))).toBe(false) // held now
    w.unmount()
  })

  it('refuses a chord that would break the text, and keeps it to fix', async () => {
    const { w, cell } = await mount()
    await cell(/^A, bar 1/)?.trigger('keydown', { key: 'C' })
    await nextTick()
    const input = w.find('input[aria-label=Chord]')
    await input.setValue('C|7')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.find('[role=alert]').text()).toMatch(/can’t go in a chart: may not contain \|/)
    expect((w.find('input[aria-label=Chord]').element as HTMLInputElement).value).toBe('C|7')
    w.unmount()
  })

  it('moves with Tab and the arrows, chord by chord', async () => {
    const { w, cell } = await mount()
    await cell(/^A, bar 1/)?.trigger('keydown', { key: 'Tab' })
    expect(cell(/^A, bar 2/)?.attributes('aria-selected')).toBe('true')
    await cell(/^A, bar 2/)?.trigger('keydown', { key: 'ArrowRight' })
    await cell(/^A, bar 3/)?.trigger('keydown', { key: 'ArrowRight' })
    expect(cell(/^A, bar 3/)?.attributes('aria-label')).toContain('(2nd chord selected)')
    await cell(/^A, bar 3/)?.trigger('keydown', { key: 'ArrowLeft' })
    expect(cell(/^A, bar 3/)?.attributes('aria-label')).toContain('(1st chord selected)')
    w.unmount()
  })

  it('underlines a chord it doesn’t know', async () => {
    const { w } = await mount(parseChart('title: T\nA | 1 | Cm7#5#9x\n').value)
    expect(w.find('[title="Not a chord the app knows"]').text()).toContain('Cm7#5#9x')
    w.unmount()
  })

  it('shows numerals and scales under the chords once turned on', async () => {
    const { w } = await mount()
    const grid = () => w.find('[role=grid]').text()
    expect(grid()).not.toContain('ii7')
    await w.findAll('button').find((b) => b.text() === 'Numerals & scales')?.trigger('click')
    expect(grid()).toContain('ii7')
    expect(grid()).toContain('D Dorian')
    w.unmount()
  })

  it('selects a chord by its chart line (tapped on the Changes sheet), and says which line is selected', async () => {
    const { w, cell } = await mount()
    expect(w.emitted('selected')?.at(-1)).toEqual([2]) // Dm7, the first chord
    ;(w.vm as unknown as { selectLine: (line: number) => void }).selectLine(5)
    await nextTick()
    expect(cell(/^A, bar 3: CMaj7, A7/)?.attributes('aria-selected')).toBe('true')
    expect(w.emitted('selected')?.at(-1)).toEqual([5])
    w.unmount()
  })
})

describe('BarEditor structure', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '' // a closed dialog's portal, left by the test before
  })
  const four = parseChart('title: T\nA | 1 | C\nA | 2 | F\nA | 3 | G7\nA | 4 | C\n@copy A A2 4\n').value

  it('+ Bar adds a held bar after the section’s last, and selects it', async () => {
    const { w, cell } = await mount(four)
    await button(w, 'Add bar')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/@copy A A2 5/)
    await w.setProps({ doc: lastDoc(w) as ChartDoc })
    expect(cell(/^A, bar 5: held/)?.attributes('aria-selected')).toBe('true')
    w.unmount()
  })

  it('writes a repeat out, to change it', async () => {
    const { w } = await mount(four)
    await button(w, 'Write out A2')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/A2 \| 5 \| C\nA2 \| 6 \| F\nA2 \| 7 \| G7\nA2 \| 8 \| C\n/)
    w.unmount()
  })

  it('renames a section from its chip, and says why a name won’t do', async () => {
    const { w } = await mount(four)
    await button(w, 'Rename section A')?.trigger('click')
    await settle()
    expect((field('Section name') as HTMLInputElement).value).toBe('A')
    await fill('Section name', 'A2')
    await press('Rename')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(document.querySelector('[role=dialog] [role=alert]')?.textContent).toMatch(/no other section has/)
    await fill('Section name', 'A1')
    await press('Rename')
    expect(text(lastDoc(w))).toMatch(/A1 \| 1 \| C[\s\S]*@copy A1 A2 4/)
    w.unmount()
  })

  it('adds a section with its first chords, and repeats one', async () => {
    const { w } = await mount(four)
    await button(w, 'Add section…')?.trigger('click')
    await settle()
    await fill('Section name', 'B')
    await fill('First chords', 'Dm7 G7')
    await press('Add section')
    expect(text(lastDoc(w))).toMatch(/B \| 9 \| Dm7\nB \| 9 \| G7\n$/)
    await w.setProps({ doc: lastDoc(w) as ChartDoc })
    await settle()
    await button(w, 'Repeat a section…')?.trigger('click')
    await settle()
    await fill('Section to repeat', 'A')
    await fill('Name of the repeat', 'A3')
    await press('Repeat')
    expect(text(lastDoc(w))).toMatch(/B \| 9 \| G7\n@copy A A3 12\n$/)
    w.unmount()
  })

  it('pastes bars after the selected bar, and won’t while the text has a problem', async () => {
    const { w, cell } = await mount(four)
    await cell(/^A, bar 2/)?.trigger('click')
    await button(w, 'Paste bars…')?.trigger('click')
    await settle()
    await fill('Bars', '| Cm7 | F7 F7 F7 F7 F7 |')
    expect(document.querySelector('[role=dialog] [role=alert]')?.textContent).toContain('more than 4 chords in bar 2')
    expect([...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.includes('Insert after'))?.disabled).toBe(true)
    await fill('Bars', '| Cm7 | F7 |')
    await press('Insert after bar 2')
    expect(text(lastDoc(w))).toMatch(/A \| 2 \| F\nA \| 3 \| Cm7\nA \| 4 \| F7\nA \| 5 \| G7/)
    w.unmount()
  })

  it('shows endings, marks and jumps on their bars', async () => {
    const { cell, w } = await mount(parseChart('title: T\nA | 1 | C\nA | 2 | F\n@ending 1 A 2\n@segno A 1\n@nav A 2 D.C. al Fine\n').value)
    expect(cell(/^A, bar 1/)?.attributes('aria-label')).toBe('A, bar 1: C; Segno')
    expect(cell(/^A, bar 2/)?.attributes('aria-label')).toBe('A, bar 2: F; 1st ending; D.C. al Fine')
    expect(cell(/^A, bar 2/)?.text()).toContain('D.C. al Fine')
    w.unmount()
  })

  it('starts a new section at the selected bar', async () => {
    const { w, cell } = await mount(parseChart('title: T\nA | 1 | C\nA | 2 | F\nA | 3 | G7\nA | 4 | C\n').value)
    await cell(/^A, bar 3/)?.trigger('click')
    await button(w, 'New section here…')?.trigger('click')
    await settle()
    await fill('Section name', 'B')
    await press('Start section')
    expect(text(lastDoc(w))).toMatch(/A \| 2 \| F\nB \| 3 \| G7\nB \| 4 \| C\n/)
    w.unmount()
  })
})

describe('BarInspector', () => {
  const d7 = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nB | 5 | C\n').value
  const cellOf = (d: ChartDoc, bar: number) => barView(d).sections.flatMap((s) => s.bars).find((b) => b.bar === bar)!
  const props = { doc: d7, section: 'A', bar: 2, index: 0, chord: { chord: 'D7', beat: 0, line: 3 }, count: 1, cell: cellOf(d7, 2) }

  it('adds and deletes bars, and says why the chart can’t take one', async () => {
    const w = await mountSuspended(BarInspector, { props })
    await button(w, 'Bar after')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/A \| 2 \| D7\nA \| 4 \| Dm7/)
    expect(w.emitted('select')).toEqual([[3]])
    await button(w, 'Delete bar')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/A \| 1 \| CMaj7\nA \| 2 \| Dm7/)
    const first = await mountSuspended(BarInspector, { props: { ...props, bar: 1, chord: { chord: 'CMaj7', beat: 0, line: 2 }, cell: cellOf(d7, 1) } })
    await button(first, 'Bar before')?.trigger('click')
    expect(first.emitted('update:doc')).toBeUndefined()
    expect(first.emitted('refused')?.[0]?.[0]).toMatch(/can’t start with a held bar/)
  })

  it('turns endings, segno and coda on, and sets a jump', async () => {
    const w = await mountSuspended(BarInspector, { props })
    await button(w, '1st ending')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/@ending 1 A 2/)
    await button(w, 'Segno')?.trigger('click')
    expect(text(lastDoc(w))).toMatch(/@segno A 2/)
    await w.find('select').setValue('D.S. al Coda')
    expect(text(lastDoc(w))).toMatch(/@nav A 2 D.S. al Coda/)
    const on = parseChart(serializeChart(d7) + '@ending 1 A 2\n').value
    const w2 = await mountSuspended(BarInspector, { props: { ...props, doc: on, cell: cellOf(on, 2) } })
    expect(button(w2, '1st ending')?.attributes('aria-pressed')).toBe('true')
  })

  it('picks a scale from the list, or any scale by search', async () => {
    const w = await mountSuspended(BarInspector, { props })
    const options = w.findAll('[role=radiogroup]')[0]?.findAll('[role=radio]') ?? []
    expect(options[0]?.text()).toContain('D Mixolydian')
    expect(options[0]?.attributes('aria-checked')).toBe('true')
    await options.find((o) => o.text().includes('D Lydian Dominant'))?.trigger('click')
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | D7 | D Lydian Dominant')
    await w.find('input[aria-label="Any scale"]').setValue('ph dom')
    await w.findAll('[aria-label="Scales found"] button')[0]?.trigger('click')
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | D7 | D Phrygian Dominant')
  })

  it('states a function, with the scale each gives, and says why', async () => {
    const w = await mountSuspended(BarInspector, { props })
    const fns = w.findAll('[role=radiogroup]')[1]?.findAll('[role=radio]') ?? []
    expect(fns[0]?.text()).toMatch(/^Auto: II7→ D Mixolydian$/)
    await fns.find((o) => o.text().startsWith('V7/V'))?.trigger('click')
    expect(rows(lastDoc(w))[1]).toMatch(/^A \| 2 \| D7 \| \| V7\/V$/)
    expect(w.text()).toContain('II7 in C, not resolving: natural tensions')
    await w.findAll('button').find((b) => b.text() === 'Key change here')?.trigger('click')
    expect(serializeChart(lastDoc(w) as ChartDoc)).toMatch(/@key A 2 C/)
  })
})

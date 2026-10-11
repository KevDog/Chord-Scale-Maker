import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import BarEditor from '~/components/BarEditor.vue'
import BarInspector from '~/components/BarInspector.vue'

const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 3 | A7\n@copy A B 4\nbad line\n').value
const lastDoc = (w: { emitted: (e: string) => unknown[][] | undefined }): ChartDoc | undefined => w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc | undefined
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^[AB] \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])

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
})

describe('BarInspector', () => {
  const d7 = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n').value
  const props = { doc: d7, section: 'A', bar: 2, index: 0, chord: { chord: 'D7', beat: 0, line: 3 }, count: 1 }

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

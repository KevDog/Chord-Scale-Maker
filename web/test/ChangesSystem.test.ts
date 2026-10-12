import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import ChangesSystem from '~/components/ChangesSystem.vue'
import { type ChangesBar, type ChangesChord, type ChangesLine, type GuideNote, type Letter, parseChart } from '@chord-scale-maker/engine'

vi.mock('~/utils/changesDrawing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/changesDrawing')>()),
  drawChangesLine: () => ({ xs: [[0.1, 0.3, 0.5, 0.7]] }),
}))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const chord = (beat: number, text: string, guide: string): ChangesChord => ({
  beat,
  text,
  tokens: null,
  numeral: '',
  scale: null,
  reason: '',
  stated: false,
  heardIn: '',
  keyFrom: 'found',
  guide,
})
const bar = (chords: readonly ChangesChord[], voice: readonly GuideNote[]): ChangesBar => ({
  keySig: null,
  chords,
  marker: '',
  keyArea: '',
  repeatStart: false,
  repeatEnd: 0,
  end: 'none',
  volta: null,
  segno: false,
  coda: false,
  nav: '',
  voice,
})
const note = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 2, tie: false, tiedIn: false, accidental: null })
const mount = (line: ChangesLine) =>
  mountSuspended(ChangesSystem, { props: { line, first: true, beats: 4 as const, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const } })
const labelsOf = (el: Element): string[] => [...el.children].map((m) => m.textContent ?? '')

describe('ChangesSystem guide tone labels', () => {
  it('has no label row with the line off', async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', '')], [])] })
    expect(w.find('[data-slot="guides"]').exists()).toBe(false)
  })

  it("with a line on, labels each chord under the staff at its x, one label a chord, hidden from screen readers (the SVG's label reads them)", async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', '3'), chord(2, 'F7sus4', '4')], [note(2, 64, 0), note(6, 70, 2)])] })
    const row = w.find('[data-slot="guides"]')
    expect(row.attributes('aria-hidden')).toBe('true')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-4', 'print:h-3']))
    expect(labelsOf(row.element)).toEqual(['3', '4'])
    await vi.waitFor(() => expect(parseFloat((row.element.children[1] as HTMLElement).style.left)).toBeCloseTo(48.8))
  })

  it('leaves a chord without guide tones unlabelled, its rest drawn', async () => {
    const rest: GuideNote = { pitch: null, beat: 2, beats: 2, tie: false, tiedIn: false, accidental: null }
    const w = await mount({ bars: [bar([chord(0, 'C7', '3'), chord(2, 'Cm7#5#9x', '')], [note(2, 64, 0), rest])] })
    expect(labelsOf(w.find('[data-slot="guides"]').element)).toEqual(['3', ''])
  })
})

describe('ChangesSystem chords while editing', () => {
  const at = (c: ChangesChord, section: string, barNo: string, line: number, written = c.text): ChangesChord => ({ ...c, at: { section, bar: barNo }, line, written })
  const line: ChangesLine = { bars: [bar([at(chord(0, 'Dm7', ''), 'A', '3', 4), at(chord(2, 'G7', ''), 'A', '3', 5, 'A7')], [])] }

  it('draws plain chords when not editable', async () => {
    const w = await mount(line)
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('makes each chord a button named for its place, asking to edit its chart line', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { line, first: true, beats: 4 as const, barsPerLine: 4, numerals: false, scales: false, editable: true, selectedLine: 5 } })
    const buttons = w.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Edit Dm7, A bar 3', 'Edit A7 (concert G7), A bar 3'])
    expect(buttons[1]?.classes()).toContain('ring-2') // selected in the bar editor
    await buttons[0]?.trigger('click')
    expect(w.emitted('tap')?.[0]?.[0]).toMatchObject({ line: 4, section: 'A', bar: '3' })
  })
})

describe('ChangesSystem as the editor', () => {
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\n').value
  const at = (c: ChangesChord, line: number): ChangesChord => ({ ...c, at: { section: 'A', bar: '1' }, line, written: c.text })
  const line = (): ChangesLine => ({ bars: [bar([at(chord(0, 'Dm7', ''), 2), at(chord(2, 'G7', ''), 3)], [])] })
  const base = { first: true, beats: 4 as const, barsPerLine: 4, numerals: true, scales: true, editable: true, doc }

  it('renders each chord as a SheetChord while editable, with the one being edited a field', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3 } } })
    expect(w.findAllComponents({ name: 'SheetChord' })).toHaveLength(2)
    expect(w.find('input[aria-label="Chord, A bar 1"]').exists()).toBe(true)
  })

  it('adds a slot after the bar’s chords when editing one, at the next beat', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'slot', section: 'A', bar: '1' } } })
    const slot = w.findAllComponents({ name: 'SheetChord' }).find((c) => c.props('adding'))
    expect(slot?.find('input').exists()).toBe(true)
    await vi.waitFor(() => expect(parseFloat(slot?.element.parentElement?.style.left ?? '')).toBeCloseTo(68.8)) // xs[0][3], the beat after G7's
  })

  it('shows the draft’s reading under the chord being edited, italic and muted', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3 }, preview: { numeral: 'V7', scale: 'G Altered', readable: true } } })
    expect(w.find('[data-slot=numeral][data-draft]').text()).toBe('V7')
    expect(w.find('[data-slot=scale][data-draft]').text()).toBe('G Altered') // no abbreviation for Altered; the sheet's own label
    expect(w.find('[data-slot=scale][data-draft]').classes()).toContain('italic')
  })

  it('blanks the draft’s labels when the draft can’t be read', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3 }, preview: { numeral: null, scale: null, readable: false } } })
    expect(w.find('[data-slot=numeral][data-draft]').text()).toBe('')
  })

  it('without an editing prop, taps a chord the old way', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line() } })
    await w.find('button').trigger('click')
    expect(w.emitted('tap')?.[0]?.[0]).toMatchObject({ line: 2, section: 'A', bar: '1' })
  })
})

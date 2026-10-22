import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ChangesSystem from '~/components/ChangesSystem.vue'
import { buildChanges, type ChangesBar, type ChangesChord, type ChangesLine, changesFor, type ChartDoc, type GuideNote, type Letter, CONCERT, hexatonicChoices, type OverlayPlan, type Part, parseChart, partFor, type PentatonicPlan, showHexatonics, serializeChart, showPentatonics, showQuartals } from '@chord-scale-maker/engine'
import PentatonicLadder from '~/components/PentatonicLadder.vue'

vi.mock('~/utils/changesDrawing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/changesDrawing')>()),
  drawChangesLine: () => ({ xs: [0, 1, 2, 3].map((b) => [0.1, 0.3, 0.5, 0.7].map((x) => (b === 0 ? x : b * 0.25 + x / 4))), ends: [0.25, 0.5, 0.75, 1], scales: [] }),
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
  pentatonic: null,
  hexatonic: null, quartal: null,
})
const bar = (chords: readonly ChangesChord[], voice: readonly GuideNote[]): ChangesBar => ({
  at: { section: chords[0]?.at?.section ?? 'A', bar: chords[0]?.at?.bar ?? '1' },
  repeatOf: null,
  keySig: null,
  beats: 4,
  timeSignature: null,
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
  mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const } })
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
    const w = await mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: false, scales: false, editable: true, selectedLine: 5 } })
    const buttons = w.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Edit Dm7, A bar 3', 'Edit A7 (concert G7), A bar 3'])
    expect(buttons[1]?.classes()).toContain('ring-2') // selected in the bar editor
    await buttons[0]?.trigger('click')
    expect(w.emitted('tap')?.[0]?.[0]).toMatchObject({ line: 4, section: 'A', bar: '3' })
  })
})

describe('ChangesSystem as the editor', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n').value
  const at = (c: ChangesChord, line: number): ChangesChord => ({ ...c, at: { section: 'A', bar: '1' }, line, written: c.text })
  const line = (): ChangesLine => ({ bars: [bar([at(chord(0, 'Dm7', ''), 2), at(chord(2, 'G7', ''), 3)], [])], sectionEnd: false })
  const base = { first: true, barsPerLine: 4, numerals: true, scales: true, editable: true, doc }

  it('renders each chord as a SheetChord while editable, with the one being edited a field', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3, at: { section: 'A', bar: '1' } } } })
    expect(w.findAllComponents({ name: 'SheetChord' })).toHaveLength(2)
    expect(w.find('input[aria-label="Chord, A bar 1"]').exists()).toBe(true)
  })

  it('adds a slot after the bar’s chords when editing one, at the next beat', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'slot', section: 'A', bar: '1' } } })
    const slot = w.findAllComponents({ name: 'SheetChord' }).find((c) => c.props('adding'))
    expect(slot?.find('input').exists()).toBe(true)
    await vi.waitFor(() => expect(parseFloat(slot?.element.parentElement?.style.left ?? '')).toBeCloseTo(68.8)) // xs[0][3], the beat after G7's
  })

  it('puts the slot after the last chord’s name when that chord is on the bar’s last beat (#143)', async () => {
    const full = (): ChangesLine => ({ bars: [bar([at(chord(0, 'Dm7', ''), 2), at(chord(2, 'G7', ''), 3), at(chord(3, 'C7', ''), 4)], [])], sectionEnd: false })
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const name = (this as HTMLElement).dataset?.name
      if (name === '0-2') return DOMRect.fromRect({ x: 700, width: 60, height: 20 }) // C7's name, from beat 4 (xs 0.7)
      if ((this as HTMLElement).dataset?.slot === 'names') return DOMRect.fromRect({ x: 0, width: 1000, height: 48 }) // the names' row
      return DOMRect.fromRect()
    })
    try {
      const w = await mountSuspended(ChangesSystem, { props: { ...base, line: full(), editing: { kind: 'slot', section: 'A', bar: '1' } } })
      const slot = w.findAllComponents({ name: 'SheetChord' }).find((c) => c.props('adding'))
      await vi.waitFor(() => expect(parseFloat(slot?.element.parentElement?.style.left ?? '')).toBeCloseTo(76.8)) // C7's name's end, and a gap
    } finally {
      rect.mockRestore()
    }
  })

  it('shows the draft’s reading under the chord being edited, italic and muted', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3, at: { section: 'A', bar: '1' } }, preview: { numeral: 'V7', scale: 'G Altered', readable: true } } })
    expect(w.find('[data-slot=numeral][data-draft]').text()).toBe('V7')
    expect(w.find('[data-slot=scale][data-draft]').text()).toBe('G Altered') // no abbreviation for Altered; the sheet's own label
    expect(w.find('[data-slot=scale][data-draft]').classes()).toContain('italic')
  })

  it('blanks the draft’s labels when the draft can’t be read', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'chord', line: 3, at: { section: 'A', bar: '1' } }, preview: { numeral: null, scale: null, readable: false } } })
    expect(w.find('[data-slot=numeral][data-draft]').text()).toBe('')
  })

  it('makes the numeral and scale pickers while the sheet is the editor, notes when it is not', async () => {
    const withReason = (): ChangesLine => ({ bars: [bar([{ ...at(chord(2, 'G7', ''), 3), numeral: 'V7', scale: 'G Mixolydian', reason: 'the V of C', rule: 'D1' }], [])] })
    const picking = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason(), editing: null } })
    expect(picking.findAllComponents({ name: 'SheetLabelPicker' })).toHaveLength(2)
    expect(picking.findAllComponents({ name: 'ChangesNote' })).toHaveLength(0)
    expect(picking.findAllComponents({ name: 'SheetLabelPicker' }).map((c) => c.props('kind'))).toEqual(['numeral', 'scale'])
    const reading = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason() } })
    expect(reading.findAllComponents({ name: 'SheetLabelPicker' })).toHaveLength(0)
    expect(reading.findAllComponents({ name: 'ChangesNote' })).toHaveLength(2)
  })

  it('gives a chord with no numeral or scale a blank picker in each row, but not the new chord slot (#143)', async () => {
    const pickers = (w: Awaited<ReturnType<typeof mountSuspended>>) => w.findAllComponents({ name: 'SheetLabelPicker' })
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: null } })
    expect(pickers(w).map((c) => [c.props('kind'), c.props('chord'), c.props('blank')])).toEqual([
      ['numeral', 'Dm7', true],
      ['numeral', 'G7', true],
      ['scale', 'Dm7', true],
      ['scale', 'G7', true],
    ])
    const adding = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: { kind: 'slot', section: 'A', bar: '1' } } })
    expect(pickers(adding)).toHaveLength(4)
  })

  it('gives a rest (N.C.) no pickers: it has no function or scale to choose', async () => {
    const rest = (): ChangesLine => ({ bars: [bar([at(chord(0, 'N.C.', ''), 2), at(chord(2, 'G7', ''), 3)], [])], sectionEnd: false })
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: rest(), editing: null } })
    expect(w.findAllComponents({ name: 'SheetLabelPicker' }).map((c) => [c.props('kind'), c.props('chord')])).toEqual([
      ['numeral', 'G7'],
      ['scale', 'G7'],
    ])
  })

  it('shows the bar toolbar for the bar under the pointer, named for the bar, and relays its changes', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: null } })
    expect(w.find('[role=toolbar]').exists()).toBe(false)
    await w.find('[data-bar="0"]').trigger('pointerenter')
    const toolbar = w.find('[role=toolbar]')
    expect(toolbar.attributes('aria-label')).toBe('Bar 1 of A')
    await toolbar.findAll('button').find((b) => b.attributes('aria-label') === 'Insert a held bar after A bar 1')?.trigger('click')
    expect(w.emitted('update:doc')).toHaveLength(1)
    expect(w.emitted('said')?.[0]).toEqual(['A: bar 2 added'])
  })

  it('shows the toolbar for the bar whose chord has focus, right after that bar’s chords in the Tab order (review: Important 3)', async () => {
    const two = (): ChangesLine => ({ bars: [bar([at(chord(0, 'Dm7', ''), 2)], []), { ...bar([{ ...at(chord(0, 'G7', ''), 3), at: { section: 'A', bar: '2' } }], []), at: { section: 'A', bar: '2' } }], sectionEnd: false })
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: two(), editing: null }, attachTo: document.body })
    const buttons = w.findAll('button[aria-label^="Edit "]')
    await buttons[0]!.trigger('focusin')
    const toolbar = w.find('[role=toolbar]')
    expect(toolbar.attributes('aria-label')).toBe('Bar 1 of A')
    const order = buttons[0]!.element.compareDocumentPosition(toolbar.element)
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(buttons[1]!.element.compareDocumentPosition(toolbar.element) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy() // before bar 2’s chord
  })

  it('offers a ghost bar at the end of a section’s last line, which asks for a bar', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: { ...line(), sectionEnd: true }, editing: null } })
    const ghost = w.find('button[aria-label="Add a bar at the end of A"]')
    expect(ghost.exists()).toBe(true)
    await ghost.trigger('click')
    expect(w.emitted('addBar')?.[0]).toEqual(['A'])
    const mid = await mountSuspended(ChangesSystem, { props: { ...base, line: line(), editing: null } })
    expect(mid.find('button[aria-label="Add a bar at the end of A"]').exists()).toBe(false)
    const one = bar([at(chord(0, 'Dm7', ''), 2)], [])
    const full = await mountSuspended(ChangesSystem, { props: { ...base, line: { bars: [one, one, one, one], sectionEnd: true }, editing: null } })
    const pill = full.find('button[aria-label="Add a bar at the end of A"]')
    expect(pill.exists()).toBe(true)
    expect(pill.element.closest('[data-slot=after]')).not.toBeNull() // under the line, not over its last bar
    const reading = await mountSuspended(ChangesSystem, { props: { ...base, line: { ...line(), sectionEnd: true } } })
    expect(reading.find('button[aria-label="Add a bar at the end of A"]').exists()).toBe(false)
  })

  it('offers no ghost bar at the end of a written-out copy: its bars are the section it repeats (#143)', async () => {
    const copy = (): ChangesLine => ({ bars: line().bars.map((b) => ({ ...b, repeatOf: 'B' })), sectionEnd: true })
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: copy(), editing: null } })
    expect(w.find('button[aria-label^="Add a bar at the end of"]').exists()).toBe(false)
    const one = bar([at(chord(0, 'Dm7', ''), 2)], [])
    const full = await mountSuspended(ChangesSystem, { props: { ...base, line: { bars: [one, one, one, one].map((b) => ({ ...b, repeatOf: 'B' })), sectionEnd: true }, editing: null } })
    expect(full.find('button[aria-label^="Add a bar at the end of"]').exists()).toBe(false)
  })

  it('makes the section’s marker a button while the sheet is the editor, which asks for the rename dialog', async () => {
    const marked = (): ChangesLine => ({ bars: [{ ...line().bars[0]!, marker: 'A' }], sectionEnd: false })
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: marked(), editing: null } })
    const label = w.find('button[aria-label="Rename A"]')
    expect(label.text()).toBe('A')
    await label.trigger('click')
    expect(w.emitted('dialog')?.[0]).toEqual(['rename', 'A', 1])
    const reading = await mountSuspended(ChangesSystem, { props: { ...base, line: marked() } })
    expect(reading.find('button[aria-label="Rename A"]').exists()).toBe(false)
    expect(reading.text()).toContain('A')
  })

  it('without an editing prop, taps a chord the old way', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: line() } })
    await w.find('button').trigger('click')
    expect(w.emitted('tap')?.[0]?.[0]).toMatchObject({ line: 2, section: 'A', bar: '1' })
  })
})

describe('ChangesSystem editing a set of a chart with alternates (#469)', () => {
  const real = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C\n2 | F\nalt 2 | Dm7\n3 | C\n4 | G7\n').value
  const played = changesFor(real, 'alternate')
  const first = (): ChangesLine => buildChanges(played, CONCERT, 4, true).lines[0]!
  const lineOf = (bar: string): number => played.lines.findIndex((l) => l.kind === 'row' && l.bar === bar)
  const base = { first: true, barsPerLine: 4, numerals: true, scales: true, editable: true, doc: played, source: real, set: 'alternate' as const }
  const text = (doc: ChartDoc): string => serializeChart(doc).replace(/[ \t]*\|[ \t]*/g, ' | ')

  it('a chord typed on a shared bar in Alternate writes it an alt row, its standard row kept', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: first(), editing: { kind: 'chord', line: lineOf('3'), at: { section: 'A', bar: '3' } } } })
    const field = w.find('input[aria-label="Chord, A bar 3"]')
    await field.setValue('E7')
    await field.trigger('keydown', { key: 'Enter' })
    const next = w.emitted('update:doc')?.[0]?.[0] as ChartDoc
    expect(text(next)).toMatch(/\nalt 3 \| E7\n/)
    expect(text(next)).toMatch(/\n3 \| C\n/)
    expect(text(next)).toMatch(/\nalt 2 \| Dm7\n/)
  })

  it('a bar op acts on the real doc: + after keeps a later alt row, renumbered', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { ...base, line: first(), editing: null } })
    await w.find('[data-bar="0"]').trigger('pointerenter')
    await w.find('[role=toolbar]').findAll('button').find((b) => b.attributes('aria-label') === 'Insert a held bar after A bar 1')?.trigger('click')
    const next = w.emitted('update:doc')?.[0]?.[0] as ChartDoc
    expect(text(next)).toMatch(/\n3 \| F\nalt 3 \| Dm7\n/)
  })
})

describe('ChangesSystem pentatonic ladders', () => {
  it('opens a label’s ladder at its section’s rung, and a pick names the run', async () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | Cmaj7').value
    const plan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' as const } }, fallback: { rung: 0, side: 'flat' as const }, counts: true }
    const line = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)[1]!
    const w = await mountSuspended(ChangesSystem, { props: { line, part: CONCERT, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, overlay: plan, counted: true }, attachTo: document.body })
    const label = w.find('[data-slot="pentatonic"] [data-section="B"] button')
    expect(label.text()).toBe('B♭m♪ 1')
    await label.trigger('click')
    await flushPromises()
    expect(w.find('[data-sheet-choice]').text()).toBe('Sheet’s choice (B♭m)')
    await w.findAll('[data-pent]').find((p) => p.text() === 'Gm')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['B:1:0'], 7])
    w.unmount()
  })

  const mountLine = async (text: string, plan: PentatonicPlan, index: number) => {
    const lines = showPentatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines)
    return mountSuspended(ChangesSystem, { props: { line: lines[index]!, part: CONCERT, first: index === 0, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, overlay: plan, counted: plan.counts }, attachTo: document.body })
  }
  const slip: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
  const AB = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | Dm7\n1 | G7\n2 | Cmaj7'

  it('tints a label by its rung, its shared count and accessible name saying the same without colour (#277)', async () => {
    const w = await mountLine(AB, slip, 1)
    const label = w.find('[data-slot="pentatonic"] [data-section="B"]')
    expect(label.classes()).toContain('text-rung-5')
    expect(label.find('button').attributes('aria-label')).toMatch(/, 1 of 5 notes in /)
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
    w.unmount()
  })

  it('draws no tint with One rung', async () => {
    const one: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false }
    const w = await mountLine(AB, one, 0)
    expect(w.find('[data-slot="pentatonic"] [data-section]').classes().some((c) => c.startsWith('text-rung-'))).toBe(false)
    w.unmount()
  })
})

describe('ChangesSystem interface levels', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n').value
  const at = (c: ChangesChord, line: number): ChangesChord => ({ ...c, at: { section: 'A', bar: '1' }, line, written: c.text })
  const withReason = (): ChangesLine => ({ bars: [bar([{ ...at(chord(2, 'G7', ''), 3), numeral: 'V7', scale: 'G Mixolydian', reason: 'the V of C', rule: 'D1' }], [])] })
  const base = { first: true, barsPerLine: 4, numerals: true, scales: true, editable: true, doc }
  const level = (l: 'essentials' | 'intermediate' | 'everything') => {
    useInterface().level.value = l
  }
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('Essentials: the labels are plain text, editing or not', async () => {
    level('essentials')
    const picking = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason(), editing: null } })
    expect(picking.findAllComponents({ name: 'SheetLabelPicker' })).toHaveLength(0)
    expect(picking.find('[data-slot=numeral]').text()).toBe('V7')
    const reading = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason() } })
    expect(reading.findAllComponents({ name: 'ChangesNote' })).toHaveLength(0)
    expect(reading.find('[data-slot=scale]').text()).toBe('G Mixolydian')
  })

  it('Intermediate: the scale picker and the notes, not the function picker', async () => {
    level('intermediate')
    const picking = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason(), editing: null } })
    expect(picking.findAllComponents({ name: 'SheetLabelPicker' }).map((c) => c.props('kind'))).toEqual(['scale'])
    const reading = await mountSuspended(ChangesSystem, { props: { ...base, line: withReason() } })
    expect(reading.findAllComponents({ name: 'ChangesNote' })).toHaveLength(2)
  })
})

describe('ChangesSystem pentatonic ladder by interface level', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('below Everything the row prints its labels, no ladder to open', async () => {
    useInterface().level.value = 'intermediate'
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | Cmaj7').value
    const plan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' as const } }, fallback: { rung: 0, side: 'flat' as const }, counts: true }
    const line = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)[1]!
    const w = await mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, overlay: plan, counted: true } })
    expect(w.findAllComponents({ name: 'PentatonicLadder' })).toHaveLength(0)
    expect(w.find('[data-slot="pentatonic"] [data-section="B"]').text()).toContain('B♭m')
  })
})

describe('ChangesSystem hexatonic row', () => {
  const HEX = { kind: 'hexatonic' } as const
  const mountHex = (text: string) => {
    const line = showHexatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, HEX).lines)[0]!
    return mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: true, scales: true, clef: 'treble' as const, overlay: HEX } })
  }

  it('labels each chord with its pair where it changes, blank where the scale has none, and draws no pentatonic row', async () => {
    const w = await mountHex('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Cmaj7\n3 | C6 | C Major Pentatonic\n4 | Dm7')
    expect(w.findAll('[data-slot="hexatonic"] > span').map((s) => s.find('span').text())).toEqual(['G/Am', 'C/Dm'])
    expect(w.find('[data-slot="pentatonic"]').exists()).toBe(false)
    expect(w.findAllComponents({ name: 'PentatonicLadder' })).toHaveLength(0)
    expect(w.find('[data-slot="hexatonic"]').html()).not.toMatch(/text-rung-/)
  })

  it('greys a label ranked against the key that is not the key’s pair (#432)', async () => {
    const KEY = { kind: 'hexatonic', basis: 'key' } as const
    const line = showHexatonics(buildChanges(parseChart('title: T\nkey: Dm\n\nsection: A\n1 | Em7b5\n2 | A7b9\n3 | Dm6\n4 | Dm6').value, CONCERT, 4, false, 'off', undefined, KEY).lines)[0]!
    const w = await mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: true, scales: true, clef: 'treble' as const, overlay: KEY } })
    const marks = w.findAll('[data-slot="hexatonic"] > span')
    const a7 = marks.find((m) => m.attributes('data-chord') === 'A:2:0')!
    const dm = marks.find((m) => m.attributes('data-chord') === 'A:3:0')!
    expect([a7.find('span').text(), a7.attributes('data-off-key')]).toEqual(['Gm/A+', undefined])
    expect(dm.attributes('data-off-key')).toBe('true')
    expect(dm.attributes('title')).toContain('Not the key’s pair')
  })

  it('has no hexatonic row under the Pentatonic overlay, or none', async () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7').value
    const plan: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false }
    const line = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)[0]!
    const props = { line, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const }
    const pent = await mountSuspended(ChangesSystem, { props: { ...props, overlay: plan } })
    expect(pent.find('[data-slot="hexatonic"]').exists()).toBe(false)
    expect(pent.find('[data-slot="pentatonic"]').exists()).toBe(true)
    expect((await mountSuspended(ChangesSystem, { props })).find('[data-slot="hexatonic"]').exists()).toBe(false)
  })
})

describe('ChangesSystem quartal row (#432)', () => {
  const II_V = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | C7 | C Half-Whole'
  const mountQ = (plan: OverlayPlan) => {
    const line = showQuartals(buildChanges(parseChart(II_V).value, CONCERT, 4, false, 'off', undefined, plan).lines)[0]!
    return mountSuspended(ChangesSystem, { props: { line, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, overlay: plan }, attachTo: document.body })
  }
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('labels each chord with its stack, blank where the scale has none, and draws no other row', async () => {
    const w = await mountQ({ kind: 'quartal' })
    expect(w.findAll('[data-slot="quartal"] > span').map((s) => s.find('span').text())).toEqual(['B E A D', 'D G C F', 'F B E A'])
    expect(w.find('[data-slot="hexatonic"]').exists()).toBe(false)
    expect(w.find('[data-slot="pentatonic"]').exists()).toBe(false)
    w.unmount()
  })

  it('opens the chord’s stacks as the plan asks; a pick is its bottom note, concert, the sheet’s choice null', async () => {
    const w = await mountQ({ kind: 'quartal', notes: 3 })
    const b = w.find('[data-slot="quartal"] [data-chord="A:2:0"] button')
    expect(b.attributes('aria-label')).toBe('Fourths: G C F, built on 4, 2 guide tones. Show the choices')
    await b.trigger('click')
    await flushPromises()
    const rows = w.findAll('[data-choice]')
    expect(rows.every((r) => /^\S+ \S+ \S+ · on \d · \d guide tones?$/.test(r.text()))).toBe(true)
    await rows.find((r) => r.text().startsWith('E A D'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['quartal', ['A:2:0'], 4])
    await w.find('[data-slot="quartal"] [data-chord="A:2:0"] button').trigger('click')
    await flushPromises()
    await w.find('[data-sheet-choice]').trigger('click')
    expect(w.emitted('pick')?.[1]).toEqual(['quartal', ['A:2:0'], null])
    w.unmount()
  })

  it('below Everything every label is plain text', async () => {
    useInterface().level.value = 'intermediate'
    const w = await mountQ({ kind: 'quartal' })
    expect(w.find('[data-slot="quartal"] button').exists()).toBe(false)
    expect(w.find('[data-slot="quartal"] [data-chord="A:2:0"]').text()).toBe('D G C F')
    w.unmount()
  })
})

describe('ChangesSystem chord picks (#303)', () => {
  const WT = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C7#5 | C Whole Tone\n2 | Dm7\n3 | C7#5 | C Whole Tone'
  const RUN = 'title: T\nkey: C\n\nsection: A\n1 | C7#5 | C Whole Tone\n2 | Dm7\n3 | Dm7\n4 | C7#5 | C Whole Tone'
  const CHORD: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord' }
  const KEY: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
  const HEX: OverlayPlan = { kind: 'hexatonic' }
  const II_V = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Dm7\n3 | G7\n4 | Cmaj7'
  const mountPlan = (text: string, plan: OverlayPlan, part: Part = CONCERT, index = 0) => {
    const built = buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan).lines
    const lines = plan.kind === 'hexatonic' ? showHexatonics(built) : showPentatonics(built)
    return mountSuspended(ChangesSystem, { props: { line: lines[index]!, part, first: true, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, overlay: plan }, attachTo: document.body })
  }
  const open = async (w: Awaited<ReturnType<typeof mountPlan>>, sel: string) => {
    await w.find(sel).trigger('click')
    await flushPromises()
    const d = w.find('[role="dialog"]')
    return { d, header: d.find(`[id="${d.attributes('aria-labelledby')}"]`).text(), footer: d.findAll('p').at(-1)!.text() }
  }
  afterEach(() => {
    useInterface().level.value = 'everything'
  })

  it('Chord basis: the label opens the chord’s choices, headed by its chord and bar; a pick is concert', async () => {
    const w = await mountPlan(WT, CHORD)
    expect(w.findAllComponents(PentatonicLadder)).toHaveLength(0)
    const b = w.find('[data-chord="A:2:0"] button')
    expect(b.attributes('aria-label')).toBe('Pentatonic: D minor, built on 1, 5 of 5 notes in D Dorian. Show the choices')
    const { header, footer } = await open(w, '[data-chord="A:2:0"] button')
    expect([header, footer]).toEqual(['Dm7 Dorian · A bar 2', 'Sets A bar 2. Why this order?'])
    expect(w.findAll('[data-choice]')).toHaveLength(12)
    await w.findAll('[data-choice]').find((r) => r.text().startsWith('Em pent'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['A:2:0'], 4])
    w.unmount()
    const two = await mountPlan(RUN, CHORD)
    expect((await open(two, '[data-chord="A:2:0"] button')).footer).toBe('Sets A bar 2 and A bar 3. Why this order?')
    await two.find('[data-sheet-choice]').trigger('click')
    expect(two.emitted('pick')?.[0]).toEqual(['pentatonic', ['A:2:0', 'A:3:0'], null])
    two.unmount()
  })

  it('Chord basis on a B♭ part: written header and rows, the pick still concert', async () => {
    const w = await mountPlan(WT, CHORD, partFor('tenor-sax'))
    const { header } = await open(w, '[data-chord="A:2:0"] button')
    expect(header).toBe('Em7 Dorian · A bar 2')
    await w.findAll('[data-choice]').find((r) => r.text().startsWith('F♯m pent'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['A:2:0'], 4]) // written F♯m sounds Em
    w.unmount()
  })

  it('Key basis: the ladder is headed by the chord, and its written pick is passed up concert', async () => {
    const doc = 'title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | Cmaj7'
    const w = await mountPlan(doc, KEY, partFor('tenor-sax'), 1)
    const { header, footer } = await open(w, '[data-section="B"] button')
    expect([header, footer]).toEqual(['Dmaj7 Lydian · B bar 1', 'Sets B bar 1. Why this order?'])
    expect(w.find('[data-slot="pentatonic"] [data-section="B"] button').attributes('aria-label')).toMatch(/notes in D major\. Show the ladder$/)
    w.findComponent(PentatonicLadder).vm.$emit('pick', 6)
    expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', ['B:1:0'], 4])
    w.findComponent(PentatonicLadder).vm.$emit('reset')
    expect(w.emitted('pick')?.[1]).toEqual(['pentatonic', ['B:1:0'], null])
    w.unmount()
  })

  it('Key basis on a chord with no scale: the header is the chord, and the ladder’s title stays its sub-line', async () => {
    const w = await mountPlan('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n\nsection: B\nbars: 3\n1 | C5', KEY, partFor('tenor-sax'), 1)
    const { d, header } = await open(w, '[data-section="B"] button')
    expect(header).toBe('D5 · B bar 1')
    expect(d.findAll('p').map((p) => p.text())).toContain('B · D major pentatonic ladder')
    w.unmount()
  })

  it('Hexatonic: each label opens the chord’s pairs; a pick names its roots, the sheet’s choice null', async () => {
    const w = await mountPlan(II_V, HEX)
    const label = w.find('[data-slot="hexatonic"] [data-chord="A:2:0"]')
    const b = label.find('button')
    const covers = hexatonicChoices('Dm7', 'D Dorian', CONCERT).find((c) => c.name === 'C/Dm')!.coverage
    expect(b.attributes('aria-label')).toBe(`Triad pair: C/Dm, covers ${covers} chord tones. Show the choices`)
    expect(b.classes()).toContain('decoration-dotted')
    expect(label.find('.hidden').text()).toBe('C/Dm') // print: plain text
    const { header, footer } = await open(w, '[data-slot="hexatonic"] [data-chord="A:2:0"] button')
    expect([header, footer]).toEqual(['Dm7 Dorian · A bar 2', 'Sets A bar 2. Why this order?'])
    expect(w.findAll('[data-choice]').every((r) => / · covers \d$/.test(r.text()))).toBe(true)
    await w.findAll('[data-choice]').find((r) => r.text().startsWith('F/G'))!.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual(['hexatonic', ['A:2:0'], [5, 7]])
    await open(w, '[data-slot="hexatonic"] [data-chord="A:2:0"] button')
    await w.find('[data-sheet-choice]').trigger('click')
    expect(w.emitted('pick')?.[1]).toEqual(['hexatonic', ['A:2:0'], null])
    w.unmount()
  })

  it('Hexatonic: a picked label says so', async () => {
    const w = await mountPlan(II_V, { kind: 'hexatonic', picks: { 'A:2:0': { roots: [5, 7] } } })
    const b = w.find('[data-slot="hexatonic"] [data-chord="A:2:0"] button')
    expect(b.text()).toBe('F/G')
    expect(b.attributes('aria-label')).toMatch(/^Triad pair: F\/G, covers \d chord tones, your pick\. Show the choices$/)
    expect(b.classes()).toContain('decoration-solid')
    w.unmount()
  })

  it('below Everything every label is plain text', async () => {
    useInterface().level.value = 'intermediate'
    for (const [text, plan] of [[WT, CHORD], [II_V, HEX]] as const) {
      const w = await mountPlan(text, plan)
      expect(w.find('[data-slot="pentatonic"] button, [data-slot="hexatonic"] button').exists()).toBe(false)
      expect(w.find('[data-chord="A:2:0"]').text()).not.toBe('')
      w.unmount()
    }
  })
})

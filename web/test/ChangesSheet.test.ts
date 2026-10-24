import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, ref } from 'vue'
import { CLICK, useClick } from '~/composables/useClick'
import { describe, expect, it } from 'vitest'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import ChangesSheet from '~/components/ChangesSheet.vue'
import { type Approach, buildChanges, type ChangesLineChoice, changesLinesPerPage, type ChartDoc, CONCERT, parseChart, type OverlayPlan, type PentatonicPlan, type ScaleView } from '@chord-scale-maker/engine'

const doc = parseChart('title: T\nkey: Bb\n\nsection: A\nbars: 4\n1 | Cm7\n2 | F7\n').value
// 64 bars: more lines than any page holds, at 2 or 4 bars a line
const long = parseChart(`title: L\nkey: C\nsection: A\n${Array.from({ length: 64 }, (_, i) => `${i + 1} | ${['Dm7', 'G7', 'CMaj7', 'A7'][i % 4]}`).join('\n')}\n`).value

const mountSheet = (over: Readonly<{ doc?: ChartDoc; line?: ChangesLineChoice; numerals?: boolean; scales?: boolean; editing?: null; overlay?: OverlayPlan | null; approach?: Approach }> = {}) =>
  mountSuspended(ChangesSheet, {
    props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, ...over },
    global: { stubs: { ChangesSystem: true } },
  })
const systemOf = async (line?: ChangesLineChoice) =>
  (await mountSheet(line ? { line } : {})).findComponent({ name: 'ChangesSystem' })

describe('ChangesSheet', () => {
  it('shows a preset’s path on screen while the sheet is the editor, and in the subtitle otherwise (#276)', async () => {
    const pentatonic: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: true, path: 'fifths', step: { unit: 'bars', bars: 4 } }
    const editing = await mountSheet({ editing: null, overlay: pentatonic })
    expect(editing.find('[data-slot="pent-caption"]').text()).toBe('Pentatonics: Fifths · every 4 bars')
    const viewing = await mountSheet({ overlay: pentatonic })
    expect(viewing.find('[data-slot="pent-caption"]').exists()).toBe(false)
    expect(viewing.text()).toContain('Changes · Pentatonics: Fifths · every 4 bars')
  })

  it('prints the pentatonic row where the key area changes, and passes a pick up', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, overlay: { kind: 'pentatonic', bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false } } }) // ChangesSystem drawn, not stubbed
    const labels = w.findAll('[data-slot="pentatonic"] button').map((b) => b.text())
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every((l) => /^[A-G][♭♯]?m♪$/.test(l))).toBe(true)
    expect(w.findComponent({ name: 'ChangesSystem' }).props('part')).toEqual({ clef: 'bass', trans: 'C' })
    w.findComponent(PentatonicLadder).vm.$emit('pick', 6)
    expect(w.emitted('pick')?.[0]).toEqual(['pentatonic', expect.any(Array), 6])
  })

  it('has no pentatonic row without a view', async () => {
    const w = await mountSheet({})
    expect(w.find('[data-slot="pentatonic"]').exists()).toBe(false)
  })

  it('tells each system it draws an arpeggio line, and gives line 1 the clef', async () => {
    const system = (await mountSheet({ line: 'up-root' })).findComponent({ name: 'ChangesSystem' })
    expect(system.props('arpeggio')).toBe(true)
    expect(system.props('clef')).toBe('bass') // the part's clef (this mount's part is bass)
  })

  it('draws the Cells line as beamed cells named cells in the aria-label (#298)', async () => {
    const system = (await mountSheet({ line: { kind: 'cells', id: '3rd-3rd' } })).findComponent({ name: 'ChangesSystem' })
    expect([system.props('arpeggio'), system.props('lineName')]).toEqual([true, 'cells'])
  })

  it('gives the guide tone line its Approach (#298): a figure into the second chord, none without one', async () => {
    const two = parseChart('title: T\nkey: C\n\nsection: A\nbars: 2\n1 | Dm7\n2 | G7\n').value
    const notes = async (approach?: Approach) =>
      (await mountSheet({ doc: two, line: 'third', ...(approach ? { approach } : {}) })).findComponent({ name: 'ChangesSystem' }).props('line').bars.flatMap((b: { voice: unknown[] }) => b.voice).length
    expect(await notes('chromatic-below')).toBeGreaterThan(await notes())
  })

  it('gives the 7th Chords line its Approach (#381): the first chord’s last note leads into the second', async () => {
    const two = parseChart('title: T\nkey: C\n\nsection: A\nbars: 2\n1 | Dm7\n2 | G7\n').value
    const last = async (approach?: Approach) =>
      (await mountSheet({ doc: two, line: 'up-root', ...(approach ? { approach } : {}) })).findComponent({ name: 'ChangesSystem' }).props('line').bars[0].voice.at(-1).pitch.midi
    expect(await last('chromatic-below')).not.toBe(await last())
  })

  it('plays a blank cell at the level it is given, Standard without one', async () => {
    const scaleAt = async (view?: ScaleView) =>
      (await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: true, ...(view ? { view } : {}) }, global: { stubs: { ChangesSystem: true } } }))
        .findComponent({ name: 'ChangesSystem' })
        .props('line').bars[0].chords[0].scale
    expect(await scaleAt()).toBe('C Dorian')
    expect(await scaleAt({ level: 'basic', seed: 0 })).toMatch(/^C Min.*Pent/)
  })

  it("gives the lines the chart's key and the part's clef (drawn on the first line only)", async () => {
    const line = await systemOf()
    expect(line.props('clef')).toBe('bass')
    expect(line.props('line').bars[0].keySig).toBe('Bb')
  })

  it("starts a new line where a line's names don't fit, until the chart changes", async () => {
    const four = parseChart('title: F\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | A7\n').value
    const sheet = await mountSheet({ doc: four })
    const lines = () => sheet.findAllComponents({ name: 'ChangesSystem' }).map((s) => s.props('line').bars.map((b: { at: { bar: string } }) => b.at.bar).join(' '))
    expect(lines()).toEqual(['1 2', '3 4']) // 2 bars a line (a phone's width)
    sheet.findComponent({ name: 'ChangesSystem' }).vm.$emit('overfull', 'A 2')
    await nextTick()
    expect(lines()).toEqual(['1', '2', '3 4'])
    await sheet.setProps({ doc: parseChart('title: F\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | C6\n4 | A7\n').value })
    expect(lines()).toEqual(['1 2', '3 4'])
  })

  it('closes the print gap between lines', async () => {
    const className = (await systemOf()).element.parentElement?.className
    expect(className).toContain('print:space-y-0')
    expect(className).not.toContain('print:space-y-1')
  })

  it('with the line off, or no line given, draws slashes: no voice, no labels', async () => {
    for (const bar of [(await systemOf('off')).props('line').bars[0], (await systemOf()).props('line').bars[0]]) {
      expect(bar.voice).toEqual([])
      expect(bar.chords[0].guide).toBe('')
    }
  })

  it('with a line on, gives the first line the notes and labels', async () => {
    const third = await systemOf('third')
    expect(third.props('line').bars[0].voice.map((n: { pitch: unknown }) => n.pitch)).not.toContain(null)
    expect(third.props('line').bars[0].chords[0].guide).toBe('3')
    expect((await systemOf('seventh')).props('line').bars[0].chords[0].guide).toBe('7')
  })

  it('pages the lines by changesLinesPerPage', async () => {
    for (const line of ['off', 'third', 'up-root'] as const)
      for (const rows of [{ numerals: true, scales: true }, { numerals: false, scales: false }]) {
        const w = await mountSheet({ doc: long, line, ...rows })
        const per = changesLinesPerPage(line, rows)
        const total = w.findAllComponents({ name: 'ChangesSystem' }).length
        const pages = w.findAll('section')
        expect(total, `${line} ${JSON.stringify(rows)}`).toBeGreaterThan(per)
        expect(pages[0]?.findAll('changes-system-stub')).toHaveLength(per)
        expect(pages).toHaveLength(Math.ceil(total / per))
        w.unmount()
      }
  })

  it('while the sheet is the editor, offers Repeat a section beside + Section', async () => {
    const w = await mountSheet({ editing: null })
    const button = w.findAll('button').find((b) => b.text().includes('Repeat a section'))
    expect(button).toBeDefined()
    await button?.trigger('click')
    expect(w.emitted('repeatSection')).toHaveLength(1)
    const reading = await mountSheet()
    expect(reading.findAll('button').find((b) => b.text().includes('Repeat a section'))).toBeUndefined()
  })

  it('names + Section for what it does: Add a section (#143)', async () => {
    const w = await mountSheet({ editing: null })
    const add = w.find('button[aria-label="Add a section"]')
    expect(add.text()).toBe('Section')
    await add.trigger('click')
    expect(w.emitted('addSection')).toHaveLength(1)
  })
})

describe('ChangesSheet pentatonic tints, no contour band (#265, #277)', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n3 | Cmaj7\n\nsection: B\nbars: 3\n1 | Cmaj7').value
  const plan: PentatonicPlan = { kind: 'pentatonic', bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }

  it('tints the labels by rung and draws no band, the shared count carrying the rung without color', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: true, scales: true, overlay: plan } })
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
    const b = w.find('[data-slot="pentatonic"] [data-section="B"]')
    expect(b.classes()).toContain('text-rung-5')
    expect(b.text()).toMatch(/♪ 1$/)
  })
})

describe('ChangesSheet Hexatonic overlay', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Cmaj7\n2 | Cmaj7\n3 | C6 | C Major Pentatonic\n4 | Dm7').value
  const HEX = { kind: 'hexatonic' } as const
  const mountHex = (over: Readonly<Record<string, unknown>> = {}) => mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: true, scales: true, overlay: HEX, ...over } })

  it('labels each chord with its pair where it changes, blank where its scale has none, with no pentatonic row, band or caption', async () => {
    const w = await mountHex()
    expect(w.findAll('[data-slot="hexatonic"] > span').map((s) => s.find('span').text())).toEqual(['G/Am', 'C/Dm'])
    expect(w.find('[data-slot="pentatonic"]').exists()).toBe(false)
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
    expect((await mountHex({ editing: null })).find('[data-slot="pent-caption"]').exists()).toBe(false)
  })

  it('pages the lines as with the Pentatonic overlay', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc: long, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: true, scales: true, overlay: HEX }, global: { stubs: { ChangesSystem: true } } })
    expect(w.findAll('section')[0]?.findAll('changes-system-stub')).toHaveLength(changesLinesPerPage('off', { numerals: true, scales: true, pentatonics: true }))
  })
})

describe('ChangesSheet chord-basis tints (#272)', () => {
  const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | Cmaj7').value
  const base = { kind: 'pentatonic', bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, degree: 1 } as const
  const mountPlan = (pentatonic: PentatonicPlan) => mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: false, scales: false, overlay: pentatonic } })
  const hasRungLabel = (w: Awaited<ReturnType<typeof mountPlan>>) => w.findAll('[data-slot="pentatonic"] [data-chord]').some((e) => /text-rung-/.test(e.classes().join(' ')))

  it('tints on the chord basis', async () => {
    const w = await mountPlan({ ...base, basis: 'chord' })
    expect(hasRungLabel(w)).toBe(true)
  })

  it('does not tint on the key basis without picks', async () => {
    const w = await mountPlan({ ...base, basis: 'key' })
    expect(hasRungLabel(w)).toBe(false)
  })

  it('tints on the key basis with a pick', async () => {
    const at = buildChanges(doc, CONCERT, 4, false, 'off', undefined, { ...base, basis: 'chord' }).lines[0]!.bars[0]!.chords[0]!.pentatonic!.chord
    const w = await mountPlan({ ...base, basis: 'key', picks: { [at]: { pc: 0 } } })
    expect(hasRungLabel(w)).toBe(true)
  })
})

describe('ChangesSheet and Hear line (#507)', () => {
  it('hands the click its Line at concert pitch, with the flag on, and takes it back when it goes', async () => {
    const features = useRuntimeConfig().public.features as Record<string, unknown>
    const was = { ...features }
    Object.assign(features, { hearLine: true })
    try {
      const click = useClick(ref({ beats: 4 as const, style: '', metreChanges: false }), ref(undefined), { audio: () => null })
      const w = await mountSuspended(ChangesSheet, {
        props: { doc, title: 'T', subtitle: '', part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: '', numerals: false, scales: false, line: 'third' },
        global: { provide: { [CLICK as symbol]: click } },
      })
      expect(click.hasLine.value).toBe(true)
      expect(click.hasForm.value).toBe(true)
      w.unmount()
      expect(click.hasLine.value).toBe(false)
      expect(click.hasForm.value).toBe(false)
    } finally {
      Object.assign(features, was)
    }
  })
})

describe('ChangesSheet and its rhythm (#573)', () => {
  const withLine = (line: ChangesLineChoice) =>
    mountSuspended(ChangesSheet, {
      props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: false, scales: false, line, rhythm: 'unit:16:3:accents' },
      global: { stubs: { ChangesSystem: true } },
    })

  it('with the Line off, a lead sheet: the rhythm on a card over the first line', async () => {
    expect((await withLine('off')).findAll('[data-slot=rhythm-card]')).toHaveLength(1)
  })

  it('with a path, a card a step, named as the step marks are (#574)', async () => {
    const w = await mountSuspended(ChangesSheet, {
      props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: false, scales: false, line: 'off', rhythm: 'unit:8:3:accents', rhythmPath: { groups: [3, 4], gears: null, step: { unit: 'bars', bars: 2 } } },
      global: { stubs: { ChangesSystem: true } },
    })
    expect(w.findAll('[data-rhythm-card-step]').map((c) => c.attributes('data-rhythm-card-step'))).toEqual(['③', '④'])
    expect(w.findAll('[data-slot=rhythm-card]')).toHaveLength(2)
  })

  it('with a Line on, no card: the Line plays the rhythm', async () => {
    expect((await withLine('third')).find('[data-slot=rhythm-card]').exists()).toBe(false)
  })
})

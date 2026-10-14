import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import ChangesSheet from '~/components/ChangesSheet.vue'
import { buildChanges, changesLinesPerPage, type ChartDoc, CONCERT, parseChart, type PentatonicPlan, type ScaleView, type SheetLine } from '@chord-scale-maker/engine'

const doc = parseChart('title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n').value
// 64 bars: more lines than any page holds, at 2 or 4 bars a line
const long = parseChart(`title: L\nkey: C\n${Array.from({ length: 64 }, (_, i) => `A | ${i + 1} | ${['Dm7', 'G7', 'CMaj7', 'A7'][i % 4]}`).join('\n')}\n`).value

const mountSheet = (over: Readonly<{ doc?: ChartDoc; signatures?: boolean; line?: SheetLine; numerals?: boolean; scales?: boolean; editing?: null; pentatonic?: PentatonicPlan | null }> = {}) =>
  mountSuspended(ChangesSheet, {
    props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, ...over },
    global: { stubs: { ChangesSystem: true } },
  })
const systemOf = async (signatures: boolean, line?: SheetLine) =>
  (await mountSheet({ signatures, ...(line ? { line } : {}) })).findComponent({ name: 'ChangesSystem' })

describe('ChangesSheet', () => {
  it('prints the pentatonic row where the key area changes, and passes a pick up', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, pentatonic: { bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false } } }) // ChangesSystem drawn, not stubbed
    const labels = w.findAll('[data-slot="pentatonic"] button').map((b) => b.text())
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every((l) => /^[A-G][♭♯]?m♪$/.test(l))).toBe(true)
    w.findComponent(PentatonicLadder).vm.$emit('pick', 6)
    expect(w.emitted('pentatonic')?.[0]).toEqual([expect.any(Array), 6])
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

  it('plays a blank cell at the level it is given, Standard without one', async () => {
    const scaleAt = async (view?: ScaleView) =>
      (await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: true, ...(view ? { view } : {}) }, global: { stubs: { ChangesSystem: true } } }))
        .findComponent({ name: 'ChangesSystem' })
        .props('line').bars[0].chords[0].scale
    expect(await scaleAt()).toBe('C Dorian')
    expect(await scaleAt({ level: 'basic', seed: 0 })).toMatch(/^C Min.*Pent/)
  })

  it("with signatures, gives the lines the chart's key and the part's clef (drawn on the first line only)", async () => {
    const line = await systemOf(true)
    expect(line.props('clef')).toBe('bass')
    expect(line.props('line').bars[0].keySig).toBe('Bb')
  })

  it('without, neither (drawn as before)', async () => {
    const line = await systemOf(false)
    expect(line.props('clef')).toBeUndefined()
    expect(line.props('line').bars[0].keySig).toBeNull()
  })

  it("starts a new line where a line's names don't fit, until the chart changes", async () => {
    const four = parseChart('title: F\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 4 | A7\n').value
    const sheet = await mountSheet({ doc: four })
    const lines = () => sheet.findAllComponents({ name: 'ChangesSystem' }).map((s) => s.props('line').bars.map((b: { at: { bar: string } }) => b.at.bar).join(' '))
    expect(lines()).toEqual(['1 2', '3 4']) // 2 bars a line (a phone's width)
    sheet.findComponent({ name: 'ChangesSystem' }).vm.$emit('overfull', 'A 2')
    await nextTick()
    expect(lines()).toEqual(['1', '2', '3 4'])
    await sheet.setProps({ doc: parseChart('title: F\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | C6\nA | 4 | A7\n').value })
    expect(lines()).toEqual(['1 2', '3 4'])
  })

  it('keeps the print gap between lines unless signatures are on', async () => {
    const gap = async (signatures: boolean) => (await systemOf(signatures)).element.parentElement?.className
    expect(await gap(false)).toContain('print:space-y-1')
    expect(await gap(true)).toContain('print:space-y-0')
    expect(await gap(true)).not.toContain('print:space-y-1')
  })

  it('with the line off, or no line given, draws slashes: no voice, no labels', async () => {
    for (const bar of [(await systemOf(false, 'off')).props('line').bars[0], (await systemOf(false)).props('line').bars[0]]) {
      expect(bar.voice).toEqual([])
      expect(bar.chords[0].guide).toBe('')
    }
  })

  it('with a line on, gives the first line the clef even without signatures, and the notes and labels', async () => {
    const third = await systemOf(false, 'third')
    expect(third.props('clef')).toBe('bass')
    expect(third.props('line').bars[0].keySig).toBeNull()
    expect(third.props('line').bars[0].voice.map((n: { pitch: unknown }) => n.pitch)).not.toContain(null)
    expect(third.props('line').bars[0].chords[0].guide).toBe('3')
    expect((await systemOf(false, 'seventh')).props('line').bars[0].chords[0].guide).toBe('7')
  })

  it('closes the print gap when a line is on', async () => {
    const className = (await systemOf(false, 'seventh')).element.parentElement?.className
    expect(className).toContain('print:space-y-0')
    expect(className).not.toContain('print:space-y-1')
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

describe('ChangesSheet pentatonic contour (#265)', () => {
  const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Cmaj7\nA | 3 | Cmaj7').value
  const plan = (counts: boolean): PentatonicPlan => ({ bySection: counts ? { B: { rung: 5, side: 'flat' } } : {}, fallback: { rung: 0, side: 'flat' }, counts })

  it('gives each line its contour, with the riser carried across lines', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: true, scales: true, pentatonic: plan(true) } })
    const bands = w.findAll('[data-slot="contour"]')
    expect(bands).toHaveLength(3)
    expect(bands.map((b) => b.findAll('line[data-kind="riser"]').length)).toEqual([0, 1, 1])
  })

  it('has no band with One rung', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: true, scales: true, pentatonic: plan(false) } })
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
  })
})

describe('ChangesSheet chord-basis contour (#272)', () => {
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Cmaj7').value
  const base = { bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, rank: 12 } as const
  const mountPlan = (pentatonic: PentatonicPlan) => mountSuspended(ChangesSheet, { props: { doc, title: 'T', subtitle: '', part: CONCERT, instrumentLabel: '', numerals: false, scales: false, pentatonic } })
  const hasRungLabel = (w: Awaited<ReturnType<typeof mountPlan>>) => w.findAll('[data-slot="pentatonic"] [data-chord]').some((e) => /text-rung-/.test(e.classes().join(' ')))

  it('draws the band and tints on the chord basis', async () => {
    const w = await mountPlan({ ...base, basis: 'chord' })
    expect(w.find('[data-slot="contour"]').exists()).toBe(true)
    expect(hasRungLabel(w)).toBe(true)
  })

  it('draws neither on the key basis without picks', async () => {
    const w = await mountPlan({ ...base, basis: 'key' })
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
    expect(hasRungLabel(w)).toBe(false)
  })

  it('draws both on the key basis with a pick', async () => {
    const at = buildChanges(doc, CONCERT, 4, false, 'off', undefined, { ...base, basis: 'chord' }).lines[0]!.bars[0]!.chords[0]!.pentatonic!.chord
    const w = await mountPlan({ ...base, basis: 'key', picks: { [at]: 0 } })
    expect(w.find('[data-slot="contour"]').exists()).toBe(true)
    expect(hasRungLabel(w)).toBe(true)
  })
})

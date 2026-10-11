import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import ChangesSystem from '~/components/ChangesSystem.vue'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '@chord-scale-maker/engine'

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
    expect(w.emitted('edit')?.[0]?.[0]).toMatchObject({ line: 4, section: 'A', bar: '3' })
  })
})

import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import ChangesSystem from '~/components/ChangesSystem.vue'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '~~/engine'

vi.mock('~/utils/changesDrawing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/changesDrawing')>()),
  drawChangesLine: () => ({ xs: [[0.1, 0.3, 0.5, 0.7]] }),
}))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const chord = (beat: number, text: string, guide: readonly string[]): ChangesChord => ({
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
const bar = (chords: readonly ChangesChord[], voices: readonly (readonly GuideNote[])[]): ChangesBar => ({
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
  voices,
})
const note = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 2, tie: false, tiedIn: false, accidental: null })
const mount = (line: ChangesLine) =>
  mountSuspended(ChangesSystem, { props: { line, first: true, beats: 4 as const, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const } })
const labelsOf = (el: Element): string[][] => [...el.children].map((m) => [...m.children].map((s) => s.textContent ?? ''))

describe('ChangesSystem guide tone labels', () => {
  it('has no label row with no guide tone on', async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', [])], [])] })
    expect(w.find('[data-slot="guides"]').exists()).toBe(false)
  })

  it("with one guide on, labels each chord under the staff at its x, hidden from screen readers (the SVG's label reads them)", async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', ['3']), chord(2, 'F7sus4', ['4'])], [[note(2, 64, 0), note(6, 70, 2)]])] })
    const row = w.find('[data-slot="guides"]')
    expect(row.attributes('aria-hidden')).toBe('true')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-4', 'print:h-3']))
    expect(labelsOf(row.element)).toEqual([['3'], ['4']])
    await vi.waitFor(() => expect(parseFloat((row.element.children[1] as HTMLElement).style.left)).toBeCloseTo(48.8))
  })

  it('with both on, stacks the labels top to bottom like the notes, in a taller row', async () => {
    const w = await mount({
      bars: [
        bar(
          [chord(0, 'Dm7', ['7', '3']), chord(2, 'G7', ['3', '7'])],
          [
            [note(0, 72, 0), note(6, 71, 2)],
            [note(3, 65, 0), note(3, 65, 2)],
          ],
        ),
      ],
    })
    const row = w.find('[data-slot="guides"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-7', 'print:h-5']))
    expect(labelsOf(row.element)).toEqual([
      ['7', '3'],
      ['3', '7'],
    ])
  })
})

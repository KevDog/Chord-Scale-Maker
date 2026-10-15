import { describe, expect, it } from 'vitest'
import { isPentatonicPathName, isPentatonicPreset, isPentatonicStep, PENTATONIC_PATH_LABELS, PENTATONIC_STEP, pentatonicCycle, pentatonicPathCaption, isPentatonicView, PENTATONIC_DEGREE_LABELS, PENTATONIC_HOME, pentatonicAt, pentatonicDegreeFrom, pentatonicCaption, pentatonicLadder, pentatonicPick, pentatonicRanking, pentatonicStep } from '../pentatonics'
import { pitchClasses } from '../ladder'
import { LETTERS, parseRoot, pcOf, type Spelled } from '../pitch'
import { SCALES } from '../scales'

const names = (home: string) => pentatonicLadder(parseRoot(home)).map((r) => `${r.rung}${r.side === 'flat' ? '♭' : r.side === 'sharp' ? '♯' : ''} ${r.name} ${r.shared}`)
const ugly = (n: Spelled) => Math.abs(n.acc) > 1 || ['B#', 'E#', 'Cb', 'Fb'].includes(LETTERS[n.letter] + (n.acc > 0 ? '#' : n.acc < 0 ? 'b' : ''))

describe('pentatonic ladders', () => {
  it("ranks C major's ladder from Am, by fifths each side", () => {
    expect(names('A')).toEqual(['0 Am 5', '1♭ Dm 5', '1♯ Em 5', '2♭ Gm 4', '2♯ Bm 4', '3♭ Cm 3', '3♯ F♯m 3', '4♭ Fm 2', '4♯ C♯m 2', '5♭ B♭m 1', '5♯ G♯m 1', '6 E♭m 0'])
  })

  it("ranks C minor's ladder from Cm", () => {
    expect(names('C').slice(0, 3)).toEqual(['0 Cm 5', '1♭ Fm 5', '1♯ Gm 5'])
  })

  it('has the shape 5 5 4 3 2 1 0 by rung in every key', () => {
    for (const home of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']) {
      const ladder = pentatonicLadder(parseRoot(home))
      expect(ladder).toHaveLength(12)
      expect([0, 1, 2, 3, 4, 5, 6].map((r) => ladder.find((x) => x.rung === r)?.shared)).toEqual([5, 5, 4, 3, 2, 1, 0])
      expect(new Set(ladder.map((x) => pcOf(x.root))).size).toBe(12)
    }
  })

  it('spells every pentatonic without double accidentals or B♯ E♯ C♭ F♭', () => {
    for (let pc = 0; pc < 12; pc++)
      for (const home of [parseRoot(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc] ?? 'C'), parseRoot(['C', 'C#', 'D', 'D#', 'E', 'F', 'Gb', 'G', 'G#', 'A', 'A#', 'B'][pc] ?? 'C')])
        for (const r of pentatonicLadder(home)) expect(ugly(r.root), `${r.name} from ${LETTERS[home.letter]}${home.acc}`).toBe(false)
  })

  it('walks sharps on the sharp side and flats on the flat side; rung 6 from the flat walk', () => {
    expect(names('C#').filter((n) => n.startsWith('6') || n.startsWith('4'))).toEqual(['4♭ Am 2', '4♯ Fm 2', '6 Gm 0']) // E major: E♯m → Fm
    expect(names('C#').find((n) => n.startsWith('3♯'))).toBe('3♯ B♭m 3') // A♯m spells B♯ and E♯: B♭m
    expect(names('F').at(-1)).toBe('6 Bm 0') // A♭ major: C♭m → Bm
  })

  it('picks a rung and side; the side is ignored where a rung has one pentatonic', () => {
    const ladder = pentatonicLadder(parseRoot('A'))
    expect(pentatonicAt(ladder, { rung: 2, side: 'flat' }).name).toBe('Gm')
    expect(pentatonicAt(ladder, { rung: 2, side: 'sharp' }).name).toBe('Bm')
    expect(pentatonicAt(ladder, { rung: 0, side: 'sharp' }).name).toBe('Am')
    expect(pentatonicAt(ladder, { rung: 6, side: 'sharp' }).name).toBe('E♭m')
  })

  it('reads a view', () => {
    expect(isPentatonicView({ rung: 3, side: 'sharp' })).toBe(true)
    expect(isPentatonicView({ rung: 7, side: 'sharp' })).toBe(false)
    expect(isPentatonicView({ rung: 1, side: 'up' })).toBe(false)
  })
})

const show = (r: Readonly<Record<string, { rung: number; side: string }>>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.rung === 0 || v.rung === 6 ? String(v.rung) : `${v.rung}${v.side === 'flat' ? '♭' : '♯'}`]))

describe('pentatonic paths', () => {
  const cycle = (path: Parameters<typeof pentatonicCycle>[0], n: number) => Array.from({ length: n }, (_, i) => show({ s: pentatonicCycle(path, i) }).s)

  it('cycles each preset from Home, one step a unit, wrapping round (#276)', () => {
    expect(cycle('side-slip', 4)).toEqual(['0', '5♭', '0', '5♭'])
    expect(cycle('fifths', 13)).toEqual(['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6', '5♭', '4♭', '3♭', '2♭', '1♭', '0'])
    expect(cycle('minor-thirds', 5)).toEqual(['0', '3♭', '6', '3♯', '0'])
    expect(cycle('major-thirds', 4)).toEqual(['0', '4♯', '4♭', '0'])
    expect(cycle('one', 3)).toEqual(['0', '0', '0'])
    expect(cycle('custom', 2)).toEqual(['0', '0'])
    expect(['one', 'fifths', 'custom'].every(isPentatonicPathName)).toBe(true)
    expect([undefined, 'thirds', 3].some(isPentatonicPathName)).toBe(false)
  })

  it('knows a step: a unit and 2, 4 or 8 bars, by default each section', () => {
    expect(PENTATONIC_STEP).toEqual({ unit: 'section', bars: 4 })
    expect([{ unit: 'section', bars: 4 }, { unit: 'key-area', bars: 2 }, { unit: 'bars', bars: 8 }].every(isPentatonicStep)).toBe(true)
    expect([null, {}, { unit: 'chord', bars: 4 }, { unit: 'bars', bars: 3 }, { unit: 'bars' }, 'bars'].some(isPentatonicStep)).toBe(false)
  })

  it('names the path playing, for a preset only', () => {
    expect(pentatonicPathCaption('minor-thirds', { unit: 'bars', bars: 4 })).toBe('Pentatonics: Minor thirds · every 4 bars')
    expect(pentatonicPathCaption('side-slip')).toBe('Pentatonics: Side-slip · by section')
    expect(pentatonicPathCaption('fifths', { unit: 'key-area', bars: 2 })).toBe('Pentatonics: Fifths · by key area')
    expect(pentatonicPathCaption('one')).toBeNull()
    expect(pentatonicPathCaption('custom')).toBeNull()
    expect(PENTATONIC_PATH_LABELS['major-thirds']).toBe('Major thirds')
    expect(['side-slip', 'fifths', 'minor-thirds', 'major-thirds'].every((p) => isPentatonicPreset(p as never))).toBe(true)
    expect([undefined, 'one', 'custom'].some((p) => isPentatonicPreset(p as never))).toBe(false)
  })

  it('steps by semitones round the circle of fifths', () => {
    expect([0, 1, 3, 6, 9, 4, 8].map((s) => show({ s: pentatonicStep(s) }).s)).toEqual(['0', '5♭', '3♭', '6', '3♯', '4♯', '4♭'])
    expect(pentatonicStep(12)).toEqual(PENTATONIC_HOME)
    expect(pentatonicStep(-3)).toEqual(pentatonicStep(9))
  })

})

describe('pentatonics ranked against any scale (#266)', () => {
  const on = (name: keyof typeof SCALES, root: string): ReadonlySet<number> => pitchClasses(SCALES[name][0]!, pcOf(parseRoot(root)))
  const names = (scale: ReadonlySet<number>, root: string): string[] => pentatonicRanking(scale, parseRoot(root)).map((p) => p.name)

  it('ranks the spec’s examples by fifths from the chord root', () => {
    expect(names(on('dorian', 'D'), 'D').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
    expect(names(on('ionian', 'C'), 'C').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
    expect(names(on('mixolydian', 'G'), 'G').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
  })

  it('gives every scale 12 distinct pentatonics, one per degree, shared never rising', () => {
    for (const name of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
      const ranked = pentatonicRanking(on(name, 'C'), parseRoot('C'))
      expect(ranked.map((p) => p.degree).toSorted((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i))
      expect(ranked.every((p) => pcOf(p.root) === p.degree)).toBe(true) // from C, the degree is the root's pc
      ranked.slice(1).forEach((p, i) => expect(p.shared).toBeLessThanOrEqual(ranked[i]!.shared))
    }
  })

  it('spells on the chord’s side and without double accidentals', () => {
    expect(names(on('dorian', 'Eb'), 'Eb')[0]).toBe('E♭m')
    expect(names(on('ionian', 'F#'), 'F#').every((n) => !/𝄪|𝄫/.test(n))).toBe(true)
  })

  it('picks a staff’s pentatonic on a degree and lights the notes it shares', () => {
    const pcs = [...on('dorian', 'D')].sort((a, b) => a - b) // C D E F G A B as pcs
    const home = pentatonicPick(pcs, parseRoot('D'), 0)
    expect(home.pentatonic).toEqual({ name: 'Dm', degree: 0, shared: 5, picked: false, sheet: 'Dm' })
    expect(home.lit.filter(Boolean)).toHaveLength(5)
    expect(pentatonicPick(pcs, parseRoot('D'), 7).pentatonic).toMatchObject({ name: 'Am', degree: 7, shared: 5 })
    const far = pentatonicPick(pcs, parseRoot('D'), 3) // Fm on ♭3 of D Dorian: F A♭ B♭ C E♭, only F and C inside
    expect(far.pentatonic).toMatchObject({ name: 'Fm', degree: 3, shared: 2 })
    expect(far.lit.filter(Boolean)).toHaveLength(2)
  })

  it('spells each degree from the chord root as the ranking does', () => {
    const pcs = [...on('mixolydian', 'G')]
    const at = (d: number) => pentatonicPick(pcs, parseRoot('G'), d).pentatonic.name
    expect(PENTATONIC_DEGREE_LABELS.map((_, d) => at(d))).toEqual(['Gm', 'G♯m', 'Am', 'B♭m', 'Bm', 'Cm', 'C♯m', 'Dm', 'E♭m', 'Em', 'Fm', 'F♯m'])
    expect(at(6)).toBe(pentatonicRanking(new Set(pcs), parseRoot('G')).find((p) => p.degree === 6)?.name)
  })

  it('plays Auto as the most shared, nearest the chord root by fifths: the old rank 1', () => {
    for (const [scale, root] of [['ionian', 'C'], ['dorian', 'D'], ['mixolydian', 'G'], ['whole tone', 'C'], ['altered', 'Bb'], ['lydian', 'F#']] as const) {
      const pcs = [...on(scale, root)]
      const first = pentatonicRanking(new Set(pcs), parseRoot(root))[0]!
      expect(pentatonicPick(pcs, parseRoot(root), 'auto').pentatonic).toEqual({ name: first.name, degree: first.degree, shared: first.shared, picked: false, sheet: first.name })
    }
    expect(pentatonicPick([...on('ionian', 'C')], parseRoot('C'), 'auto').pentatonic.name).toBe('Dm') // on the 2
    expect(pentatonicPick([...on('mixolydian', 'G')], parseRoot('G'), 'auto').pentatonic.name).toBe('Dm') // on the 5
  })

  it('reads a bad degree as Auto', () => {
    const pcs = [...on('dorian', 'D')]
    const auto = pentatonicPick(pcs, parseRoot('D'), 'auto').pentatonic
    for (const d of [NaN, 2.5, -1, 12, 99]) expect(pentatonicPick(pcs, parseRoot('D'), d).pentatonic).toEqual(auto)
  })

  it('reads a degree from untrusted data: an integer 0–11, else Auto', () => {
    expect([0, 5, 11].map(pentatonicDegreeFrom)).toEqual([0, 5, 11])
    for (const v of ['auto', undefined, null, -1, 12, 2.5, '3', NaN]) expect(pentatonicDegreeFrom(v)).toBe('auto')
  })

  it('labels the 12 degrees chromatically from 1', () => {
    expect(PENTATONIC_DEGREE_LABELS).toEqual(['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'])
  })

  it('finds the usual inside choices: on 2, 3, 6 over Ionian; 1, 2, 5 over Dorian; 2, 5, 6 over Mixolydian', () => {
    const inside = (scale: keyof typeof SCALES) =>
      pentatonicRanking(on(scale, 'C'), parseRoot('C')).filter((p) => p.shared === 5).map((p) => p.degree).toSorted((a, b) => a - b).map((d) => PENTATONIC_DEGREE_LABELS[d])
    expect(inside('ionian')).toEqual(['2', '3', '6'])
    expect(inside('dorian')).toEqual(['1', '2', '5'])
    expect(inside('mixolydian')).toEqual(['2', '5', '6'])
  })

  it('captions every pick with its name and shared count', () => {
    expect(pentatonicCaption({ name: 'Dm', degree: 2, shared: 5, picked: false, sheet: 'Dm' })).toBe('Dm pent · 5 shared')
    expect(pentatonicCaption({ name: 'F♯m', degree: 6, shared: 3, picked: true, sheet: 'Dm' })).toBe('F♯m pent · 3 shared')
  })

  it('adds varies to the caption where a staff’s positions differ (#303)', () => {
    expect(pentatonicCaption({ name: 'Dm', degree: 2, shared: 5, picked: false, sheet: 'Dm' }, true)).toBe('Dm pent · 5 shared · varies')
    expect(pentatonicCaption({ name: 'Dm', degree: 2, shared: 5, picked: false, sheet: 'Dm' }, false)).toBe('Dm pent · 5 shared')
  })

  it('plays a pick (a written pc in the ranking) over the degree, and names the degree’s as the sheet’s (#303)', () => {
    const pcs = [...on('dorian', 'D')].sort((a, b) => a - b)
    const picked = pentatonicPick(pcs, parseRoot('D'), 7, 4) // Em, over Am on the 5
    expect(picked.pentatonic).toEqual({ name: 'Em', degree: 2, shared: 5, picked: true, sheet: 'Am' })
    expect(picked.lit).toEqual(pcs.map((pc) => [4, 7, 9, 11, 2].includes(pc)))
    expect(pentatonicPick(pcs, parseRoot('D'), 'auto', null).pentatonic).toMatchObject({ name: 'Dm', picked: false, sheet: 'Dm' })
    expect(pentatonicPick(pcs, parseRoot('D'), 'auto', 3).pentatonic).toMatchObject({ name: 'E♭m', picked: true, sheet: 'Dm' }) // every pc is in the ranking
  })
})

import { describe, expect, it } from 'vitest'
import { isPentatonicPathName, isPentatonicPreset, isPentatonicStep, PENTATONIC_PATH_LABELS, PENTATONIC_STEP, pentatonicCycle, pentatonicPathCaption, isPentatonicView, PENTATONIC_HOME, PENTATONIC_RANKS, pentatonicAt, pentatonicCaption, pentatonicLadder, pentatonicPick, pentatonicRanking, pentatonicStep } from '../pentatonics'
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

  it('gives every scale 12 distinct pentatonics, ranks 1–12, shared never rising', () => {
    for (const name of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
      const ranked = pentatonicRanking(on(name, 'C'), parseRoot('C'))
      expect(ranked.map((p) => p.rank)).toEqual(Array.from({ length: PENTATONIC_RANKS }, (_, i) => i + 1))
      expect(new Set(ranked.map((p) => pcOf(p.root))).size).toBe(12)
      ranked.slice(1).forEach((p, i) => expect(p.shared).toBeLessThanOrEqual(ranked[i]!.shared))
    }
  })

  it('spells on the chord’s side and without double accidentals', () => {
    expect(names(on('dorian', 'Eb'), 'Eb')[0]).toBe('E♭m')
    expect(names(on('ionian', 'F#'), 'F#').every((n) => !/𝄪|𝄫/.test(n))).toBe(true)
  })

  it('picks a staff’s pentatonic and lights the notes it shares', () => {
    const pcs = [...on('dorian', 'D')].sort((a, b) => a - b) // C D E F G A B as pcs
    const top = pentatonicPick(pcs, parseRoot('D'), 1)
    expect(top.pentatonic).toEqual({ name: 'Dm', rank: 1, shared: 5, best: 5 })
    expect(top.lit.filter(Boolean)).toHaveLength(5)
    const far = pentatonicPick(pcs, parseRoot('D'), 12)
    expect(far.pentatonic.shared).toBe(0)
    expect(far.lit.every((l) => !l)).toBe(true)
  })

  it('reads a non-integer rank as 1 and clamps the rest to 1-12', () => {
    const pcs = [...pitchClasses(SCALES['dorian'][0]!, pcOf(parseRoot('D')))]
    const rank = (r: number) => pentatonicPick(pcs, parseRoot('D'), r).pentatonic.rank
    expect([NaN, 2.5, 0, -3, 99].map(rank)).toEqual([1, 1, 1, 1, 12])
  })

  it('reports a best match under 5 on scales a pentatonic can’t fit', () => {
    const wt = [...on('whole tone', 'C')]
    expect(pentatonicPick(wt, parseRoot('C'), 1).pentatonic.best).toBe(3)
    expect(pentatonicPick([...on('half whole diminished', 'C')], parseRoot('C'), 1).pentatonic.best).toBeLessThan(5)
  })

  it('captions by name, adding rank and shared count where the best is under 5', () => {
    expect(pentatonicCaption({ name: 'Dm', rank: 1, shared: 5, best: 5 })).toBe('Dm pent')
    expect(pentatonicCaption({ name: 'Gm', rank: 7, shared: 3, best: 5 })).toBe('Gm pent')
    expect(pentatonicCaption({ name: 'F♯m', rank: 2, shared: 3, best: 3 })).toBe('F♯m pent · #2 · 3 shared')
  })
})

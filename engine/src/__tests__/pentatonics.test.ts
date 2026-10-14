import { describe, expect, it } from 'vitest'
import { isPentatonicPathName, isPentatonicView, PENTATONIC_HOME, PENTATONIC_RANKS, pentatonicAt, pentatonicCaption, pentatonicLadder, pentatonicPick, pentatonicPreset, pentatonicRanking, pentatonicStep, type PentatonicSection } from '../pentatonics'
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

const form = (...keys: string[]): PentatonicSection[] => keys.map((key) => ({ key, part: 'form' }))
const show = (r: Readonly<Record<string, { rung: number; side: string }>>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.rung === 0 || v.rung === 6 ? String(v.rung) : `${v.rung}${v.side === 'flat' ? '♭' : '♯'}`]))

describe('pentatonic paths', () => {
  it('steps by semitones round the circle of fifths', () => {
    expect([0, 1, 3, 6, 9, 4, 8].map((s) => show({ s: pentatonicStep(s) }).s)).toEqual(['0', '5♭', '3♭', '6', '3♯', '4♯', '4♭'])
    expect(pentatonicStep(12)).toEqual(PENTATONIC_HOME)
    expect(pentatonicStep(-3)).toEqual(pentatonicStep(9))
  })

  it('lays each preset over AABA by role (A1 · A2 merged: three sections)', () => {
    const s = form('A1', 'B', 'A3')
    expect(show(pentatonicPreset('side-slip', s))).toEqual({ A1: '0', B: '5♭', A3: '0' })
    expect(show(pentatonicPreset('fifths', s))).toEqual({ A1: '0', B: '6', A3: '0' })
    expect(show(pentatonicPreset('minor-thirds', s))).toEqual({ A1: '0', B: '3♭', A3: '0' })
    expect(show(pentatonicPreset('major-thirds', s))).toEqual({ A1: '0', B: '4♯', A3: '0' })
  })

  it('lays each preset over AABA written out (four sections)', () => {
    const s = form('A1', 'A2', 'B', 'A3')
    expect(show(pentatonicPreset('side-slip', s))).toEqual({ A1: '0', A2: '0', B: '5♭', A3: '0' })
    expect(show(pentatonicPreset('fifths', s))).toEqual({ A1: '0', A2: '3♯', B: '6', A3: '0' })
    expect(show(pentatonicPreset('minor-thirds', s))).toEqual({ A1: '0', A2: '3♭', B: '6', A3: '0' })
    expect(show(pentatonicPreset('major-thirds', s))).toEqual({ A1: '0', A2: '4♯', B: '4♭', A3: '0' })
  })

  it('spreads the fifths climb over more sections', () => {
    expect(show(pentatonicPreset('fifths', form('A', 'B', 'C', 'D', 'E')))).toEqual({ A: '0', B: '2♯', C: '4♯', D: '6', E: '0' })
  })

  it('tiny forms: one section is Home, two are inside and outside; Intro and Coda are Home', () => {
    expect(show(pentatonicPreset('fifths', form('A')))).toEqual({ A: '0' })
    expect(show(pentatonicPreset('side-slip', form('A', 'B')))).toEqual({ A: '0', B: '5♭' })
    expect(show(pentatonicPreset('minor-thirds', form('A', 'B')))).toEqual({ A: '0', B: '3♭' })
    const withIntro: PentatonicSection[] = [{ key: 'Intro', part: 'before' }, ...form('A', 'B', 'C'), { key: 'Coda', part: 'after' }]
    expect(show(pentatonicPreset('side-slip', withIntro))).toEqual({ Intro: '0', A: '0', B: '5♭', C: '0', Coda: '0' })
    expect(pentatonicPreset('side-slip', [{ key: 'Intro', part: 'before' }])).toEqual({ Intro: PENTATONIC_HOME })
    expect(pentatonicPreset('fifths', [])).toEqual({})
  })

  it('has no preset for One rung or Custom, and knows its path names', () => {
    expect(pentatonicPreset('one', form('A', 'B'))).toEqual({})
    expect(pentatonicPreset('custom', form('A', 'B'))).toEqual({})
    expect(['one', 'fifths', 'custom'].every(isPentatonicPathName)).toBe(true)
    expect([undefined, 'thirds', 3].some(isPentatonicPathName)).toBe(false)
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

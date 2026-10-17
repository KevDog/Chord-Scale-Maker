import { describe, expect, it } from 'vitest'
import { APPROACH_LABELS, APPROACHES, approachNotes, isApproach } from '../approaches'
import { type GuideInput, type GuideNote, guideVoices } from '../guideTones'
import { CONCERT, type Pitched, rangeOf } from '../part'
import { toVexKey } from '../sheet'
import { accText, LETTERS, parseRoot, type Spelled } from '../pitch'
import { SCALES, spellFrom } from '../scales'

const cIonian: readonly Spelled[] = spellFrom({ letter: 0, acc: 0 }, SCALES.ionian[0])
const note = (name: string, midi: number): Pitched => ({ ...parseRoot(name), midi })
const E4 = note('E', 64)
const names = (ns: readonly Pitched[] | null) => ns?.map((n) => LETTERS[n.letter] + accText(n.acc))

describe('approachNotes into E4 over C Ionian', () => {
  it.each([
    ['none', []],
    ['chromatic-below', ['D#']],
    ['chromatic-above', ['F']],
    ['diatonic-above', ['F']],
    ['double-below', ['D', 'D#']],
    ['double-above', ['F#', 'F']],
    ['above-below', ['F', 'D#']],
    ['enclosure', ['F', 'D#']],
    ['below-above', ['D#', 'F']],
    ['delayed', ['F', 'D', 'D#']],
  ] as const)('%s', (f, expected) => {
    expect(names(approachNotes(E4, f, cIonian))).toEqual(expected)
  })
  it('pitches', () => {
    expect(approachNotes(E4, 'delayed', cIonian)?.map((n) => n.midi)).toEqual([65, 62, 63])
    expect(approachNotes(E4, 'double-above', cIonian)?.map((n) => n.midi)).toEqual([66, 65])
    expect(approachNotes(E4, 'double-below', cIonian)?.map((n) => n.midi)).toEqual([62, 63])
  })
})

describe('spelling', () => {
  it('into B♭ chromatic below is A', () => expect(names(approachNotes(note('Bb', 70), 'chromatic-below', null))).toEqual(['A']))
  it('into C♯ chromatic above is D', () => expect(names(approachNotes(note('C#', 61), 'chromatic-above', null))).toEqual(['D']))
  it('double below B♭ goes flat', () => expect(names(approachNotes(note('Bb', 70), 'double-below', null))).toEqual(['Ab', 'A']))
})

describe('needing a scale', () => {
  it.each(['diatonic-above', 'enclosure', 'delayed'] as const)('%s with no scale is null', (f) => expect(approachNotes(E4, f, null)).toBeNull())
  it.each(['none', 'chromatic-below', 'double-above', 'above-below', 'below-above'] as const)('%s needs none', (f) => expect(approachNotes(E4, f, null)).not.toBeNull())
})

describe('ids', () => {
  it('guard and labels', () => {
    expect(isApproach('enclosure')).toBe(true)
    expect(isApproach('x')).toBe(false)
    expect(APPROACHES.every((a) => APPROACH_LABELS[a].length > 0)).toBe(true)
  })
  it('lists the figures in the spec order', () =>
    expect([...APPROACHES]).toEqual(['none', 'chromatic-below', 'chromatic-above', 'diatonic-above', 'double-below', 'double-above', 'above-below', 'enclosure', 'below-above', 'delayed']))
})

describe('double chromatic tie follows the target', () => {
  it.each([
    ['Db', 61, ['Eb', 'D']],
    ['Ab', 68, ['Bb', 'A']],
    ['Gb', 66, ['Ab', 'G']],
  ] as const)('double-above into %s', (name, midi, outer) => {
    expect(names(approachNotes(note(name, midi), 'double-above', null))).toEqual(outer)
  })
  it('sharp target goes sharp below', () => expect(names(approachNotes(note('G#', 68), 'double-below', null))).toEqual(['F#', 'G']))
  it('natural target: flat below, sharp above', () => {
    expect(names(approachNotes(note('C', 60), 'double-below', null))).toEqual(['Bb', 'B'])
    expect(names(approachNotes(note('C', 60), 'double-above', null))).toEqual(['D', 'Db'])
  })
})

describe('one semitone never needs a double accidental', () => {
  it('into E# below is E', () => expect(names(approachNotes(note('E#', 65), 'chromatic-below', null))).toEqual(['E']))
})

describe('diatonic steps', () => {
  const scaleOf = (root: string) => spellFrom(parseRoot(root), SCALES.ionian[0])
  it('whole step above C over C Ionian is D', () => {
    const r = approachNotes(note('C', 60), 'diatonic-above', cIonian)
    expect(names(r)).toEqual(['D'])
    expect(r?.map((n) => n.midi)).toEqual([62])
  })
  it('keeps the scale spelling: above D over Eb Ionian is Eb', () => expect(names(approachNotes(note('D', 62), 'diatonic-above', scaleOf('Eb')))).toEqual(['Eb']))
  it('target outside the scale: C# above is D', () => expect(names(approachNotes(note('C#', 61), 'diatonic-above', cIonian))).toEqual(['D']))
  it('wraps the octave: above B is C an octave up', () => {
    const r = approachNotes(note('B', 71), 'diatonic-above', cIonian)
    expect(names(r)).toEqual(['C'])
    expect(r?.map((n) => n.midi)).toEqual([72])
  })
  it('delayed into F: G E (the repeated E collapses)', () => {
    const r = approachNotes(note('F', 65), 'delayed', cIonian)
    expect(names(r)).toEqual(['G', 'E'])
    expect(r?.map((n) => n.midi)).toEqual([67, 64])
  })
})

describe('approaches on the guide tone line', () => {
  const chords = (names: readonly string[], len = 4): GuideInput[] => names.map((chord, i) => ({ row: i, chord, start: i * len, beats: len }))
  const text = (n: GuideNote): string => `${n.beat}:${n.pitch ? toVexKey(n.pitch) : 'rest'}/${n.beats}${n.tie ? '~' : ''}${n.tiedIn ? '^' : ''}`
  const bars = (g: ReturnType<typeof guideVoices>): string[] => [...g.bars.entries()].sort(([a], [b]) => a - b).map(([, v]) => v.map(text).join(' '))
  const voices = (names: readonly string[], approach: Parameters<typeof guideVoices>[5], len = 4, line: 'third' | 'seventh' = 'third') =>
    guideVoices(chords(names, len), CONCERT, 4, null, line, approach)

  it('none leaves the output as it is', () => {
    const plain = guideVoices(chords(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, 'third')
    expect(voices(['Dm7', 'G7', 'CMaj7'], 'none')).toEqual(plain)
  })
  it('a chromatic note under a held target breaks the tie and leaves a shortened guide tone', () => {
    // Dm7 F -> G7 F (held) -> CMaj7 E
    expect(bars(voices(['Dm7', 'G7', 'CMaj7'], 'chromatic-below'))).toEqual([
      '0:f/4/3~ 3:f/4/0.5^ 3.5:e/4/0.5',
      '0:f/4/3~ 3:f/4/0.5^ 3.5:d#/4/0.5',
      '0:e/4/4',
    ])
  })
  it('a three-note figure takes the last beat and a half, the guide tone before it shortened', () => {
    const [g7, c] = chords(['G7', 'CMaj7'])
    const g = guideVoices([{ ...g7!, scale: 'G mixolydian' }, c!], CONCERT, 4, null, 'third', 'delayed')
    expect(bars(g)[0]).toBe('0:b/4/2~ 2:b/4/0.5^ 2.5:c/5/0.5 3:a/4/0.5 3.5:a#/4/0.5')
  })
  it('the first chord has no approach: bar 1 starts as it does without', () => {
    expect(bars(voices(['Dm7', 'G7'], 'chromatic-below'))[0]!.startsWith('0:f/4/3~')).toBe(true)
  })
  it('a chord after a rest has no approach', () => {
    const g = voices(['Dm7', 'N.C.', 'CMaj7'], 'chromatic-below')
    expect(bars(g)).toEqual(bars(voices(['Dm7', 'N.C.', 'CMaj7'], 'none')))
  })
  it('a previous chord no longer than the figure gets none', () => {
    const g = guideVoices(chords(['Dm7', 'G7', 'CMaj7'], 1), CONCERT, 4, null, 'third', 'double-below')
    expect(bars(g)).toEqual(bars(guideVoices(chords(['Dm7', 'G7', 'CMaj7'], 1), CONCERT, 4, null, 'third')))
    const one = guideVoices(chords(['Dm7', 'G7', 'CMaj7'], 1), CONCERT, 4, null, 'third', 'chromatic-below')
    expect(bars(one)[0]).toContain('/0.5')
  })
  it('a diatonic figure steps in the previous chord scale text', () => {
    const [dm, g7] = chords(['Dm7', 'G7'])
    const g = guideVoices([{ ...dm!, scale: 'D dorian' }, g7!], CONCERT, 4, null, 'third', 'diatonic-above')
    expect(bars(g)[0]).toBe('0:f/4/3~ 3:f/4/0.5^ 3.5:g/4/0.5')
  })
  it('a diatonic figure with no scale plays no approach for that chord', () => {
    const g = voices(['Dm7', 'G7'], 'diatonic-above')
    expect(bars(g)).toEqual(bars(voices(['Dm7', 'G7'], 'none')))
  })
  it('keeps every figure note in the part range', () => {
    const range = rangeOf(CONCERT)
    for (const a of ['chromatic-below', 'double-above', 'delayed'] as const) {
      const g = voices(['Dm7', 'G7', 'CMaj7'], a)
      const pitched = [...g.bars.values()].flat().flatMap((n) => (n.pitch ? [n.pitch.midi] : []))
      expect(pitched.every((m) => m >= range.lo && m <= range.hi)).toBe(true)
    }
  })
})

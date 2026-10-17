import { describe, expect, it } from 'vitest'
import { APPROACH_LABELS, APPROACHES, approachNotes, isApproach } from '../approaches'
import type { Pitched } from '../part'
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
})

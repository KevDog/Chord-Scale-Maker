import { parseChord } from './chord'
import { guideToneDegrees } from './guideTones'
import { spelledInterval } from './intervals'
import type { Mode } from './part'
import { glyphs, mod, parseRoot, pcOf, rootName, type Spelled } from './pitch'
import { PENTATONIC_RANKS } from './pentatonics'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'

/**
 * Practice selection (docs/plan-practice.md): a subset of every scale's notes to improvise with. A note is picked
 * by its key, a spelled interval: from each chord's written root in From root mode ("b3", "#4"), from the written
 * start note in From X mode (so "b3" from C is E♭). Presets pick per chord, from the chord's quality.
 */

export type Preset = 'chordTones' | 'guideTones' | 'tensions' | 'all' | 'pentatonic'
/** a preset, or explicit keys; keys are relative to the mode's reference, so they survive instrument changes. Pentatonic: a rank 1–12 on each staff's ladder (#266) */
export type PracticeSelection =
  | Readonly<{ preset: Exclude<Preset, 'pentatonic'> }>
  | Readonly<{ preset: 'pentatonic'; rank: number }>
  | Readonly<{ keys: readonly string[] }>

export const isPentatonicSelection = (s: PracticeSelection | null): s is Readonly<{ preset: 'pentatonic'; rank: number }> =>
  s !== null && 'preset' in s && s.preset === 'pentatonic'

const rankFrom = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= PENTATONIC_RANKS ? (v as number) : 1)

const PRACTICE_KEY = /^(?:b{1,2}|#{1,2})?[1-7]$/

/** a practice selection read from untrusted data (storage, a share link), or null if it isn't one */
export function practiceSelectionFrom(v: unknown): PracticeSelection | null {
  if (!v || typeof v !== 'object') return null
  if ('preset' in v && v.preset === 'pentatonic') return { preset: 'pentatonic', rank: rankFrom('rank' in v ? v.rank : undefined) }
  if ('preset' in v && typeof v.preset === 'string' && Object.values(PRESETS).flat().includes(v.preset as Preset)) return { preset: v.preset as Exclude<Preset, 'pentatonic'> }
  if ('keys' in v && Array.isArray(v.keys)) {
    const keys = v.keys.filter((k): k is string => typeof k === 'string' && PRACTICE_KEY.test(k))
    return keys.length ? { keys } : null
  }
  return null
}

/** the presets each mode offers: function-based ones only make sense from the root */
export const PRESETS: Readonly<Record<Mode, readonly Preset[]>> = {
  root: ['chordTones', 'guideTones', 'tensions', 'pentatonic'],
  from: ['all', 'pentatonic'],
}
export const PRESET_LABELS: Readonly<Record<Preset, string>> = {
  chordTones: 'Chord tones',
  guideTones: 'Guide tones',
  tensions: 'Tensions',
  all: 'All',
  pentatonic: 'Pentatonic',
}

/** canonical quality -> its chord tones as spelled degrees (6 chords: the 6; sus: the 4; alt: no 5th) */
const CHORD_TONES: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  Maj7: ['1', '3', '5', '7'],
  'Maj7#11': ['1', '3', '5', '7'],
  'Maj7#5': ['1', '3', '#5', '7'],
  '6': ['1', '3', '5', '6'],
  m7: ['1', 'b3', '5', 'b7'],
  m6: ['1', 'b3', '5', '6'],
  mMaj7: ['1', 'b3', '5', '7'],
  '7': ['1', '3', '5', 'b7'],
  '7sus4': ['1', '4', '5', 'b7'],
  '7sus4b9': ['1', 'b2', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7'],
  '7b13': ['1', '3', '5', 'b7'],
  '7b9b13': ['1', '3', '5', 'b7'],
  '7#11': ['1', '3', '5', 'b7'],
  '7alt': ['1', '3', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}

/** the start text's note ("Eb", "F#3" -> F#), or null if it isn't one */
export const startReference = (startText: string): Spelled | null => orNull(() => parseRoot(startText.trim().replace(/\d+$/, '')))

/** a dim7's chord tones and major 7th by semitone, whatever the scale's letters (♭VI°7 spells its ♭3 C♯ over B♭) */
const DIM7_KEYS: Readonly<Record<number, string>> = { 0: '1', 3: 'b3', 6: 'b5', 9: 'bb7', 11: '7' }

/** each note's key against the reference; `quality`: the chord's, when the reference is its root (From root) */
export const practiceKeys = (reference: Spelled, notes: readonly Spelled[], quality?: string | null): string[] =>
  notes.map((n) => (quality === 'dim7' ? DIM7_KEYS[mod(pcOf(n) - pcOf(reference), 12)] : undefined) ?? spelledInterval(reference, n))

const rawQuality = (chord: string): string | null => orNull(() => parseChord(chord).quality)

/** which keys a preset lights on one chord (its keys are measured from that chord's root) */
function presetKeys(preset: Exclude<Preset, 'pentatonic'>, chord: string, keys: readonly string[]): ReadonlySet<string> {
  if (preset === 'all') return new Set(keys)
  const raw = rawQuality(chord)
  const quality = raw === null ? null : baseQuality(raw)
  if (preset === 'guideTones') return new Set(raw === null ? [] : (guideToneDegrees(raw) ?? []))
  const tones = new Set(quality ? (CHORD_TONES[quality] ?? []) : [])
  if (preset === 'chordTones') return tones
  return new Set(quality ? keys.filter((k) => !tones.has(k)) : []) // tensions: the scale's other notes; none if unknown
}

/** per note of one staff: is it selected? (a Pentatonic selection lights per staff, in buildSheet: here, nothing) */
export function selectedNotes(selection: PracticeSelection, chord: string, keys: readonly string[]): boolean[] {
  if (isPentatonicSelection(selection)) return keys.map(() => false)
  const lit = 'preset' in selection ? presetKeys(selection.preset, chord, keys) : new Set(selection.keys)
  return keys.map((k) => lit.has(k))
}

/** box order: by degree, then flattest first ("b3" before "3" before "#3") */
const accOf = (key: string): number => [...key].reduce((s, c) => s + (c === '#' ? 1 : c === 'b' ? -1 : 0), 0)
const degreeOf = (key: string): number => Number(key.replace(/[b#]/g, ''))
export const compareKeys = (a: string, b: string): number => degreeOf(a) - degreeOf(b) || accOf(a) - accOf(b)

export type PracticeBox = Readonly<{ key: string; label: string }>

/**
 * the boxes for a chart: every key that occurs on some staff, in order. Labels are intervals from the root (♭3), or
 * in From X mode the pitch spelled from the start note (E♭).
 */
export function practiceBoxes(staves: readonly { keys: readonly string[] | null }[], mode: Mode, startText: string): PracticeBox[] {
  const keys = [...new Set(staves.flatMap((s) => s.keys ?? []))].sort(compareKeys)
  const start = mode === 'from' ? startReference(startText) : null
  return keys.map((key) => {
    const note = start ? orNull(() => spellFrom(start, key)[0]) : null
    return { key, label: glyphs(note ? rootName(note) : key) }
  })
}

/** the keys a selection lights anywhere in the chart: where a custom selection starts from a preset */
export const litKeys = (staves: readonly { keys: readonly string[] | null; selected: readonly boolean[] | null }[]): string[] =>
  [...new Set(staves.flatMap((s) => (s.keys ?? []).filter((_, i) => s.selected?.[i])))].sort(compareKeys)

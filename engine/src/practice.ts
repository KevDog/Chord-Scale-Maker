import { parseChord } from './chord'
import { guideToneDegrees } from './guideTones'
import { spelledInterval } from './intervals'
import type { Mode } from './part'
import { HEX_GROUPINGS, HEX_PAIRS, type HexGrouping } from './hexatonics'
import { glyphs, mod, parseRoot, pcOf, rootName, type Spelled } from './pitch'
import { type PentatonicDegree, pentatonicDegreeFrom } from './pentatonics'
import { baseQuality, CHORD_TONES } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'

/**
 * Practice selection (docs/plan-practice.md): a subset of every scale's notes to improvise with. A note is picked
 * by its key, a spelled interval: from each chord's written root in From root mode ("b3", "#4"), from the written
 * start note in From X mode (so "b3" from C is E♭). Presets pick per chord, from the chord's quality.
 */

export type Preset = 'chordTones' | 'guideTones' | 'tensions' | 'all' | 'pentatonic' | 'hexatonic'
type KeyPreset = Exclude<Preset, 'pentatonic' | 'hexatonic'>
/** Pentatonic: the degree each staff's minor pentatonic is built on (#286), or Auto */
export type PentatonicSelection = Readonly<{ preset: 'pentatonic'; degree: PentatonicDegree }>
/** Hexatonic: pair 0 (Auto) or 1 … HEX_PAIRS on each staff's chain, and how its six notes divide into groups A and B */
export type HexatonicSelection = Readonly<{ preset: 'hexatonic'; pair: number; grouping: HexGrouping }>
/**
 * a preset, or explicit keys; keys are relative to the mode's reference, so they survive instrument changes.
 * Pentatonic: a degree from each chord root, or Auto (#266, #286); Hexatonic: a pair and a grouping, lit per staff
 */
export type PracticeSelection = Readonly<{ preset: KeyPreset }> | PentatonicSelection | HexatonicSelection | Readonly<{ keys: readonly string[] }>

export const isPentatonicSelection = (s: PracticeSelection | null): s is PentatonicSelection => s !== null && 'preset' in s && s.preset === 'pentatonic'
export const isHexatonicSelection = (s: PracticeSelection | null): s is HexatonicSelection => s !== null && 'preset' in s && s.preset === 'hexatonic'

const pairFrom = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= HEX_PAIRS ? (v as number) : 0)
const groupingFrom = (v: unknown): HexGrouping => (HEX_GROUPINGS as readonly unknown[]).includes(v) ? (v as HexGrouping) : 'triads'

const PRACTICE_KEY = /^(?:b{1,2}|#{1,2})?[1-7]$/

/** a practice selection read from untrusted data (storage, a share link), or null if it isn't one */
export function practiceSelectionFrom(v: unknown): PracticeSelection | null {
  if (!v || typeof v !== 'object') return null
  if ('preset' in v && v.preset === 'pentatonic') return { preset: 'pentatonic', degree: pentatonicDegreeFrom('degree' in v ? v.degree : undefined) } // the old { rank } reads as Auto
  if ('preset' in v && v.preset === 'hexatonic') return { preset: 'hexatonic', pair: pairFrom('pair' in v ? v.pair : undefined), grouping: groupingFrom('grouping' in v ? v.grouping : undefined) }
  if ('preset' in v && typeof v.preset === 'string' && Object.values(PRESETS).flat().includes(v.preset as Preset)) return { preset: v.preset as KeyPreset }
  if ('keys' in v && Array.isArray(v.keys)) {
    const keys = v.keys.filter((k): k is string => typeof k === 'string' && PRACTICE_KEY.test(k))
    return keys.length ? { keys } : null
  }
  return null
}

/** the presets each mode offers: function-based ones only make sense from the root */
export const PRESETS: Readonly<Record<Mode, readonly Preset[]>> = {
  root: ['chordTones', 'guideTones', 'tensions', 'pentatonic', 'hexatonic'],
  from: ['all', 'pentatonic', 'hexatonic'],
}
export const PRESET_LABELS: Readonly<Record<Preset, string>> = {
  chordTones: 'Chord tones',
  guideTones: 'Guide tones',
  tensions: 'Tensions',
  all: 'All',
  pentatonic: 'Pentatonic',
  hexatonic: 'Hexatonic',
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
function presetKeys(preset: KeyPreset, chord: string, keys: readonly string[]): ReadonlySet<string> {
  if (preset === 'all') return new Set(keys)
  const raw = rawQuality(chord)
  const quality = raw === null ? null : baseQuality(raw)
  if (preset === 'guideTones') return new Set(raw === null ? [] : (guideToneDegrees(raw) ?? []))
  const tones = new Set(quality ? (CHORD_TONES[quality] ?? []) : [])
  if (preset === 'chordTones') return tones
  return new Set(quality ? keys.filter((k) => !tones.has(k)) : []) // tensions: the scale's other notes; none if unknown
}

/** per note of one staff: is it selected? (a Pentatonic or Hexatonic selection lights per staff, in buildSheet: here, nothing) */
export function selectedNotes(selection: PracticeSelection, chord: string, keys: readonly string[]): boolean[] {
  if (isPentatonicSelection(selection) || isHexatonicSelection(selection)) return keys.map(() => false)
  const lit = 'preset' in selection ? presetKeys(selection.preset, chord, keys) : new Set(selection.keys)
  return keys.map((k) => lit.has(k))
}

/** box order: by degree, then flattest first ("b3" before "3" before "#3") */
const accOf = (key: string): number => [...key].reduce((s, c) => s + (c === '#' ? 1 : c === 'b' ? -1 : 0), 0)
const degreeOf = (key: string): number => Number(key.replace(/[b#]/g, ''))
export const compareKeys = (a: string, b: string): number => degreeOf(a) - degreeOf(b) || accOf(a) - accOf(b)

export type PracticeBox = Readonly<{ key: string; label: string }>

/**
 * the boxes for a chart: every key that occurs on some staff (not a pentatonic's added notes, #308), in order. Labels are intervals from the root (♭3), or
 * in From X mode the pitch spelled from the start note (E♭).
 */
export function practiceBoxes(staves: readonly { keys: readonly string[] | null; outside?: readonly boolean[] | null }[], mode: Mode, startText: string): PracticeBox[] {
  const keys = [...new Set(staves.flatMap((s) => (s.keys ?? []).filter((_, i) => !s.outside?.[i])))].sort(compareKeys)
  const start = mode === 'from' ? startReference(startText) : null
  return keys.map((key) => {
    const note = start ? orNull(() => spellFrom(start, key)[0]) : null
    return { key, label: glyphs(note ? rootName(note) : key) }
  })
}

/** the keys a selection lights anywhere in the chart: where a custom selection starts from a preset; a pentatonic's notes outside the scale (#308) aren't the scale's, so not among them */
export const litKeys = (staves: readonly { keys: readonly string[] | null; selected: readonly boolean[] | null; outside?: readonly boolean[] | null }[]): string[] =>
  [...new Set(staves.flatMap((s) => (s.keys ?? []).filter((_, i) => s.selected?.[i] && !s.outside?.[i])))].sort(compareKeys)

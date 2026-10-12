import { parseChord, writtenChordRootLenient } from './chord'
import type { GuideLine } from './guideTones'
import type { Part } from './part'
import type { Spelled } from './pitch'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'

/**
 * 7th chord arpeggios on the Changes sheet (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * each chord's four chord tones (a triad's three), arpeggiated in one of ten patterns, in quarters, eighths or
 * sixteenths by bar. Pure; no DOM.
 */

export const ARPEGGIO_PATTERNS = ['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'] as const
export type ArpeggioPattern = (typeof ARPEGGIO_PATTERNS)[number]
export const isArpeggioPattern = (x: unknown): x is ArpeggioPattern => (ARPEGGIO_PATTERNS as readonly unknown[]).includes(x)
export const ARPEGGIO_LABELS: Readonly<Record<ArpeggioPattern, string>> = {
  'up-root': 'Up · root',
  'up-1st': 'Up · 1st inv',
  'up-2nd': 'Up · 2nd inv',
  'up-3rd': 'Up · 3rd inv',
  'down-root': 'Down · root',
  'down-1st': 'Down · 1st inv',
  'down-2nd': 'Down · 2nd inv',
  'down-3rd': 'Down · 3rd inv',
  'up-down': 'Up & down',
  'voice-led': 'Voice-led',
}

/** the Changes sheet's line: none, a guide tone line, or an arpeggio pattern */
export type SheetLine = GuideLine | ArpeggioPattern
export const isSheetLine = (x: unknown): x is SheetLine => x === 'off' || x === 'third' || x === 'seventh' || isArpeggioPattern(x)

/** canonical quality -> its arpeggio's degrees: four, a triad's three; extensions dropped, altered 5ths kept */
const DEGREES: Readonly<Record<string, readonly string[]>> = {
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
  '7sus4b9': ['1', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7'],
  '7b13': ['1', '3', '5', 'b7'],
  '7b9b13': ['1', '3', '5', 'b7'],
  '7#11': ['1', '3', '5', 'b7'],
  '7alt': ['1', '3', '#5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}

/** a chord's arpeggio tones, spelled from its written root; null if the chord or its quality is unknown */
export function arpeggioTones(part: Part, chord: string, scale?: string): readonly Spelled[] | null {
  try {
    const degrees = DEGREES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    return spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' ')).map(({ letter, acc }) => ({ letter, acc }))
  } catch {
    return null
  }
}

/**
 * one arpeggio's order, as indexes into the tones: the tones rotated by the inversion, four long (a triad's first
 * tone again at the end, and its 3rd inversion is root position); down reverses it, so Down ends where Up starts
 */
export function arpeggioOrder(n: 3 | 4, inversion: number, up: boolean): readonly number[] {
  const seq = [0, 1, 2, 3].map((i) => ((inversion % n) + i) % n)
  return up ? seq : seq.reverse()
}

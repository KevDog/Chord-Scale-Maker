import { writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { type Part, writtenScale } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { resolveQuality } from './qualities'

/**
 * The Arpeggios sheet (docs/superpowers/specs/2026-10-12-arpeggios-sheet-design.md): each scale line as an arpeggio,
 * the 7th chord or, Extended, the 7th chord then the scale's other notes as tensions. Pure; no DOM.
 */

/** a leftover note's place above the chord: its interval label as a compound degree (a 2 is a 9, a 3 sits between 9 and 11, a 7 comes first) */
const COMPOUND: Readonly<Record<string, number>> = { '1': 1, '9': 9, '2': 9, '3': 10, '11': 11, '4': 11, '5': 12, '13': 13, '6': 13, '7': 7 }
const compound = (label: string): number => COMPOUND[label.replace(/[b#]/g, '')] ?? 14

/** the scale's notes that aren't chord tones, written for the part, ordered as tensions (7, then 9s, 11s, 13s; lower first) */
export function tensionsOf(part: Part, chord: string, scale: string, tones: readonly Spelled[]): readonly Spelled[] {
  const root = writtenChordRootLenient(part, chord, scale)
  const chordPcs = new Set(tones.map(pcOf))
  const rest = writtenScale(part, scale).notes.filter((n) => !chordPcs.has(pcOf(n)))
  const labels = intervalLabels(root, rest, resolveQuality(chord)?.quality ?? null)
  return rest
    .map((n, i) => ({ note: { letter: n.letter, acc: n.acc }, deg: compound(labels[i] ?? ''), semis: mod(pcOf(n) - pcOf(root), 12) }))
    .sort((a, b) => a.deg - b.deg || a.semis - b.semis)
    .map((t) => t.note)
}

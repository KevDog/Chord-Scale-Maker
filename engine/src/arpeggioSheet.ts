import { arpeggioTones, placeRun } from './arpeggios'
import { writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { type Part, type Pitched, rangeOf, writtenScale } from './part'
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

export const ARP_NOTES = ['seventh', 'extended'] as const
export type ArpNotes = (typeof ARP_NOTES)[number]
export const ARP_DIRECTIONS = ['up', 'down', 'up-down'] as const
export type ArpDirection = (typeof ARP_DIRECTIONS)[number]
export const isArpNotes = (x: unknown): x is ArpNotes => (ARP_NOTES as readonly unknown[]).includes(x)
export const isArpDirection = (x: unknown): x is ArpDirection => (ARP_DIRECTIONS as readonly unknown[]).includes(x)
export const ARP_NOTES_LABELS: Readonly<Record<ArpNotes, string>> = { seventh: '7th Chord', extended: 'Extended' }
export const ARP_DIRECTION_LABELS: Readonly<Record<ArpDirection, string>> = { up: 'Up', down: 'Down', 'up-down': 'Up & down' }

/** one line's notes, and the length of each beamed group in order */
export type ArpeggioLineNotes = Readonly<{ notes: readonly Pitched[]; groups: readonly number[] }>

/** one scale line's arpeggio: chord tones (a triad's root again on top in 7th Chord mode), Extended adds the tensions above */
export function arpeggioLine(part: Part, chord: string, scale: string | null, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }> {
  const tones = arpeggioTones(part, chord, scale ?? undefined)
  if (!tones) return { error: `No chord tones for ${chord}` }
  if (notes === 'extended' && scale === null) return { error: 'Choose a scale' }
  const chordPart = notes === 'seventh' && tones.length === 3 ? [...tones, tones[0] as Spelled] : tones
  const upper = notes === 'extended' && scale !== null ? tensionsOf(part, chord, scale, tones) : []
  const run = [...chordPart, ...upper]
  const midi = placeRun(run.map(pcOf), true, rangeOf(part))
  const asc: Pitched[] = run.map((n, i) => ({ letter: n.letter, acc: n.acc, midi: midi[i] ?? 0 }))
  const groups = upper.length ? [chordPart.length, upper.length] : [chordPart.length]
  if (dir === 'up') return { notes: asc, groups }
  const desc = [...asc].reverse()
  const descGroups = [...groups].reverse()
  if (dir === 'down') return { notes: desc, groups: descGroups }
  const turn = (descGroups[0] ?? 1) - 1
  return { notes: [...asc, ...desc.slice(1)], groups: [...groups, ...[turn, ...descGroups.slice(1)].filter((g) => g > 0)] }
}

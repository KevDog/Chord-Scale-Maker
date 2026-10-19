import type { Key } from './analysis/keys'
import { arpeggioTones, placeRun } from './arpeggios'
import { type Row, qualityScale } from './chart'
import { type ChordToken, chordTokensOrNull, writtenChordRootLenient } from './chord'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { intervalLabels } from './intervals'
import { type Part, type Pitched, type ScaleLabel, rangeOf, scaleLabel, writtenScale } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { resolveQuality } from './qualities'
import type { Resolved } from './resolve'
import type { ChordAt } from './changes'
import { type HexPair, hexatonicAuto, keyedPair, offKeyNote, type StaffHexatonic, writtenKeyPair } from './hexatonics'
import { type Cover, lineCovers, type SheetPicks, scaleLines, staffPairs } from './sheet'
import { type PairShape, triadPairFigure } from './triadPairSheet'
import { chunk, orNull } from './util'

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

export const ARP_NOTES = ['seventh', 'extended', 'pairs'] as const
export type ArpNotes = (typeof ARP_NOTES)[number]
export const ARP_DIRECTIONS = ['up', 'down', 'up-down'] as const
export type ArpDirection = (typeof ARP_DIRECTIONS)[number]
export const isArpNotes = (x: unknown): x is ArpNotes => (ARP_NOTES as readonly unknown[]).includes(x)
export const isArpDirection = (x: unknown): x is ArpDirection => (ARP_DIRECTIONS as readonly unknown[]).includes(x)
export const ARP_NOTES_LABELS: Readonly<Record<ArpNotes, string>> = { seventh: '7th Chord', extended: 'Extended', pairs: 'Triad pairs' }
export const ARP_DIRECTION_LABELS: Readonly<Record<ArpDirection, string>> = { up: 'Up', down: 'Down', 'up-down': 'Up & down' }

/**
 * a Triad pairs staff's pair (#436): the one it plays (null: none, so its 7th chord arpeggio), the chord tones it
 * covers, and what a chord pick on it needs (as StaffModel's positions, varies and source)
 */
export type ArpeggioPair = Readonly<{
  hexatonic: StaffHexatonic | null
  coverage: number | null
  positions: readonly ChordAt[]
  varies: boolean
  source: Readonly<{ chord: string; scale: string }> | null
}>

/** "F/G · covers 4", or "no triad pair"; " · varies" where the staff's chords have different picks */
export const pairCaption = (p: ArpeggioPair): string => (p.hexatonic ? `${p.hexatonic.name} · covers ${p.coverage}${offKeyNote(p.hexatonic)}${p.varies ? ' · varies' : ''}` : 'no triad pair')

/** one staff on the Arpeggios sheet: the Scales sheet's line, its arpeggio's notes and beam groups, or the error that stands in for them */
export type ArpeggioStaffModel = Readonly<{
  id: string // unique per sheet; stable while the line, its notes and the view are unchanged
  chords: readonly (readonly ChordToken[] | null)[]
  scale: ScaleLabel | null
  notes: readonly Pitched[]
  groups: readonly number[] // each beamed group's length, in order
  keySig: string | null
  showClefAndKey: boolean
  accidentals: readonly (string | null)[]
  intervals: readonly string[] | null // each note against the chord root; null if the chord can't be read
  error: string | null
  last: boolean
  pair?: ArpeggioPair // Triad pairs only
  block?: boolean // Triad pairs, Block: each beamed group is one chord
}>
export type ArpeggioSheetModel = Readonly<{ heading: string; pages: readonly (readonly ArpeggioStaffModel[])[] }>

const HEADINGS: Readonly<Record<ArpNotes, string>> = { seventh: 'Arpeggios', extended: 'Extended arpeggios', pairs: 'Triad pairs' }

/** one line's notes, and the length of each beamed group in order */
export type ArpeggioLineNotes = Readonly<{ notes: readonly Pitched[]; groups: readonly number[] }>

/** one scale line's arpeggio: 7th Chord mode, the chord tones over two octaves; Extended, the chord tones then the tensions above; an unreadable scale is an error, never a throw */
export function arpeggioLine(part: Part, chord: string, scale: string | null, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }> {
  try {
    return playLine(part, chord, scale, notes, dir)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

function playLine(part: Part, chord: string, scale: string | null, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }> {
  const tones = arpeggioTones(part, chord, scale ?? undefined)
  if (!tones) return { error: `No chord tones for ${chord}` }
  if (notes === 'extended' && scale === null) return { error: 'Choose a scale' }
  const placed = (run: readonly Spelled[]): Pitched[] => {
    const midi = placeRun(run.map(pcOf), true, rangeOf(part))
    return run.map((n, i) => ({ letter: n.letter, acc: n.acc, midi: midi[i] ?? 0 }))
  }
  if (notes === 'seventh') return twoOctaves(placed([...tones, ...tones, tones[0] as Spelled]), tones.length, dir)
  const upper = scale !== null ? tensionsOf(part, chord, scale, tones) : []
  const asc = placed([...tones, ...upper])
  const groups = upper.length ? [tones.length, upper.length] : [tones.length]
  if (dir === 'up') return { notes: asc, groups }
  const desc = [...asc].reverse()
  const descGroups = [...groups].reverse()
  if (dir === 'down') return { notes: desc, groups: descGroups }
  const turn = (descGroups[0] ?? 1) - 1
  return { notes: [...asc, ...desc.slice(1)], groups: [...groups, ...[turn, ...descGroups.slice(1)].filter((g) => g > 0)] }
}

/** 7th Chord mode (#227): the chord twice and its root on top, beamed a chord at a time with the closing root alone; Up & down shares the top */
function twoOctaves(asc: readonly Pitched[], size: number, dir: ArpDirection): ArpeggioLineNotes {
  const desc = [...asc].reverse()
  if (dir === 'up') return { notes: asc, groups: [size, size, 1] }
  if (dir === 'down') return { notes: desc, groups: [size, size, 1] }
  return { notes: [...asc, ...desc.slice(1)], groups: [size, size, size, size, 1] }
}

/**
 * a line's pair under Triad pairs: its first position's pick where that is one of its pairs (cover.pick, written),
 * else Auto, as the Changes sheet's Hexatonic overlay chooses; null where its scale has none
 */
function pairFor(part: Part, row: Row, scale: string | null, cover: Cover, keyName: string | undefined): Readonly<{ pair: HexPair; hexatonic: StaffHexatonic }> | null {
  const pairs = staffPairs(row, scale, part)
  if (scale === null || !pairs.length) return null
  const chordRoot = orNull(() => writtenChordRootLenient(part, row.chord, scale)) ?? scaleLabel(part, scale).root
  const pick = Array.isArray(cover.pick) ? cover.pick : null
  const key = keyName === undefined ? null : writtenKeyPair(keyName, part)
  const keyed = key && keyedPair(pairs, key)
  const sheet = keyed ?? hexatonicAuto(pairs, chordRoot)
  const found = pick ? pairs.find((p) => pcOf(p.lower.root) === pick[0] && pcOf(p.upper.root) === pick[1]) : undefined
  const used = found ?? sheet
  return used && { pair: used, hexatonic: { name: used.name, link: used.link, picked: !!found, sheet: sheet?.name ?? '', offKey: keyName !== undefined && !keyed } }
}

/** Triad pairs: the shape (Arpeggiated or Block) and the chord picks (#303), as the Scales sheet takes them; keys: each row's key area (rowKeys), given when the Changes sheet's pairs rank against the key (#432) */
export type PairOptions = Readonly<{ shape?: PairShape; picks?: SheetPicks; keys?: ReadonlyMap<number, string> }>

/**
 * the Arpeggios sheet: the Scales sheet's lines (scaleLines), each its arpeggio, in pages of perPage; never throws.
 * key and resolved as in buildSheet: the signature (undefined: off) and the scale each row plays. Triad pairs (#436):
 * each line's pair as triadPairFigure, or its 7th chord arpeggio where it has none.
 */
export function buildArpeggioSheet(
  rows: readonly Row[],
  part: Part,
  perPage: number,
  notes: ArpNotes,
  dir: ArpDirection,
  key?: Key | null,
  resolved?: ReadonlyMap<number, Resolved>,
  opts: PairOptions = {},
): ArpeggioSheetModel {
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  const shape = opts.shape ?? 'arpeggiated'
  const covers = notes === 'pairs' ? lineCovers(rows, lines, part, scaleOf, 'hexatonic', opts.picks) : []
  const keySig = key === undefined ? null : keySignature(key, part)
  const staves = lines.map((l, n): ArpeggioStaffModel => {
    const r = rows[l.row] as Row
    const scale = scaleOf(r, l.row)
    const showClefAndKey = key === undefined || n === 0
    const range = rangeOf(part)
    const cover = covers[n]
    const used = cover ? pairFor(part, r, scale, cover, opts.keys ? (opts.keys.get(l.row) ?? '') : undefined) : null
    const pairKey = cover ? `${used?.pair.name ?? '-'}|${shape}` : ''
    const id = [l.chords.join(' '), scale, part.clef, part.trans, `${range.lo}-${range.hi}-${range.centre}`, notes, dir, pairKey, keySig, showClefAndKey ? '' : 'bare'].join('|')
    const block = !!used && shape === 'block'
    const base = {
      id,
      chords: l.chords.map((c) => chordTokensOrNull(part, c, scale)),
      scale: orNull(() => (scale ? scaleLabel(part, scale) : null)),
      keySig,
      showClefAndKey,
      last: n === lines.length - 1,
      ...(cover && {
        pair: { hexatonic: used?.hexatonic ?? null, coverage: used?.pair.coverage ?? null, positions: cover.positions, varies: cover.varies, source: scale === null ? null : { chord: r.chord, scale } },
        block,
      }),
    }
    const played = used ? triadPairFigure(used.pair, shape, dir, range) : arpeggioLine(part, r.chord, scale, notes === 'pairs' ? 'seventh' : notes, dir)
    if ('error' in played) return { ...base, notes: [], groups: [], accidentals: [], intervals: null, error: played.error }
    return {
      ...base,
      ...played,
      accidentals: accidentalsInBar(
        played.notes.map((p) => ({ letter: p.letter, acc: p.acc, octave: octaveOf(p) })),
        keySig,
      ),
      intervals: block ? null : orNull(() => intervalLabels(writtenChordRootLenient(part, r.chord, scale), played.notes, resolveQuality(r.chord)?.quality ?? null)),
      error: null,
    }
  })
  return { heading: HEADINGS[notes], pages: chunk(staves, perPage) }
}

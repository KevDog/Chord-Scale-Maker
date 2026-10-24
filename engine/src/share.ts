import { isSheetLine, type SheetLine } from './arpeggios'
import { type Approach, isApproach } from './approaches'
import { isAnticipate, isFeel, isNotesPerBar, isRhythmId, isRhythmPath, isRhythmStart, type NotesPerBar, type Pulse, RHYTHM_PATH_OFF, type RhythmId, type RhythmStart, type RhythmStep } from './rhythm'
import { isPentatonicStep } from './pentatonics'
import { type CellId, isCellId, isSystemId } from './cells'
import { type CellOrder, isCellOrder } from './cellOrder'
import { type ArpDirection, type ArpNotes, isArpDirection, isArpNotes } from './arpeggioSheet'
import { isPairShape, type PairShape } from './triadPairSheet'
import { type ChordPicks, chordPicksFrom, hasPicks } from './chordPicks'
import { type InstrumentName, isInstrumentName } from './instruments'
import { isPentatonicLeave, type PentatonicLeave } from './pentatonicLine'
import { isPairLineShape, type PairLineShape } from './triadPairLine'
import { isScaleLevel, type ScaleLevel } from './levels'
import { LIMITS } from './limits'
import type { Mode } from './part'
import { formatPattern, isPatternNotes, parsePattern, type PatternNotes } from './patterns'
import { type PracticeSelection, practiceSelectionFrom } from './practice'

/**
 * Share links: a chart, and how it was being viewed, packed into the part of a link after the "#" (which browsers
 * never send to the server). The payload is versioned JSON, deflated (the web-standard CompressionStream, in
 * browsers and Node alike) and base64url-encoded. Decoding treats the link as untrusted: it caps every length
 * (including while inflating, so a tiny link can't expand into megabytes), validates every field, drops what it
 * doesn't know, and returns null instead of throwing.
 */
export type ShareSheet = 'scales' | 'changes' | 'arpeggios' | 'patterns' // a link from the retired Guide tones sheet drops its sheet and opens the default
/** the Changes sheet's line in a link: a guide tone line, an arpeggio pattern, or cells:<id> (#298), then ~<order> unless as written and ~free with Phrase off (#376) */
export type ShareLine = SheetLine | `cells:${CellId}` | `cells:${CellId}~${string}`
/** a cells line read (#462): its first Order but As written (none: as written) and Phrase off for ~free; not a cells line or an unknown id: undefined */
export function cellsLineOf(x: string): Readonly<{ id: CellId; order: CellOrder; phrase: boolean }> | undefined {
  if (!x.startsWith('cells:')) return undefined
  const [id, ...suffixes] = x.slice(6).split('~')
  if (!isCellId(id)) return undefined
  return { id, order: suffixes.find((s): s is CellOrder => isCellOrder(s) && s !== 'as-written') ?? 'as-written', phrase: !suffixes.includes('free') }
}
/** a cells line in its one spelling: the Order unless as written, then ~free with Phrase off for a system (the only cells Phrase aims) */
export function cellsShareLine(id: CellId, order: CellOrder, phrase: boolean): ShareLine {
  const suffix = [...(order === 'as-written' ? [] : [order]), ...(phrase || !isSystemId(id) ? [] : ['free'])].join('~')
  return suffix ? `cells:${id}~${suffix}` : `cells:${id}`
}
/** a link's rhythm path (Phase 4 spec §7): its valid lists (at least one) and its step if valid; else undefined */
export type ShareRhythmPath = Readonly<{ groups?: readonly number[]; gears?: readonly Pulse[]; step?: RhythmStep }>
function rhythmPathFrom(x: unknown): ShareRhythmPath | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined
  const o = x as Record<string, unknown>
  // a list is valid where a path holding it alone is (1–8 entries, each a group 2–7 or a pulse)
  const valid = (key: 'groups' | 'gears'): boolean => Array.isArray(o[key]) && isRhythmPath({ ...RHYTHM_PATH_OFF, [key]: o[key] })
  const lists = {
    ...(valid('groups') ? { groups: [...(o.groups as number[])] } : {}),
    ...(valid('gears') ? { gears: [...(o.gears as Pulse[])] } : {}),
  }
  if (!Object.keys(lists).length) return undefined
  return { ...lists, ...(isPentatonicStep(o.step) ? { step: { unit: o.step.unit, bars: o.step.bars } } : {}) }
}
const lineFrom = (x: unknown): ShareLine | undefined => {
  if (isSheetLine(x)) return x
  const cells = typeof x === 'string' ? cellsLineOf(x) : undefined
  return cells && cellsShareLine(cells.id, cells.order, cells.phrase)
}
export type ShareView = Readonly<{
  instrument?: InstrumentName
  mode?: Mode
  start?: string
  intervals?: boolean
  /** the Changes sheet's numerals and scale rows */
  numerals?: boolean
  scaleNames?: boolean
  /** the Changes sheet's line: a guide tone line, an arpeggio pattern or a cells line; absent: off */
  line?: ShareLine
  /** the guide tone line's Approach (#298); absent: none */
  approach?: Approach
  /** the Changes sheet's rhythm line and its target beats (rhythm spec §9); absent: off */
  rhythm?: RhythmId
  targets?: boolean
  /** with the target beats, the Line lands a chord tone on each; absent: off */
  land?: true
  /** where the rhythm starts, its timing and Restate (rhythm spec §10); absent: on the beat, on time, off */
  rhythmStart?: RhythmStart
  anticipate?: number
  restate?: true
  /** the Changes sheet's rhythm path (Phase 4 spec §7): Groups, Gears and the Step; written only with a path on */
  rhythmPath?: ShareRhythmPath
  /** the Changes sheet's Feel (Phase 4 spec §7): in 2 or in 1; absent: in 4 */
  feel?: 2 | 1
  /** the Scales sheet's Notes per bar (rhythm-scales-arpeggios spec §9); absent: Whole notes */
  notesPerBar?: Exclude<NotesPerBar, 'whole'>
  sheet?: ShareSheet
  /** the Arpeggios sheet's choices: 7th Chord, Extended or Triad pairs; Up, Down or Up & down; Triad pairs' shape (#436) */
  arpNotes?: ArpNotes
  arpDir?: ArpDirection
  arpShape?: PairShape
  /** the Patterns sheet's choices (#298): the moves in canonical text, what they run over, the direction (arpDir's values) */
  pattern?: string
  patternNotes?: PatternNotes
  patternDir?: ArpDirection
  /** the Changes sheet's Pentatonic line (#284), with an arpeggio line: its Leave out (its direction is arpDir); an old link has none */
  pentLeave?: PentatonicLeave
  /** the Triad pair line's shape (#432), with an arpeggio line; an old link has none */
  pairLine?: PairLineShape
  practice?: PracticeSelection
  level?: ScaleLevel
  seed?: number
  /** the main changes set when it is the alternate (#215); absent: standard */
  changes?: 'alternate'
  /** the alternate changes hidden from the small line (#215); absent: shown */
  altHidden?: true
  /** chord picks (#303), only when there are live ones; an old link has none */
  picks?: ChordPicks
}>
export type SharePayload = Readonly<{ chart: string; view?: ShareView }>

/** 2: section blocks (#329); a version-1 link's chart is in the retired row format and doesn't open */
const VERSION = 2
/** the longest link payload we read (characters after "#s="), and the most it may inflate to (bytes) */
export const SHARE_LIMITS = { encoded: 64_000, inflated: LIMITS.maxChars * 4 + 4_000 } as const
const START = /^[A-G](?:b|#)?$/

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** inflate, giving up (null) past `max` bytes or on corrupt data */
async function inflate(bytes: Uint8Array<ArrayBuffer>, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > max) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** the view's known, valid fields only */
export function shareViewFrom(v: unknown): ShareView | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const practice = practiceSelectionFrom(o.practice)
  const picks = chordPicksFrom(Object.hasOwn(o, 'picks') ? o.picks : undefined)
  const instrument = o.instrument === 'concert' ? 'piano' : o.instrument // #332: links made before the concert choice was retired
  const line = lineFrom(o.line)
  const rhythmPath = rhythmPathFrom(o.rhythmPath)
  const parsed = typeof o.pattern === 'string' ? parsePattern(o.pattern) : undefined
  const view: ShareView = {
    ...(typeof instrument === 'string' && isInstrumentName(instrument) ? { instrument } : {}),
    ...(o.mode === 'root' || o.mode === 'from' ? { mode: o.mode } : {}),
    ...(typeof o.start === 'string' && START.test(o.start) ? { start: o.start } : {}),
    ...(typeof o.intervals === 'boolean' ? { intervals: o.intervals } : {}),
    ...(typeof o.numerals === 'boolean' ? { numerals: o.numerals } : {}),
    ...(typeof o.scaleNames === 'boolean' ? { scaleNames: o.scaleNames } : {}),
    ...(line && line !== 'off' ? { line } : {}), // anything else: off
    ...(isApproach(o.approach) ? { approach: o.approach } : {}),
    ...(typeof o.rhythm === 'string' && isRhythmId(o.rhythm) && o.rhythm !== 'off' ? { rhythm: o.rhythm } : {}),
    ...(o.targets === true ? { targets: true } : {}),
    ...(o.land === true ? { land: true as const } : {}),
    ...(isRhythmStart(o.rhythmStart) && o.rhythmStart !== 'beat' ? { rhythmStart: o.rhythmStart } : {}),
    ...(isAnticipate(o.anticipate) && o.anticipate !== 0 ? { anticipate: o.anticipate } : {}),
    ...(o.restate === true ? { restate: true as const } : {}),
    ...(rhythmPath ? { rhythmPath } : {}),
    ...(isFeel(o.feel) && o.feel !== 4 ? { feel: o.feel } : {}),
    ...(isNotesPerBar(o.notesPerBar) && o.notesPerBar !== 'whole' ? { notesPerBar: o.notesPerBar } : {}),
    ...(o.sheet === 'scales' || o.sheet === 'changes' || o.sheet === 'arpeggios' || o.sheet === 'patterns' ? { sheet: o.sheet } : {}),
    ...(isArpNotes(o.arpNotes) ? { arpNotes: o.arpNotes } : {}),
    ...(isArpDirection(o.arpDir) ? { arpDir: o.arpDir } : {}),
    ...(isPairShape(o.arpShape) ? { arpShape: o.arpShape } : {}),
    ...(parsed && 'moves' in parsed ? { pattern: formatPattern(parsed.moves) } : {}),
    ...(isPatternNotes(o.patternNotes) ? { patternNotes: o.patternNotes } : {}),
    ...(isArpDirection(o.patternDir) ? { patternDir: o.patternDir } : {}),
    ...(isPentatonicLeave(o.pentLeave) ? { pentLeave: o.pentLeave } : {}),
    ...(isPairLineShape(o.pairLine) ? { pairLine: o.pairLine } : {}),
    ...(practice ? { practice } : {}),
    ...(isScaleLevel(o.level) ? { level: o.level } : {}),
    ...(Number.isInteger(o.seed) && (o.seed as number) >= 0 && (o.seed as number) < 2 ** 32 ? { seed: o.seed as number } : {}),
    ...(o.changes === 'alternate' ? { changes: 'alternate' as const } : {}),
    ...(o.altHidden === true ? { altHidden: true as const } : {}),
    ...(hasPicks(picks) ? { picks } : {}),
  }
  return Object.keys(view).length ? view : undefined
}

/** a link to the payload; where its picks would make it too big to open (#303), the link leaves them out */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const bytes = (view: ShareView | undefined): Uint8Array<ArrayBuffer> =>
    new TextEncoder().encode(JSON.stringify({ v: VERSION, chart: payload.chart, ...(view ? { view } : {}) }))
  const full = bytes(payload.view)
  if (full.length <= SHARE_LIMITS.inflated || !payload.view?.picks) return toBase64Url(await deflate(full))
  const { picks: _dropped, ...rest } = payload.view
  return toBase64Url(await deflate(bytes(Object.keys(rest).length ? rest : undefined)))
}

/** the payload a link carries, or null if it's damaged, too big, from a newer version, or not a chart */
export async function decodeShare(encoded: string): Promise<SharePayload | null> {
  if (!encoded || encoded.length > SHARE_LIMITS.encoded) return null
  const bytes = fromBase64Url(encoded)
  const inflated = bytes && (await inflate(bytes, SHARE_LIMITS.inflated))
  if (!inflated) return null
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (o.v !== VERSION || typeof o.chart !== 'string' || o.chart.length > LIMITS.maxChars) return null
  const view = shareViewFrom(o.view)
  return view ? { chart: o.chart, view } : { chart: o.chart }
}

import { isSheetLine, type SheetLine } from './arpeggios'
import { type Approach, isApproach } from './approaches'
import { type CellId, isCellId } from './cells'
import { type ArpDirection, type ArpNotes, isArpDirection, isArpNotes } from './arpeggioSheet'
import { isPairShape, type PairShape } from './triadPairSheet'
import { type ChordPicks, chordPicksFrom, hasPicks } from './chordPicks'
import { type InstrumentName, isInstrumentName } from './instruments'
import { isPentatonicLeave, type PentatonicLeave } from './pentatonicLine'
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
/** the Changes sheet's line in a link: a guide tone line, an arpeggio pattern, or cells:<id> (#298) */
export type ShareLine = SheetLine | `cells:${CellId}`
const lineFrom = (x: unknown): ShareLine | undefined =>
  isSheetLine(x) ? x : typeof x === 'string' && x.startsWith('cells:') && isCellId(x.slice(6)) ? (x as `cells:${CellId}`) : undefined
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
  practice?: PracticeSelection
  level?: ScaleLevel
  seed?: number
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
    ...(o.sheet === 'scales' || o.sheet === 'changes' || o.sheet === 'arpeggios' || o.sheet === 'patterns' ? { sheet: o.sheet } : {}),
    ...(isArpNotes(o.arpNotes) ? { arpNotes: o.arpNotes } : {}),
    ...(isArpDirection(o.arpDir) ? { arpDir: o.arpDir } : {}),
    ...(isPairShape(o.arpShape) ? { arpShape: o.arpShape } : {}),
    ...(parsed && 'moves' in parsed ? { pattern: formatPattern(parsed.moves) } : {}),
    ...(isPatternNotes(o.patternNotes) ? { patternNotes: o.patternNotes } : {}),
    ...(isArpDirection(o.patternDir) ? { patternDir: o.patternDir } : {}),
    ...(isPentatonicLeave(o.pentLeave) ? { pentLeave: o.pentLeave } : {}),
    ...(practice ? { practice } : {}),
    ...(isScaleLevel(o.level) ? { level: o.level } : {}),
    ...(Number.isInteger(o.seed) && (o.seed as number) >= 0 && (o.seed as number) < 2 ** 32 ? { seed: o.seed as number } : {}),
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

import { type InstrumentName, isInstrumentName } from './instruments'
import { isScaleLevel, type ScaleLevel } from './levels'
import { LIMITS } from './limits'
import type { Mode } from './part'
import { type PracticeSelection, practiceSelectionFrom } from './practice'

/**
 * Share links: a chart, and how it was being viewed, packed into the part of a link after the "#" (which browsers
 * never send to the server). The payload is versioned JSON, deflated (the web-standard CompressionStream, in
 * browsers and Node alike) and base64url-encoded. Decoding treats the link as untrusted: it caps every length
 * (including while inflating, so a tiny link can't expand into megabytes), validates every field, drops what it
 * doesn't know, and returns null instead of throwing.
 */
export type ShareSheet = 'scales' | 'guideTones'
export type ShareView = Readonly<{
  instrument?: InstrumentName
  mode?: Mode
  start?: string
  intervals?: boolean
  sheet?: ShareSheet
  practice?: PracticeSelection
  level?: ScaleLevel
  seed?: number
}>
export type SharePayload = Readonly<{ chart: string; view?: ShareView }>

const VERSION = 1
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
  const view: ShareView = {
    ...(typeof o.instrument === 'string' && isInstrumentName(o.instrument) ? { instrument: o.instrument } : {}),
    ...(o.mode === 'root' || o.mode === 'from' ? { mode: o.mode } : {}),
    ...(typeof o.start === 'string' && START.test(o.start) ? { start: o.start } : {}),
    ...(typeof o.intervals === 'boolean' ? { intervals: o.intervals } : {}),
    ...(o.sheet === 'scales' || o.sheet === 'guideTones' ? { sheet: o.sheet } : {}),
    ...(practice ? { practice } : {}),
    ...(isScaleLevel(o.level) ? { level: o.level } : {}),
    ...(Number.isInteger(o.seed) && (o.seed as number) >= 0 && (o.seed as number) < 2 ** 32 ? { seed: o.seed as number } : {}),
  }
  return Object.keys(view).length ? view : undefined
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = JSON.stringify({ v: VERSION, chart: payload.chart, ...(payload.view ? { view: payload.view } : {}) })
  return toBase64Url(await deflate(new TextEncoder().encode(json)))
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

import { keyLabel, TRANSPOSE_KEYS, TRANSPOSE_MINOR_KEYS } from '@chord-scale-maker/engine'

/**
 * the /functions page's key picker (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §3): every
 * Transpose major, then the twelve minors as their key signatures spell them (C♯ and G♯ minor, not D♭ and G♭ minor,
 * whose tables would need double flats); all of them in CATALOGUE_KEYS, the keys the engine's tests sweep
 */
export const FUNCTIONS_KEYS: readonly string[] = [...TRANSPOSE_KEYS, ...TRANSPOSE_MINOR_KEYS]

const offered = (v: unknown): v is string => typeof v === 'string' && FUNCTIONS_KEYS.includes(v)

/** the key to show: the link's ?key=, else this browser's last choice, else C major */
export const functionsKeyFrom = (query: unknown, stored: string | null): string => (offered(query) ? query : offered(stored) ? stored : 'C')

/** "Eb" -> "E♭ major", "F#m" -> "F♯ minor": the picker offers both modes, so each says which */
export const functionsKeyLabel = (key: string): string => (key.endsWith('m') ? keyLabel(key) : `${keyLabel(key)} major`)

/**
 * the address with the page's ?key=, and the history state to write with it, or null when it's already there. The
 * state's `current` is where Vue Router thinks this entry is: it rewrites the entry from it on the next navigation,
 * so it has to follow the address (a router navigation would scroll back to the #anchor instead)
 */
export function keyedLocation(href: string, state: unknown, key: string): Readonly<{ url: string; state: Record<string, unknown> }> | null {
  const url = new URL(href)
  const keys = url.searchParams.getAll('key')
  if (keys.length === 1 && keys[0] === key) return null
  url.searchParams.set('key', key)
  const base = state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {}
  return { url: url.href, state: { ...base, current: `${url.pathname}${url.search}${url.hash}` } }
}

import { keyLabel, TRANSPOSE_KEYS } from '~~/engine'

/** the /functions page's key picker: every Transpose key, major then minor (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §3) */
export const FUNCTIONS_KEYS: readonly string[] = [...TRANSPOSE_KEYS, ...TRANSPOSE_KEYS.map((k) => `${k}m`)]

const offered = (v: unknown): v is string => typeof v === 'string' && FUNCTIONS_KEYS.includes(v)

/** the key to show: the link's ?key=, else this browser's last choice, else C major */
export const functionsKeyFrom = (query: unknown, stored: string | null): string => (offered(query) ? query : offered(stored) ? stored : 'C')

/** "Eb" -> "E♭ major", "F#m" -> "F♯ minor": the picker offers both modes, so each says which */
export const functionsKeyLabel = (key: string): string => (key.endsWith('m') ? keyLabel(key) : `${keyLabel(key)} major`)

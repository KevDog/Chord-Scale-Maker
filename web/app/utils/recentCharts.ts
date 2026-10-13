import { readStored, writeStored } from './storage'

/**
 * Recently opened charts, for the home page: a library tune by slug, or one of My charts by id, newest first. Kept
 * in this browser (`csm-recent`), like the instrument; nothing is sent anywhere.
 */
export type Recent = Readonly<{ kind: 'library' | 'mine'; id: string; at: number }>

export const RECENT_KEY = 'csm-recent'
export const RECENT_MAX = 5

const same = (a: Recent, b: Recent): boolean => a.kind === b.kind && a.id === b.id

/** the list with `r` first, any earlier visit to it dropped, the oldest past RECENT_MAX dropped */
export const addRecent = (list: readonly Recent[], r: Recent): Recent[] => [r, ...list.filter((x) => !same(x, r))].slice(0, RECENT_MAX)

function recentFrom(v: unknown): Recent | null {
  if (!v || typeof v !== 'object') return null
  const { kind, id, at } = v as Record<string, unknown>
  return (kind === 'library' || kind === 'mine') && typeof id === 'string' && typeof at === 'number' ? { kind, id, at } : null
}

/** the stored list; [] when there is none or it isn't one */
export function parseRecent(raw: string | null): Recent[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v.map(recentFrom).filter((r): r is Recent => r !== null).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

/** remember that `r` was opened, in this browser */
export function rememberRecent(r: Recent): void {
  writeStored(RECENT_KEY, JSON.stringify(addRecent(parseRecent(readStored(RECENT_KEY)), r)))
}

export const loadRecent = (): Recent[] => parseRecent(readStored(RECENT_KEY))

/** when a chart was opened, by calendar day: "Today", "Yesterday", "3 days ago", then the date ("Oct 1") */
export function openedWhen(at: number, now: number): string {
  const day = (t: number): number => {
    const d = new Date(t)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  }
  const days = day(now) - day(at)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  const d = new Date(at)
  return d.toLocaleDateString([], { year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric', month: 'short', day: 'numeric' })
}

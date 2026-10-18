/**
 * This browser's localStorage, for conveniences (theme, preferences) and My charts (utils/myCharts.ts): nothing is sent
 * anywhere. Storage can be unavailable (private mode, blocked, full), so reads fall back to null and writes are
 * best-effort; every caller keeps working for the visit without it.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // unavailable or full: the setting still applies for this visit
  }
}

/** like writeStored, but says whether it stuck (false when storage is full or unavailable) */
export function tryWriteStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // unavailable: nothing was stored
  }
}

/** every key in this browser's localStorage (none when it's unavailable) */
export function storedKeys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k !== null)
  } catch {
    return []
  }
}

/** this tab's sessionStorage (a handoff between pages, read once): the same fallbacks as above */
export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // unavailable or full: the next page opens without it
  }
}

export function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // unavailable: nothing was stored
  }
}

/**
 * This browser's localStorage, for conveniences only (theme, preferences, the editor draft): nothing is sent
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

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // unavailable: nothing was stored
  }
}

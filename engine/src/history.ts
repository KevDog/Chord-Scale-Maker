/** an undo history: the states before the present (oldest first) and after it (next first) */
export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

export const HISTORY_LIMIT = 100

export const historyOf = <T>(present: T): History<T> => ({ past: [], present, future: [] })

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0

/** a new present (a no-op if it equals the present); the redo states go, and the past keeps the latest `limit` */
export function recordHistory<T>(h: History<T>, next: T, limit: number = HISTORY_LIMIT): History<T> {
  if (next === h.present) return h
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] }
}

export function undoHistory<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1)
  if (!canUndo(h) || prev === undefined) return h
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }
}

export function redoHistory<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future
  if (!canRedo(h) || next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: rest }
}

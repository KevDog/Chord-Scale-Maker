/** one step: the fields it changed, as they were before it and after it */
export interface Change<S> {
  readonly before: Partial<S>
  readonly after: Partial<S>
}

/**
 * an undo history of changes (#315), oldest first, and the undone ones, next first. A change holds only the fields it
 * touched, so undoing it leaves every other field as it is now.
 */
export interface History<S> {
  readonly done: readonly Change<S>[]
  readonly undone: readonly Change<S>[]
}

export const HISTORY_LIMIT = 100

export const NO_HISTORY: History<never> = { done: [], undone: [] }

export const canUndo = <S>(h: History<S>): boolean => h.done.length > 0
export const canRedo = <S>(h: History<S>): boolean => h.undone.length > 0

/** values compared as data: a state read back from storage equals the one it was saved from */
const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

/** the change from prev to next (a no-op if no field differs); the undone changes go, and the latest `limit` stay */
export function recordChange<S extends object>(h: History<S>, prev: S, next: S, limit: number = HISTORY_LIMIT): History<S> {
  const keys = (Object.keys(next) as (keyof S)[]).filter((k) => !same(prev[k], next[k]))
  if (!keys.length) return h
  const pick = (s: S): Partial<S> => Object.fromEntries(keys.map((k) => [k, s[k]])) as Partial<S>
  return { done: [...h.done, { before: pick(prev), after: pick(next) }].slice(-limit), undone: [] }
}

/** the history after undoing its last change, and the fields to set; null with nothing to undo */
export function undoChange<S>(h: History<S>): { history: History<S>; patch: Partial<S> } | null {
  const last = h.done.at(-1)
  if (!last) return null
  return { history: { done: h.done.slice(0, -1), undone: [last, ...h.undone] }, patch: last.before }
}

/** the history after redoing its next change, and the fields to set; null with nothing to redo */
export function redoChange<S>(h: History<S>): { history: History<S>; patch: Partial<S> } | null {
  const [next, ...rest] = h.undone
  if (!next) return null
  return { history: { done: [...h.done, next], undone: rest }, patch: next.after }
}

/**
 * the history, if it ends at `now`: its last change's after (or, with all undone, its next one's before) is what `now`
 * holds; else none (the chart or a choice moved on while it was stored, or it names a field `now` lacks)
 */
export function historyAt<S extends object>(h: History<S>, now: S): History<S> {
  const at = h.done.at(-1)?.after ?? h.undone[0]?.before
  if (!at) return h
  const fits = Object.entries(at).every(([k, v]) => k in now && same(v, now[k as keyof S]))
  return fits ? h : (NO_HISTORY as History<S>)
}

const isRecord =(v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isChange = (v: unknown): v is Change<Record<string, unknown>> => isRecord(v) && isRecord(v.before) && isRecord(v.after)

/** a stored history, if it is one (its fields are the caller's to check) */
export function historyFrom(v: unknown): History<Record<string, unknown>> | null {
  if (!isRecord(v) || !Array.isArray(v.done) || !Array.isArray(v.undone)) return null
  return v.done.every(isChange) && v.undone.every(isChange) ? { done: v.done, undone: v.undone } : null
}

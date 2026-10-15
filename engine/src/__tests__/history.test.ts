import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, type History, historyAt, historyFrom, NO_HISTORY, recordChange, redoChange, undoChange } from '../history'

type S = { text: string; picks: { a?: number }; rung: number }
const s0: S = { text: 'a', picks: {}, rung: 0 }
const none = NO_HISTORY as History<S>

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    expect([canUndo(none), canRedo(none)]).toEqual([false, false])
    expect(undoChange(none)).toBeNull()
    expect(redoChange(none)).toBeNull()
  })

  it('records only the fields that changed, each change a step', () => {
    const h = recordChange(recordChange(none, s0, { ...s0, text: 'b' }), { ...s0, text: 'b' }, { ...s0, text: 'b', rung: 2 })
    expect(h.done).toEqual([
      { before: { text: 'a' }, after: { text: 'b' } },
      { before: { rung: 0 }, after: { rung: 2 } },
    ])
  })

  it('ignores a state equal to the last, comparing values not references', () => {
    expect(recordChange(none, s0, { ...s0, picks: {} })).toBe(none)
  })

  it('undoes to the fields before the last change, and redoes to the fields after it', () => {
    const h = recordChange(recordChange(none, s0, { ...s0, text: 'b' }), { ...s0, text: 'b' }, { ...s0, text: 'b', picks: { a: 1 } })
    const u1 = undoChange(h)
    expect(u1?.patch).toEqual({ picks: {} })
    const u2 = u1 && undoChange(u1.history)
    expect(u2?.patch).toEqual({ text: 'a' })
    expect(u2 && canUndo(u2.history)).toBe(false)
    const r1 = u2 && redoChange(u2.history)
    expect(r1?.patch).toEqual({ text: 'b' })
    expect(r1 && redoChange(r1.history)?.patch).toEqual({ picks: { a: 1 } })
  })

  it('keeps several fields changed together as one step', () => {
    const h = recordChange(none, s0, { ...s0, text: 'b', picks: { a: 1 } })
    expect(undoChange(h)?.patch).toEqual({ text: 'a', picks: {} })
  })

  it('drops the redo steps when a new change is recorded', () => {
    const undone = undoChange(recordChange(none, s0, { ...s0, text: 'b' }))?.history ?? none
    const next = recordChange(undone, s0, { ...s0, rung: 1 })
    expect(canRedo(next)).toBe(false)
    expect(next.done).toEqual([{ before: { rung: 0 }, after: { rung: 1 } }])
  })

  it('keeps at most limit steps, forgetting the oldest', () => {
    let h = none
    for (let i = 1; i <= 5; i++) h = recordChange(h, { ...s0, rung: i - 1 }, { ...s0, rung: i }, 3)
    expect(h.done.map((c) => c.after.rung)).toEqual([3, 4, 5])
  })

  it('leaves the history it was given unchanged', () => {
    const h = recordChange(none, s0, { ...s0, text: 'b' })
    undoChange(h)
    recordChange(h, { ...s0, text: 'b' }, { ...s0, text: 'c' })
    expect(h.done).toHaveLength(1)
    expect(h.undone).toEqual([])
  })

  it('reads a stored history back, and anything else as null', () => {
    const h = recordChange(none, s0, { ...s0, text: 'b' })
    expect(historyFrom(JSON.parse(JSON.stringify(h)))).toEqual(h)
    expect(historyFrom(null)).toBeNull()
    expect(historyFrom({ done: [{ before: 1, after: {} }], undone: [] })).toBeNull()
    expect(historyFrom({ done: [] })).toBeNull()
  })

  it('keeps a history only while it ends at the state now (its last change done, or its next one to redo)', () => {
    const b = { ...s0, text: 'b' }
    const h = recordChange(none, s0, b)
    expect(historyAt(h, b)).toBe(h)
    expect(historyAt(h, { ...b, picks: {} })).toBe(h)
    expect(historyAt(h, s0)).toBe(none)
    const undone = undoChange(h)?.history ?? none
    expect(historyAt(undone, s0)).toBe(undone)
    expect(historyAt(undone, b)).toBe(none)
    expect(historyAt(recordChange(none, s0, b) as History<S & { gone: number }>, { ...b, gone: 1 })).not.toBe(none)
    expect(historyAt({ done: [{ before: { gone: 0 }, after: { gone: 1 } }], undone: [] } as unknown as History<S>, b)).toBe(none)
  })
})

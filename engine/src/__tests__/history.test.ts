import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, historyOf, recordHistory, redoHistory, undoHistory } from '../history'

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const h = historyOf('a')
    expect(h.present).toBe('a')
    expect([canUndo(h), canRedo(h)]).toEqual([false, false])
  })

  it('undoes and redoes recorded states in order', () => {
    const h = recordHistory(recordHistory(historyOf('a'), 'b'), 'c')
    const back = undoHistory(undoHistory(h))
    expect(back.present).toBe('a')
    expect(canUndo(back)).toBe(false)
    expect(redoHistory(back).present).toBe('b')
    expect(redoHistory(redoHistory(back)).present).toBe('c')
  })

  it('ignores a state equal to the present', () => {
    const h = recordHistory(historyOf('a'), 'b')
    expect(recordHistory(h, 'b')).toBe(h)
  })

  it('drops the redo states when a new one is recorded', () => {
    const h = recordHistory(undoHistory(recordHistory(historyOf('a'), 'b')), 'c')
    expect(h.present).toBe('c')
    expect(canRedo(h)).toBe(false)
    expect(undoHistory(h).present).toBe('a')
  })

  it('returns the same history when there is nothing to undo or redo', () => {
    const h = historyOf('a')
    expect(undoHistory(h)).toBe(h)
    expect(redoHistory(h)).toBe(h)
  })

  it('keeps at most limit past states, forgetting the oldest', () => {
    let h = historyOf(0)
    for (let i = 1; i <= 5; i++) h = recordHistory(h, i, 3)
    expect(h.past).toEqual([2, 3, 4])
  })

  it('leaves the history it was given unchanged', () => {
    const h = recordHistory(historyOf('a'), 'b')
    undoHistory(h)
    recordHistory(h, 'c')
    expect(h).toEqual({ past: ['a'], present: 'b', future: [] })
  })
})

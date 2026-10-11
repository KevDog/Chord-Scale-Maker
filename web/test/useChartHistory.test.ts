import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { setRowField } from '@chord-scale-maker/engine'
import { TEXT_DEBOUNCE_MS, useChartEditor } from '~/composables/useChartEditor'
import { useChartHistory } from '~/composables/useChartHistory'

const TEXT = 'title: T\nA | 1 | Cm7\n'

function setup(text = TEXT) {
  const scope = effectScope()
  const r = scope.run(() => {
    const e = useChartEditor(text)
    return { e, h: useChartHistory(e) }
  })
  if (!r) throw new Error('no editor')
  return r
}

const key = (k: string, mods: Partial<KeyboardEventInit> = {}) => new KeyboardEvent('keydown', { key: k, cancelable: true, ...mods })

describe('useChartHistory', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('undoes and redoes grid edits', () => {
    const { e, h } = setup()
    expect(h.canUndo.value).toBe(false)
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    expect(h.canUndo.value).toBe(true)
    h.undo()
    expect(e.text.value).toBe(TEXT)
    expect(e.doc.value.lines[1]).toMatchObject({ chord: 'Cm7' })
    expect(h.canRedo.value).toBe(true)
    h.redo()
    expect(e.doc.value.lines[1]).toMatchObject({ chord: 'Dm7' })
  })

  it('records typing once it is parsed, not every keystroke', () => {
    const { e, h } = setup()
    e.setText(`${TEXT}A`)
    e.setText(`${TEXT}A |`)
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    h.undo()
    expect(e.text.value).toBe(TEXT)
    expect(h.canUndo.value).toBe(false)
  })

  it('records text typed just before an undo, so the undo reverts it', () => {
    const { e, h } = setup()
    e.setText(`${TEXT}# x\n`)
    h.undo()
    expect(e.text.value).toBe(TEXT)
    h.redo()
    expect(e.text.value).toBe(`${TEXT}# x\n`)
  })

  it('maps ⌘Z and ⇧⌘Z (or Ctrl) to undo and redo, and stops the browser default', () => {
    const { e, h } = setup()
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    const undo = key('z', { metaKey: true })
    h.onKeydown(undo)
    expect(undo.defaultPrevented).toBe(true)
    expect(e.text.value).toBe(TEXT)
    h.onKeydown(key('Z', { ctrlKey: true, shiftKey: true }))
    expect(e.doc.value.lines[1]).toMatchObject({ chord: 'Dm7' })
    const plain = key('z')
    h.onKeydown(plain)
    expect(plain.defaultPrevented).toBe(false)
  })
})

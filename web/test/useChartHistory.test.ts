import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { setRowField } from '@chord-scale-maker/engine'
import { TEXT_DEBOUNCE_MS, useChartEditor } from '~/composables/useChartEditor'
import { useChartHistory } from '~/composables/useChartHistory'

const TEXT = 'title: T\n\nsection: A\nbars: 4\n1 | Cm7\n'

function setup(text = TEXT, key?: string) {
  const scope = effectScope()
  const r = scope.run(() => {
    const e = useChartEditor(text)
    const rung = ref(0)
    const picks = ref<Readonly<Record<string, number>>>({})
    const choices = { rung: { get: () => rung.value, set: (v: number) => (rung.value = v) }, picks: { get: () => picks.value, set: (v: Readonly<Record<string, number>>) => (picks.value = v) } }
    return { e, rung, picks, h: useChartHistory(e, choices, key) }
  })
  if (!r) throw new Error('no editor')
  return { ...r, stop: () => scope.stop() }
}

const key = (k: string, mods: Partial<KeyboardEventInit> = {}) => new KeyboardEvent('keydown', { key: k, cancelable: true, ...mods })

describe('useChartHistory', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('undoes and redoes grid edits', async () => {
    const { e, h } = setup()
    expect(h.canUndo.value).toBe(false)
    e.setDoc(setRowField(e.doc.value, 4, 'chord', 'Dm7'))
    await nextTick()
    expect(h.canUndo.value).toBe(true)
    h.undo()
    expect(e.text.value).toBe(TEXT)
    expect(e.doc.value.lines[4]).toMatchObject({ chord: 'Cm7' })
    expect(h.canRedo.value).toBe(true)
    h.redo()
    expect(e.doc.value.lines[4]).toMatchObject({ chord: 'Dm7' })
  })

  it('records typing once it is parsed, not every keystroke', async () => {
    const { e, h } = setup()
    e.setText(`${TEXT}A`)
    await nextTick()
    e.setText(`${TEXT}A |`)
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    await nextTick()
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
    e.setDoc(setRowField(e.doc.value, 4, 'chord', 'Dm7'))
    const undo = key('z', { metaKey: true })
    h.onKeydown(undo)
    expect(undo.defaultPrevented).toBe(true)
    expect(e.text.value).toBe(TEXT)
    h.onKeydown(key('Z', { ctrlKey: true, shiftKey: true }))
    expect(e.doc.value.lines[4]).toMatchObject({ chord: 'Dm7' })
    const plain = key('z')
    h.onKeydown(plain)
    expect(plain.defaultPrevented).toBe(false)
  })

  it('undoes note choices and text edits in the order they were made, each its own step', async () => {
    const { e, h, rung, picks } = setup()
    rung.value = 3
    await nextTick()
    e.setDoc(setRowField(e.doc.value, 4, 'chord', 'Dm7'))
    await nextTick()
    picks.value = { '0': 5 }
    await nextTick()
    h.undo()
    expect([picks.value, rung.value, e.doc.value.lines[4]]).toMatchObject([{}, 3, { chord: 'Dm7' }])
    h.undo()
    expect([rung.value, e.text.value]).toEqual([3, TEXT])
    h.undo()
    expect(rung.value).toBe(0)
    expect(h.canUndo.value).toBe(false)
    h.redo()
    h.redo()
    h.redo()
    expect([rung.value, picks.value, e.doc.value.lines[4]]).toMatchObject([3, { '0': 5 }, { chord: 'Dm7' }])
  })

  it('takes a text edit and the choice it moved, in the same moment, as one step', async () => {
    const { e, h, picks } = setup()
    e.setDoc(setRowField(e.doc.value, 4, 'chord', 'Dm7'))
    picks.value = { '1': 2 }
    await nextTick()
    h.undo()
    expect([e.text.value, picks.value]).toEqual([TEXT, {}])
    expect(h.canUndo.value).toBe(false)
  })

  it('says it is restoring while an undo sets its state, so dependent watchers can stand aside', async () => {
    const { h, picks } = setup()
    picks.value = { '0': 1 }
    await nextTick()
    h.undo()
    expect(h.restoring.value).toBe(true)
    await nextTick()
    expect(h.restoring.value).toBe(false)
  })

  it('reads the stored history when the chart opens as it was left', async () => {
    const first = setup(TEXT, 'autumn-leaves')
    first.e.setDoc(setRowField(first.e.doc.value, 4, 'chord', 'Dm7'))
    await nextTick()
    const text = first.e.text.value
    first.stop()
    const again = setup(text, 'autumn-leaves')
    expect(again.h.canUndo.value).toBe(true)
    again.h.undo()
    expect(again.e.text.value).toBe(TEXT)
  })

  it('drops a stored history the chart has moved on from, and stores none without a key', async () => {
    const first = setup(TEXT, 'so-what')
    first.e.setDoc(setRowField(first.e.doc.value, 4, 'chord', 'Dm7'))
    await nextTick()
    first.stop()
    expect(setup(TEXT, 'so-what').h.canUndo.value).toBe(false) // opened with other text: its library chart changed
    localStorage.clear()
    const draft = setup()
    draft.rung.value = 1
    await nextTick()
    expect(localStorage.length).toBe(0)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { setRowField } from '~~/engine'
import { TEXT_DEBOUNCE_MS, useChartEditor } from '~/composables/useChartEditor'

const TEXT = 'title: T\nA | 1 | Cm7\n@copy A B 8\n'

function editor(text = TEXT) {
  const scope = effectScope()
  const e = scope.run(() => useChartEditor(text))
  if (!e) throw new Error('no editor')
  return { e, stop: () => scope.stop() }
}

describe('useChartEditor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('parses the initial text and expands rows', () => {
    const { e } = editor()
    expect(e.meta.value.title).toBe('T')
    expect(e.rows.value.map((r) => `${r.section}${r.bar}`)).toEqual(['A1', 'B9'])
    expect(e.diagnostics.value).toEqual([])
  })

  it('re-parses text edits after a pause, without reformatting the text', () => {
    const { e } = editor()
    e.setText('A|1|Cm7\nA|2|F7')
    expect(e.text.value).toBe('A|1|Cm7\nA|2|F7')
    expect(e.rows.value).toHaveLength(2) // still the old doc
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value.map((r) => r.chord)).toEqual(['Cm7', 'F7'])
    expect(e.text.value).toBe('A|1|Cm7\nA|2|F7')
  })

  it('serializes grid edits into canonical text at once', () => {
    const { e } = editor()
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    expect(e.text.value).toBe('title: T\nA | 1 | Dm7\n@copy A B 8\n')
    expect(e.rows.value.map((r) => r.chord)).toEqual(['Dm7', 'Dm7'])
  })

  it('a grid edit cancels a pending text parse', () => {
    const { e } = editor()
    e.setText('A | 1 | X')
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value[0]?.chord).toBe('Dm7')
  })

  it('flags charts over a hard limit as fatal and keeps the text', () => {
    const { e } = editor()
    const huge = 'x'.repeat(20_001)
    e.setText(huge)
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.fatal.value).toBe(true)
    expect(e.text.value).toBe(huge)
  })

  it('stops its timer when the scope is disposed', () => {
    const { e, stop } = editor()
    e.setText('A | 1 | F7')
    stop()
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value[0]?.chord).toBe('Cm7')
  })
})

import { canRedo, canUndo, historyOf, recordHistory, redoHistory, undoHistory } from '@chord-scale-maker/engine'
import type { useChartEditor } from './useChartEditor'

type ChartEditor = ReturnType<typeof useChartEditor>

/**
 * Undo and redo over the editor's text. A state is recorded each time the doc changes: at once for a grid edit,
 * after the parse pause for typing (so a burst of keystrokes is one step).
 */
export function useChartHistory(editor: ChartEditor) {
  const history = shallowRef(historyOf(editor.text.value))
  const record = (): void => { history.value = recordHistory(history.value, editor.text.value) }
  watch(editor.doc, record, { flush: 'sync' })

  function go(step: typeof undoHistory): void {
    editor.flush()
    record() // text typed in the last moment is a state of its own
    history.value = step(history.value)
    editor.setText(history.value.present)
    editor.flush()
  }

  /** ⌘Z undoes, ⇧⌘Z redoes (Ctrl off a Mac) */
  function onKeydown(e: KeyboardEvent): void {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return
    e.preventDefault()
    go(e.shiftKey ? redoHistory : undoHistory)
  }

  return {
    undo: () => go(undoHistory),
    redo: () => go(redoHistory),
    canUndo: computed(() => canUndo(history.value)),
    canRedo: computed(() => canRedo(history.value)),
    onKeydown,
  }
}

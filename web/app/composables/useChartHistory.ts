import { canRedo, canUndo, type History, historyAt, historyFrom, NO_HISTORY, recordChange, redoChange, undoChange } from '@chord-scale-maker/engine'
import type { Ref } from 'vue'
import type { useChartEditor } from './useChartEditor'

type ChartEditor = ReturnType<typeof useChartEditor>

/** a note choice the history keeps (#315): how to read it now, and how to set it back */
export interface Choice<V> {
  get(): V
  set(v: V): void
}

export const choice = <V>(get: () => V, set: (v: V) => void): Choice<V> => ({ get, set })
/** a ref as a choice */
export const refChoice = <V>(r: Ref<V>): Choice<V> => choice(() => r.value, (v) => (r.value = v))

type State = Readonly<Record<string, unknown>>

/** the stored history, if it ends where the chart opened; none otherwise */
function load(storeKey: string | null, now: State): History<State> {
  const raw = storeKey ? readStored(storeKey) : null
  if (raw === null) return NO_HISTORY
  try {
    return historyAt(historyFrom(JSON.parse(raw)) ?? NO_HISTORY, now)
  } catch {
    return NO_HISTORY // not JSON
  }
}

/** best-effort: with storage full, the oldest half of the steps goes until it fits */
function store(storeKey: string, h: History<State>): void {
  if (!h.done.length && !h.undone.length) return removeStored(storeKey)
  for (let done = h.done; ; done = done.slice(Math.ceil(done.length / 2))) {
    if (tryWriteStored(storeKey, JSON.stringify({ done, undone: h.undone }))) return
    if (!done.length) return removeStored(storeKey)
  }
}

/**
 * Undo and redo over the chart's text and its note choices (#315): one history for both sheets, in order. A step is
 * recorded once the doc or a choice changes: at once for a sheet edit, after the parse pause for typing (so a burst of
 * keystrokes is one step); what changes in the same moment (an edit and the picks it carries) is one step. Undoing
 * sets back only what that step changed. Kept per chart in this browser under `csm-undo:<key>`; without a key, for
 * the visit.
 */
export function useChartHistory(editor: ChartEditor, choices: Readonly<Record<string, Choice<unknown>>> = {}, chartKey?: string) {
  const snapshot = (): State => ({ text: editor.text.value, ...Object.fromEntries(Object.entries(choices).map(([k, c]) => [k, c.get()])) })
  const storeKey = chartKey ? `csm-undo:${chartKey}` : null
  let last = snapshot()
  const history = shallowRef(load(storeKey, last))
  /** true while an undo or redo sets its state, until the watchers it set off have run */
  const restoring = ref(false)

  const record = (): void => {
    const now = snapshot()
    history.value = recordChange(history.value, last, now)
    last = now
  }
  watch(() => [editor.doc.value, ...Object.values(choices).map((c) => c.get())], record, { flush: 'post' })
  if (storeKey) watch(history, (h) => store(storeKey, h))

  function apply(patch: Partial<State>): void {
    restoring.value = true
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'text') editor.setText(v as string)
      else choices[k]?.set(v)
    }
    editor.flush()
    last = snapshot()
    void nextTick(() => (restoring.value = false))
  }

  function go(step: typeof undoChange): void {
    editor.flush()
    record() // what changed in the last moment is a step of its own
    const r = step(history.value)
    if (!r) return
    history.value = r.history
    apply(r.patch)
  }

  /** ⌘Z undoes, ⇧⌘Z redoes (Ctrl off a Mac) */
  function onKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return
    e.preventDefault()
    go(e.shiftKey ? redoChange : undoChange)
  }

  return {
    undo: () => go(undoChange),
    redo: () => go(redoChange),
    canUndo: computed(() => canUndo(history.value)),
    canRedo: computed(() => canRedo(history.value)),
    restoring: readonly(restoring),
    onKeydown,
  }
}

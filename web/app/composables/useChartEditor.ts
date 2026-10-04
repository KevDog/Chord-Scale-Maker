import {
  type ChartDoc,
  type Diagnostic,
  type Parsed,
  chartMeta,
  expandRows,
  isFatal,
  parseChart,
  serializeChart,
} from '~~/engine'

export const TEXT_DEBOUNCE_MS = 150

/** over the character limit: the parser returned an empty doc, so the grid shows nothing real */
const tooLongToLoad = (p: Parsed<ChartDoc>): boolean => isFatal(p.diagnostics) && p.value.lines.length === 0

/**
 * Single source of truth for the editor: chart text and the parsed ChartDoc kept in sync.
 * Text edits re-parse after a short pause (the text is not reformatted while typing);
 * grid edits produce a new doc, which is serialized into canonical text at once.
 * The text always wins: a grid edit is dropped if it was made from a doc older than the
 * typed text, or if the text is too long to load (its doc is empty).
 */
export function useChartEditor(initialText: string) {
  const text = ref(initialText)
  const parsed = shallowRef<Parsed<ChartDoc>>(parseChart(initialText))
  let timer: ReturnType<typeof setTimeout> | undefined

  /** parse the typed text now if a parse is pending; true if one was */
  function flush(): boolean {
    if (timer === undefined) return false
    clearTimeout(timer)
    timer = undefined
    parsed.value = parseChart(text.value)
    return true
  }

  function setText(next: string): void {
    text.value = next
    clearTimeout(timer)
    timer = setTimeout(flush, TEXT_DEBOUNCE_MS)
  }

  function setDoc(next: ChartDoc): void {
    if (flush()) return // the edit was made from a doc older than the typed text
    if (tooLongToLoad(parsed.value)) return
    text.value = serializeChart(next)
    parsed.value = parseChart(text.value) // re-parse so diagnostics describe the new text
  }

  onScopeDispose(() => clearTimeout(timer))

  const doc = computed(() => parsed.value.value)
  const expanded = computed(() => expandRows(doc.value))
  const diagnostics = computed<readonly Diagnostic[]>(() => [...parsed.value.diagnostics, ...expanded.value.diagnostics])

  return {
    text: readonly(text),
    doc,
    rows: computed(() => expanded.value.value),
    meta: computed(() => chartMeta(doc.value)),
    diagnostics,
    /** over a hard input limit: don't render, and don't let the grid write back over the text */
    fatal: computed(() => isFatal(diagnostics.value)),
    setText,
    setDoc,
    flush,
  }
}

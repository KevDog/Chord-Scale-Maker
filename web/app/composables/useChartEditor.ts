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
import { computed, onScopeDispose, readonly, ref, shallowRef } from 'vue'

export const TEXT_DEBOUNCE_MS = 150

/**
 * Single source of truth for the editor: chart text and the parsed ChartDoc kept in sync.
 * Text edits re-parse after a short pause (the text is not reformatted while typing);
 * grid edits produce a new doc, which is serialized into canonical text at once.
 */
export function useChartEditor(initialText: string) {
  const text = ref(initialText)
  const parsed = shallowRef<Parsed<ChartDoc>>(parseChart(initialText))
  let timer: ReturnType<typeof setTimeout> | undefined

  function setText(next: string): void {
    text.value = next
    clearTimeout(timer)
    timer = setTimeout(() => {
      parsed.value = parseChart(next)
    }, TEXT_DEBOUNCE_MS)
  }

  function setDoc(next: ChartDoc): void {
    clearTimeout(timer)
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
  }
}

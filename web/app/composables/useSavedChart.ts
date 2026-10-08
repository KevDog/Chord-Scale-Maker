import type { Ref } from 'vue'
import { sameChart } from '~~/engine'
import type { SavedKind } from '~/utils/myCharts'

/**
 * Where the editor's chart saves to (My charts, utils/myCharts.ts):
 * - library: a library chart; edits become your version of it (one per slug), and editing it back to the library
 *   text removes that version
 * - mine: one of your saved charts, by id
 * - new: a chart not saved yet; its first edit saves it under `id`
 */
export type SaveTarget =
  | Readonly<{ kind: 'library'; slug: string; libraryText: string; id?: string }>
  | Readonly<{ kind: 'mine'; id: string }>
  | Readonly<{ kind: 'new'; id: string; savedKind: SavedKind; basedOn?: string }>

export type SaveStatus =
  | Readonly<{ state: 'clean' }> // nothing of yours: an untouched library chart, or a new chart not edited yet
  | Readonly<{ state: 'pending' }>
  | Readonly<{ state: 'saved'; at: number }>
  | Readonly<{ state: 'failed'; reason: 'full' | 'tooLong' }>

export const SAVE_DEBOUNCE_MS = 800

/**
 * saves the editor's text a moment after typing stops, and at once when the page is hidden or the editor closes.
 * `created` fires with the id when a new chart is first saved (the page then switches its address to ?mine=<id>).
 */
export function useSavedChart(text: Readonly<Ref<string>>, target: SaveTarget, created?: (id: string) => void) {
  let id = target.kind === 'new' ? undefined : target.id
  const status = ref<SaveStatus>(id ? { state: 'saved', at: loadChart(id)?.meta.updatedAt ?? Date.now() } : { state: 'clean' })
  /** for a library chart: whether you have your own version of it */
  const edited = ref(target.kind === 'library' && id !== undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false

  function save(): void {
    clearTimeout(timer)
    timer = undefined
    if (!dirty) return
    dirty = false
    const now = text.value
    if (target.kind === 'library' && sameChart(now, target.libraryText)) {
      if (id) deleteChart(id) // edited back to the library version: nothing of yours to keep
      id = undefined
      edited.value = false
      status.value = { state: 'clean' }
      return
    }
    const input =
      target.kind === 'library'
        ? { id: id ?? newChartId(), text: now, kind: 'edited' as const, basedOn: target.slug }
        : target.kind === 'new'
          ? { id: target.id, text: now, kind: target.savedKind, ...(target.basedOn ? { basedOn: target.basedOn } : {}) }
          : { id: target.id, text: now, kind: 'new' as const } // an existing chart keeps its own kind and origin
    const result = saveChart(input)
    if (!result.ok) {
      dirty = true // try again on the next edit or when the page is hidden
      status.value = { state: 'failed', reason: result.reason }
      return
    }
    const first = id === undefined
    id = result.meta.id
    edited.value = target.kind === 'library'
    status.value = { state: 'saved', at: result.meta.updatedAt }
    if (first && target.kind === 'new') created?.(id)
  }

  watch(text, () => {
    dirty = true
    status.value = { state: 'pending' }
    clearTimeout(timer)
    timer = setTimeout(save, SAVE_DEBOUNCE_MS)
  })

  const onHide = (): void => save()
  onMounted(() => window.addEventListener('pagehide', onHide))
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onHide)
    save()
  })

  return {
    status: readonly(status),
    edited: readonly(edited),
    /** save now (before Save as a copy, Download, Share) */
    flush: save,
    /** the saved chart's id, once there is one */
    id: (): string | undefined => id,
    /** your version of a library chart is gone: forget it without saving again */
    forget(): void {
      clearTimeout(timer)
      dirty = false
      id = undefined
      edited.value = false
      status.value = { state: 'clean' }
    },
  }
}

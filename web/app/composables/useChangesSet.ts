import { isChangesSet, type ChangesSet } from '@chord-scale-maker/engine'

/** a stored { main, shown }, if it is one */
function parse(raw: string | null): { main: ChangesSet; shown: boolean } | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (v && typeof v === 'object') {
      return {
        main: 'main' in v && isChangesSet(v.main) ? v.main : 'standard',
        shown: 'shown' in v && typeof v.shown === 'boolean' ? v.shown : true,
      }
    }
  } catch {
    // not JSON
  }
  return null
}

/**
 * which changes set a chart with alternates plays (#215) and whether the other set shows as the small line, remembered
 * per chart in this browser under `key` (a library slug or mine:<id>); without a key, or from a share link's `initial`,
 * it lasts for the visit. A view preference, never written into the chart.
 */
export function useChangesSet(key?: string, initial?: Readonly<{ changes?: ChangesSet; altHidden?: boolean }>) {
  const storeKey = key ? `csm-changes:${key}` : null
  const saved = storeKey && !initial ? parse(readStored(storeKey)) : null
  const main = ref<ChangesSet>(initial?.changes ?? saved?.main ?? 'standard')
  const shown = ref<boolean>(initial ? !initial.altHidden : (saved?.shown ?? true))
  const state = (): string => JSON.stringify({ main: main.value, shown: shown.value })
  const isDefault = (): boolean => main.value === 'standard' && shown.value
  watch([main, shown], () => {
    if (!storeKey) return
    if (isDefault()) removeStored(storeKey)
    else writeStored(storeKey, state())
  })
  return {
    main,
    shown,
    /** the same view for another chart (a copy, or a shared chart once saved) */
    carryTo(otherKey: string): void {
      if (!isDefault()) writeStored(`csm-changes:${otherKey}`, state())
    },
  }
}

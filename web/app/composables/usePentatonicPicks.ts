import type { Ref } from 'vue'
import type { ChordAt } from '@chord-scale-maker/engine'

type Picks = Readonly<Record<ChordAt, number>>

function parse(raw: string | null): Picks {
  if (raw === null) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => Number.isInteger(e[1]) && e[1] >= 0 && e[1] < 12))
  } catch {
    return {}
  }
}

/**
 * the pentatonics picked in labels' popovers (#272), per chart in this browser under `csm-pent-picks:<key>`: each
 * drawn chord's picked pentatonic root, concert. Without a key they last for the visit. Never in the chart or a share link.
 */
export function usePentatonicPicks(key: string | undefined) {
  const storeKey = key ? `csm-pent-picks:${key}` : null
  const picks: Ref<Picks> = ref(storeKey ? parse(readStored(storeKey)) : {})
  watch(picks, (p) => {
    if (!storeKey) return
    if (Object.keys(p).length) writeStored(storeKey, JSON.stringify(p))
    else removeStored(storeKey)
  })
  const without = (run: readonly ChordAt[]): Picks => Object.fromEntries(Object.entries(picks.value).filter(([k]) => !run.includes(k)))
  return {
    picks: readonly(picks),
    pick(run: readonly ChordAt[], pc: number): void {
      picks.value = { ...without(run), ...Object.fromEntries(run.map((k) => [k, pc])) }
    },
    reset(run: readonly ChordAt[]): void {
      picks.value = without(run)
    },
    clear(): void {
      if (Object.keys(picks.value).length) picks.value = {}
    },
    carryTo(otherKey: string): void {
      if (Object.keys(picks.value).length) writeStored(`csm-pent-picks:${otherKey}`, JSON.stringify(picks.value))
    },
  }
}

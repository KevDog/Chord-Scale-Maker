import { isScaleLevel, type ScaleLevel } from '~~/engine'

const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1

/** a stored { level, seed }, if it is one */
function parse(raw: string | null): { level: ScaleLevel; seed: number; owned?: string[] } | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (v && typeof v === 'object' && 'level' in v && isScaleLevel(v.level)) {
      const owned = 'owned' in v && Array.isArray(v.owned) ? v.owned.filter((k): k is string => typeof k === 'string' && k.length < 80) : undefined
      return { level: v.level, seed: 'seed' in v && Number.isInteger(v.seed) ? (v.seed as number) >>> 0 : newSeed(), ...(owned ? { owned } : {}) }
    }
  } catch {
    // not JSON
  }
  return null
}

/**
 * the level the chart's scales were written at (engine/levels.ts) and its Random seed, remembered per chart in this
 * browser under `key` (a library slug or mine:<id>), so the next change knows which rows to move; without a key, or
 * from a share link's `initial`, it lasts for the visit
 */
export function useScaleLevel(key?: string, initial?: Readonly<{ level?: ScaleLevel; seed?: number }>) {
  const storeKey = key ? `csm-level:${key}` : null
  const saved = storeKey && !initial ? parse(readStored(storeKey)) : null
  const level = ref<ScaleLevel>(initial?.level ?? saved?.level ?? 'standard')
  const seed = ref<number>(initial?.seed ?? saved?.seed ?? newSeed())
  /** the rows the level owns (engine/levels.ts); unknown for a share link, which then matches by scale */
  const owned = ref<readonly string[] | undefined>(saved?.owned)
  const state = (): string => JSON.stringify({ level: level.value, seed: seed.value, ...(owned.value ? { owned: owned.value } : {}) })
  watch([level, seed, owned], () => {
    if (!storeKey) return
    if (level.value === 'standard') removeStored(storeKey)
    else writeStored(storeKey, state())
  })
  return {
    level,
    seed: readonly(seed),
    owned,
    /** a new Random pick for every row */
    shuffle(): void {
      seed.value = newSeed()
    },
    /** the same level for another chart (a copy, or a shared chart once saved): its scales were written at it */
    carryTo(otherKey: string): void {
      if (level.value !== 'standard') writeStored(`csm-level:${otherKey}`, state())
    },
    /** back to Standard without moving any scales (the chart was reverted to the library's) */
    reset(): void {
      level.value = 'standard'
      owned.value = undefined
      if (storeKey) removeStored(storeKey)
    },
  }
}

import { isScaleLevel, type ScaleLevel } from '~~/engine'

const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1

/** a stored { level, seed }, if it is one */
function parse(raw: string | null): { level: ScaleLevel; seed: number } | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (v && typeof v === 'object' && 'level' in v && isScaleLevel(v.level))
      return { level: v.level, seed: 'seed' in v && Number.isInteger(v.seed) ? (v.seed as number) >>> 0 : newSeed() }
  } catch {
    // not JSON
  }
  return null
}

/**
 * the chart's scale Level (engine/levels.ts) and its Random seed, remembered per chart in this browser under `key`
 * (a library slug or mine:<id>); without a key, or from a share link's `initial`, it lasts for the visit
 */
export function useScaleLevel(key?: string, initial?: Readonly<{ level?: ScaleLevel; seed?: number }>) {
  const storeKey = key ? `csm-level:${key}` : null
  const saved = storeKey && !initial ? parse(readStored(storeKey)) : null
  const level = ref<ScaleLevel>(initial?.level ?? saved?.level ?? 'standard')
  const seed = ref<number>(initial?.seed ?? saved?.seed ?? newSeed())
  watch([level, seed], ([l, s]) => {
    if (!storeKey) return
    if (l === 'standard') removeStored(storeKey)
    else writeStored(storeKey, JSON.stringify({ level: l, seed: s }))
  })
  return {
    level,
    seed: readonly(seed),
    /** a new Random pick for every row */
    shuffle(): void {
      seed.value = newSeed()
    },
  }
}

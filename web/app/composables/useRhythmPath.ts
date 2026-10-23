import type { Ref } from 'vue'
import { isRhythmPath, type Pulse, RHYTHM_PATH_OFF, type RhythmPath, type RhythmStep } from '@chord-scale-maker/engine'

/** a stored path, if it is one; anything else is off */
function parse(raw: string | null): RhythmPath {
  if (raw === null) return RHYTHM_PATH_OFF
  try {
    const v: unknown = JSON.parse(raw)
    return isRhythmPath(v) ? v : RHYTHM_PATH_OFF
  } catch {
    return RHYTHM_PATH_OFF
  }
}

const isOff = (p: RhythmPath): boolean => p.groups === null && p.gears === null

/**
 * the chart's rhythm path (Phase 4 spec §3, §7): Groups, Gears and their Step, per chart in this browser under
 * `csm-rhythm-path:<key>` (a library slug or mine:<id>, as usePentatonicPath keys it); without a key it lasts for the
 * visit, from a share link's path (initial). A path with both lists One is removed. With the rhythmGears flag off it
 * reads off and the stored path stays (D8).
 */
export function useRhythmPath(key: string | undefined, initial?: RhythmPath) {
  const flag = useFeature('rhythmGears')
  const storeKey = key ? `csm-rhythm-path:${key}` : null
  const path: Ref<RhythmPath> = ref(!flag ? RHYTHM_PATH_OFF : storeKey ? parse(readStored(storeKey)) : (initial ?? RHYTHM_PATH_OFF))
  watch(path, (p) => {
    if (!storeKey || !flag) return
    if (isOff(p)) removeStored(storeKey)
    else writeStored(storeKey, JSON.stringify(p))
  })
  return {
    path: computed(() => path.value),
    setGroups(groups: readonly number[] | null): void {
      path.value = { ...path.value, groups: groups && [...groups] }
    },
    setGears(gears: readonly Pulse[] | null): void {
      path.value = { ...path.value, gears: gears && [...gears] }
    },
    setStep(step: RhythmStep): void {
      path.value = { ...path.value, step }
    },
    /** both lists One at the default step: this chart's stored path goes (the hidden-settings notice's Reset) */
    reset(): void {
      path.value = RHYTHM_PATH_OFF
    },
    /** the same path for another chart (a copy, or a shared chart once saved) */
    carryTo(otherKey: string): void {
      if (flag && !isOff(path.value)) writeStored(`csm-rhythm-path:${otherKey}`, JSON.stringify(path.value))
    },
  }
}

import type { Ref } from 'vue'
import {
  carryChordPicks,
  type ChordAt,
  type ChordPicks,
  chordPicksFrom,
  type DrawnChord,
  hasPicks,
  livePicks,
  NO_PICKS,
  type PickKind,
  type PickValue,
  withoutPicks,
  withPick,
} from '@chord-scale-maker/engine'

const parse = (raw: string | null): ChordPicks => {
  if (raw === null) return NO_PICKS
  try {
    return chordPicksFrom(JSON.parse(raw))
  } catch {
    return NO_PICKS
  }
}

/**
 * chord picks (#272, #303): each drawn chord's own pentatonic or triad pair, per chart in this browser under
 * `csm-pent-picks:<key>` (the #272 name, kept: its old bare-number maps still read). Without a key (a shared chart) they last
 * for the visit. targets: what each drawn position plays now, so a pick knows what it was made for.
 */
export function useChordPicks(chartKey: string | undefined, targets: Readonly<Ref<ReadonlyMap<ChordAt, string>>>, seed?: ChordPicks) {
  const storeKey = chartKey ? `csm-pent-picks:${chartKey}` : null
  const picks: Ref<ChordPicks> = ref(seed ?? (storeKey ? parse(readStored(storeKey)) : NO_PICKS))
  watch(picks, (p) => {
    if (!storeKey) return
    if (hasPicks(p)) writeStored(storeKey, JSON.stringify(p))
    else removeStored(storeKey)
  })
  return {
    picks: readonly(picks),
    /** the picks in force: drawn positions still playing what they were picked for */
    live: computed(() => livePicks(picks.value, targets.value)),
    pick<K extends PickKind>(kind: K, positions: readonly ChordAt[], value: PickValue[K]): void {
      picks.value = withPick(picks.value, kind, positions, value, targets.value)
    },
    clear(kind: PickKind, positions: readonly ChordAt[]): void {
      picks.value = withoutPicks(picks.value, kind, positions, targets.value)
    },
    clearAll(): void {
      if (hasPicks(picks.value)) picks.value = NO_PICKS
    },
    /** after an edit: each pick follows its chord to its new place, or goes with it (#275) */
    carry(before: readonly DrawnChord[], after: readonly DrawnChord[]): void {
      if (hasPicks(picks.value)) picks.value = carryChordPicks(before, after, picks.value)
    },
    carryTo(otherKey: string): void {
      if (hasPicks(picks.value)) writeStored(`csm-pent-picks:${otherKey}`, JSON.stringify(picks.value))
    },
  }
}

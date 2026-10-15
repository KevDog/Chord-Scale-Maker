import type { ComputedRef, Ref } from 'vue'
import { type ChangesSection, isPentatonicPathName, isPentatonicStep, isPentatonicView, PENTATONIC_HOME, PENTATONIC_STEP, type PentatonicPathName, type PentatonicPlan, type PentatonicStep, type PentatonicView } from '@chord-scale-maker/engine'

type Stored = Readonly<{ path: PentatonicPathName; step: PentatonicStep; sections: Readonly<Record<string, PentatonicView>> }>
const ONE: Stored = { path: 'one', step: PENTATONIC_STEP, sections: {} }

/** a stored path, if it is one; its invalid section views dropped, a missing or invalid step read as Section */
function parse(raw: string | null): Stored {
  if (raw === null) return ONE
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || !('path' in v) || !isPentatonicPathName(v.path)) return ONE
    const step = 'step' in v && isPentatonicStep(v.step) ? v.step : PENTATONIC_STEP
    const given = 'sections' in v && v.sections && typeof v.sections === 'object' ? Object.entries(v.sections as Record<string, unknown>) : []
    return { path: v.path, step, sections: Object.fromEntries(given.filter((e): e is [string, PentatonicView] => isPentatonicView(e[1]))) }
  } catch {
    return ONE
  }
}

/**
 * the chart's pentatonic path (#264, #276), per chart in this browser under `csm-pent-path:<key>` (a library slug or
 * mine:<id>); without a key it lasts for the visit. One rung plays `fallback` (the sheet's Rung and Side) everywhere;
 * a preset goes to the engine with its step, which lays it over the form; a stored Custom path (from before #272)
 * still plays its sections. Never in the chart or a share link.
 */
export function usePentatonicPath(key: string | undefined, sections: Ref<readonly ChangesSection[]>, fallback: Ref<PentatonicView>) {
  const storeKey = key ? `csm-pent-path:${key}` : null
  const state = ref<Stored>(storeKey ? parse(readStored(storeKey)) : ONE)
  watch(state, (s) => {
    if (!storeKey) return
    if (s.path === 'one') removeStored(storeKey)
    else writeStored(storeKey, JSON.stringify(s))
  })
  const plan: ComputedRef<PentatonicPlan> = computed(() => {
    const s = state.value
    if (s.path === 'one') return { kind: 'pentatonic', bySection: {}, fallback: fallback.value, counts: false }
    if (s.path !== 'custom') return { kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: true, path: s.path, step: s.step }
    const known = new Set(sections.value.map((x) => x.key))
    return { kind: 'pentatonic', bySection: Object.fromEntries(Object.entries(s.sections).filter(([k]) => known.has(k))), fallback: PENTATONIC_HOME, counts: true }
  })
  return {
    path: computed(() => state.value.path),
    step: computed(() => state.value.step),
    plan,
    /** the step stays with the chart whatever the path; Custom keeps its own sections, and starts empty from anything else */
    setPath(name: PentatonicPathName): void {
      state.value = { path: name, step: state.value.step, sections: name === 'custom' && state.value.path === 'custom' ? state.value.sections : {} }
    },
    setStep(step: PentatonicStep): void {
      state.value = { ...state.value, step }
    },
    /** the same path for another chart (a copy, or a shared chart once saved) */
    carryTo(otherKey: string): void {
      if (state.value.path !== 'one') writeStored(`csm-pent-path:${otherKey}`, JSON.stringify(state.value))
    },
  }
}

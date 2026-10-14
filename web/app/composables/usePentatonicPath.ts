import type { ComputedRef, Ref } from 'vue'
import { type ChangesSection, isPentatonicPathName, isPentatonicView, PENTATONIC_HOME, pentatonicPreset, type PentatonicPathName, type PentatonicPlan, type PentatonicView } from '@chord-scale-maker/engine'

type Stored = Readonly<{ path: PentatonicPathName; sections: Readonly<Record<string, PentatonicView>> }>
const ONE: Stored = { path: 'one', sections: {} }

/** a stored path, if it is one; its invalid section views dropped */
function parse(raw: string | null): Stored {
  if (raw === null) return ONE
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || !('path' in v) || !isPentatonicPathName(v.path)) return ONE
    const given = 'sections' in v && v.sections && typeof v.sections === 'object' ? Object.entries(v.sections as Record<string, unknown>) : []
    return { path: v.path, sections: Object.fromEntries(given.filter((e): e is [string, PentatonicView] => isPentatonicView(e[1]))) }
  } catch {
    return ONE
  }
}

/**
 * the chart's pentatonic path (#264), per chart in this browser under `csm-pent-path:<key>` (a library slug or
 * mine:<id>); without a key it lasts for the visit. One rung plays `fallback` (the sheet's Rung and Side) everywhere;
 * a preset fills every section; an edit to one section makes the path Custom. Never in the chart or a share link.
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
    if (s.path === 'one') return { bySection: {}, fallback: fallback.value, counts: false }
    const known = new Set(sections.value.map((x) => x.key))
    const own = Object.fromEntries(Object.entries(s.sections).filter(([k]) => known.has(k)))
    return { bySection: { ...pentatonicPreset(s.path, sections.value), ...own }, fallback: PENTATONIC_HOME, counts: true }
  })
  return {
    path: computed(() => state.value.path),
    plan,
    /** a preset fills every section; One rung forgets them */
    setPath(name: PentatonicPathName): void {
      state.value = name === 'one' || name === 'custom' ? { path: name, sections: name === 'custom' ? state.value.sections : {} } : { path: name, sections: pentatonicPreset(name, sections.value) }
    },
    /** one section's rung and side: the path becomes Custom, every other section keeping what it played */
    setSection(section: string, view: PentatonicView): void {
      const p = plan.value
      const seeded = Object.fromEntries(sections.value.map((x) => [x.key, p.bySection[x.key] ?? p.fallback]))
      state.value = { path: 'custom', sections: { ...seeded, [section]: view } }
    },
  }
}

import { type Mode, type PracticeSelection, PRESETS } from '~~/engine'

const KEY = /^(?:b{1,2}|#{1,2})?[1-7]$/
const ALL_PRESETS = new Set<string>(Object.values(PRESETS).flat())

/** a stored selection, if it is one (anything else in storage is ignored) */
function parse(raw: string | null): PracticeSelection | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (v && typeof v === 'object' && 'preset' in v && typeof v.preset === 'string' && ALL_PRESETS.has(v.preset))
      return { preset: v.preset as PracticeSelection extends { preset: infer P } ? P : never }
    if (v && typeof v === 'object' && 'keys' in v && Array.isArray(v.keys)) {
      const keys = v.keys.filter((k): k is string => typeof k === 'string' && KEY.test(k))
      return keys.length ? { keys } : null
    }
  } catch {
    // not JSON
  }
  return null
}

/**
 * the practice selection, one per mode (From root picks intervals, From X pitches), remembered per library chart in
 * this browser. Without a chart (a draft) it lasts for the visit.
 */
export function usePractice(slug?: string) {
  const key = (mode: Mode): string => `csm-practice:${slug}:${mode}`
  const load = (mode: Mode): PracticeSelection | null => (slug ? parse(readStored(key(mode))) : null)
  const selections = reactive<Record<Mode, PracticeSelection | null>>({ root: load('root'), from: load('from') })

  function setSelection(mode: Mode, selection: PracticeSelection | null): void {
    selections[mode] = selection
    if (!slug) return
    if (selection) writeStored(key(mode), JSON.stringify(selection))
    else removeStored(key(mode))
  }

  return { selection: (mode: Mode): PracticeSelection | null => selections[mode], setSelection }
}

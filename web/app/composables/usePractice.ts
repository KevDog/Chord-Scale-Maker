import { type Mode, type PracticeSelection, practiceSelectionFrom } from '~~/engine'

/** a stored selection, if it is one (anything else in storage is ignored) */
function parse(raw: string | null): PracticeSelection | null {
  if (raw === null) return null
  try {
    return practiceSelectionFrom(JSON.parse(raw))
  } catch {
    return null // not JSON
  }
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

import { type ControlId, type InterfaceLevel, initialLevel, shows as tierShows } from '~/utils/interface'

const KEY = 'csm-interface'
/** the viewer's level, shared by every control (the song page is client-only); remembered once decided */
const level = ref<InterfaceLevel>('everything')
let remembered = false
watch(level, (v) => {
  if (remembered) writeStored(KEY, v)
})

/** decide the level from this browser before any page writes a preference (plugins/interface.client.ts) */
export function initInterface(): void {
  remembered = true
  const stored = readStored(KEY)
  const next = initialLevel(stored, storedKeys())
  level.value = next
  if (stored !== next) writeStored(KEY, next)
}

/** the Interface setting (#273): which controls show */
export function useInterface() {
  return { level, shows: (id: ControlId): boolean => tierShows(level.value, id) }
}

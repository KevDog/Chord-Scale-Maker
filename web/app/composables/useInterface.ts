import { type ControlId, type InterfaceLevel, initialLevel, shows as tierShows } from '~/utils/interface'

const KEY = 'csm-interface'
/** the viewer's level, shared by every control (the song page is client-only); remembered once the flag is on */
const level = ref<InterfaceLevel>('everything')
let remembered = false
watch(level, (v) => {
  if (remembered) writeStored(KEY, v)
})

/** decide the level from this browser before any page writes a preference (plugins/interface.client.ts); with the flag off, Everything and nothing stored */
export function initInterface(): void {
  remembered = useFeature('interfaceLevels')
  if (!remembered) return void (level.value = 'everything')
  const stored = readStored(KEY)
  const next = initialLevel(stored, storedKeys())
  level.value = next
  if (stored !== next) writeStored(KEY, next)
}

/** the Interface setting (#273): which controls show; the flag off shows all */
export function useInterface() {
  const on = useFeature('interfaceLevels')
  return { level, on, shows: (id: ControlId): boolean => !on || tierShows(level.value, id) }
}

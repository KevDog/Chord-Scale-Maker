import { RHYTHM_GEAR_PRESETS, RHYTHM_GROUP_PRESETS, type RhythmPath } from '@chord-scale-maker/engine'
import type { InjectionKey, Ref, WritableComputedRef } from 'vue'
import { typedGears, typedGroups } from '~/utils/rhythmText'

/** a path's listbox value: One, a preset, or Your list… */
export type ListChoice = 'one' | 'up' | 'down' | 'custom'
export const LIST_CHOICES: readonly ListChoice[] = ['one', 'up', 'down', 'custom']

/** one path's listbox and its Your list… text */
export type PathList = Readonly<{ choice: WritableComputedRef<ListChoice>; text: Ref<string>; commit: () => void }>
export type RhythmPathLists = Readonly<{ groups: PathList; gears: PathList }>

/** the paths' list state, owned by the controls that outlive Line options (PreviewControls) */
export const RHYTHM_PATH_LISTS: InjectionKey<RhythmPathLists> = Symbol('rhythm-path-lists')

/** a typed list plays once typing pauses this long (or on Enter or leaving the field), so it is one undo step (#553) */
export const LIST_PAUSE_MS = 500

const sameList = (a: readonly unknown[] | null, b: readonly unknown[] | null): boolean => a?.join(' ') === b?.join(' ')

/**
 * one path's listbox and its Your list… text: One, the presets (up, down) or a typed list (typed: null where the
 * text doesn't read). Your list… stays chosen while its text doesn't read (the path is One then), as Your rhythm… does.
 */
function pathList<K extends 'groups' | 'gears'>(path: Ref<RhythmPath>, key: K, presets: Readonly<Record<'up' | 'down', NonNullable<RhythmPath[K]>>>, typed: (text: string) => RhythmPath[K]): PathList {
  type List = RhythmPath[K]
  const presetOf = (list: List): ListChoice => (list === null ? 'one' : sameList(list, presets.up) ? 'up' : sameList(list, presets.down) ? 'down' : 'custom')
  const custom = ref(presetOf(path.value[key]) === 'custom')
  const text = ref(custom.value ? (path.value[key] ?? []).join(' ') : '')
  const set = (list: List): void => void (path.value = { ...path.value, [key]: list && [...list] })
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = (): void => {
    clearTimeout(timer)
    timer = undefined
  }
  /** the typed text plays now, if it is waiting for the pause */
  const commit = (): void => {
    if (timer === undefined) return
    cancel()
    if (custom.value) set(typed(text.value))
  }
  onScopeDispose(cancel)
  const choice = computed<ListChoice>({
    get: () => (custom.value ? 'custom' : presetOf(path.value[key])),
    set: (c) => {
      cancel()
      custom.value = c === 'custom'
      if (c === 'custom') {
        // start from the list in force, as text to edit
        if (!text.value && path.value[key]) text.value = path.value[key]!.join(' ')
        set(typed(text.value))
      } else set(c === 'one' ? null : presets[c])
    },
  })
  // typing plays after a pause, not a keystroke at a time; text that already says the path in force (an undo set it) waits for nothing
  watch(text, (t) => {
    cancel()
    if (!custom.value || sameList(typed(t), path.value[key])) return
    timer = setTimeout(commit, LIST_PAUSE_MS)
  })
  // the path changed from outside (a reset, a link, an undo): the listbox follows, unless it is the typed list or text that doesn't read
  watch(() => path.value[key], (list) => {
    if (custom.value && (sameList(list, typed(text.value)) || (list === null && !typed(text.value)))) return
    custom.value = presetOf(list) === 'custom'
    if (custom.value) text.value = (list ?? []).join(' ')
  })
  return { choice, text, commit }
}

/**
 * Groups' and Gears' listboxes and their Your list… text (Phase 4 spec §3, §7): owned where they outlive Line options,
 * so text that doesn't read survives a close and reopen, as useRhythmText keeps Your rhythm…'s (#553)
 */
export function useRhythmPathLists(path: Ref<RhythmPath>): RhythmPathLists {
  return {
    groups: pathList(path, 'groups', RHYTHM_GROUP_PRESETS, typedGroups),
    gears: pathList(path, 'gears', RHYTHM_GEAR_PRESETS, typedGears),
  }
}

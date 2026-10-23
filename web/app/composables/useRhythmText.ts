import { formatRhythm, parseRhythm, parseRhythmId, type RhythmId } from '@chord-scale-maker/engine'
import type { InjectionKey, Ref } from 'vue'
import { typedRhythm } from '~/utils/rhythmText'

/** Your rhythm…: whether it's chosen, and its text (which plays while it reads, Off while it doesn't) */
export type RhythmText = Readonly<{ custom: Ref<boolean>; text: Ref<string> }>

/** the RhythmControls' text state, owned by the controls that outlive its panels (PreviewControls) */
export const RHYTHM_TEXT: InjectionKey<RhythmText> = Symbol('rhythm-text')

/** a rhythm's custom id from its text, or Off where it doesn't read (or is at a tuplet pulse with the rhythmGears flag off) */
export function customRhythmId(text: string, gears: boolean): RhythmId {
  const r = typedRhythm(text, gears)
  return r ? `custom:${formatRhythm(r).replace(': ', ':')}` : 'off'
}

/**
 * Your rhythm…'s state for a rhythm: owned where it outlives the Line options panel and the rail's Rhythm options, so
 * text that doesn't read survives a close and reopen. shown: the Rhythm controls show (useInterface's shows('rhythm'))
 */
export function useRhythmText(rhythm: Ref<RhythmId>, shown: () => boolean): RhythmText {
  const gears = useFeature('rhythmGears')
  const parsed = parseRhythmId(rhythm.value)
  const custom = ref(parsed?.kind === 'custom')
  const text = ref(parsed?.kind === 'custom' ? formatRhythm(parsed.rhythm) : '')
  watch(text, (t) => {
    if (custom.value) rhythm.value = customRhythmId(t, gears)
  })
  // the stored rhythm changed from outside (a share link, a reset): the listbox follows
  watch(rhythm, (id) => {
    const p = parseRhythmId(id)
    const typed = parseRhythm(text.value)
    if (p?.kind === 'custom' && (!typed || formatRhythm(typed) !== formatRhythm(p.rhythm))) text.value = formatRhythm(p.rhythm) // not typed here: the box follows
    custom.value = p?.kind === 'custom' || (id === 'off' && custom.value && !typedRhythm(text.value, gears)) // invalid text plays Off, still Your rhythm…
  })
  // a reset comes from the hidden-settings notice, with these controls hidden; it sets an Off rhythm to Off, which no
  // watch sees, so text that doesn't read stops holding Your rhythm… once the controls hide: they come back on Off
  watch(shown, (s) => {
    if (!s && rhythm.value === 'off') custom.value = false
  })
  return { custom, text }
}


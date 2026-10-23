import type { GuideNote } from '../guideTones'
import { pcOf } from '../pitch'
import { EPS } from './pour'

/** Target beats (rhythm spec §7, after Galper): the strong beats of a bar, counting beats from 0. */

/** The downbeat, and from 4/4 to 7/4 the start of the bar's second group (2 + 2, 3 + 2, 3 + 3, 4 + 3). */
export function targetBeats(beats: number): readonly number[] {
  return beats < 4 ? [0] : [0, Math.ceil(beats / 2)]
}

/**
 * A voice with `target` set on each pitched note that starts exactly on one of the bar's target beats and isn't tied in
 * (rhythm-on-lines spec §6): 'tone' when its pitch class is among tonesAt(beat), the chord sounding there, else 'other'.
 * With no readable chord (tonesAt gives null) the note gets no mark.
 */
export function markTargets(voice: readonly GuideNote[], targets: readonly number[], tonesAt: (beat: number) => readonly number[] | null): GuideNote[] {
  return voice.map((n) => {
    if (!n.pitch || n.tiedIn || !targets.some((t) => Math.abs(t - n.beat) < EPS)) return n
    const tones = tonesAt(n.beat)
    if (!tones) return n
    return { ...n, target: tones.includes(pcOf(n.pitch)) ? 'tone' : 'other' }
  })
}

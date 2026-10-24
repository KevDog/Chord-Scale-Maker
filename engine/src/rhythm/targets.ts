import type { GuideNote } from '../guideTones'
import type { Pitched } from '../part'
import { mod, pcOf, type Spelled } from '../pitch'
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

/** a target's beat in its bar and the chord tones a note there should be (null: the chord can't be read) */
export type TargetTones = Readonly<{ beat: number; tones: readonly Spelled[] | null }>

/** the chord tone nearest p (a tie: the lower), in the band when one is (else the nearest at all), spelled as the chord spells it */
function toneNear(p: Pitched, tones: readonly Spelled[], band?: Readonly<{ lo: number; hi: number }>): Pitched {
  const all = tones
    .flatMap((t) => {
      const up = p.midi + mod(pcOf(t) - p.midi, 12)
      return [{ ...t, midi: up }, { ...t, midi: up - 12 }]
    })
    .toSorted((a, b) => Math.abs(a.midi - p.midi) - Math.abs(b.midi - p.midi) || a.midi - b.midi)
  return all.find((c) => !band || (c.midi >= band.lo && c.midi <= band.hi)) ?? all[0] ?? p
}

/**
 * Land on the targets (Galper): a chord tone struck on every target. A note struck there that isn't one of its chord
 * tones moves to the nearest; with split, a note held or tied through a target is struck again there, as a chord tone
 * (without split, under a rhythm, which owns the attacks, it stays). A rest, or a chord that can't be read, stays.
 * The accidentals are the caller's to work out again.
 */
export function landTargets(voice: readonly GuideNote[], targets: readonly TargetTones[], opts: Readonly<{ split: boolean; band?: Readonly<{ lo: number; hi: number }> }>): GuideNote[] {
  const out = [...voice]
  for (const t of targets) {
    if (!t.tones?.length) continue
    const i = out.findIndex((n) => n.beat < t.beat + EPS && t.beat < n.beat + n.beats - EPS)
    const n = out[i]
    if (!n?.pitch) continue
    const onBeat = Math.abs(n.beat - t.beat) < EPS
    const struck = onBeat && !n.tiedIn
    if (!struck && !opts.split) continue
    const tone = t.tones.map(pcOf).includes(pcOf(n.pitch)) ? n.pitch : toneNear(n.pitch, t.tones, opts.band)
    if (struck) {
      if (tone !== n.pitch) out[i] = { ...n, pitch: tone }
    } else if (onBeat) out[i] = { ...n, pitch: tone, tiedIn: false }
    else out.splice(i, 1, { ...n, beats: t.beat - n.beat, tie: false }, { ...n, beat: t.beat, beats: n.beat + n.beats - t.beat, pitch: tone, tiedIn: false })
  }
  return out
}

/** a drawn bar's length, its target beats, and the beats where the Line's chord changes (the first chord's and a break's left out: they don't move) */
export type TargetBar = Readonly<{ beats: number; targets: readonly number[]; changes: readonly number[] }>

/**
 * each drawn bar's targets moved with the phrasing (rhythm-on-lines spec §2), as beats in the bar they land in: a
 * target on a chord change lands `anticipate` beats earlier (later when negative), maybe in another bar, as the Line's
 * change does; one inside a chord stays. None lands outside the sheet.
 */
export function targetLandings(bars: readonly TargetBar[], anticipate: number): readonly (readonly number[])[] {
  const starts = bars.reduce<number[]>((acc, b, d) => [...acc, d ? acc[d - 1]! + bars[d - 1]!.beats : 0], [])
  const total = (starts.at(-1) ?? 0) + (bars.at(-1)?.beats ?? 0)
  const out: number[][] = bars.map(() => [])
  bars.forEach((b, d) => {
    for (const t of b.targets) {
      const at = starts[d]! + t
      const land = b.changes.some((c) => Math.abs(c - t) < EPS) ? at - anticipate : at
      if (land < -EPS || land > total - EPS) continue
      const e = starts.findLastIndex((s) => s <= land + EPS)
      out[e]!.push(Math.max(0, land - starts[e]!))
    }
  })
  return out.map((b) => b.toSorted((x, y) => x - y))
}

/** Target beats (rhythm spec §7, after Galper): the strong beats of a bar, counting beats from 0. */

/** The downbeat, and from 4/4 to 7/4 the start of the bar's second group (2 + 2, 3 + 2, 3 + 3, 4 + 3). */
export function targetBeats(beats: number): readonly number[] {
  return beats < 4 ? [0] : [0, Math.ceil(beats / 2)]
}

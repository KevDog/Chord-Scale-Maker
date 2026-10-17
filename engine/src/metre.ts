/**
 * Bars of their own lengths, one after another (#235): a chart whose metre changes partway (a section's time:, an
 * @time) times each bar in its own. A Metre is a steady number of beats a bar, or a Clock: listed bars, then bars of
 * `tail` beats. Bars count from 0 through the chart, beats from 0. Pure.
 */

export type Clock = Readonly<{ lengths: readonly number[]; starts: readonly number[]; tail: number }>
export type Metre = number | Clock

/** bars of these lengths (in beats), then of `tail` */
export function clockOf(lengths: readonly number[], tail: number): Clock {
  const starts = lengths.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : (acc[i - 1] ?? 0) + (lengths[i - 1] ?? 0)], [])
  return { lengths: [...lengths], starts, tail }
}

const asClock = (m: Metre): Clock => (typeof m === 'number' ? { lengths: [], starts: [], tail: m } : m)
/** where the listed bars end, in bars and beats */
const listedEnd = (c: Clock): number => (c.starts.at(-1) ?? 0) + (c.lengths.at(-1) ?? 0)

/** the bar a beat falls in */
export function barAt(m: Metre, beat: number): number {
  const c = asClock(m)
  const end = listedEnd(c)
  if (beat >= end) return c.lengths.length + Math.floor((beat - end) / c.tail)
  let lo = 0
  let hi = c.starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((c.starts[mid] ?? 0) <= beat) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** a bar's first beat */
export function barStart(m: Metre, bar: number): number {
  const c = asClock(m)
  return bar < c.starts.length ? (c.starts[bar] ?? 0) : listedEnd(c) + (bar - c.lengths.length) * c.tail
}

/** a bar's length in beats */
export const barLength = (m: Metre, bar: number): number => {
  const c = asClock(m)
  return c.lengths[bar] ?? c.tail
}

import { CAPS, type InstrumentName, INSTRUMENTS, type Range } from './instruments'

/**
 * The player's range (#359): the written range the lines keep to, set inside the instrument's full range and its
 * staff's cap, two octaves at least (the Arpeggios sheet's run), or the preset's span where that is less (tuba, bass).
 */

export const MIN_SPAN = 24

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi)

/** where an instrument's range may lie, and its least span */
function limits(name: InstrumentName): Readonly<{ lo: number; hi: number; span: number }> {
  const { clef, compass, range } = INSTRUMENTS[name]
  return { lo: Math.max(compass.lo, CAPS[clef].lo), hi: Math.min(compass.hi, CAPS[clef].hi), span: Math.min(MIN_SPAN, range.hi - range.lo) }
}

/** the range nearest want that the player may set, keeping the end they moved and pushing the other; the preset's centre, which every such range holds */
export function fitRange(name: InstrumentName, want: Readonly<{ lo: number; hi: number }>, moved: 'lo' | 'hi' = 'lo'): Range {
  const { lo: min, hi: max, span } = limits(name)
  const { centre } = INSTRUMENTS[name].range
  if (moved === 'lo') {
    const lo = clamp(want.lo, min, max - span)
    return { lo, hi: clamp(want.hi, lo + span, max), centre }
  }
  const hi = clamp(want.hi, min + span, max)
  return { lo: clamp(want.lo, min, hi - span), hi, centre }
}

/** the notes each end can take (moving one may push the other) */
export function rangeChoices(name: InstrumentName): Readonly<{ lows: readonly number[]; highs: readonly number[] }> {
  const { lo, hi, span } = limits(name)
  const run = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return { lows: run(lo, hi - span), highs: run(lo + span, hi) }
}

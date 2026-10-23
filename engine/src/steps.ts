import type { PentatonicStep } from './pentatonics'

/** a drawn block, as `changes.ts` cuts the form: its part, its clock bars `from`..`to`, the chart rows in it */
export type StepBlock = Readonly<{ part: string; from: number; to: number; rows: readonly number[] }>

/** a drawn block's bars: one at least (a block whose rows sit in one bar still draws it) */
export const blockBars = (b: Readonly<{ from: number; to: number }>): number => Math.max(1, b.to - b.from + 1)

export type StepUnits = Readonly<{
  /** a chord's unit: its block k, its bar j in the block, its row i; null outside the form */
  ofChord: (block: number, bar: number, row: number) => number | null
  /** each drawn bar's unit, indexed like `buildChanges`'s `lengths` (the bars as drawn, a written-out repeat and each
   *  ending included); null outside the form. A bar takes the key area of its first chord, or of the chord held into it */
  ofDrawnBar: readonly (number | null)[]
}>

/**
 * The step unit of each chord and each drawn bar: one per form block (`section`), per `step.bars` bars of the form
 * (`bars`) or per run of one key area (`key-area`). Blocks outside the form (intro, coda) have no unit
 * (Phase 4 spec §3; #276). `keyOfRow` is a row's key name, `barOf` the clock bar a row starts in.
 */
export function stepUnits(
  blocks: readonly StepBlock[],
  keyOfRow: (row: number) => string | undefined,
  barOf: (row: number) => number | undefined,
  step: PentatonicStep,
): StepUnits {
  const formBlocks = blocks.flatMap((b, k) => (b.part === 'form' ? [k] : []))
  const sectionUnit = new Map(formBlocks.map((k, n) => [k, n]))
  const formStart = new Map<number, number>() // block → its first bar's index in the form
  const areaUnit = new Map<number, number>() // row → its run of one key area
  {
    let formBars = 0
    let run = 0
    let key: string | undefined
    for (const k of formBlocks) {
      const b = blocks[k]!
      formStart.set(k, formBars)
      formBars += blockBars(b)
      for (const i of b.rows) {
        const here = keyOfRow(i)
        if (here !== undefined && key !== undefined && here !== key) run++
        if (here !== undefined) key = here
        areaUnit.set(i, run)
      }
    }
  }
  const unit = (k: number, j: number, i: number): number | null => {
    const n = sectionUnit.get(k)
    if (n === undefined) return null
    if (step.unit === 'section') return n
    if (step.unit === 'bars') return Math.floor(((formStart.get(k) ?? 0) + j) / step.bars)
    return areaUnit.get(i) ?? 0
  }
  const ofDrawnBar = blocks.flatMap((b, k) =>
    Array.from({ length: blockBars(b) }, (_, j): number | null => {
      const bar = b.from + j
      // the bar's first chord, else the chord still sounding from an earlier bar of the block
      const row = b.rows.find((i) => barOf(i) === bar) ?? b.rows.findLast((i) => (barOf(i) ?? Infinity) < bar)
      return unit(k, j, row ?? -1)
    }),
  )
  return { ofChord: unit, ofDrawnBar }
}

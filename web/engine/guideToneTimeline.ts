import type { Row } from './chart'

/**
 * When each chord of a guide tone sheet starts and how long it lasts, in beats of 4/4 (docs/plan-guide-tones.md):
 * a chord lasts until the next change, rows that share a bar split it, and the last row runs to the end of the form.
 */

export const BEATS = 4 // 4/4
const MAX_PER_BAR = 4
/** how a bar is shared by 1-4 chords, in beats */
const SPLITS: readonly (readonly number[])[] = [[4], [2, 2], [2, 1, 1], [1, 1, 1, 1]]
const WHOLE = /^[+-]?\d{1,6}$/

/** "1" and "01" are the same bar */
const sameBar = (a: string, b: string): boolean => (WHOLE.test(a) && WHOLE.test(b) ? Number(a) === Number(b) : a === b)

const sectionStart = (rows: readonly Row[], section: string): number =>
  Math.min(...rows.filter((r) => r.section === section).map((r) => Number(r.bar)))

/** each section's rows relative to its first bar, to spot a section repeated by @copy */
const shape = (rows: readonly Row[], section: string): string => {
  const start = sectionStart(rows, section)
  return rows.filter((r) => r.section === section).map((r) => `${Number(r.bar) - start}|${r.chord}|${r.scale}`).join(';')
}

/**
 * how long the last row lasts. The chart has no end marker, so: a final section that repeats an earlier one
 * (A3 = A1 in an AABA) lasts as long as that one did, and the form then rounds up to whole 4-bar phrases.
 */
function finalBars(rows: readonly Row[]): number {
  const last = rows.at(-1)
  if (!last || !rows.every((r) => WHOLE.test(r.bar))) return 1
  const first = Number(rows[0]?.bar)
  const order = [...new Set(rows.map((r) => r.section))]
  let end = Number(last.bar) + 1
  const twin = order.slice(0, -1).find((s) => s !== last.section && shape(rows, s) === shape(rows, last.section))
  const twinNext = twin === undefined ? undefined : order[order.indexOf(twin) + 1]
  if (twin !== undefined && twinNext !== undefined)
    end = sectionStart(rows, last.section) + sectionStart(rows, twinNext) - sectionStart(rows, twin)
  const length = Math.ceil((end - first) / 4) * 4
  return Math.max(1, first + length - Number(last.bar))
}

export type GuideEvent = Readonly<{ row: Row; chord: string; start: number; beats: number }> // in beats from 0

/** when each chord starts and how long it lasts; rows that share a bar split it */
export function guideToneTimeline(rows: readonly Row[]): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[] }> {
  const groups: Row[][] = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last?.[0] && sameBar(last[0].bar, r.bar)) last.push(r)
    else groups.push([r])
  }
  const diagnostics: string[] = []
  const events: GuideEvent[] = []
  let cursor = 0
  const lastBars = finalBars(rows)
  groups.forEach((group, g) => {
    const first = group[0]
    if (!first) return
    if (group.length > MAX_PER_BAR)
      diagnostics.push(`more than ${MAX_PER_BAR} chords in bar ${first.bar}: the ${MAX_PER_BAR + 1}th and later are left out`)
    const kept = group.slice(0, MAX_PER_BAR)
    const next = groups[g + 1]?.[0]?.bar
    let bars = 1
    if (!WHOLE.test(first.bar)) diagnostics.push(`bar "${first.bar}" is not a whole number, so ${first.chord} gets one bar`)
    else if (next !== undefined && WHOLE.test(next) && Number(next) > Number(first.bar)) bars = Number(next) - Number(first.bar)
    else if (next === undefined) bars = lastBars
    const split = SPLITS[kept.length - 1] ?? [BEATS]
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      const beats = i === kept.length - 1 ? slot + (bars - 1) * BEATS : slot
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats })
      offset += slot
    })
    cursor += bars * BEATS
  })
  return { events, diagnostics }
}

import { formPart, type Row } from './chart'

/**
 * When each chord of a guide tone sheet starts and how long it lasts, in beats (4/4 unless the chart says 3/4 or 2/4;
 * docs/plan-guide-tones.md):
 * a chord lasts until the next change, rows that share a bar split it, and the last row runs to the end of the form.
 */

export const BEATS = 4 // 4/4, the default
/** how a bar is shared by 1 chord, 2, …, in beats, for each metre; a bar holds at most one chord a beat */
const SPLITS: Readonly<Record<2 | 3 | 4, readonly (readonly number[])[]>> = {
  4: [[4], [2, 2], [2, 1, 1], [1, 1, 1, 1]],
  3: [[3], [2, 1], [1, 1, 1]],
  2: [[2], [1, 1]],
}
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

/**
 * when each chord starts and how long it lasts; rows that share a bar split it. An intro, the form and a coda are
 * timed one after another, each to its own end, so an intro or coda can number its bars from 1.
 */
export function guideToneTimeline(rows: readonly Row[], beats: 2 | 3 | 4 = BEATS): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[] }> {
  const runs: Row[][] = []
  for (const r of rows) {
    const last = runs.at(-1)
    if (last?.[0] && formPart(last[0].section) === formPart(r.section)) last.push(r)
    else runs.push([r])
  }
  const events: GuideEvent[] = []
  const diagnostics: string[] = []
  let cursor = 0
  for (const run of runs) {
    const t = timeRun(run, cursor, beats)
    events.push(...t.events)
    diagnostics.push(...t.diagnostics)
    cursor = t.end
  }
  return { events, diagnostics }
}

function timeRun(rows: readonly Row[], from: number, beats: 2 | 3 | 4): Readonly<{ events: GuideEvent[]; diagnostics: string[]; end: number }> {
  const MAX_PER_BAR = beats
  const groups: Row[][] = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last?.[0] && sameBar(last[0].bar, r.bar)) last.push(r)
    else groups.push([r])
  }
  const diagnostics: string[] = []
  const events: GuideEvent[] = []
  let cursor = from
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
    const split = SPLITS[beats][kept.length - 1] ?? [beats]
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      const length = i === kept.length - 1 ? slot + (bars - 1) * beats : slot
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats: length })
      offset += slot
    })
    cursor += bars * beats
  })
  return { events, diagnostics, end: cursor }
}

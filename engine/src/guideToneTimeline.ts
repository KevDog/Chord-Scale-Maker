import type { Row } from './chart'
import { type Clock, clockOf } from './metre'

/**
 * When each chord of the Changes sheet starts and how long it lasts, in beats (4/4 unless the chart says 3/4 or 2/4;
 * docs/plan-guide-tones.md), for its bars and its guide tones: sections are timed one after another, each from its own
 * bar 1; a chord lasts until the next change in its section, rows that share a bar split it, and a section's last
 * chord lasts to the section's length (bars:, else its last written bar; layout.ts). Each bar is in its own metre
 * where the chart changes it (a section's time:, an @time; #235).
 */

const BEATS = 4 // 4/4, the default
/** how a bar is shared by 1 chord, 2, …, in beats, for each metre; a bar holds at most one chord a beat */
const SPLITS: Readonly<Record<number, readonly (readonly number[])[]>> = {
  6: [[6], [3, 3], [2, 2, 2], [2, 1, 2, 1], [2, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]],
  5: [[5], [3, 2], [2, 1, 2], [2, 1, 1, 1], [1, 1, 1, 1, 1]],
  4: [[4], [2, 2], [2, 1, 1], [1, 1, 1, 1]],
  3: [[3], [2, 1], [1, 1, 1]],
  2: [[2], [1, 1]],
}
const WHOLE = /^[+-]?\d{1,6}$/

/** "1" and "01" are the same bar */
const sameBar = (a: string, b: string): boolean => (WHOLE.test(a) && WHOLE.test(b) ? Number(a) === Number(b) : a === b)

export type GuideEvent = Readonly<{ row: Row; chord: string; start: number; beats: number }> // in beats from 0

/**
 * when each chord starts and how long it lasts; lengths: each section's, in bars (else its last written bar), in
 * chart order, so a section with no rows still takes its bars; metres: each section's bars' beats, from its bar 1
 * (bars past the list: its last, else `beats`). clock: every bar's length through the chart.
 */
export function guideToneTimeline(
  rows: readonly Row[],
  beats: number = BEATS,
  lengths?: ReadonlyMap<string, number>,
  metres?: ReadonlyMap<string, readonly number[]>,
): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[]; clock: Clock }> {
  const sections: { name: string; rows: Row[] }[] = lengths ? [...lengths.keys()].map((name) => ({ name, rows: [] })) : []
  for (const r of rows) {
    const known = lengths ? sections.find((s) => s.name === r.section) : undefined
    const last = sections.at(-1)
    if (known) known.rows.push(r)
    else if (!lengths && last?.name === r.section) last.rows.push(r)
    else sections.push({ name: r.section, rows: [r] })
  }
  const events: GuideEvent[] = []
  const diagnostics: string[] = []
  const bars: number[] = []
  for (const { name, rows: rs } of sections) {
    const lastBar = Math.max(1, ...rs.filter((r) => WHOLE.test(r.bar)).map((r) => Number(r.bar)))
    const length = Math.max(lengths?.get(name) ?? lastBar, lastBar)
    const own = metres?.get(name) ?? []
    const barBeats = (n: number): number => own[n - 1] ?? own.at(-1) ?? beats // n from 1
    const t = timeSection(rs, bars.reduce((a, b) => a + b, 0), barBeats, length)
    events.push(...t.events)
    diagnostics.push(...t.diagnostics)
    for (let n = 1; n <= length; n++) bars.push(barBeats(n))
  }
  return { events, diagnostics, clock: clockOf(bars, beats) }
}

/** bars from–to (from 1, `to` excluded) of a section, in beats */
const span = (barBeats: (n: number) => number, from: number, to: number): number => {
  let sum = 0
  for (let n = from; n < to; n++) sum += barBeats(n)
  return sum
}

function timeSection(rows: readonly Row[], from: number, barBeats: (n: number) => number, length: number): Readonly<{ events: GuideEvent[]; diagnostics: string[] }> {
  const groups: Row[][] = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last?.[0] && sameBar(last[0].bar, r.bar)) last.push(r)
    else groups.push([r])
  }
  const diagnostics: string[] = []
  const events: GuideEvent[] = []
  // a section whose first chord comes after its bar 1 starts with silent bars
  const firstBar = groups[0]?.[0]?.bar ?? '1'
  let bar = WHOLE.test(firstBar) && Number(firstBar) > 1 ? Number(firstBar) : 1 // where the cursor is, from 1
  let cursor = from + span(barBeats, 1, bar)
  groups.forEach((group, g) => {
    const first = group[0]
    if (!first) return
    const beats = barBeats(bar)
    if (group.length > beats) diagnostics.push(`more than ${beats} chords in bar ${first.bar}: the ${beats + 1}th and later are left out`)
    const kept = group.slice(0, beats)
    const next = groups[g + 1]?.[0]?.bar
    let bars = 1
    if (!WHOLE.test(first.bar)) diagnostics.push(`bar "${first.bar}" is not a whole number, so ${first.chord} gets one bar`)
    else if (next !== undefined && WHOLE.test(next) && Number(next) > Number(first.bar)) bars = Number(next) - Number(first.bar)
    else if (next === undefined) bars = Math.max(1, length - Number(first.bar) + 1)
    const split = SPLITS[beats]?.[kept.length - 1] ?? [beats]
    const held = span(barBeats, bar + 1, bar + bars)
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats: i === kept.length - 1 ? slot + held : slot })
      offset += slot
    })
    cursor += beats + held
    bar += bars
  })
  return { events, diagnostics }
}

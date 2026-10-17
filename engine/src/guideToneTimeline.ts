import type { Row } from './chart'

/**
 * When each chord of the Changes sheet starts and how long it lasts, in beats (4/4 unless the chart says 3/4 or 2/4;
 * docs/plan-guide-tones.md), for its bars and its guide tones: sections are timed one after another, each from its own
 * bar 1; a chord lasts until the next change in its section, rows that share a bar split it, and a section's last
 * chord lasts to the section's length (bars:, else its last written bar; layout.ts).
 */

const BEATS = 4 // 4/4, the default
/** how a bar is shared by 1 chord, 2, …, in beats, for each metre; a bar holds at most one chord a beat */
const SPLITS: Readonly<Record<2 | 3 | 4, readonly (readonly number[])[]>> = {
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
 * chart order, so a section with no rows still takes its bars
 */
export function guideToneTimeline(rows: readonly Row[], beats: 2 | 3 | 4 = BEATS, lengths?: ReadonlyMap<string, number>): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[] }> {
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
  let cursor = 0
  for (const { name, rows: rs } of sections) {
    const lastBar = Math.max(1, ...rs.filter((r) => WHOLE.test(r.bar)).map((r) => Number(r.bar)))
    const length = Math.max(lengths?.get(name) ?? lastBar, lastBar)
    const t = timeSection(rs, cursor, beats, length)
    events.push(...t.events)
    diagnostics.push(...t.diagnostics)
    cursor += length * beats
  }
  return { events, diagnostics }
}

function timeSection(rows: readonly Row[], from: number, beats: 2 | 3 | 4, length: number): Readonly<{ events: GuideEvent[]; diagnostics: string[] }> {
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
  let cursor = from + (WHOLE.test(firstBar) && Number(firstBar) > 1 ? (Number(firstBar) - 1) * beats : 0)
  groups.forEach((group, g) => {
    const first = group[0]
    if (!first) return
    if (group.length > beats) diagnostics.push(`more than ${beats} chords in bar ${first.bar}: the ${beats + 1}th and later are left out`)
    const kept = group.slice(0, beats)
    const next = groups[g + 1]?.[0]?.bar
    let bars = 1
    if (!WHOLE.test(first.bar)) diagnostics.push(`bar "${first.bar}" is not a whole number, so ${first.chord} gets one bar`)
    else if (next !== undefined && WHOLE.test(next) && Number(next) > Number(first.bar)) bars = Number(next) - Number(first.bar)
    else if (next === undefined) bars = Math.max(1, length - Number(first.bar) + 1)
    const split = SPLITS[beats][kept.length - 1] ?? [beats]
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats: i === kept.length - 1 ? slot + (bars - 1) * beats : slot })
      offset += slot
    })
    cursor += bars * beats
  })
  return { events, diagnostics }
}

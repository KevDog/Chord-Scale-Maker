import { type FormPart, formPart, type LinedRow } from '../chart'
import { pcOf, type Spelled } from '../pitch'
import { readChord } from '../qualities'

/**
 * Pass 1 (docs/plan-analysis.md §4): the chord stream. One entry per chord change, as the ear hears it (slash
 * readings applied), with where it starts and how long it lasts; identical consecutive chords are one entry. The
 * form repeats, so the last entry's next is the first.
 */

export type Family = 'major' | 'minor' | 'dominant' | 'halfdim' | 'dim' | 'sus'

const FAMILY: Readonly<Record<string, Family>> = {
  maj: 'major',
  Maj7: 'major',
  'Maj7#11': 'major',
  'Maj7#5': 'major',
  '6': 'major',
  m: 'minor',
  m7: 'minor',
  m6: 'minor',
  mMaj7: 'minor',
  '7': 'dominant',
  '7b9': 'dominant',
  '7b13': 'dominant',
  '7b9b13': 'dominant',
  '7#11': 'dominant',
  '7alt': 'dominant',
  m7b5: 'halfdim',
  dim7: 'dim',
  '7sus4': 'sus',
  '7sus4b9': 'sus',
}

export type Entry = Readonly<{
  /** the expanded rows this entry covers (identical consecutive rows are one entry) */
  rows: readonly number[]
  /** in the form, or an intro before it or a coda after it (chart.ts formPart) */
  part: FormPart
  /** the entries it moves to and comes from: the form wraps, an intro leads into bar 1, a coda follows the form's
   * last chord and leads nowhere */
  next: number | null
  prev: number | null
  /** the section label of its first row */
  section: string
  chord: string
  /** null: a chord the analyser can't read (unparseable, or an unknown quality); it gets no rule */
  root: Spelled | null
  pc: number
  quality: string
  family: Family | null
  /** the quality text whose tensions the symbol pins */
  symbol: string
  /** the bar it starts in (fractional when it shares a bar) and how many bars it lasts */
  start: number
  bars: number
}>

/**
 * where each row starts and how long it lasts: chords sharing a bar split it evenly; the last row runs to the form's
 * end, which is its stated length, else the next multiple of four bars (forms come in 12, 16, 32…)
 */
function timing(rows: readonly LinedRow[], formBars?: number): { start: number; bars: number }[] {
  const bars = rows.map((r) => Number(r.bar))
  const first = bars.find((b) => Number.isFinite(b)) ?? 1
  const last = Math.max(first, ...bars.filter(Number.isFinite))
  const length = formBars !== undefined && first + formBars > last ? formBars : Math.ceil((last - first + 1) / 4) * 4
  const end = first + length
  return rows.map((_, i) => {
    const bar = Number.isFinite(bars[i]) ? (bars[i] ?? first) : first
    let j = i
    while (j > 0 && bars[j - 1] === bar) j--
    let k = i
    while (k + 1 < rows.length && bars[k + 1] === bar) k++
    const share = k - j + 1
    const nextBar = k + 1 < rows.length ? (bars[k + 1] ?? end) : end
    const span = Math.max(1, Number.isFinite(nextBar) && nextBar > bar ? nextBar - bar : 1)
    return { start: bar + ((i - j) * span) / share, bars: span / share }
  })
}

export function buildStream(rows: readonly LinedRow[], formBars?: number): Entry[] {
  // each part is timed on its own: the form to its stated length, an intro or coda to its own last bar
  const parts = rows.map((r) => formPart(r.section))
  const times: { start: number; bars: number }[] = []
  for (const part of ['before', 'form', 'after'] as const) {
    const idx = rows.flatMap((_, i) => (parts[i] === part ? [i] : []))
    timing(
      idx.map((i) => rows[i] as LinedRow),
      part === 'form' ? formBars : undefined,
    ).forEach((t, k) => (times[idx[k] ?? 0] = t))
  }
  const out: Entry[] = []
  rows.forEach((row, i) => {
    const t = times[i] ?? { start: 1, bars: 1 }
    const part = parts[i] ?? 'form'
    const prev = out[out.length - 1]
    if (prev && prev.chord === row.chord && prev.part === part) {
      out[out.length - 1] = { ...prev, rows: [...prev.rows, i], bars: prev.bars + t.bars }
      return
    }
    const reading = readChord(row.chord)
    out.push({
      rows: [i],
      part,
      next: null,
      prev: null,
      section: row.section,
      chord: row.chord,
      root: reading?.root ?? null,
      pc: reading ? pcOf(reading.root) : -1,
      quality: reading?.quality ?? '',
      family: reading ? (FAMILY[reading.quality] ?? null) : null,
      symbol: reading?.symbol ?? '',
      start: t.start,
      bars: t.bars,
    })
  })
  return link(out)
}

function link(entries: Entry[]): Entry[] {
  const of = (part: FormPart): number[] => entries.flatMap((e, i) => (e.part === part ? [i] : []))
  const [before, form, after] = [of('before'), of('form'), of('after')]
  const at = (xs: readonly number[], k: number): number | null => xs[k] ?? null
  const links = new Map<number, { next: number | null; prev: number | null }>()
  form.forEach((i, k) => links.set(i, { next: at(form, (k + 1) % form.length), prev: at(form, (k - 1 + form.length) % form.length) }))
  before.forEach((i, k) => links.set(i, { next: k + 1 < before.length ? at(before, k + 1) : at(form, 0), prev: k > 0 ? at(before, k - 1) : null }))
  after.forEach((i, k) => links.set(i, { next: at(after, k + 1), prev: k > 0 ? at(after, k - 1) : at(form, form.length - 1) }))
  return entries.map((e, i) => ({ ...e, ...links.get(i) }))
}

/** the next and previous entries (the form wraps; see Entry.next) */
export const nextOf = (stream: readonly Entry[], i: number | null | undefined): Entry | undefined => {
  const n = i === null || i === undefined ? null : stream[i]?.next
  return n === null || n === undefined ? undefined : stream[n]
}
export const prevOf = (stream: readonly Entry[], i: number | null | undefined): Entry | undefined => {
  const p = i === null || i === undefined ? null : stream[i]?.prev
  return p === null || p === undefined ? undefined : stream[p]
}

/** b - a in semitones, 0..11 */
export const interval = (a: number, b: number): number => (((b - a) % 12) + 12) % 12
/** e resolves down a perfect fifth (up a fourth) to n */
export const downFifth = (e: Entry, n: Entry | undefined): boolean => !!n && e.pc >= 0 && n.pc >= 0 && interval(e.pc, n.pc) === 5
/** e resolves down a half step to n */
export const downHalf = (e: Entry, n: Entry | undefined): boolean => !!n && e.pc >= 0 && n.pc >= 0 && interval(e.pc, n.pc) === 11

import type { Diagnostic, Parsed } from '../chart'
import { REST } from '../chord'
import { irealChord } from './chords'
import type { IRealSong } from './decode'
import { type IRealBar, readMusic } from './music'

/*
 * An iReal song as our chart text (spec "Engine", toChart.ts). Bars are played first (x/r filled in, chords mapped,
 * metres and comments read), then cut into sections at each *X mark; a { } section with endings gets @ending, one
 * without them a copy: section after it. Each step returns its own diagnostics; the song's bar number is their line.
 */

const METRES = new Set(['2/4', '3/4', '4/4', '5/4', '6/4'])
const NAV: readonly string[] = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
const navOf = (comment: string): string | undefined => NAV.find((n) => n.toLowerCase() === comment.replace(/\s+/g, ' ').trim().toLowerCase())

const baseName = (mark: string): string => (mark === 'i' ? 'Intro' : mark === 'V' ? 'Verse' : mark.toUpperCase())
const isOutside = (base: string): boolean => base === 'Intro' || base === 'Verse'
const diag = (line: number, message: string): Diagnostic => ({ line, message })

/** each bar's place for a report, "A bar 3", by its section's letter (before A1/A2 numbering) */
function labels(bars: readonly IRealBar[]): readonly string[] {
  let section = 'A'
  let k = 0
  return bars.map((b, i) => {
    if (b.section !== undefined || i === 0) {
      section = baseName(b.section ?? 'A')
      k = 0
    }
    return `${section} bar ${++k}`
  })
}

type Played = Readonly<{
  n: number // the song's bar, from 1
  bar: IRealBar
  chords: readonly string[] // empty: the chord before holds
  time?: string // a metre the sheets have, where this bar sets one
  navs: readonly string[]
}>

/** the bars as played: chords mapped, x/r filled from the bars before; reports what's left out */
function play(bars: readonly IRealBar[], at: readonly string[]): Parsed<readonly Played[]> {
  const out: Played[] = []
  const diagnostics: Diagnostic[] = []
  let pending: readonly string[] | null = null // the second bar of an r
  for (const [i, bar] of bars.entries()) {
    const n = i + 1
    const report = (message: string) => diagnostics.push(diag(n, `${at[i]}: ${message}`))
    const chords: string[] = pending && !bar.items.length ? [...pending] : []
    pending = null
    for (const item of bar.items) {
      if (item.kind === 'repeat') {
        const back = out.at(-item.bars)
        if (!back) report('a repeat sign with no bar before it, left empty')
        else {
          chords.push(...back.chords)
          if (item.bars === 2) pending = out.at(-1)?.chords ?? []
        }
      } else if (item.kind === 'rest') chords.push(REST)
      else if (item.kind === 'bass') report(`a bass note with no chord (W/${item.bass}) is left out`)
      else {
        if (item.alt) report(`the alternate chord ${item.alt} is left out`)
        const m = irealChord(item.text)
        if (m.note) report(m.note)
        if (m.chord !== null) chords.push(m.chord)
      }
    }
    const supported = bar.time === undefined || METRES.has(bar.time)
    if (!supported) report(`${bar.time} is not a metre the sheets have; read as 4/4`)
    const time = bar.time === undefined ? undefined : supported ? bar.time : '4/4'
    const navs = bar.comments.flatMap((c) => {
      const nav = navOf(c)
      if (!nav) report(`the comment "${c}" is left out`)
      return nav ? [nav] : []
    })
    out.push({ n, bar, chords, navs, ...(time ? { time } : {}) })
  }
  return { value: out, diagnostics }
}

type Section = Readonly<{ base: string; bars: readonly Played[] }>

function sections(played: readonly Played[]): readonly Section[] {
  return played.reduce<Section[]>((out, p, i) => {
    if (p.bar.section !== undefined || i === 0) return [...out, { base: baseName(p.bar.section ?? 'A'), bars: [p] }]
    const last = out.at(-1) as Section
    return [...out.slice(0, -1), { ...last, bars: [...last.bars, p] }]
  }, [])
}

type Ending = Readonly<{ n: number; first: number; last: number }>
type Block = Readonly<{ sec: Section; copy?: true; endings?: readonly Ending[] }>

/** a section as written: with its endings, or followed by a copy of it when { } repeats it whole */
function blocksOf(sec: Section, at: readonly string[]): Parsed<readonly Block[]> {
  const bars = sec.bars
  const diagnostics: Diagnostic[] = []
  const report = (p: Played, message: string) => diagnostics.push(diag(p.n, `${at[p.n - 1]}: ${message}`))
  const counted = bars.find((p) => p.bar.count !== undefined && p.bar.count !== 2)
  if (counted) report(counted, `played ${counted.bar.count} times; written as twice`)
  const starts = bars.flatMap((p, i) => (p.bar.ending ? [{ n: p.bar.ending, i }] : []))
  const opens = bars[0]?.bar.open === true
  if (opens && starts.length) {
    const endings = starts.map(({ n, i }, j) => ({ n, first: i + 1, last: starts[j + 1]?.i ?? bars.length }))
    return { value: [{ sec, endings }], diagnostics }
  }
  if (opens && bars.at(-1)?.bar.close) return { value: [{ sec }, { sec, copy: true }], diagnostics }
  const partial = bars.find((p) => p.bar.open || p.bar.close || p.bar.ending)
  if (partial) report(partial, 'a repeat that isn’t a whole section is written out once')
  return { value: [{ sec }], diagnostics }
}

/** a letter that comes more than once is numbered A1, A2… (a copy counts) */
function names(blocks: readonly Block[]): readonly string[] {
  const total = new Map<string, number>()
  for (const b of blocks) total.set(b.sec.base, (total.get(b.sec.base) ?? 0) + 1)
  const seen = new Map<string, number>()
  return blocks.map((b) => {
    const k = (seen.get(b.sec.base) ?? 0) + 1
    seen.set(b.sec.base, k)
    return (total.get(b.sec.base) ?? 1) > 1 ? `${b.sec.base}${k}` : b.sec.base
  })
}

/** the section's metre from its bar 1 (its own mark, else the one running) and its changes after */
function metresOf(bars: readonly Played[], running: string): Readonly<{ start: string; changes: readonly string[]; end: string }> {
  const start = bars[0]?.time ?? running
  let now = start
  const changes = bars.slice(1).flatMap((p, i) => {
    if (p.time === undefined || p.time === now) return []
    now = p.time
    return [`@time ${i + 2} ${p.time}`]
  })
  return { start, changes, end: now }
}

/** the chord sounding as a bar starts: the last one played before it */
const heldInto = (played: readonly Played[], n: number): string | undefined => played.slice(0, n - 1).flatMap((p) => p.chords).at(-1)

type Context = Readonly<{ name: string; source: string; songTime: string; running: string; held?: string }>

/** a block's lines, given the song's metre, the metre running into it and the chord held into it */
function writeBlock(b: Block, { name, source, songTime, running, held }: Context): Readonly<{ text: string; end: string }> {
  const { start, changes, end } = metresOf(b.sec.bars, running)
  if (b.copy) return { text: `section: ${name}\ncopy: ${source}\n`, end }
  const bars = b.sec.bars
  // a chord holds only within its section: one opening on a held bar restates it
  const chordsOf = (p: Played, i: number): readonly string[] => (i === 0 && !p.chords.length && held !== undefined ? [held] : p.chords)
  const rows = bars.flatMap((p, i) => chordsOf(p, i).map((c) => `${i + 1} | ${c}`))
  const lastRow = bars.reduce((last, p, i) => (chordsOf(p, i).length ? i + 1 : last), 0)
  const marks = bars.flatMap((p, i) => [
    ...(p.bar.segno ? [`@segno ${i + 1}`] : []),
    ...p.navs.map((nav) => `@nav ${i + 1} ${nav}`),
    ...(p.bar.coda ? [`@coda ${i + 1}`] : []),
  ])
  // in bar order; a stable sort keeps one bar's own order
  const barOf = (line: string): number => Number(line.split(' ')[1])
  const marked = [...marks, ...changes].sort((x, y) => barOf(x) - barOf(y))
  const lines = [
    `section: ${name}`,
    ...(b.sec.base === 'Verse' ? ['outside: yes'] : []),
    ...(start !== songTime ? [`time: ${start}`] : []),
    ...(lastRow < bars.length ? [`bars: ${bars.length}`] : []),
    ...rows,
    ...marked,
    ...(b.endings ?? []).map((e) => (e.first === e.last ? `@ending ${e.n} ${e.first}` : `@ending ${e.n} ${e.first} ${e.last}`)),
  ]
  return { text: lines.join('\n') + '\n', end }
}

/** the form's letters and its length in bars, played through (endings: the body twice, each ending once) */
function formOf(blocks: readonly Block[]): string | undefined {
  const inForm = blocks.filter((b) => !isOutside(b.sec.base))
  if (!inForm.length) return undefined
  const letters = inForm.flatMap((b) => Array<string>(b.endings?.length ?? 1).fill(b.sec.base)).join('')
  const bars = inForm.reduce((sum, b) => {
    const length = b.sec.bars.length
    if (!b.endings) return sum + length
    const endingBars = b.endings.reduce((s, e) => s + e.last - e.first + 1, 0)
    return sum + (length - endingBars) * b.endings.length + endingBars
  }, 0)
  return `${letters}, ${bars} ${bars === 1 ? 'bar' : 'bars'}`
}

export function irealToChart(song: IRealSong): Parsed<string> {
  const read = readMusic(song.music)
  const at = labels(read.value)
  const played = play(read.value, at)
  const blocked = sections(played.value).map((sec) => blocksOf(sec, at))
  const blocks = blocked.flatMap((b) => b.value)
  const named = names(blocks)
  const songTime = played.value[0]?.time ?? '4/4'
  const written = blocks.reduce<{ texts: readonly string[]; running: string }>(
    (acc, b, j) => {
      const first = b.sec.bars[0]?.n ?? 1
      const held = heldInto(played.value, first)
      const context = { name: named[j] as string, source: named[j - 1] ?? '', songTime, running: acc.running, ...(held !== undefined ? { held } : {}) }
      const { text, end } = writeBlock(b, context)
      return { texts: [...acc.texts, text], running: end }
    },
    { texts: [], running: songTime },
  )
  const form = formOf(blocks)
  const header = [
    `title: ${song.title}`,
    ...(song.composer ? [`composer: ${song.composer}`] : []),
    ...(song.style ? [`style: ${song.style}`] : []),
    ...(song.key ? [`key: ${song.key}`] : []),
    ...(songTime !== '4/4' ? [`time: ${songTime}`] : []),
    ...(form ? [`form: ${form}`] : []),
    'source: iReal Pro',
  ]
  const diagnostics = [...read.diagnostics, ...played.diagnostics, ...blocked.flatMap((b) => b.diagnostics)]
  // in bar order; a stable sort keeps one bar's in the order found
  return { value: [...header, '', written.texts.join('\n')].join('\n'), diagnostics: [...diagnostics].sort((a, b) => a.line - b.line) }
}

/** the song's bars, flat, as Paste bars inserts them (parseBarLine's shape): repeats filled in, sections and endings gone */
export function irealBars(song: IRealSong): Parsed<readonly (readonly string[])[]> {
  const read = readMusic(song.music)
  const played = play(read.value, labels(read.value))
  return { value: played.value.map((p) => p.chords), diagnostics: [...read.diagnostics, ...played.diagnostics].sort((a, b) => a.line - b.line) }
}

import type { Diagnostic, Parsed } from '../chart'
import { REST } from '../chord'
import { irealChord } from './chords'
import type { IRealSong } from './decode'
import { type IRealBar, readMusic } from './music'

/*
 * An iReal song as our chart text (spec "Engine", toChart.ts). Bars are played first (x/r filled in, chords mapped,
 * metres and comments read), then cut into sections at each *X mark, and at a coda: a stretch after the form that
 * opens on a Q with no letter. A { } section with endings gets @ending, one without them a copy: section after it; a }
 * with no { before it repeats from the section's start; a { … } over several sections is played out, its second pass
 * copies where it repeats a section as written. Each step returns its own diagnostics; the song's bar number
 * is their line.
 */

const METRES = new Set(['2/4', '3/4', '4/4', '5/4', '6/4'])
const NAV: readonly string[] = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
const navOf = (comment: string): string | undefined => NAV.find((n) => n.toLowerCase() === comment.replace(/\s+/g, ' ').trim().toLowerCase())

const baseName = (mark: string): string => (mark === 'i' ? 'Intro' : mark === 'V' || mark === 'v' ? 'Verse' : mark.toUpperCase())
const isOutside = (base: string): boolean => base === 'Intro' || base === 'Verse' || base === 'Coda'
const diag = (line: number, message: string): Diagnostic => ({ line, message })

/**
 * where each section starts, and its name (before A1/A2 numbering): at a *X mark, and at a coda, a bar marked Q with
 * no letter that opens a stretch after a ] } or Z, when no lettered section follows (it's after the form)
 */
function starts(bars: readonly IRealBar[]): readonly (string | undefined)[] {
  const lastLetter = bars.findLastIndex((b) => b.section !== undefined)
  return bars.map((b, i) => {
    if (b.section !== undefined) return baseName(b.section)
    if (i === 0) return 'A'
    const before = bars[i - 1] as IRealBar
    return b.coda && i > lastLetter && (before.end || before.close || before.final) ? 'Coda' : undefined
  })
}

/** each bar's place for a report, "A bar 3", by its section's name (before A1/A2 numbering) */
function labels(bars: readonly IRealBar[]): readonly string[] {
  let section = 'A'
  let k = 0
  return starts(bars).map((start) => {
    if (start !== undefined) {
      section = start
      k = 0
    }
    return `${section} bar ${++k}`
  })
}

/** readMusic's "bar N: …" as "A bar 3: …" */
const relabel = (d: Diagnostic, at: readonly string[]): Diagnostic => {
  const place = at[d.line - 1]
  return place && d.message.startsWith(`bar ${d.line}: `) ? { ...d, message: `${place}: ${d.message.slice(`bar ${d.line}: `.length)}` } : d
}

type Played = Readonly<{
  n: number // the song's bar, from 1
  bar: IRealBar
  chords: readonly string[] // empty: the chord before holds
  alts: readonly string[] | null // the bar's alternate chords, each ( ) in its chord's place; null: no alternate
  time?: string // a metre the sheets have, where this bar sets one
  navs: readonly string[]
}>

/** the bars as played: chords mapped, x/r filled from the bars before; reports what's left out; a bar's alternate chords alongside */
function play(bars: readonly IRealBar[], at: readonly string[]): Parsed<readonly Played[]> {
  const out: Played[] = []
  const diagnostics: Diagnostic[] = []
  let pending: Played | null = null // the second bar of an r
  for (const [i, bar] of bars.entries()) {
    const n = i + 1
    const report = (message: string) => diagnostics.push(diag(n, `${at[i]}: ${message}`))
    if (pending && bar.items.length) report('a two-bar repeat cut short by chords in its second bar')
    const filled = pending && !bar.items.length ? pending : null
    const chords: string[] = filled ? [...filled.chords] : []
    const alts: string[] = filled ? [...(filled.alts ?? filled.chords)] : [] // the alternate bar's chords, built beside the main bar's
    let hasAlt = filled?.alts != null
    pending = null
    for (const item of bar.items) {
      if (item.kind === 'repeat') {
        const back = out.at(-item.bars)
        if (!back) report('a repeat sign with no bar before it, left empty')
        else {
          chords.push(...back.chords)
          alts.push(...(back.alts ?? back.chords))
          if (back.alts) hasAlt = true
          if (item.bars === 2) pending = out.at(-1) ?? null
        }
      } else if (item.kind === 'rest') {
        chords.push(REST)
        alts.push(REST)
      } else if (item.kind === 'bass') report(`a bass note with no chord (W/${item.bass}) is left out`)
      else {
        // a chord's ( ) stands in its place in the alternate; one on its own has no main chord
        let main: string | null = null
        if (item.kind === 'chord') {
          const m = irealChord(item.text)
          if (m.note) report(m.note)
          main = m.chord
          if (main !== null) chords.push(main)
        }
        if (item.alt) {
          hasAlt = true
          const m = irealChord(item.alt)
          if (m.note) report(m.note)
          if (m.chord !== null) alts.push(m.chord)
        } else if (main !== null) alts.push(main)
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
    out.push({ n, bar, chords, alts: hasAlt && alts.length ? alts : null, navs, ...(time ? { time } : {}) })
  }
  return { value: out, diagnostics }
}

type Section = Readonly<{ base: string; bars: readonly Played[] }>

function sections(played: readonly Played[]): readonly Section[] {
  const opens = starts(played.map((p) => p.bar))
  return played.reduce<Section[]>((out, p, i) => {
    const start = opens[i]
    if (start !== undefined) return [...out, { base: start, bars: [p] }]
    const last = out.at(-1) as Section
    return [...out.slice(0, -1), { ...last, bars: [...last.bars, p] }]
  }, [])
}

type Ending = Readonly<{ n: number; first: number; last: number }>
const ordinal = (n: number): string => (n === 3 ? '3rd' : `${n}th`)
type Block = Readonly<{ sec: Section; copy?: true; endings?: readonly Ending[] }>

/**
 * whether each section's } (with no { before it in the section) repeats from the section's start, as iReal reads it:
 * not when a { left open in a section before is still open
 */
function fromStart(secs: readonly Section[]): readonly boolean[] {
  let open = false // a { not yet closed
  return secs.map((sec) => {
    const inherited = open
    const firstOpen = sec.bars.findIndex((p) => p.bar.open)
    const firstClose = sec.bars.findIndex((p) => p.bar.close)
    for (const p of sec.bars) {
      if (p.bar.open) open = true
      if (p.bar.close) open = false
    }
    return !inherited && firstClose >= 0 && (firstOpen < 0 || firstOpen > firstClose)
  })
}

/** a section as written: with its endings, or followed by a copy of it when { } repeats it whole */
function blocksOf(sec: Section, at: readonly string[], repeatsFromStart: boolean): Parsed<readonly Block[]> {
  const bars = sec.bars
  const diagnostics: Diagnostic[] = []
  const report = (p: Played, message: string) => diagnostics.push(diag(p.n, `${at[p.n - 1]}: ${message}`))
  const counted = bars.find((p) => p.bar.count !== undefined && p.bar.count !== 2)
  if (counted) report(counted, `played ${counted.bar.count} times; written as twice`)
  // N0 shows no number: it follows the ending before it
  const starts = bars.reduce<readonly Readonly<{ n: number; i: number; p: Played }>[]>(
    (out, p, i) => (p.bar.ending === undefined ? out : [...out, { n: p.bar.ending || (out.at(-1)?.n ?? 0) + 1, i, p }]),
    [],
  )
  const opens = bars[0]?.bar.open === true || repeatsFromStart
  if (opens && starts.length) {
    for (const { n, p } of starts) {
      if (p.bar.ending === 0) report(p, `an unnumbered ending read as ending ${n}`)
      // our endings are a 1st and a 2nd: a later one's bars stay as plain bars after the 2nd
      if (n > 2) report(p, `a ${ordinal(n)} ending is written as plain bars after the 2nd`)
    }
    const endings = starts.map(({ n, i }, j) => ({ n, first: i + 1, last: starts[j + 1]?.i ?? bars.length })).filter((e) => e.n <= 2)
    return { value: [{ sec, endings }], diagnostics }
  }
  if (opens && bars.at(-1)?.bar.close) return { value: [{ sec }, { sec, copy: true }], diagnostics }
  const partial = bars.find((p) => p.bar.open || p.bar.close || p.bar.ending !== undefined)
  if (partial) report(partial, 'a repeat that isn’t a whole section is written out once')
  return { value: [{ sec }], diagnostics }
}

/** the section whose } closes a { that opens section i, when that's a later one: a repeat over several sections */
function spanEnd(secs: readonly Section[], i: number): number | undefined {
  const sec = secs[i] as Section
  if (sec.bars[0]?.bar.open !== true || sec.bars.some((p) => p.bar.close)) return undefined
  const j = secs.findIndex((s, k) => k > i && s.bars.some((p) => p.bar.close))
  return j < 0 ? undefined : j
}

/** a bar with its ending mark gone: a 2nd ending a repeat over several sections has already placed */
const unmarked = (p: Played): Played => {
  const { ending, ...bar } = p.bar
  return ending === undefined ? p : { ...p, bar }
}

/**
 * a repeat over several sections (#394) as the two passes it plays: the sections up to the } (the 1st ending's bars
 * too), then again up to the 1st ending, the bars after the } (the 2nd ending's, when they open no section) ending the
 * last; a section the second pass plays as written is a copy, one it leaves empty is dropped
 */
function spanBlocks(span: readonly Section[], at: readonly string[]): Parsed<readonly Block[]> {
  const diagnostics: Diagnostic[] = []
  const report = (p: Played, message: string) => diagnostics.push(diag(p.n, `${at[p.n - 1]}: ${message}`))
  const last = span.at(-1) as Section
  const close = last.bars.findIndex((p) => p.bar.close)
  const tail = last.bars.slice(close + 1)
  const first = [...span.slice(0, -1), tail.length ? { ...last, bars: last.bars.slice(0, close + 1) } : last]
  const counted = first.flatMap((s) => s.bars).find((p) => p.bar.count !== undefined && p.bar.count !== 2)
  if (counted) report(counted, `played ${counted.bar.count} times; written as twice`)
  for (const p of tail.filter((p) => p.bar.ending !== undefined && p.bar.ending > 2)) report(p, `a ${ordinal(p.bar.ending as number)} ending is written as plain bars after the 2nd`)
  const ending = first.flatMap((s) => s.bars).find((p) => p.bar.ending !== undefined)?.n ?? Infinity
  const second = first.map((s) => ({ s, bars: s.bars.filter((p) => p.n < ending) })).filter((x) => x.bars.length)
  const lastPlayed = second.length - 1
  const again = second.map(({ s, bars }, k): Block => {
    const played = k === lastPlayed ? [...bars, ...tail.map(unmarked)] : bars
    return played.length === s.bars.length && played.every((p, m) => p === s.bars[m]) ? { sec: s, copy: true } : { sec: { base: s.base, bars: played } }
  })
  const rest = second.length ? [] : tail.length ? [{ sec: { base: last.base, bars: tail.map(unmarked) } }] : []
  return { value: [...first.map((sec) => ({ sec })), ...again, ...rest], diagnostics }
}

/** the song's sections as blocks: a repeat over several sections played out, each other section as blocksOf writes it */
function blocksAll(secs: readonly Section[], at: readonly string[]): Parsed<readonly Block[]> {
  const repeats = fromStart(secs)
  const list = [...secs]
  const out: Parsed<readonly Block[]>[] = []
  for (let i = 0; i < list.length; i++) {
    const j = spanEnd(list, i)
    if (j === undefined) {
      out.push(blocksOf(list[i] as Section, at, repeats[i] === true))
      continue
    }
    out.push(spanBlocks(list.slice(i, j + 1), at))
    // a 2nd ending that opens the section after the repeat is that section's start
    const next = list[j + 1]
    if (next?.bars[0]) list[j + 1] = { ...next, bars: [unmarked(next.bars[0]), ...next.bars.slice(1)] }
    i = j
  }
  return { value: out.flatMap((b) => b.value), diagnostics: out.flatMap((b) => b.diagnostics) }
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

type Context = Readonly<{ name: string; source: string; songTime: string; running: string; held?: string }>

/** a block's lines, given the song's metre, the metre running into it and the chord held into it */
function writeBlock(b: Block, { name, source, songTime, running, held }: Context): Readonly<{ text: string; end: string }> {
  const { start, changes, end } = metresOf(b.sec.bars, running)
  if (b.copy) return { text: `section: ${name}\ncopy: ${source}\n`, end }
  const bars = b.sec.bars
  // a chord holds only within its section: one opening on a held bar restates it
  const chordsOf = (p: Played, i: number): readonly string[] => (i === 0 && !p.chords.length && held !== undefined ? [held] : p.chords)
  const rows = bars.flatMap((p, i) => [...chordsOf(p, i).map((c) => `${i + 1} | ${c}`), ...(p.alts ?? []).map((c) => `alt ${i + 1} | ${c}`)])
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
    // the bars before the 1st ending once per pass; the endings, and any bars after them, once
    const body = (b.endings?.[0]?.first ?? 1) - 1
    return sum + length + body * ((b.endings?.length ?? 1) - 1)
  }, 0)
  return `${letters}, ${bars} ${bars === 1 ? 'bar' : 'bars'}`
}

export function irealToChart(song: IRealSong): Parsed<string> {
  const read = readMusic(song.music)
  const at = labels(read.value)
  const played = play(read.value, at)
  const secs = sections(played.value)
  const blocked = blocksAll(secs, at)
  const blocks = blocked.value
  const named = names(blocks)
  const songTime = played.value[0]?.time ?? '4/4'
  const written = blocks.reduce<{ texts: readonly string[]; running: string; held?: string }>(
    (acc, b, j) => {
      const { held } = acc
      // a copy names the block it repeats: the first written from its section
      const source = named[blocks.findIndex((x) => x.sec === b.sec)] ?? ''
      const context = { name: named[j] as string, source, songTime, running: acc.running, ...(held !== undefined ? { held } : {}) }
      const { text, end } = writeBlock(b, context)
      const last = b.sec.bars.flatMap((p) => p.chords).at(-1) ?? held
      return { texts: [...acc.texts, text], running: end, ...(last !== undefined ? { held: last } : {}) }
    },
    { texts: [], running: songTime },
  )
  const form = formOf(blocks)
  const header = [
    `title: ${song.title}`,
    ...(song.composer ? [`composer: ${song.composer}`] : []),
    ...(song.style ? [`style: ${song.style}`] : []),
    ...(song.style && /blues/i.test(song.style) ? ['context: blues'] : []), // a blues whatever its form (blues spec §1)
    ...(song.key ? [`key: ${song.key}`] : []),
    ...(songTime !== '4/4' ? [`time: ${songTime}`] : []),
    ...(form ? [`form: ${form}`] : []),
    'source: iReal Pro',
  ]
  const diagnostics = [...read.diagnostics.map((d) => relabel(d, at)), ...played.diagnostics, ...blocked.diagnostics]
  // in bar order; a stable sort keeps one bar's in the order found
  return { value: [...header, '', written.texts.join('\n')].join('\n'), diagnostics: [...diagnostics].sort((a, b) => a.line - b.line) }
}

/** the song's bars, flat, as Paste bars inserts them (parseBarLine's shape): repeats filled in, sections and endings gone */
export function irealBars(song: IRealSong): Parsed<readonly (readonly string[])[]> {
  const read = readMusic(song.music)
  const at = labels(read.value)
  const played = play(read.value, at)
  // the editor holds no alternates (#469): each one is reported as left out
  const dropped = read.value.flatMap((bar, i) =>
    bar.items.flatMap((item) => {
      const alt = item.kind === 'alt' || item.kind === 'chord' ? item.alt : undefined
      return alt ? [diag(i + 1, `${at[i]}: the alternate chord ${alt} is left out`)] : []
    }),
  )
  return { value: played.value.map((p) => p.chords), diagnostics: [...read.diagnostics.map((d) => relabel(d, at)), ...played.diagnostics, ...dropped].sort((a, b) => a.line - b.line) }
}

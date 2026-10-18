import type { Diagnostic, Parsed } from '../chart'

/*
 * An unscrambled iReal music string as bars (spec "The format", "Tokens"). Bar lines | [ ] { } Z; marks between them
 * belong to the next bar written. Layout-only tokens (sizes, spacing, fermata, End) are read and dropped.
 */

export type IRealItem =
  | Readonly<{ kind: 'chord'; text: string; alt?: string }>
  | Readonly<{ kind: 'repeat'; bars: 1 | 2 }>
  | Readonly<{ kind: 'rest' }>
  | Readonly<{ kind: 'bass'; bass: string }>

export type IRealBar = Readonly<{
  items: readonly IRealItem[]
  section?: string
  time?: string
  ending?: number
  open?: true
  close?: true
  count?: number
  segno?: true
  coda?: true
  comments: readonly string[]
  final?: true
}>

type Draft = { -readonly [K in keyof IRealBar]: IRealBar[K] } & { items: IRealItem[]; comments: string[]; text: boolean }

const TOKENS: readonly (readonly [RegExp, (m: RegExpExecArray, d: Draft) => void])[] = [
  [/\s+|,/y, () => {}],
  [/T(12|\d\d)/y, (m, d) => (d.time = m[1] === '12' ? '12/8' : `${m[1]?.[0]}/${m[1]?.[1]}`)],
  [/\*([A-Za-z])/y, (m, d) => (d.section = m[1])],
  [/N(\d)/y, (m, d) => (d.ending = Number(m[1]))],
  [/<(?:\*\d\d)?([^>]*)>/y, (m, d) => {
    const text = (m[1] ?? '').trim()
    const count = /^(\d+)x$/i.exec(text)
    if (count) d.count = Number(count[1])
    else if (text) d.comments.push(text)
  }],
  [/S/y, (_, d) => (d.segno = true)],
  [/Q/y, (_, d) => (d.coda = true)],
  [/[slfUY]|p/y, (_, d) => (d.text = true)], // layout, and the slash that holds the chord
  [/x/y, (_, d) => d.items.push({ kind: 'repeat', bars: 1 })],
  [/r/y, (_, d) => d.items.push({ kind: 'repeat', bars: 2 })],
  [/n/y, (_, d) => d.items.push({ kind: 'rest' })],
  [/W\/([A-G][b#]?)/y, (m, d) => d.items.push({ kind: 'bass', bass: m[1] ?? '' })],
  [/([A-G][b#]?(?:sus|alt|add|[+\-^\dhob#])*(?:\/[A-G][b#]?)?)(?:\(([^)]*)\))?/y, (m, d) => d.items.push(m[2] ? { kind: 'chord', text: m[1] ?? '', alt: m[2] } : { kind: 'chord', text: m[1] ?? '' })],
]

const OPENS = new Set(['|', '[', '{'])
const CLOSES = new Set(['|', ']', '}', 'Z'])

export function readMusic(music: string): Parsed<readonly IRealBar[]> {
  const bars: IRealBar[] = []
  const diagnostics: Diagnostic[] = []
  const fresh = (): Draft => ({ items: [], comments: [], text: false })
  let d = fresh()
  let before = '' // the bar line that opened this stretch
  let spaces = false
  let i = 0
  const close = (line: string) => {
    const marks = d.section !== undefined || d.time !== undefined || d.ending !== undefined || d.segno || d.coda || d.comments.length > 0 || d.count !== undefined
    const held = spaces && OPENS.has(before) && CLOSES.has(line) // `|    |`: a bar of the chord before
    if (d.items.length || d.text || held || (marks && line !== '')) {
      const { text: _text, ...bar } = d
      bars.push({ ...bar, ...(line === '}' ? { close: true as const } : {}), ...(line === 'Z' ? { final: true as const } : {}) })
      d = fresh()
    } else if (line === '}' && bars.length) bars[bars.length - 1] = { ...bars[bars.length - 1]!, close: true }
    else if (line === 'Z' && bars.length) bars[bars.length - 1] = { ...bars[bars.length - 1]!, final: true }
    spaces = false
  }
  while (i < music.length) {
    const c = music[i] as string
    if (OPENS.has(c) || CLOSES.has(c)) {
      if (CLOSES.has(c)) close(c)
      if (c === '{') d.open = true
      before = c
      spaces = false
      i++
      continue
    }
    const hit = TOKENS.map(([re, act]) => {
      re.lastIndex = i
      const m = re.exec(music)
      return m ? ([m, act] as const) : null
    }).find(Boolean)
    if (!hit) {
      const bad = /\S+?(?=[\s|[\]{}Z]|$)/y
      bad.lastIndex = i
      const tok = bad.exec(music)?.[0] ?? c
      diagnostics.push({ line: bars.length + 1, message: `bar ${bars.length + 1}: "${tok}" not read` })
      i += tok.length
      continue
    }
    const [m, act] = hit
    if (/^\s+$/.test(m[0])) spaces = true
    act(m, d)
    i += m[0].length
  }
  close('')
  return { value: bars, diagnostics }
}

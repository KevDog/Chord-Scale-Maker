import type { BarView, ChartBar } from './bars'

/**
 * The bar editor's grid (docs/superpowers/proposals/editor-ux/README.md §3 B): the written sections of a barView in
 * lines of four bars, a selection on it, and how keys move the selection and typing changes a bar. A repeated
 * section (@copy) has no lines: it changes through the section it repeats. No DOM.
 */

export const BARS_PER_LINE = 4

/** a chord on the grid: its bar, and its place in the bar (0 for a bar with none) */
export type GridPos = Readonly<{ section: string; bar: number; chord: number }>
export type GridLine = Readonly<{ section: string; bars: readonly ChartBar[] }>
export type GridMove = 'next' | 'prev' | 'up' | 'down'

export function gridLines(view: BarView): GridLine[] {
  return view.sections
    .filter((s) => !s.copy)
    .flatMap((s) =>
      Array.from({ length: Math.ceil(s.bars.length / BARS_PER_LINE) }, (_, k) => ({ section: s.name, bars: s.bars.slice(k * BARS_PER_LINE, (k + 1) * BARS_PER_LINE) })),
    )
}

type Cell = Readonly<{ line: number; col: number; bar: ChartBar }>

function cellsOf(lines: readonly GridLine[]): Cell[] {
  return lines.flatMap((l, line) => l.bars.map((bar, col) => ({ line, col, bar })))
}

const lastChord = (bar: ChartBar): number => Math.max(0, bar.chords.length - 1)
const at = (section: string, bar: ChartBar, chord = 0): GridPos => ({ section, bar: bar.bar, chord })

/** where a key takes the selection: null off either end with next or prev (so Tab can leave the grid) */
export function moveInGrid(view: BarView, pos: GridPos, move: GridMove): GridPos | null {
  const lines = gridLines(view)
  const cells = cellsOf(lines)
  const k = cells.findIndex((c) => lines[c.line]?.section === pos.section && c.bar.bar === pos.bar)
  const here = cells[k]
  if (!here) return firstPos(view)
  const sectionOf = (c: Cell): string => lines[c.line]?.section ?? ''
  if (move === 'next') {
    if (pos.chord < lastChord(here.bar)) return { ...pos, chord: pos.chord + 1 }
    const next = cells[k + 1]
    return next ? at(sectionOf(next), next.bar) : null
  }
  if (move === 'prev') {
    if (pos.chord > 0) return { ...pos, chord: pos.chord - 1 }
    const prev = cells[k - 1]
    return prev ? at(sectionOf(prev), prev.bar, lastChord(prev.bar)) : null
  }
  const line = lines[here.line + (move === 'down' ? 1 : -1)]
  const bar = line?.bars[Math.min(here.col, line.bars.length - 1)]
  return line && bar ? at(line.section, bar) : pos
}

export function firstPos(view: BarView): GridPos | null {
  const line = gridLines(view)[0]
  const bar = line?.bars[0]
  return line && bar ? at(line.section, bar) : null
}

/** the position again after the chart changed: the same chord if it's still there, else the nearest on the grid */
export function placePos(view: BarView, pos: GridPos): GridPos | null {
  const s = view.sections.find((x) => x.name === pos.section && !x.copy)
  const bar = s?.bars.find((b) => b.bar === pos.bar) ?? s?.bars.findLast((b) => b.bar < pos.bar) ?? s?.bars[0]
  if (!s || !bar) return firstPos(view)
  return at(s.name, bar, Math.min(pos.chord, lastChord(bar)))
}

/** the chords that play in a bar: its own, or the one held into it */
export function soundingChords(view: BarView, section: string, bar: number): string[] {
  const bars = view.sections.find((s) => s.name === section)?.bars ?? []
  const found = bars.findLast((b) => b.bar <= bar && b.chords.length)
  if (!found) return []
  return found.bar === bar ? found.chords.map((c) => c.chord) : [found.chords.at(-1)?.chord ?? ''].filter(Boolean)
}

/**
 * a bar's chords once `text` is typed at `pos`: in place of the chord there, or as a new chord there (insert);
 * blank takes the chord out, and % is the bar before as it plays
 */
export function chordsAfterTyping(view: BarView, pos: GridPos, text: string, insert: boolean): string[] {
  const chord = text.trim()
  if (chord === '%') return soundingChords(view, pos.section, pos.bar - 1)
  const chords = view.sections.find((s) => s.name === pos.section)?.bars.find((b) => b.bar === pos.bar)?.chords.map((c) => c.chord) ?? []
  const put = chord ? [chord] : []
  return insert ? [...chords.slice(0, pos.chord), ...put, ...chords.slice(pos.chord)] : [...chords.slice(0, pos.chord), ...put, ...chords.slice(pos.chord + 1)]
}

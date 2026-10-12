import type { BarView, ChartBar } from './bars'

/**
 * A chord's place on a barView, and how the sheet editor walks and types over it: the written sections' bars in
 * order (a repeated section, @copy, has none: it changes through the section it repeats), a position on them, how
 * Tab and the arrows move it, and what a bar's chords become once something is typed. No DOM.
 */

/** a chord on the chart: its bar, and its place in the bar (0 for a bar with none) */
export type GridPos = Readonly<{ section: string; bar: number; chord: number }>
export type GridMove = 'next' | 'prev'

type Cell = Readonly<{ section: string; bar: ChartBar }>

/** the written sections' bars, in order */
const written = (view: BarView): Cell[] => view.sections.filter((s) => !s.copy).flatMap((s) => s.bars.map((bar) => ({ section: s.name, bar })))

const lastChord = (bar: ChartBar): number => Math.max(0, bar.chords.length - 1)
const at = (section: string, bar: ChartBar, chord = 0): GridPos => ({ section, bar: bar.bar, chord })

/**
 * where a key takes the position: chord by chord, then bar by bar, across sections; null off either end (so Tab can
 * leave the sheet). A position that isn't on the chart goes to the first chord, or null for a chart with none.
 */
export function moveInGrid(view: BarView, pos: GridPos, move: GridMove): GridPos | null {
  const cells = written(view)
  const k = cells.findIndex((c) => c.section === pos.section && c.bar.bar === pos.bar)
  const here = cells[k]
  if (!here) {
    const first = cells[0]
    return first ? at(first.section, first.bar) : null
  }
  if (move === 'next') {
    if (pos.chord < lastChord(here.bar)) return { ...pos, chord: pos.chord + 1 }
    const next = cells[k + 1]
    return next ? at(next.section, next.bar) : null
  }
  if (pos.chord > 0) return { ...pos, chord: pos.chord - 1 }
  const prev = cells[k - 1]
  return prev ? at(prev.section, prev.bar, lastChord(prev.bar)) : null
}

/** where the chord written on line `line` of the chart is; null for a line that isn't a written chord */
export function posOfLine(view: BarView, line: number): GridPos | null {
  for (const s of view.sections.filter((x) => !x.copy))
    for (const b of s.bars) {
      const k = b.chords.findIndex((c) => c.line === line)
      if (k >= 0) return at(s.name, b, k)
    }
  return null
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

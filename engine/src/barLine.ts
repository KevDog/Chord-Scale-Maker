import type { Diagnostic, Parsed } from './chart'
import { cellError } from './edit'

/*
 * Pasted or typed bars (docs/superpowers/proposals/editor-ux/README.md §3, "Paste bars…"), in iReal, forum and
 * lead-sheet style: `| Cm7 | F7 | Bm7 E7 |`. Each bar is its chords; an empty one is held (the chord before goes on).
 * insertBars (edit.ts) writes them into a chart.
 */

/** a bar line: | || |: :| :|| [ ] { } */
const BAR_LINE = /(:?\|\|?:?|[[\]{}])/
/** a section label (*A) or a beat slash, which the chart's rows don't write */
const SKIP = /^(\*.*|\/+)$/

/**
 * one line's bars; an empty bar (or one of slashes) is held only between two plain pipes (`| |`), not inside `] [`,
 * around `||` or when it holds just a label
 */
function lineBars(line: string): string[][] {
  const parts = line.split(BAR_LINE)
  const out: string[][] = []
  for (let i = 0; i < parts.length; i += 2) {
    const tokens = (parts[i] ?? '').split(/\s+/).filter(Boolean)
    const chords = tokens.filter((t) => !SKIP.test(t))
    const held = i > 0 && i < parts.length - 1 && parts[i - 1] === '|' && parts[i + 1] === '|' && !tokens.some((t) => t.startsWith('*'))
    if (chords.length || held) out.push(chords)
  }
  return out
}

/**
 * bars of chords from pasted text: pipes with or without the outer ones, one or more lines, `%` for the bar before
 * again (held after a bar of one chord). A chord that wouldn't read back as a chart cell, or more chords than `beats`
 * in a bar, is a diagnostic (line: the text's line, from 1); insert the bars only when there are none.
 */
export function parseBarLine(text: string, beats: number = 4): Parsed<readonly (readonly string[])[]> {
  const value: (readonly string[])[] = []
  const diagnostics: Diagnostic[] = []
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    for (const chords of lineBars(line)) {
      const before = value.at(-1) ?? []
      const bar = chords.length === 1 && chords[0] === '%' ? (before.length > 1 ? before : []) : chords
      value.push(bar)
      if (bar.length > beats) diagnostics.push({ line: i + 1, message: `more than ${beats} chords in bar ${value.length}` })
      for (const chord of bar) {
        const error = cellError(chord)
        if (error) diagnostics.push({ line: i + 1, message: `"${chord}": ${error}` })
      }
    }
  }
  return { value, diagnostics }
}

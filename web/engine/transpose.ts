import type { ChartDoc, ChartLine } from './chart'
import { resolveScale } from './chart'
import { parseChord } from './chord'
import type { RowLine } from './edit'
import { type Spelled, accFor, mod, parseRoot, pcOf, rootName, toLetter } from './pitch'
import { type ScaleKey, parseScale, simplifyRoot } from './scales'

/** an interval as letter steps plus semitones, so spellings move with it (F -> Bb is up a 4th) */
export type KeyShift = Readonly<{ steps: number; semis: number }>

/** keys offered for transposing a chart; F# and Gb both, since the spelling matters */
export const TRANSPOSE_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export const keyShift = (from: Spelled, to: Spelled): KeyShift => ({
  steps: mod(to.letter - from.letter, 7),
  semis: mod(pcOf(to) - pcOf(from), 12),
})

export function shiftNote(n: Spelled, s: KeyShift): Spelled {
  const letter = toLetter(n.letter + s.steps)
  return { letter, acc: accFor(mod(pcOf(n) + s.semis, 12), letter) }
}

/** the row's scale key when that scale is built on the chord root, else Ionian */
function rootScaleKey(row: RowLine, root: Spelled): ScaleKey {
  const text = resolveScale(row)
  if (!text) return 'ionian'
  const s = parseScale(text)
  return pcOf(s.root) === pcOf(root) ? s.key : 'ionian'
}

/**
 * one row moved by the shift (throws if its chord or scale can't be read). Roots are respelled by
 * the design rule (simplifyRoot over the scale); the chord follows its scale's root when they share
 * a pitch, and a slash bass keeps its interval from the root.
 */
function transposeRow(row: RowLine, s: KeyShift): RowLine {
  const c = parseChord(row.chord)
  let scale = row.scale
  let root = simplifyRoot(shiftNote(c.root, s), rootScaleKey(row, c.root))
  if (row.scale) {
    const parsed = parseScale(row.scale)
    const scaleRoot = simplifyRoot(shiftNote(parsed.root, s), parsed.key)
    const name = row.scale.trim().slice(row.scale.trim().search(/\s/))
    scale = rootName(scaleRoot) + name
    if (pcOf(parsed.root) === pcOf(c.root)) root = scaleRoot
  }
  let chord = rootName(root) + c.quality
  if (c.bass) {
    const letter = toLetter(root.letter + (c.bass.letter - c.root.letter))
    const acc = accFor(mod(pcOf(root) + pcOf(c.bass) - pcOf(c.root), 12), letter)
    chord += '/' + rootName(Math.abs(acc) > 1 ? simplifyRoot({ letter, acc }) : { letter, acc })
  }
  return { ...row, chord, scale }
}

/** move every row from one key to another; lines that aren't rows, and rows it can't read, stay as they are */
export function transposeChart(doc: ChartDoc, from: string, to: string): Readonly<{ doc: ChartDoc; skipped: number }> {
  const s = keyShift(parseRoot(from), parseRoot(to))
  let skipped = 0
  const lines = doc.lines.map((l): ChartLine => {
    if (l.kind !== 'row') return l
    try {
      return transposeRow(l, s)
    } catch {
      skipped++
      return l
    }
  })
  return { doc: { lines }, skipped }
}

/** the first readable chord's root, as a guess at the chart's key */
export function chartKey(doc: ChartDoc): string | null {
  for (const l of doc.lines) {
    if (l.kind !== 'row') continue
    try {
      return rootName(parseChord(l.chord).root)
    } catch {
      return null
    }
  }
  return null
}

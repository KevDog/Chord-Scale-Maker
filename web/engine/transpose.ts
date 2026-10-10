import type { ChartDoc, ChartLine } from './chart'
import { matchKeyText, resolveScale } from './chart'
import { parseChord } from './chord'
import type { RowLine } from './edit'
import { type Spelled, accFor, enharmonics, mod, parseRoot, pcOf, rootName, shiftBy, toLetter } from './pitch'
import { type ScaleKey, parseScale, SCALES, simplifyRoot, spellFrom } from './scales'

/**
 * Transposing a whole chart to another concert key (the editor's Transpose…). Web-only: roots are spelled on the
 * target key's side (spellInKey), unlike instrument parts, which use plain simplifyRoot.
 */

/** an interval as letter steps plus semitones, so spellings move with it (F -> Bb is up a 4th) */
export type KeyShift = Readonly<{ steps: number; semis: number }>

/** keys offered for transposing a chart; F# and Gb both, since the spelling matters */
export const TRANSPOSE_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export const keyShift = (from: Spelled, to: Spelled): KeyShift => ({
  steps: mod(to.letter - from.letter, 7),
  semis: mod(pcOf(to) - pcOf(from), 12),
})

export function shiftNote(n: Spelled, s: KeyShift): Spelled {
  return shiftBy(n, s.steps, s.semis)
}

/** -1 for a flat key (F, Bb … Gb), 1 for a sharp key (G, D … F#), 0 for C */
export type KeySide = -1 | 0 | 1
export function keySide(key: string): KeySide {
  const acc = spellFrom(parseRoot(key), SCALES.ionian[0]).reduce((sum, n) => sum + n.acc, 0)
  return acc < 0 ? -1 : acc > 0 ? 1 : 0
}

/**
 * a transposed root, spelled on the target key's side: Db, not C#, in Bb (Dbm7 Gb7 in a Bb Bird blues),
 * even when its scale then has a Cb or Fb. A natural beats an accidental (B, not Cb). The plain
 * simplifyRoot rule decides in C, and when the key's side would put double accidentals in the scale.
 */
export function spellInKey(n: Spelled, scale: ScaleKey, side: KeySide): Spelled {
  const fits = (o: Spelled): boolean =>
    (side < 0 ? o.acc <= 0 : o.acc >= 0) && spellFrom(o, SCALES[scale][0]).every((x) => Math.abs(x.acc) <= 1)
  const onSide = side === 0 ? [] : enharmonics(n).filter(fits).sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc))
  return onSide[0] ?? simplifyRoot(n, scale)
}

/** the row's scale key when that scale is built on the chord root, else Ionian */
function rootScaleKey(row: RowLine, root: Spelled): ScaleKey {
  const text = resolveScale(row)
  if (!text) return 'ionian'
  const s = parseScale(text)
  return pcOf(s.root) === pcOf(root) ? s.key : 'ionian'
}

/** a key moved by the shift, spelled on the target key's side, its suffix as written ("Am" -> "Cm" up a minor 3rd) */
function transposeKeyText(text: string, s: KeyShift, side: KeySide): string {
  const t = text.trim()
  const m = matchKeyText(t)
  if (!m) return text
  const minor = /^(m|-|min|minor)$/i.test(m[2] ?? '')
  const root = spellInKey(shiftNote(parseRoot(m[1] ?? 'C'), s), minor ? 'aeolian' : 'ionian', side)
  return rootName(root) + t.slice((m[1] ?? '').length)
}

/** a function is relative to its key, so only the key before its colon moves ("Db: V7/ii") */
function transposeFunction(fn: string, s: KeyShift, side: KeySide): string {
  const colon = fn.indexOf(':')
  return colon < 0 ? fn : transposeKeyText(fn.slice(0, colon), s, side) + fn.slice(colon)
}

/**
 * one row moved by the shift (throws if its chord or scale can't be read). Roots are spelled for the
 * target key (spellInKey); the chord follows its scale's root when they share a pitch, and a slash
 * bass keeps its interval from the root.
 */
function transposeRow(row: RowLine, s: KeyShift, side: KeySide): RowLine {
  const c = parseChord(row.chord)
  let scale = row.scale
  let root = spellInKey(shiftNote(c.root, s), rootScaleKey(row, c.root), side)
  if (row.scale) {
    const parsed = parseScale(row.scale)
    const scaleRoot = spellInKey(shiftNote(parsed.root, s), parsed.key, side)
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
  return { ...row, chord, scale, ...(row.function ? { function: transposeFunction(row.function, s, side) } : {}) }
}

/** move every row from one key to another; lines that aren't rows, and rows it can't read, stay as they are */
export function transposeChart(doc: ChartDoc, from: string, to: string): Readonly<{ doc: ChartDoc; skipped: number }> {
  const s = keyShift(parseRoot(from), parseRoot(to))
  const side = keySide(to)
  let skipped = 0
  const lines = doc.lines.map((l): ChartLine => {
    if (l.kind === 'key') return { ...l, key: transposeKeyText(l.key, s, side) }
    if (l.kind !== 'row') return l
    try {
      return transposeRow(l, s, side)
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

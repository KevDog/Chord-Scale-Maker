import { type Analysis, analyse } from './analysis'
import { type ChartDoc, expandRowLines, qualityScale } from './chart'
import { isRest } from './chord'
import { type ScaleLevel, scaleAtLevel } from './levels'
import { rootName } from './pitch'
import { readChord } from './qualities'

/**
 * What each chord plays (docs/superpowers/specs/2026-10-11-proposed-scales-design.md §2): a written scale is the
 * user's, at every level; a blank cell plays the analysis, the stated function's scale first, then the rules', at the
 * sheet's level; the quality's default only where the analysis doesn't reach the row. One resolver for every sheet.
 */
export type Resolved = Readonly<{
  /** null: the chord can't be read yet ("ask the user"), or it is a rest (N.C.) */
  scale: string | null
  source: 'written' | 'function' | 'rules' | 'default' | 'rest'
  /** the rule id, when the analysis chose the scale */
  rule?: string
  reason?: string
}>

/** the level is the player's, like the instrument: a view preference, never chart text */
export type ScaleView = Readonly<{ level: ScaleLevel; seed: number }>

/** the rules a blues chord gets (docs/superpowers/specs/2026-10-18-blues-analysis-design.md §2), with any D1+ before them */
const BLUES_RULE = /(^|\+)(D9|M6|m10|s4)$/
export const isBluesRule = (rule: string): boolean => BLUES_RULE.test(rule)

/** the blues key's note ("E", "Bb") when the chart reads as a blues; '' otherwise */
export const bluesTonic = (a: Analysis): string => (a.context === 'blues' && a.key ? (a.key.name.split(' ')[0] ?? '') : '')

/**
 * an analysed scale at a level: Standard as analysed; at Basic a blues chord plays the key's Blues scale (`blues`: the
 * blues key's note) and a tonic minor (rule m5) Aeolian; else its ladder or a Random pick
 */
export function atLevel(view: ScaleView, chord: string, scale: string, rule: string, line: number, blues = ''): string {
  if (view.level === 'standard') return scale
  if (view.level === 'basic' && blues && isBluesRule(rule)) return `${blues} Blues`
  const root = readChord(chord)?.root
  if (view.level === 'basic' && rule === 'm5' && root) return `${rootName(root)} Aeolian`
  return scaleAtLevel(chord, view.level, view.seed, `${line}:${chord}`, scale) ?? scale
}

/**
 * each expanded row's scale (in expandRowLines order, @copy repeats on their own rows), from one analysis: pass the
 * one the caller has already made to share it
 */
export function resolveScales(doc: ChartDoc, view: ScaleView, analysis: Analysis = analyse(doc)): ReadonlyMap<number, Resolved> {
  const byRow = new Map(analysis.rows.map((r) => [r.row, r]))
  const blues = bluesTonic(analysis)
  const out = new Map<number, Resolved>()
  expandRowLines(doc).value.forEach((row, i) => {
    if (isRest(row.chord)) return void out.set(i, { scale: null, source: 'rest' })
    if (row.scale) return void out.set(i, { scale: row.scale, source: 'written' })
    const r = byRow.get(i)
    if (r?.scale) return void out.set(i, { scale: atLevel(view, row.chord, r.scale, r.rule, row.line, blues), source: r.stated ? 'function' : 'rules', rule: r.rule, reason: r.reason })
    out.set(i, { scale: qualityScale(row), source: 'default' })
  })
  return out
}

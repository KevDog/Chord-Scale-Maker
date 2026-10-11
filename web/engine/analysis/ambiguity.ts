import { pcOf } from '../pitch'
import { readChord } from '../qualities'
import { functionCandidates, impliedTarget, parseFunction } from './functions'
import type { Analysis, Area } from './index'
import { type Detection, keyCode, keyText, modalTests, sameKey } from './keys'
import { ownNumeral } from './degrees'
import { familyOf } from './stream'

/**
 * The --ambiguous report (docs/superpowers/specs/2026-10-09-chart-functions-design.md §2): what an author could
 * settle with a function or an @key line, then the problems with the ones already written.
 */
export function ambiguities(a: Analysis): string[] {
  const out: string[] = []
  if (a.contextSource === 'detected') out.push(...nearThreshold(a.detection))
  const home = a.key
  if (a.keyFrom === 'scored' && home) out.push(`no key: line; the analysis guessed ${keyText(home)}: add  key: ${keyCode(home)}`)
  if (a.keyFrom === 'none') out.push("no key: line, and the analysis couldn't guess one: add  key: …")
  // an @key holds until the next, so a pin also returns to the area after it (unless an @key already starts that one)
  const pin = (x: Area): string => `@key ${x.section} ${x.from} ${keyCode(x.key)}`
  a.areas.forEach((x, k) => {
    if (!home || x.stated || sameKey(x.key, home)) return
    const next = a.areas[k + 1]
    out.push(`key area ${keyText(x.key)}, bars ${x.from}–${x.to}, found by cadence: pin it with  ${pin(x)}${next && !next.stated ? `  and  ${pin(next)}` : ''}`)
  })
  const seen = new Set<number>()
  for (const r of a.rows) {
    if (!r.fallback || r.stated || r.held || seen.has(r.line)) continue
    seen.add(r.line)
    const c = readChord(r.chord)
    const key = r.statedKey ?? r.key
    const chord = c ? { pc: pcOf(c.root), family: familyOf(c.quality), quality: c.quality } : null
    const own = chord?.family ? ownNumeral({ ...chord, family: chord.family }, key) : ''
    // the chord's own numeral is no idea when stating it would change nothing (it names no target)
    const idle = (t: string): boolean => {
      if (t !== own) return false
      const f = parseFunction(t)
      return typeof f === 'string' || impliedTarget(f, key) === null
    }
    const ideas = chord ? functionCandidates(chord, key).filter((t) => !idle(t)) : []
    const list = ideas.length < 2 ? (ideas[0] ?? '') : `${ideas.slice(0, -1).join(', ')} or ${ideas.at(-1)}`
    out.push(`bar ${r.bar} ${r.chord}: ${r.reason}${list ? `; if it's ${list}, choose that as its function` : ''}`)
  }
  for (const p of a.problems) out.push(`line ${p.line + 1}: ${p.message}`)
  return out
}

const bars = (n: number): string => `${Number(n.toFixed(2))} bar${n === 1 ? '' : 's'}`

/**
 * the report's context line (docs/superpowers/specs/2026-10-10-chart-context-design.md): which decided, and for the
 * detection what it read. "context: modal (detected: 0 of 8 chords in cadences, median chord 2 bars)"
 */
export function contextLine(a: Analysis): string {
  if (a.contextSource === 'stated') return `context: ${a.context} (stated)`
  const d = a.detection
  if (d.blues) return `context: blues (detected: ${d.blues === 'form' ? 'a 12-bar blues' : 'a blues in the first 12-bar section'}, I7 in bar 1 and IV7 in bar 5)`
  // the dominants are named only when they alone kept the chart from modal
  const [few, long, poor] = modalTests(d)
  const guard = few && long && !poor
  return `context: ${a.context} (detected: ${d.inCadence} of ${d.chords} chords in cadences, median chord ${bars(d.medianBars)}${guard ? `, but ${d.dominants} of ${d.chords} dominant 7ths` : ''})`
}

/**
 * --ambiguous: a modal test that one chord more or less would flip, where flipping it flips the context. A blues is
 * found by its form, not by counting, so it has none.
 */
function nearThreshold(d: Detection): string[] {
  if (d.blues || !d.chords) return []
  const tests = modalTests(d)
  const context = tests.every(Boolean) ? 'modal' : 'functional'
  const mid = Math.floor(d.lengths.length / 2)
  // a cadence takes two chords, so from none no single chord adds one; and a second root takes a second dominant,
  // so a one-chord chart is near neither cut
  const several = d.chords >= 2
  const near = [
    tests[0] ? d.inCadence > 0 && d.inCadence + 1 >= d.chords / 3 : d.inCadence - 1 < d.chords / 3,
    tests[1] ? (d.lengths[mid - 1] ?? 2) < 2 : (d.lengths[mid + 1] ?? 0) >= 2,
    tests[2] ? several && d.dominants >= 1 && d.dominants + 1 > d.chords / 2 : d.dominants - 1 <= d.chords / 2,
  ]
  const consider = `; consider  context: ${context}`
  const why = [
    `${d.inCadence} of ${d.chords} chords in cadences (under a third is modal)`,
    `the median chord ${bars(d.medianBars)} (2 bars or more is modal)`,
    `${d.dominants} of ${d.chords} chords dominant 7ths (over half, on more than one root, is not modal)`,
  ]
  return tests.flatMap((_, k) => {
    // flipping this test alone must change the context
    const flipped = tests.map((t, j) => (j === k ? !t : t)).every(Boolean) ? 'modal' : 'functional'
    if (!near[k] || flipped === context) return []
    if (k === 1 && d.medianBars === 2) return [`context: ${context} by the median exactly (2 bars)${consider}`]
    return [`context: ${context} by one chord: ${why[k]}${consider}`]
  })
}

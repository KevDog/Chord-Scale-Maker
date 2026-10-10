import { pcOf } from '../pitch'
import { readChord } from '../qualities'
import { functionCandidates } from './functions'
import type { Analysis } from './index'
import { keyCode, keyText, sameKey } from './keys'
import { ownNumeral } from './numerals'
import { familyOf } from './stream'

/**
 * The --ambiguous report (docs/superpowers/specs/2026-10-09-chart-functions-design.md §2): what an author could
 * settle with a function or an @key line, then the problems with the ones already written.
 */
export function ambiguities(a: Analysis): string[] {
  const out: string[] = []
  const home = a.key
  if (a.keyFrom === 'scored' && home) out.push(`no key: line; the analysis guessed ${keyText(home)}: add  key: ${keyCode(home)}`)
  for (const x of a.areas)
    if (home && !x.stated && !sameKey(x.key, home)) out.push(`key area ${keyText(x.key)}, bars ${x.from}–${x.to}, found by cadence: pin it with  @key ${x.section} ${x.from} ${keyCode(x.key)}`)
  const seen = new Set<number>()
  for (const r of a.rows) {
    if (!r.fallback || r.stated || r.held || seen.has(r.line)) continue
    seen.add(r.line)
    const c = readChord(r.chord)
    const key = r.statedKey ?? r.key
    const chord = c ? { pc: pcOf(c.root), family: familyOf(c.quality), quality: c.quality } : null
    const own = chord?.family ? ownNumeral({ ...chord, family: chord.family }, key) : ''
    const ideas = chord ? functionCandidates(chord, key).filter((t) => t !== own) : []
    const list = ideas.length < 2 ? (ideas[0] ?? '') : `${ideas.slice(0, -1).join(', ')} or ${ideas.at(-1)}`
    out.push(`bar ${r.bar} ${r.chord}: ${r.reason}${list ? `; if it's ${list}, choose that as its function` : ''}`)
  }
  for (const p of a.problems) out.push(`line ${p.line + 1}: ${p.message}`)
  return out
}

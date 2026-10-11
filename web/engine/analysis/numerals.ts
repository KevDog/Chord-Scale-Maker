import { diatonic, hasRelatedII, isDominantLike, isTonicType, type Key } from './keys'
import { degreeOf, ownNumeral, SUFFIX } from './degrees'
import { ascends, type Context, type Decision, towardV7 } from './rules'
import { downFifth, downHalf, type Entry, interval, nextOf, prevOf } from './stream'

/**
 * Each chord's Roman numeral in its key area, for the Changes sheet (docs/plan-changes.md): its degree with its
 * quality (IVmaj7, ii7, iiø7, vii°7), and for a dominant, or the ii of a ii–V, what it leads to (V7/ii, subV7,
 * ii7/V). Relative to the key, so the same for every instrument.
 */

/** "/ii", or nothing when the chord it leads to is the key's own tonic */
const of = (target: Pick<Entry, 'pc' | 'family'>, key: Key): string => (target.pc === key.tonic ? '' : `/${degreeOf(target, key)}`)
/** the chromatic degrees spelled sharp, for a °7 that leads up a half step (the accidental carries the direction) */
const SHARP: Readonly<Record<number, string>> = { 1: '♯i', 3: '♯ii', 6: '♯iv', 8: '♯v', 10: '♯vi' }

export function numeral(ctx: Context, i: number, decision: Decision): string {
  const e = ctx.stream[i]
  if (!e?.family) return '?'
  const key = ctx.keys[i] ?? ctx.global
  if (ctx.modal) return ownNumeral(e, key)
  const n = nextOf(ctx.stream, i)
  const p = prevOf(ctx.stream, i)
  if (e.family === 'dim' && ascends(e, n)) return `${SHARP[interval(key.tonic, e.pc)] ?? degreeOf(e, key)}°7` // vii°7 of the next chord (by its bass: ♯ii°7 → I/3): ♯i°7
  if (e.family === 'dominant' || e.quality === '7sus4') {
    const seven = e.family === 'dominant' ? '7' : '7sus4'
    if (n && downHalf(e, n) && decision.rule.includes('D2')) return `subV${seven}${of(n, key)}`
    if (n && downFifth(e, n) && !isDominantLike(n)) return `V${seven}${of(n, key)}`
    const toward = towardV7(ctx, i)
    if (toward) return toward === 'link' ? 'V7/V' : '→' // into the key's V7: the Rhythm bridge's → → V7/V
    if (n && downFifth(e, n)) return ownNumeral(e, key) // any other extended dominant: its own degree (a blues I7 → IV7)
    if (n && interval(e.pc, n.pc) === 2 && n.family === 'major') return `♭VII${seven}${of(n, key)}` // the back door
    if (p && interval(e.pc, p.pc) === 5 && isTonicType(p)) return `V${seven}${of(p, key)}` // V7 of the chord before
    if (hasRelatedII(ctx.stream, i) && p) return `V${seven}${of({ pc: (e.pc + 5) % 12, family: p.family === 'halfdim' ? 'minor' : 'major' }, key)}`
    return ownNumeral(e, key)
  }
  if ((e.family === 'minor' || e.family === 'halfdim') && n && isDominantLike(n) && interval(e.pc, n.pc) === 5) {
    // the ii of a ii–V: a diatonic chord of a major key prints its degree (iii7, vi7, viiø7); else named for the chord the V goes to
    if (!key.minor && diatonic(e, key)) return ownNumeral(e, key)
    const t = nextOf(ctx.stream, e.next)
    const suffix = e.family === 'halfdim' ? 'ø7' : (SUFFIX[e.quality] ?? '')
    if (t && downFifth(n, t) && isTonicType(t)) return `ii${suffix}${of(t, key)}`
    if (t && interval(n.pc, t.pc) === 2 && t.family === 'major') return `iv${suffix}${of(t, key)}` // the back door's iv
    // a ii–V that doesn't land: named for the chord it implies (a major one, or minor after a ø7)
    return `ii${suffix}${of({ pc: (n.pc + 5) % 12, family: e.family === 'halfdim' ? 'minor' : 'major' }, key)}`
  }
  return ownNumeral(e, key)
}

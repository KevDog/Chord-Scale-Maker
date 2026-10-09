import { hasRelatedII, isDominantLike, type Key } from './keys'
import { type Context, type Decision, roman } from './rules'
import { downFifth, downHalf, type Entry, interval, nextOf, prevOf } from './stream'

/**
 * Each chord's Roman numeral in its key area, for the Changes sheet (docs/plan-changes.md): its degree with its
 * quality (IVmaj7, ii7, iiø7, vii°7), and for a dominant, or the ii of a ii–V, what it leads to (V7/ii, subV7,
 * ii7/V). Relative to the key, so the same for every instrument.
 */

const SUFFIX: Readonly<Record<string, string>> = {
  maj: '',
  Maj7: 'maj7',
  'Maj7#11': 'maj7',
  'Maj7#5': 'maj7♯5',
  '6': '6',
  m: '',
  m7: '7',
  m6: '6',
  mMaj7: '(maj7)',
  m7b5: 'ø7',
  dim7: '°7',
  '7sus4': '7sus',
  '7sus4b9': '7sus',
}
/** "bVII" -> "♭VII" */
const glyph = (r: string): string => r.replace(/^b/, '♭').replace(/^#/, '♯')
const degreeOf = (e: Pick<Entry, 'pc' | 'family'>, key: Key): string => glyph(roman(e, key))
const own = (e: Entry, key: Key): string => degreeOf(e, key) + (e.family === 'dominant' ? '7' : (SUFFIX[e.quality] ?? ''))
/** "/ii", or nothing when the chord it leads to is the key's own tonic */
const of = (target: Pick<Entry, 'pc' | 'family'>, key: Key): string => (target.pc === key.tonic ? '' : `/${degreeOf(target, key)}`)
const isTonicType = (e: Entry | undefined): e is Entry => e?.family === 'major' || e?.family === 'minor'

export function numeral(ctx: Context, i: number, decision: Decision): string {
  const e = ctx.stream[i]
  if (!e?.family) return '?'
  const key = ctx.keys[i] ?? ctx.global
  if (ctx.modal) return own(e, key)
  const n = nextOf(ctx.stream, i)
  const p = prevOf(ctx.stream, i)
  if (e.family === 'dominant' || e.quality === '7sus4') {
    const seven = e.family === 'dominant' ? '7' : '7sus'
    if (n && downHalf(e, n) && decision.rule.includes('D2')) return `subV${seven}${of(n, key)}`
    if (n && downFifth(e, n) && !isDominantLike(n)) return `V${seven}${of(n, key)}`
    if (n && downFifth(e, n)) return own(e, key) // an extended dominant: its own degree (the Rhythm bridge's III7 VI7 II7)
    if (n && interval(e.pc, n.pc) === 2 && n.family === 'major') return `♭VII${seven}${of(n, key)}` // the back door
    if (p && interval(e.pc, p.pc) === 5 && isTonicType(p)) return `V${seven}${of(p, key)}` // V7 of the chord before
    if (hasRelatedII(ctx.stream, i) && p) return `V${seven}${of({ pc: (e.pc + 5) % 12, family: p.family === 'halfdim' ? 'minor' : 'major' }, key)}`
    return own(e, key)
  }
  if ((e.family === 'minor' || e.family === 'halfdim') && n && isDominantLike(n) && interval(e.pc, n.pc) === 5) {
    // the ii of a ii–V: named for the chord the V goes to
    const t = nextOf(ctx.stream, e.next)
    const suffix = e.family === 'halfdim' ? 'ø7' : (SUFFIX[e.quality] ?? '')
    if (t && downFifth(n, t) && isTonicType(t)) return `ii${suffix}${of(t, key)}`
    if (t && interval(n.pc, t.pc) === 2 && t.family === 'major') return `iv${suffix}${of(t, key)}` // the back door's iv
    // a ii–V that doesn't land: named for the chord it implies (a major one, or minor after a ø7)
    return `ii${suffix}${of({ pc: (n.pc + 5) % 12, family: e.family === 'halfdim' ? 'minor' : 'major' }, key)}`
  }
  return own(e, key)
}

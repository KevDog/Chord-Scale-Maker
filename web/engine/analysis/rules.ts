import { rootName } from '../pitch'
import { degree, diatonic, hasRelatedII, impliedDiatonic, isDominantLike, type Key, makeKey, reference } from './keys'
import { downFifth, downHalf, type Entry, interval, nextOf, prevOf } from './stream'

/**
 * Passes 3 and 4 (docs/plan-analysis.md §6–7): each chord's function in its local key, and the scale the rules give
 * it, with the rule's id and a reason a player would say. Dominants derive their tensions from a reference scale
 * (principle 4); the other families read their scale off the function.
 */

export type Context = Readonly<{
  stream: readonly Entry[]
  keys: readonly Key[]
  global: Key
  blues: Key | null
  modal: boolean
}>

/** one chord's verdict: null scale when no rule reaches it */
export type Decision = Readonly<{ scale: string | null; rule: string; fn: string; reason: string }>

// —— names ——

/** the written names, as chord_scales.json spells them (what the scale menus write) */
const NAME = {
  mixolydian: 'Mixolydian',
  lydianDominant: 'Lydian Dominant',
  mixolydianB6: 'Mixolydian b6',
  phrygianDominant: 'Phrygian Dominant',
  halfWhole: 'Half-Whole Diminished',
  wholeTone: 'Whole Tone',
  altered: 'Altered',
  spanishPhrygian: 'Spanish Phrygian',
  ionian: 'Ionian',
  lydian: 'Lydian',
  lydianAugmented: 'Lydian Augmented',
  dorian: 'Dorian',
  aeolian: 'Aeolian',
  phrygian: 'Phrygian',
  melodicMinor: 'Melodic Minor',
  locrian: 'Locrian',
  locrianN2: 'Locrian natural 2',
  wholeHalf: 'Whole-Half Diminished',
} as const

const DEGREES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']
/** "ii", "bVII", "V": the entry's degree in the key, lower case for minor-type chords */
export function roman(e: Pick<Entry, 'pc' | 'family'>, key: Key): string {
  const d = DEGREES[interval(key.tonic, e.pc)] ?? '?'
  return e.family === 'minor' || e.family === 'halfdim' || e.family === 'dim' ? d.toLowerCase() : d
}
/** "Bb" for a major key, "G minor" for a minor one */
const keyText = (key: Key): string => (key.minor ? key.name : key.name.replace(/ major$/, ''))

const named = (e: Entry, scale: string): string => `${e.root ? rootName(e.root) : '?'} ${scale}`

// —— dominants: tension slots ——

type Ninth = '9' | 'b9' | 'b9#9'
type Slots = Readonly<{ n9: Ninth; n11: '11' | '#11'; n13: '13' | 'b13' }>
type Pins = Partial<Slots> & Readonly<{ all?: true }>

const NATURAL: Slots = { n9: '9', n11: '11', n13: '13' }
const LYDIAN_DOMINANT: Slots = { n9: '9', n11: '#11', n13: '13' }

/** principle 2: the tensions a dominant's symbol writes down ("13b9", "7#5", "alt") */
export function pins(symbol: string): Pins {
  const s = symbol.replace(/[(),\s]/g, '')
  if (/alt/.test(s)) return { n9: 'b9#9', n11: '#11', n13: 'b13', all: true }
  const p: { n9?: Ninth; n11?: '11' | '#11'; n13?: '13' | 'b13' } = {}
  if (/#9/.test(s)) Object.assign(p, { n9: 'b9#9', n11: '#11' })
  else if (/b9/.test(s)) p.n9 = 'b9'
  else if (/(^|[^b#\d])9/.test(s)) p.n9 = '9'
  if (/#11|b5/.test(s)) {
    // a #11 written on its own means Lydian Dominant (the plan's D1): natural 9 and 13 unless the symbol says otherwise
    p.n11 = '#11'
    p.n9 ??= '9'
    if (!/b13|#5|\+/.test(s)) p.n13 = '13'
  }
  if (/#5|\+/.test(s)) Object.assign(p, { n13: 'b13', n11: '#11' }) // no natural 5th: the #5 is the b13
  else if (/b13/.test(s)) p.n13 = 'b13'
  else if (/(^|[^b#\d])13/.test(s)) p.n13 = '13'
  return p
}

/**
 * principle 4: each tension in the form the reference scale holds; the natural one when it holds both (a chromatic
 * root: Ab7 in Bb has A and Bb) or neither
 */
function derive(e: Entry, key: Key, harmonic = false): Slots {
  const ref = new Set(reference(key, harmonic))
  const has = (semis: number): boolean => ref.has((e.pc + semis) % 12)
  return {
    n9: !has(2) && has(1) ? 'b9' : '9',
    n11: !has(5) && has(6) ? '#11' : '11',
    n13: !has(9) && has(8) ? 'b13' : '13',
  }
}

/** §7.1's table: tensions to a dominant scale */
function dominantScale(s: Slots): string {
  if (s.n9 === '9') return s.n11 === '11' ? (s.n13 === '13' ? NAME.mixolydian : NAME.mixolydianB6) : s.n13 === '13' ? NAME.lydianDominant : NAME.wholeTone
  if (s.n9 === 'b9') return s.n11 === '11' ? (s.n13 === 'b13' ? NAME.phrygianDominant : NAME.halfWhole) : s.n13 === '13' ? NAME.halfWhole : NAME.altered
  return s.n11 === '11' ? NAME.spanishPhrygian : s.n13 === '13' ? NAME.halfWhole : NAME.altered
}

const SLOTS = ['n9', 'n11', 'n13'] as const
/** a slot's value as a player names its notes ("b9#9" -> b9, #9); nothing for the natural ones */
const notes = (v: string): string[] => (v === 'b9#9' ? ['b9', '#9'] : v === '9' || v === '11' || v === '13' ? [] : [v])
const list = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** where the tensions came from: "b9 and b13 are in the key", "the 13 from the symbol", "natural tensions" */
function tensionReason(derived: Slots, pinned: Pins): string {
  const fromKey: string[] = []
  const fromSymbol: string[] = []
  for (const slot of SLOTS) {
    const pin = pinned[slot]
    if (pin !== undefined && pin !== derived[slot]) fromSymbol.push(...(notes(pin).length ? notes(pin) : [pin]))
    else fromKey.push(...notes(derived[slot]))
  }
  const parts = [
    fromKey.length === 1 ? `the ${fromKey[0]} is in the key` : fromKey.length ? `${list(fromKey)} are in the key` : '',
    fromSymbol.length === 1 ? `the ${fromSymbol[0]} from the symbol` : fromSymbol.length ? `${list(fromSymbol)} from the symbol` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'natural tensions'
}

/** the slots the symbol changes from the rule's, as notes: "b9" */
const changedBy = (base: Slots, pinned: Pins): string[] => SLOTS.flatMap((slot) => (pinned[slot] !== undefined && pinned[slot] !== base[slot] ? notes(pinned[slot] ?? '') : []))

/**
 * the symbol's pins over the rule's slots, and the scale they name. A rule that derives its tensions from a key says
 * where each came from; one that sets them (subV7: Lydian Dominant) says which the symbol changed. D1+ marks a scale
 * the symbol moved.
 */
function dominantDecision(e: Entry, rule: string, fn: string, base: Slots, why: string, derived: boolean): Decision {
  const p = pins(e.symbol)
  const slots: Slots = { ...base, ...p }
  const moved = dominantScale(slots) !== dominantScale(base)
  const symbolNotes = changedBy(base, p)
  const reason = derived ? `${why}: ${tensionReason(base, p)}` : moved && symbolNotes.length ? `${why}; ${list(symbolNotes)} from the symbol` : why
  return { scale: named(e, dominantScale(slots)), rule: moved ? `D1+${rule}` : rule, fn, reason }
}

/** the end of a chain of dominants each resolving down a fifth into the next */
function chainEnd(ctx: Context, i: number): Entry | undefined {
  let j: number | null = i
  for (let guard = 0; guard < ctx.stream.length && j !== null; guard++) {
    const n = nextOf(ctx.stream, j)
    const here: Entry | undefined = ctx.stream[j]
    if (!here || !n || !downFifth(here, n)) return undefined
    if (!isDominantLike(n)) return n
    j = here.next
  }
  return undefined
}

function dominant(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const p = prevOf(ctx.stream, i)
  const pin = pins(e.symbol)
  if (pin.all) return { scale: named(e, NAME.altered), rule: 'D1', fn: 'altered dominant', reason: 'from the symbol: altered' }
  if (ctx.modal) return dominantDecision(e, 'D7', 'modal dominant', NATURAL, 'modal: its own mode', false)
  // a tritone substitute lands on a chord of its own; into a ø7 or °7 it is the V of what follows (Fm7 Bb7 | Aø7)
  if (n && downHalf(e, n) && n.family !== 'halfdim' && n.family !== 'dim') return dominantDecision(e, 'D2', `subV7 of ${n.chord}`, LYDIAN_DOMINANT, `tritone substitute: resolves down a half step to ${n.chord}`, false)
  if (n && downFifth(e, n) && isDominantLike(n)) {
    const end = chainEnd(ctx, i)
    if (end?.root && end.family === 'minor') {
      const minor = makeKey(end.root, true)
      return dominantDecision(e, "D3'", `extended dominant into ${keyText(minor)}`, derive(e, minor), `V7 of ${n.chord}, on the way to ${keyText(minor)}`, true)
    }
    return dominantDecision(e, 'D3', `extended dominant (V7 of ${n.chord})`, NATURAL, `extended dominant: V7 of ${n.chord}`, false)
  }
  if (n?.root && downFifth(e, n) && n.family === 'minor' && p && isDominantLike(p) && downFifth(p, e)) {
    // the last link of a chain of dominants into a minor chord: that minor key, as for the links before it
    const minor = makeKey(n.root, true)
    return dominantDecision(e, "D3'", `V7 of ${keyText(minor)}, at the end of a chain of dominants`, derive(e, minor, true), `V7 of ${keyText(minor)}, the chain's last link`, true)
  }
  if (n && downFifth(e, n)) {
    const tonic = n.pc === key.tonic
    const harmonic = tonic && key.minor && n.family === 'minor'
    const fn = tonic ? `V7 of ${keyText(key)}` : `V7/${roman(n, key)} in ${keyText(key)}`
    return dominantDecision(e, 'D4', fn, derive(e, key, harmonic), fn, true)
  }
  if (n && interval(e.pc, n.pc) === 2 && n.family === 'major') {
    // the back door: bVII7 up a step to a major chord (Bbm7 Eb7 | FMaj7), in the key it sits in
    const fn = `back door bVII7 to ${n.chord}`
    return dominantDecision(e, 'D5', fn, derive(e, key), fn, true)
  }
  if (p && interval(e.pc, p.pc) === 5 && (p.family === 'major' || p.family === 'minor')) {
    const harmonic = key.minor && p.pc === key.tonic && p.family === 'minor'
    return dominantDecision(e, 'D4', `V7 of the ${p.chord} before it`, derive(e, key, harmonic), `V7 of the ${p.chord} before it`, true)
  }
  if (hasRelatedII(ctx.stream, i)) {
    const ii = p as Entry
    const implied = { pc: (e.pc + 5) % 12, family: ii.family === 'halfdim' ? ('minor' as const) : ('major' as const) }
    if (!impliedDiatonic(implied.pc, implied.family === 'minor', key)) {
      const target: Key = { tonic: implied.pc, minor: implied.family === 'minor', name: '' } // the pair's own key
      return dominantDecision(e, 'D4', 'passing ii–V', derive(e, target, target.minor), 'passing ii–V: its own key', implied.family === 'minor')
    }
    return dominantDecision(e, 'D4', `V7/${roman(implied, key)} in ${keyText(key)} (the ${roman(implied, key)} never arrives)`, derive(e, key), `V7/${roman(implied, key)} in ${keyText(key)}`, true)
  }
  if (e.bars >= 4) return dominantDecision(e, 'D7', 'static dominant', NATURAL, 'static dominant: its own mode', false)
  if (ctx.blues && (e.pc === ctx.blues.tonic || interval(ctx.blues.tonic, e.pc) === 5)) {
    const fn = e.pc === ctx.blues.tonic ? 'I7 of the blues' : 'IV7 of the blues'
    return dominantDecision(e, 'D5', fn, derive(e, ctx.blues), fn, true)
  }
  if (reference(key).includes(e.pc) || reference(key, true).includes(e.pc)) {
    const fn = `${roman(e, key)}7 in ${keyText(key)}, not resolving`
    return dominantDecision(e, 'D5', fn, derive(e, key), fn, true)
  }
  return dominantDecision(e, 'D6', 'chromatic dominant', LYDIAN_DOMINANT, 'a chromatic dominant with nowhere to go: Lydian Dominant, its own key', false)
}

// —— the other families ——

function major(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const d = degree(e, key)
  const fn = `${roman(e, key)} in ${keyText(key)}`
  if (e.quality === 'Maj7#11') return { scale: named(e, NAME.lydian), rule: 'M1', fn, reason: 'from the symbol: #11' }
  if (e.quality === 'Maj7#5') return { scale: named(e, NAME.lydianAugmented), rule: 'M2', fn, reason: 'from the symbol: #5' }
  if (ctx.modal) return { scale: named(e, NAME.lydian), rule: 'M5', fn: 'modal major', reason: 'modal major: Lydian' }
  if (!key.minor && d === 0) return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: 'tonic: the 4th is in the key' }
  if (key.minor && d === 3) return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: `bIII of ${keyText(key)}: the relative major itself` }
  if (!key.minor && d === 7 && e.quality === 'maj') return { scale: named(e, NAME.mixolydian), rule: 'M3', fn, reason: 'V without its 7th: Mixolydian, the key’s own notes' }
  const why = !key.minor && d === 5 ? 'IV: the #4 is the key’s 7th' : 'a non-tonic major chord: Lydian'
  return { scale: named(e, NAME.lydian), rule: 'M4', fn, reason: why }
}

function minor(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const d = degree(e, key)
  const fn = `${roman(e, key)} in ${keyText(key)}`
  if (e.quality === 'mMaj7') return { scale: named(e, NAME.melodicMinor), rule: 'm1', fn, reason: 'from the symbol: minor-major 7th' }
  if (e.quality === 'm6') return { scale: named(e, NAME.dorian), rule: 'm2', fn, reason: 'a minor sixth chord: Dorian' }
  if (/b6|b13/.test(e.symbol)) return { scale: named(e, NAME.aeolian), rule: 'm3', fn, reason: 'from the symbol: b6' }
  if (ctx.modal) return { scale: named(e, NAME.dorian), rule: 'm6', fn: 'modal minor', reason: 'modal minor: Dorian' }
  if (n && isDominantLike(n) && interval(e.pc, n.pc) === 5) {
    const end = n.root ? nextOf(ctx.stream, ctx.stream[i]?.next) : undefined
    const lands = end && downFifth(n, end) && (end.family === 'major' || end.family === 'minor')
    const to = lands && end?.root ? keyText(makeKey(end.root, end.family === 'minor')) : null
    return { scale: named(e, NAME.dorian), rule: 'm4', fn: to ? `ii of the ii–V to ${to}` : `ii of ${n.chord}`, reason: to ? `ii of the ii–V to ${to}` : `ii of ${n.chord}: Dorian` }
  }
  if (key.minor && d === 0) return { scale: named(e, NAME.dorian), rule: 'm5', fn, reason: 'tonic minor: Dorian by convention' }
  if (diatonic(e, key)) {
    if (!key.minor && d === 9) return { scale: named(e, NAME.aeolian), rule: 'm7', fn, reason: 'vi: the b13 is in the key' }
    if (!key.minor && d === 4) return { scale: named(e, NAME.dorian), rule: "m7'", fn, reason: 'iii: Dorian (its Phrygian would put a b9 over the root)' }
    if (key.minor && d === 7) return { scale: named(e, NAME.phrygian), rule: 'm7', fn, reason: 'v of a minor key: the b9 is in the key' }
    return { scale: named(e, NAME.dorian), rule: 'm7', fn, reason: `${roman(e, key)}: Dorian, the key’s own notes` }
  }
  return { scale: named(e, NAME.dorian), rule: 'm8', fn: `borrowed ${roman(e, key)} in ${keyText(key)}`, reason: 'a borrowed minor chord: Dorian, its own key' }
}

function halfDiminished(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  if (ctx.modal) return { scale: named(e, NAME.locrianN2), rule: 'h1', fn: 'modal half-diminished', reason: 'modal: the melodic-minor colour, with a 9 to lean on' }
  const n = nextOf(ctx.stream, i)
  const related = n && isDominantLike(n) && interval(e.pc, n.pc) === 5
  const end = related ? nextOf(ctx.stream, ctx.stream[i]?.next) : undefined
  const to = related && end?.root && n && downFifth(n, end) && (end.family === 'minor' || end.family === 'major') ? keyText(makeKey(end.root, end.family === 'minor')) : null
  const fn = to ? `iiø7 of the ii–V to ${to}` : related ? `iiø7 of ${n?.chord}` : `${roman(e, key)}ø7 in ${keyText(key)}`
  return { scale: named(e, NAME.locrian), rule: 'h2', fn, reason: `${fn}: the b9 is in the key` }
}

function diminished(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const p = prevOf(ctx.stream, i)
  const n = nextOf(ctx.stream, i)
  const fn =
    n && interval(e.pc, n.pc) === 1 && (n.family === 'major' || n.family === 'minor')
      ? `vii°7 of ${n.chord}`
      : p && n && p.pc === n.pc && p.pc === e.pc
        ? 'auxiliary diminished'
        : 'passing diminished'
  return { scale: named(e, NAME.wholeHalf), rule: 'd1', fn, reason: `${fn}: the rootless V7b9 of the next chord` }
}

function sus(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  if (e.quality === '7sus4b9') return { scale: named(e, NAME.phrygian), rule: 's1', fn: 'sus b9', reason: 'from the symbol: sus b9' }
  const n = nextOf(ctx.stream, i)
  if (!ctx.modal && n && downFifth(e, n) && e.bars < 4) {
    const harmonic = key.minor && n.pc === key.tonic && n.family === 'minor'
    const b13 = derive(e, key, harmonic).n13 === 'b13'
    return {
      scale: named(e, b13 ? NAME.mixolydianB6 : NAME.mixolydian),
      rule: 's2',
      fn: `V7sus4 of ${n.chord}`,
      reason: b13 ? `V7sus4 of ${n.chord}: the b13 is in the key` : `V7sus4 of ${n.chord}: natural tensions`,
    }
  }
  return { scale: named(e, NAME.mixolydian), rule: 's3', fn: 'static sus', reason: 'static sus: Mixolydian' }
}

/** the rules' verdict on one entry */
export function decide(ctx: Context, i: number): Decision {
  const e = ctx.stream[i]
  switch (e?.family) {
    case 'dominant':
      return dominant(ctx, i)
    case 'major':
      return major(ctx, i)
    case 'minor':
      return minor(ctx, i)
    case 'halfdim':
      return halfDiminished(ctx, i)
    case 'dim':
      return diminished(ctx, i)
    case 'sus':
      return sus(ctx, i)
    default:
      return { scale: null, rule: '?', fn: '?', reason: 'no rule reaches this chord (it can’t be read)' }
  }
}

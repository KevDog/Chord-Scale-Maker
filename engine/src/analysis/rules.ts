import { proseGlyphs, rootName, shiftBy } from '../pitch'
import { cleanLettering, scaleKey } from '../scales'
import { degree, diatonic, hasRelatedII, impliedDiatonic, isDominantLike, type Key, keyText, makeKey, reference, sameKey, tonicName } from './keys'
import { ownNumeral, roman } from './degrees'
import { bassOf, bassPc, downFifth, downHalf, type Entry, type Family, interval, nextOf, prevOf } from './stream'

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
  /** the entries whose stated function names a target (V7/IV): the rules read that target, before R2's degree (principle 1) */
  statedTarget: readonly boolean[]
}>

/**
 * one chord's verdict: null scale when no rule reaches it; fallback: the rules could only guess (an author's function
 * would settle it); short: the reason without an aside, for a chart comment that would pass the limit (R7)
 */
export type Decision = Readonly<{ scale: string | null; rule: string; fn: string; reason: string; fallback?: true; short?: string }>

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
  wholeHalf: 'Whole-Half Diminished',
  diatonicDim: 'Diatonic Diminished',
} as const

const named = (e: Entry, scale: string): string => `${e.root ? rootName(e.root) : '?'} ${scale}`

/** the blues key when this chord is a blues chord's home: a blues context, and the chord not under an @key or section key: */
const bluesAt = (ctx: Context, i: number): Key | null => (ctx.blues && sameKey(ctx.keys[i] ?? ctx.global, ctx.blues) ? ctx.blues : null)
/** the chord's step above the blues tonic, named when it is the I, IV or V */
const BLUES_STEP: Readonly<Record<number, 'I' | 'IV' | 'V'>> = { 0: 'I', 5: 'IV', 7: 'V' }

// —— dominants: tension slots ——

type Ninth = '9' | 'b9' | 'b9#9'
export type Slots = Readonly<{ n9: Ninth; n11: '11' | '#11'; n13: '13' | 'b13' }>
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
export function dominantScale(s: Slots): string {
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
function dominantDecision(e: Entry, rule: string, fn: string, base: Slots, why: string, derived: boolean, sep = ': '): Decision {
  const p = pins(e.symbol)
  const slots: Slots = { ...base, ...p }
  const moved = dominantScale(slots) !== dominantScale(base)
  const symbolNotes = changedBy(base, p)
  const reason = derived ? `${why}${sep}${tensionReason(base, p)}` : moved && symbolNotes.length ? `${why}; ${list(symbolNotes)} from the symbol` : why
  return { scale: named(e, dominantScale(slots)), rule: moved ? `D1+${rule}` : rule, fn, reason }
}

const BLUES_ROLE = { I: 'a tonic with dominant color', IV: 'a subdominant with dominant color', V: 'a dominant that needn’t resolve' } as const
/** D9: a blues dominant, Mixolydian; written tensions still move it (D1+D9) */
function bluesDominant(e: Entry, step: 'I' | 'IV' | 'V'): Decision {
  const why = `${step}7 of the blues: ${BLUES_ROLE[step]}`
  const moved = dominantScale({ ...NATURAL, ...pins(e.symbol) }) !== NAME.mixolydian // the symbol's notes then name the scale
  const extra = step === 'IV' ? ' (the #11 is an extra color)' : ''
  return dominantDecision(e, 'D9', `${step}7 of the blues`, NATURAL, moved ? why : `${why}, Mixolydian${extra}`, false)
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

/**
 * a dominant link on its way into the key's own V7 (a dominant on degree V of its local key): 'link' when the next
 * chord is that V7 (V7/V), 'arrow' when a later link of its chain is (→); null for a chain that never reaches it, or
 * one a sus breaks (A7 D7sus4 G7)
 */
export function towardV7(ctx: Context, i: number): 'link' | 'arrow' | null {
  const e = ctx.stream[i]
  const key = ctx.keys[i] ?? ctx.global
  if (e?.family !== 'dominant') return null
  let here: Entry = e
  let j: number | null = i
  for (let step = 0; step < ctx.stream.length && j !== null; step++) {
    const n = nextOf(ctx.stream, j)
    if (!n || !downFifth(here, n) || n.family !== 'dominant') return null // a sus breaks the chain: no arrow before it
    if (interval(key.tonic, n.pc) === 7) return step === 0 ? 'link' : 'arrow'
    here = n
    j = ctx.stream[j]?.next ?? null
  }
  return null
}

const TOWARD_V7 = { link: 'V7 of V7: the dominant of the dominant', arrow: 'extended dominant: each one falls a fifth into the next' } as const

function dominant(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const p = prevOf(ctx.stream, i)
  const pin = pins(e.symbol)
  if (pin.all) return { scale: named(e, NAME.altered), rule: 'D1', fn: 'altered dominant', reason: 'from the symbol: altered' }
  if (ctx.modal) return dominantDecision(e, 'D7', 'modal dominant', NATURAL, 'modal: its own mode', false)
  // D9: the blues I7 and IV7 are decided by their degree before the chords around them (M&H p. 137: "I7 should not be
  // confused with V7/IV"): Mixolydian, though the key holds the IV7's #11 (principle 4 yields, N&G p. 105). A stated
  // function that names a target wins (principle 1): a stated V7/IV goes the usual way, to its target
  const blues = ctx.statedTarget[i] ? null : bluesAt(ctx, i)
  const step = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (step === 'I' || step === 'IV') return bluesDominant(e, step)
  // a blues V7 is decided by its degree too, unless its ii makes it a ii–V (Gm7 C7 | F7 goes the usual way); a minor
  // blues' V7 keeps the minor key's rules
  if (step === 'V' && !blues?.minor && !hasRelatedII(ctx.stream, i)) return bluesDominant(e, 'V')
  // a tritone substitute lands on a chord of its own; into a ø7 or °7 it is the V of what follows (Fm7 Bb7 | Aø7)
  if (n && downHalf(e, n) && n.family !== 'halfdim' && n.family !== 'dim') return dominantDecision(e, 'D2', `subV7 of ${n.chord}`, LYDIAN_DOMINANT, `tritone substitute: resolves down a half step to ${n.chord}`, false)
  if (n && downFifth(e, n) && isDominantLike(n)) {
    const end = chainEnd(ctx, i)
    const toward = towardV7(ctx, i)
    const words = toward ? TOWARD_V7[toward] : null
    if (end?.root && end.family === 'minor') {
      const minor = makeKey(end.root, true)
      if (words) return dominantDecision(e, 'D8', `${words}, on the way to ${keyText(minor)}`, derive(e, minor), `${words}, on the way to ${keyText(minor)}`, true)
      return dominantDecision(e, 'D8', `extended dominant into ${keyText(minor)}`, derive(e, minor), `V7 of ${n.chord}, on the way to ${keyText(minor)}`, true)
    }
    if (words) return dominantDecision(e, 'D3', words, NATURAL, words, true)
    return dominantDecision(e, 'D3', `extended dominant (V7 of ${n.chord})`, NATURAL, `extended dominant: V7 of ${n.chord}`, false)
  }
  if (n?.root && downFifth(e, n) && n.family === 'minor' && p && isDominantLike(p) && downFifth(p, e)) {
    // the last link of a chain of dominants into a minor chord: that minor key, as for the links before it
    const minor = makeKey(n.root, true)
    return dominantDecision(e, 'D8', `V7 of ${keyText(minor)}, at the end of a chain of dominants`, derive(e, minor, true), `V7 of ${keyText(minor)}, the chain's last link`, true)
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
      return dominantDecision(e, 'D4', 'extended ii–V: a side-step, its own notes', derive(e, target, target.minor), 'extended ii–V: a side-step, its own key', implied.family === 'minor')
    }
    return dominantDecision(e, 'D4', `V7/${roman(implied, key)} in ${keyText(key)} (the ${roman(implied, key)} never arrives)`, derive(e, key), `V7/${roman(implied, key)} in ${keyText(key)}`, true)
  }
  if (e.bars >= 4) return dominantDecision(e, 'D7', 'static dominant', NATURAL, 'static dominant: its own mode', false)
  if (reference(key).includes(e.pc) || reference(key, true).includes(e.pc)) {
    const fn = `${roman(e, key)}7 in ${keyText(key)}, not resolving`
    return { ...dominantDecision(e, 'D5', fn, derive(e, key), fn, true), fallback: true }
  }
  const d = degree(e, key)
  if (!key.minor && (d === 10 || d === 8 || d === 3)) {
    // ♭VII7, ♭VI7, ♭III7: borrowed from the parallel minor
    const own = ownNumeral(e, key)
    const home = n?.pc === key.tonic && n.family === 'major'
    const fn = `${own}, borrowed from the parallel minor${d === 3 ? '' : ' (subdominant minor)'}`
    return dominantDecision(e, 'D6', fn, LYDIAN_DOMINANT, `${own} from the parallel minor: Lydian Dominant${home ? ', it returns to I' : ''}`, false)
  }
  return { ...dominantDecision(e, 'D6', 'chromatic dominant', LYDIAN_DOMINANT, 'a chromatic dominant with nowhere to go: Lydian Dominant, its own key', false), fallback: true }
}

// —— the other families ——

/** a triad with a #11 written (Bb(#11)) is Lydian: the other rules' reason where they give Lydian too, else M1 */
function major(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const d = majorRules(ctx, i)
  if (e.quality !== 'maj' || !/#11/.test(e.symbol) || d.scale === named(e, NAME.lydian)) return d
  const key = ctx.keys[i] ?? ctx.global
  return { scale: named(e, NAME.lydian), rule: 'M1', fn: `${roman(e, key)} in ${keyText(key)}`, reason: 'from the symbol: #11' }
}

function majorRules(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const d = degree(e, key)
  const fn = `${roman(e, key)} in ${keyText(key)}`
  if (e.quality === 'Maj7#11') return { scale: named(e, NAME.lydian), rule: 'M1', fn, reason: 'from the symbol: #11' }
  if (e.quality === 'Maj7#5') return { scale: named(e, NAME.lydianAugmented), rule: 'M2', fn, reason: 'from the symbol: #5' }
  if (e.quality === 'aug') return { scale: named(e, NAME.wholeTone), rule: 'M2', fn, reason: 'from the symbol: augmented' }
  const blues = bluesAt(ctx, i)
  const bluesStep = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (bluesStep && (e.quality === 'maj' || e.quality === '6')) {
    return { scale: named(e, NAME.mixolydian), rule: 'M6', fn: `${bluesStep} of the blues`, reason: `${bluesStep} of the blues: a triad here implies its ♭7, Mixolydian` }
  }
  if (ctx.modal) return { scale: named(e, NAME.lydian), rule: 'M5', fn: 'modal major', reason: 'modal major: Lydian' }
  if (!key.minor && d === 0) return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: 'tonic: the 4th is in the key' }
  if (key.minor && d === 3) return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: `bIII of ${keyText(key)}: the relative major itself` }
  if (key.minor && d === 10) {
    // R6: ♭VII of a minor key, its Ionian the notes of the tonic's Dorian (N&G pp. 85, 88, 91)
    return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: proseGlyphs(`bVII of ${keyText(key)}: ${e.root ? rootName(e.root) : '?'} major, the notes of ${tonicName(key)} Dorian`) }
  }
  if (!key.minor && d === 7 && e.quality === 'maj') return { scale: named(e, NAME.mixolydian), rule: 'M3', fn, reason: 'V without its 7th: Mixolydian, the key’s own notes' }
  const p = prevOf(ctx.stream, i)
  if (!key.minor && d === 5 && p?.family === 'dominant' && (downFifth(p, e) || downHalf(p, e))) {
    // R1: IV reached by its own dominant (V7/IV, or subV7/IV a half step above) is the key of the moment
    return { scale: named(e, NAME.ionian), rule: 'M3', fn, reason: `the ${p.chord} before it makes ${e.root ? rootName(e.root) : '?'} the key of the moment: the 4th is in the key` }
  }
  if (!key.minor && (d === 1 || d === 3 || d === 8 || d === 10)) {
    // ♭II, ♭III, ♭VI, ♭VII: modal interchange, from the parallel minor (♭II from Phrygian)
    const own = ownNumeral(e, key)
    const from = `${keyText(key)} ${d === 1 ? 'Phrygian' : 'minor'}`
    return { scale: named(e, NAME.lydian), rule: 'M4', fn: `${own}, borrowed (modal interchange)`, reason: `${own}, borrowed from ${from}: Lydian (its ♯11 is in the key)` }
  }
  const why = !key.minor && d === 5 ? 'IV: the #4 is the key’s 7th' : 'a non-tonic major chord: Lydian'
  return { scale: named(e, NAME.lydian), rule: 'M4', fn, reason: why }
}

/** a related ii that is also a diatonic chord of a major key other than its ii: "; also iii of C" (dual function) */
const alsoDegree = (e: Entry, key: Key): string =>
  !key.minor && diatonic(e, key) && degree(e, key) !== 2 ? `; also ${roman(e, key)}${e.family === 'halfdim' ? 'ø7' : ''} of ${keyText(key)}` : ''

/** iii of a major key, diatonic (R4) */
const iii = (e: Entry, key: Key): boolean => !key.minor && diatonic(e, key) && degree(e, key) === 4
/** m9: iii7 is Phrygian, its only available tension the 11 (N&G p. 33; M&H pp. 23, 57); Dorian is its Advanced rung */
const iiiPhrygian = (e: Entry): Omit<Decision, 'fn'> => ({ scale: named(e, NAME.phrygian), rule: 'm9', reason: "iii: Phrygian, the key's own notes (the ♭2 is a passing note)" })

function minor(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const d = degree(e, key)
  const fn = `${roman(e, key)} in ${keyText(key)}`
  if (e.quality === 'mMaj7') return { scale: named(e, NAME.melodicMinor), rule: 'm1', fn, reason: 'from the symbol: minor-major 7th' }
  const blues = bluesAt(ctx, i)
  const bluesStep = blues?.minor ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if ((bluesStep === 'I' || bluesStep === 'IV') && ['m', 'm7', 'm6'].includes(e.quality) && !/b6|b13/.test(e.symbol)) {
    const which = bluesStep === 'I' ? 'i' : 'iv'
    return { scale: named(e, NAME.dorian), rule: 'm10', fn: `${which} of the minor blues`, reason: `${which} of the minor blues: Dorian` }
  }
  if (e.quality === 'm6') {
    // R6: the tonic m6 of a minor key takes melodic minor (M&H pp. 85–86; Chediak vol. 1 p. 341); a modal chart has no tonic function (§5.4)
    if (!ctx.modal && key.minor && d === 0) return { scale: named(e, NAME.melodicMinor), rule: 'm2', fn, reason: 'tonic minor sixth chord: melodic minor, the raised 7th is a tension' }
    return { scale: named(e, NAME.dorian), rule: 'm2', fn, reason: 'a minor sixth chord: Dorian' }
  }
  if (/b6|b13/.test(e.symbol)) return { scale: named(e, NAME.aeolian), rule: 'm3', fn, reason: 'from the symbol: b6' }
  if (ctx.modal) return { scale: named(e, NAME.dorian), rule: 'm6', fn: 'modal minor', reason: 'modal minor: Dorian' }
  if (n && isDominantLike(n) && interval(e.pc, n.pc) === 5) {
    const end = n.root ? nextOf(ctx.stream, ctx.stream[i]?.next) : undefined
    const lands = end && downFifth(n, end) && (end.family === 'major' || end.family === 'minor')
    const to = lands && end?.root ? keyText(makeKey(end.root, end.family === 'minor')) : null
    const fn = to ? `ii of the ii–V to ${to}` : `ii of ${n.chord}`
    if (iii(e, key)) return { ...iiiPhrygian(e), fn: `${fn}${alsoDegree(e, key)}` } // a diatonic iii keeps its own scale as a related ii (M&H p. 57)
    return { scale: named(e, NAME.dorian), rule: 'm4', fn: `${fn}${alsoDegree(e, key)}`, reason: to ? fn : `${fn}: Dorian` }
  }
  if (key.minor && d === 0) return { scale: named(e, NAME.dorian), rule: 'm5', fn, reason: 'tonic minor: Dorian by convention' }
  if (diatonic(e, key)) {
    if (!key.minor && d === 9) return { scale: named(e, NAME.aeolian), rule: 'm7', fn, reason: "vi: Aeolian, the key's own notes (the ♭6 is a passing note)" }
    if (iii(e, key)) return { ...iiiPhrygian(e), fn }
    if (key.minor && d === 7) return { scale: named(e, NAME.phrygian), rule: 'm7', fn, reason: "v of a minor key: Phrygian, the key's own notes (its ♭2 is a passing note)" }
    return { scale: named(e, NAME.dorian), rule: 'm7', fn, reason: `${roman(e, key)}: Dorian, the key’s own notes` }
  }
  return { scale: named(e, NAME.dorian), rule: 'm8', fn: `borrowed ${roman(e, key)} in ${keyText(key)}`, reason: 'a borrowed minor chord: Dorian, its own key', fallback: true }
}

function halfDiminished(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const related = n && isDominantLike(n) && interval(e.pc, n.pc) === 5
  const end = related ? nextOf(ctx.stream, ctx.stream[i]?.next) : undefined
  const to = related && end?.root && n && downFifth(n, end) && (end.family === 'minor' || end.family === 'major') ? keyText(makeKey(end.root, end.family === 'minor')) : null
  if (!related && !key.minor && degree(e, key) === 2) return { scale: named(e, NAME.locrian), rule: 'h2', fn: 'iiø7, borrowed', reason: `iiø7, borrowed from ${keyText(key)} minor: Locrian` }
  const fn = to ? `iiø7 of the ii–V to ${to}` : related ? `iiø7 of ${n?.chord}` : `${roman(e, key)}ø7 in ${keyText(key)}`
  if (!related && !diatonic(e, key)) return { scale: named(e, NAME.locrian), rule: 'h2', fn, reason: `${fn}: Locrian, its own mode (the chord is outside the key)`, fallback: true }
  const why = `${to ? `iiø7 of ${to}` : fn}: Locrian, the key's own notes (its ♭2 is a passing note)`
  return { scale: named(e, NAME.locrian), rule: 'h2', fn: related ? `${fn}${alsoDegree(e, key)}` : fn, reason: why, ...(related ? {} : { fallback: true as const }) }
}

type Neighbor = Pick<Entry, 'chord' | 'root' | 'pc' | 'family' | 'quality'>
/** the dominant a °7 hides, without its root: its root, the chord it is the V of, and the ii that stands between */
export type Hidden = Readonly<{ root: string; target: string; ii?: string }>

/**
 * R3a: of the four dominants a half step below the °7's notes, the one that is the V of the next chord, or of the
 * chord after it when the next is that chord's related ii (Wave: B♭°7 → Am7 D7 hides A7♭9, not E7♭9); spelled a
 * fifth above its target. null when none is.
 */
export function hiddenDominant(dim: number, next: Neighbor | undefined, after: Neighbor | undefined): Hidden | null {
  const hides = (t: Neighbor | undefined): t is Neighbor & { root: NonNullable<Entry['root']> } =>
    !!t?.root && t.pc >= 0 && [0, 3, 6, 9].some((k) => interval(dim + k - 1, t.pc) === 5)
  const fifthAbove = (t: Neighbor & { root: NonNullable<Entry['root']> }): string => rootName(shiftBy(t.root, 4, 7))
  if (hides(next)) return { root: fifthAbove(next), target: next.chord }
  const ii = !!next && (next.family === 'minor' || next.family === 'halfdim') && isDominantLike(after as Entry) && !!after && interval(next.pc, after.pc) === 5
  if (ii && hides(after)) return { root: fifthAbove(after), target: after.chord, ii: next.chord }
  return null
}

/** a passing °7's reason: the dominant it hides, or (none) a rootless dominant ♭9 */
export const passingReason = (h: Hidden | null): string =>
  h ? `passing diminished: ${h.root}7♭9 without its ${h.root}, the ${h.target}'s dominant${h.ii ? ` (${h.ii} its ii)` : ''}` : 'passing diminished: a rootless dominant ♭9'

/** R9: a °7's scale on the root the project rule spells best, or the ascending formula's lettering (cleanLettering) */
function dimScale(e: Entry, name: string): string {
  if (!e.root) return named(e, name)
  const spelled = cleanLettering(e.root, scaleKey(name))
  return `${rootName(spelled.root)} ${spelled.name ?? name}`
}

/** Q5: a °7 M&H's figures don't cover keeps the symmetric scale (N&G p. 114) */
const SYMMETRIC = '; not functioning diatonically: the symmetric scale'

/**
 * R16: a °7 a half step below the next chord's root (C♯°7 → Dm7/A, B°7 → C/G) or its bass (D♯°7 → C/E, fig. 7.9), a
 * major or minor chord: ascending to it
 */
export const ascends = (e: Pick<Entry, 'pc'>, n: Entry | undefined): n is Entry =>
  !!n && (n.family === 'major' || n.family === 'minor') && (interval(e.pc, n.pc) === 1 || interval(e.pc, bassPc(n)) === 1)

/**
 * R3b: a °7's scale by its function in the local key (M&H pp. 152–161): in a major key ♯IV°7 to the tonic (over its
 * 5th or not, fig. 7.12–7.15) takes the ♯II°7's notes; the ascending vii°7 of X (by X's root or bass) takes X's V7(♭9 ♯9 ♭13)
 * from its root, in any key; in a major key the passing ♭III°7 and ♭VI°7 and the auxiliary I°7 and V°7 take their
 * figure's scale (the chord tones plus the key's notes); any other is Whole-Half (Q5)
 */
function diminished(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  const n = nextOf(ctx.stream, i)
  const d = interval(key.tonic, e.pc)
  /** the figure's scale on this degree of a major key, or Whole-Half with Q5's reason */
  const byDegree = (figures: Readonly<Record<number, string>>, reason: string, short?: string): Pick<Decision, 'scale' | 'reason' | 'short'> => {
    const variant = key.minor ? undefined : figures[d]
    if (variant) return { scale: dimScale(e, `${NAME.diatonicDim} ${variant}`), reason }
    return { scale: dimScale(e, NAME.wholeHalf), reason: `${reason}${SYMMETRIC}`, ...(short ? { short: `${short}${SYMMETRIC}` } : {}) }
  }
  // auxiliary: the next chord is on its own root, whatever came before (C7 | C°7 | C6, G°7 | G7)
  if (n && n.pc === e.pc) return { ...byDegree({ 0: 'I', 7: 'V' }, 'auxiliary diminished: it decorates the chord and returns to it'), rule: 'd1', fn: 'auxiliary diminished' }
  if (!key.minor && d === 6 && e.root && n && n.pc === key.tonic && (n.family === 'major' || n.family === 'dominant')) {
    // ♯IV°7 to I (I/5 above all): an inversion of ♯II°7, the V7/iii's 3rd, 5th, 7th and ♭9
    const fn = `♯IV°7 to I${interval(n.pc, bassPc(n)) === 7 ? ' over its 5th' : ''}`
    return { scale: dimScale(e, `${NAME.diatonicDim} #IV`), rule: 'd1', fn, reason: `${fn}: ${rootName(shiftBy(e.root, 3, 5))}7♭9 without its root, the ♯II°7's notes` }
  }
  const hidden = hiddenDominant(e.pc, n, nextOf(ctx.stream, ctx.stream[i]?.next))
  if (ascends(e, n)) {
    // a vii°7 always hides its target's V: the °7's root is that V's 3rd (by the bass when not by the root: D♯°7 → C/E hides B7)
    const bass = bassOf(n)
    if (interval(e.pc, n.pc) !== 1 && bass) {
      const fn = `vii°7 to ${n.chord}, up to its bass`
      return { scale: dimScale(e, NAME.diatonicDim), rule: 'd1', fn, reason: `${fn}: ${rootName(shiftBy(bass, 4, 7))}7♭9 without its root` }
    }
    const fn = `vii°7 of ${n.chord}`
    return { scale: dimScale(e, NAME.diatonicDim), rule: 'd1', fn, reason: `${fn}: ${hidden?.root ?? 'its V'}7♭9 without its root` }
  }
  // R7: the "(X its ii)" aside is what a chart comment drops first
  const short = hidden?.ii ? passingReason({ root: hidden.root, target: hidden.target }) : undefined
  return { ...byDegree({ 3: 'bIII', 8: 'bVI' }, passingReason(hidden), short), rule: 'd1', fn: 'passing diminished', fallback: true }
}

function sus(ctx: Context, i: number): Decision {
  const e = ctx.stream[i] as Entry
  const key = ctx.keys[i] ?? ctx.global
  if (e.quality === '7sus4b9') return { scale: named(e, NAME.phrygian), rule: 's1', fn: 'sus b9', reason: 'from the symbol: sus b9' }
  const blues = bluesAt(ctx, i)
  const bluesStep = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (bluesStep) return { scale: named(e, NAME.mixolydian), rule: 's4', fn: `${bluesStep}7sus of the blues`, reason: `${bluesStep}7sus of the blues: Mixolydian` }
  const n = nextOf(ctx.stream, i)
  if (!ctx.modal && n && downFifth(e, n) && e.bars < 4) {
    const harmonic = key.minor && n.pc === key.tonic && n.family === 'minor'
    const b13 = derive(e, key, harmonic).n13 === 'b13'
    return {
      scale: named(e, b13 ? NAME.mixolydianB6 : NAME.mixolydian),
      rule: 's2',
      fn: `V7sus4 of ${n.chord}`,
      reason: b13 ? `V7sus4 of ${n.chord}: the b13 is in the key` : 'V7sus4 resolving down a fifth: Mixolydian, the 4th is a chord tone here',
    }
  }
  if (!ctx.modal && n && n.pc === e.pc && n.family === 'dominant') {
    const own = ownNumeral(e, key)
    return { scale: named(e, NAME.mixolydian), rule: 's3', fn: `${own} before its dominant: a subdominant suspension`, reason: `${own} before its dominant: Mixolydian, the 4th is a chord tone here` }
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

// —— the rules, for the reference page (/functions) ——

/** what a rule looks at, from the least to the most contextual */
export const TIERS = {
  1: 'The chord symbol alone',
  2: 'The chart’s mode',
  3: 'The chord’s degree in its key',
  4: 'The chords around it',
  5: 'A guess',
} as const

/** one rule as the reference page lists it; guess: when its verdict is only a guess (fallback) */
export type RuleInfo = Readonly<{ id: string; family: Family; tier: keyof typeof TIERS; scale: string; looksAt: string; summary: string; guess?: string }>

/** every rule id decide() can give, each family's in the order it tries them */
export const RULES: readonly RuleInfo[] = [
  { id: 'D1', family: 'dominant', tier: 1, scale: 'from the symbol (Altered for alt)', looksAt: 'the tensions written in the symbol', summary: 'An alt dominant is Altered; written tensions (b9, #9, #11, b13) override any other rule’s, shown as D1+ before that rule when they change its scale.' },
  { id: 'D7', family: 'dominant', tier: 3, scale: 'Mixolydian', looksAt: 'a modal chart, or a dominant that resolves nowhere and is held four bars or more', summary: 'A static or modal dominant is its own mode: Mixolydian.' },
  { id: 'D2', family: 'dominant', tier: 4, scale: 'Lydian Dominant', looksAt: 'the next chord, a half step down (not a ø7 or °7)', summary: 'A tritone substitute resolves down a half step: Lydian Dominant.' },
  { id: 'D8', family: 'dominant', tier: 4, scale: 'derived from the minor key', looksAt: 'a chain of dominants that ends on a minor chord, or its last link', summary: 'An extended dominant on its way into a minor key, or the last link of the chain, takes its tensions from that key. A link into the key’s own V7 is V7/V, the links before it arrows.' },
  { id: 'D3', family: 'dominant', tier: 4, scale: 'Mixolydian', looksAt: 'the next chord, another dominant a fifth down', summary: 'An extended dominant (V7 of another V7) keeps natural tensions: Mixolydian (a blues I7 before its IV7 is not one: D9). A link into the key’s own V7 is V7/V (the dominant of the dominant), the links before it arrows; a chain that never reaches the key’s V7 keeps each chord’s own degree.' },
  { id: 'D4', family: 'dominant', tier: 4, scale: 'derived from the key', looksAt: 'the chord it resolves to, a fifth down; the major or minor chord before it that it is the V of; or the ii before it', summary: 'A resolving dominant takes each tension (9, 11, 13) in the form the key holds.' },
  { id: 'D5', family: 'dominant', tier: 3, scale: 'derived from the key', looksAt: 'its degree: the back door, or a diatonic dominant', summary: 'A dominant a whole step below a major chord (the back door, ♭VII7), or a diatonic dominant that does not resolve, takes its tensions from the key.', guess: 'a diatonic dominant that does not resolve' },
  { id: 'D9', family: 'dominant', tier: 3, scale: 'Mixolydian', looksAt: 'a blues: its degree, the I7, IV7 or V7 (before the chords around it), and for the V7 the chord before it', summary: 'In a blues the I7 (a tonic with dominant color), the IV7 and the V7 are Mixolydian, unless a ii before the V7 makes it a ii–V; at Basic they play the key’s Blues scale. A minor blues’ V7 keeps the minor key’s rules.' },
  { id: 'D6', family: 'dominant', tier: 4, scale: 'Lydian Dominant', looksAt: 'a non-diatonic dominant with nowhere to go', summary: 'A non-diatonic dominant that does not resolve is Lydian Dominant: in a major key, ♭VII7, ♭VI7 or ♭III7 borrowed from the parallel minor; any other, a chromatic dominant in its own key.', guess: 'a chromatic dominant (not ♭VII7, ♭VI7 or ♭III7 in a major key)' },
  { id: 'M1', family: 'major', tier: 1, scale: 'Lydian', looksAt: 'a #11 in the symbol', summary: 'A maj7#11, or a triad with a #11 (Bb(#11)), is Lydian.' },
  { id: 'M2', family: 'major', tier: 1, scale: 'Lydian Augmented', looksAt: 'a #5 in the symbol', summary: 'A maj7#5 is Lydian Augmented; an augmented triad, Whole Tone.' },
  { id: 'M5', family: 'major', tier: 2, scale: 'Lydian', looksAt: 'a modal chart', summary: 'A major chord in a modal chart is Lydian.' },
  { id: 'M6', family: 'major', tier: 2, scale: 'Mixolydian', looksAt: 'a blues: a major triad or 6 chord on I, IV or V', summary: 'In a blues a triad on I, IV or V implies its ♭7: Mixolydian (a maj7 says otherwise, and keeps the major rules); at Basic, the key’s Blues scale.' },
  { id: 'M3', family: 'major', tier: 3, scale: 'Ionian (Mixolydian for a V triad)', looksAt: 'its degree: the tonic, ♭III or ♭VII in a minor key, a V triad, or IV after its own dominant', summary: 'The tonic major chord (or ♭III, the relative major, in a minor key) is Ionian; so is ♭VII of a minor key, the notes of the tonic’s Dorian, and a IV reached by its own dominant (V7/IV, or subV7/IV a half step above), the key of the moment; a V triad without its 7th is Mixolydian.' },
  { id: 'M4', family: 'major', tier: 3, scale: 'Lydian', looksAt: 'its degree: any other major chord', summary: 'Any other major chord is Lydian (♭VI of a minor key among them; on a IV not reached by its own dominant, the #4 is the key’s 7th; on ♭II, ♭III, ♭VI or ♭VII of a major key, borrowed by modal interchange, its ♯11 is in the key).' },
  { id: 'm1', family: 'minor', tier: 1, scale: 'Melodic Minor', looksAt: 'a major 7th in the symbol', summary: 'A minor-major 7th is Melodic Minor.' },
  { id: 'm2', family: 'minor', tier: 3, scale: 'Melodic Minor or Dorian', looksAt: 'a 6 in the symbol, and its degree: the tonic of a minor key', summary: 'A minor sixth chord on the tonic of a minor key is Melodic Minor, the raised 7th a tension; any other (iv6, ii6, or any in a modal chart) is Dorian.' },
  { id: 'm3', family: 'minor', tier: 1, scale: 'Aeolian', looksAt: 'a b6 or b13 in the symbol', summary: 'A minor chord with a written b6 or b13 is Aeolian.' },
  { id: 'm6', family: 'minor', tier: 2, scale: 'Dorian', looksAt: 'a modal chart', summary: 'A minor chord in a modal chart is Dorian.' },
  { id: 'm10', family: 'minor', tier: 2, scale: 'Dorian', looksAt: 'a minor blues: the i or iv (triad, m7 or m6)', summary: 'In a minor blues the i and iv are Dorian; at Basic, the key’s Blues scale.' },
  { id: 'm4', family: 'minor', tier: 4, scale: 'Dorian', looksAt: 'the next chord, a dominant a fourth up', summary: 'The ii of a ii–V is Dorian (a diatonic iii keeps its Phrygian, m9).' },
  { id: 'm5', family: 'minor', tier: 3, scale: 'Dorian', looksAt: 'its degree: the tonic of a minor key', summary: 'The tonic minor chord of a minor key is Dorian, by convention.' },
  { id: 'm9', family: 'minor', tier: 3, scale: 'Phrygian', looksAt: 'its degree: iii in a major key, also as the ii of the next dominant', summary: 'iii in a major key is Phrygian, the key’s own notes (the ♭2 is a passing note); Dorian at Advanced.' },
  { id: 'm7', family: 'minor', tier: 3, scale: 'Dorian, Aeolian or Phrygian', looksAt: 'its degree: another diatonic minor chord', summary: 'A diatonic minor chord takes the key’s own notes: vi of a major key Aeolian, v of a minor key Phrygian, any other Dorian.' },
  { id: 'm8', family: 'minor', tier: 5, scale: 'Dorian', looksAt: 'a minor chord the key does not hold', summary: 'A borrowed or chromatic minor chord is Dorian, its own key.', guess: 'always' },
  { id: 'h2', family: 'halfdim', tier: 4, scale: 'Locrian', looksAt: 'the next chord, a dominant a fourth up', summary: 'A half-diminished chord is Locrian (Locrian ♮2 at Advanced), in a modal chart too; with a dominant after it, it is the iiø7 of that minor ii–V; without one, iiø7 in a major key is borrowed from the parallel minor.', guess: 'no related dominant follows (but iiø7 in a major key)' },
  { id: 'd1', family: 'dim', tier: 4, scale: 'Diatonic Diminished, or Whole-Half Diminished', looksAt: 'the next chord (its root or bass), and its degree in the key', summary: 'A diminished seventh chord takes the diatonic diminished scale of its function: a vii°7 leading up a half step (to the next chord’s root or bass: ♯II°7 to I/3), the V7♭9♯9♭13 of the chord it leads to, from its own root; in a major key, ♯IV°7 to I (over its 5th or not), the ♯II°7’s notes; a passing ♭III°7 or ♭VI°7 or an auxiliary I°7 or V°7 (one that returns to a chord on its own root), its chord tones plus the key’s notes. Any other is not functioning diatonically: Whole-Half Diminished, the symmetric scale. Whole-Half at Basic and Advanced.', guess: 'a passing diminished chord' },
  { id: 's1', family: 'sus', tier: 1, scale: 'Phrygian', looksAt: 'a b9 in the symbol', summary: 'A sus b9 is Phrygian.' },
  { id: 's4', family: 'sus', tier: 2, scale: 'Mixolydian', looksAt: 'a blues: a sus chord on I, IV or V', summary: 'In a blues a sus chord on I, IV or V is Mixolydian; at Basic, the key’s Blues scale.' },
  { id: 's2', family: 'sus', tier: 4, scale: 'Mixolydian or Mixolydian b6', looksAt: 'the next chord, a fifth down (in a chart that is not modal, held under four bars)', summary: 'A resolving sus takes its 13 from the key: Mixolydian, or Mixolydian b6 when the key holds the b13.' },
  { id: 's3', family: 'sus', tier: 4, scale: 'Mixolydian', looksAt: 'no resolution: a modal chart, a sus held four bars or more, or none that falls a fifth; or, outside a modal chart, the dominant on its own root next', summary: 'A static sus is Mixolydian; so is a sus before its dominant on the same root, a subdominant suspension (its 4th a chord tone).' },
]

/** the rules a verdict's id names: "D1+D4" -> D1, D4 */
export const ruleParts = (rule: string): string[] => rule.split('+').filter(Boolean)

/** §7.1 in full: every combination of the three tension slots, and the dominant scale it names */
export function dominantScaleTable(): readonly (Slots & Readonly<{ scale: string }>)[] {
  const n9s: Slots['n9'][] = ['9', 'b9', 'b9#9']
  const n11s: Slots['n11'][] = ['11', '#11']
  const n13s: Slots['n13'][] = ['13', 'b13']
  return n9s.flatMap((n9) => n11s.flatMap((n11) => n13s.map((n13) => ({ n9, n11, n13, scale: dominantScale({ n9, n11, n13 }) }))))
}

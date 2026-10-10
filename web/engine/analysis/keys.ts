import { matchKeyText } from '../chart'
import { parseRoot, pcOf, rootName, type Spelled } from '../pitch'
import { downFifth, downHalf, type Entry, type Family, interval, nextOf, prevOf } from './stream'

/**
 * Pass 2 (docs/plan-analysis.md §5): cadences, the global key, key areas, and the modal and blues contexts.
 */

export type Key = Readonly<{ tonic: number; minor: boolean; name: string }>

export const makeKey = (root: Spelled, minor: boolean): Key => ({ tonic: pcOf(root), minor, name: `${rootName(root)} ${minor ? 'minor' : 'major'}` })

/** a key as a label: "C major" -> "C", "A minor" -> "A minor" (the ambient major is unspoken) */
export const keyText = (key: Key): string => (key.minor ? key.name : key.name.replace(/ major$/, ''))

/** a key as `key:` and `@key` write it: "D", "Bbm" */
export const keyCode = (key: Key): string => `${key.name.split(' ')[0] ?? ''}${key.minor ? 'm' : ''}`
export const sameKey = (a: Key, b: Key): boolean => a.tonic === b.tonic && a.minor === b.minor

/** a `key:` meta value: "Eb", "F#m", "Bb minor", "C-"; null if it isn't one */
export function parseKey(text: string): Key | null {
  const m = matchKeyText(text.trim())
  if (!m) return null
  const suffix = (m[2] ?? '').toLowerCase()
  return makeKey(parseRoot(m[1] ?? 'C'), suffix === 'm' || suffix === '-' || suffix.startsWith('min'))
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]

/** the key's reference scale as pitch classes: Ionian, natural minor, or harmonic minor for a minor key's own V7 */
export function reference(key: Key, harmonic = false): readonly number[] {
  const steps = key.minor ? (harmonic ? HARMONIC_MINOR : NATURAL_MINOR) : MAJOR
  return steps.map((s) => (key.tonic + s) % 12)
}

/** §5.5: the families each degree holds, in a major key and in the composite minor */
const DIATONIC_MAJOR: Readonly<Record<number, readonly Family[]>> = {
  0: ['major'],
  2: ['minor', 'sus'],
  4: ['minor'],
  5: ['major'],
  7: ['dominant', 'sus'],
  9: ['minor'],
  11: ['halfdim'],
}
const DIATONIC_MINOR: Readonly<Record<number, readonly Family[]>> = {
  0: ['minor'],
  2: ['halfdim'],
  3: ['major'],
  5: ['minor'],
  7: ['minor', 'dominant', 'sus'],
  8: ['major'],
  10: ['dominant', 'major'],
  11: ['dim'],
}

/** the entry's degree in the key, in semitones above the tonic */
export const degree = (e: Entry, key: Key): number => interval(key.tonic, e.pc)

export function diatonic(e: Entry, key: Key): boolean {
  if (!e.family) return false
  const table = key.minor ? DIATONIC_MINOR : DIATONIC_MAJOR
  // a major triad on V of a major key is its dominant without the 7th
  if (!key.minor && degree(e, key) === 7 && e.quality === 'maj') return true
  return table[degree(e, key)]?.includes(e.family) ?? false
}

/** a dominant 7th or a resolving sus chord: what can make a cadence */
export const isDominantLike = (e: Entry | undefined): boolean => e?.family === 'dominant' || e?.quality === '7sus4'
export const isTonicType = (e: Entry | undefined): e is Entry => e?.family === 'major' || e?.family === 'minor'

/** §5.1: a dominant resolving down a fifth (or, as a tritone cadence, a half step) to a major or minor chord */
export type Cadence = Readonly<{
  dominant: number
  target: number
  key: Key
  /** where its approach starts: the ii of a ii–V, else the first of a chain of dominants leading to it */
  approach: number
  ii: boolean
  tritone: boolean
}>

export function findCadences(stream: readonly Entry[]): Cadence[] {
  const out: Cadence[] = []
  stream.forEach((e, i) => {
    if (!isDominantLike(e)) return
    const n = nextOf(stream, i)
    const fifth = downFifth(e, n)
    const tritone = !fifth && e.family === 'dominant' && downHalf(e, n)
    if (!(fifth || tritone) || !n?.root || !isTonicType(n)) return
    // back over a chain of dominants each resolving down a fifth into the next, then a ii a fifth above its start
    // (never back across the top of the form)
    const back = (k: number): number | null => {
      const p = stream[k]?.prev
      return p !== null && p !== undefined && p < k ? p : null
    }
    let a = i
    for (let p = back(a); p !== null && isDominantLike(stream[p]) && downFifth(stream[p] as Entry, stream[a]); p = back(a)) a = p
    const b = back(a)
    const before = b === null ? undefined : stream[b]
    const start = stream[a] as Entry
    const ii = !!before && (before.family === 'minor' || before.family === 'halfdim') && interval(start.pc, before.pc) === 7
    out.push({ dominant: i, target: e.next ?? i, key: makeKey(n.root, n.family === 'minor'), approach: ii && b !== null ? b : a, ii, tritone })
  })
  return out
}

/** §5.4: a 12-bar (or 24-bar) form with a dominant 7th on its root in bar 1 and on the 4th above it in bar 5 */
export function bluesKey(stream: readonly Entry[], formBars: number): Key | null {
  if (formBars % 12 !== 0 || formBars > 24 || !stream.length) return null
  const first = stream[0]
  const startBar = first?.start ?? 1
  const at = (bar: number): Entry | undefined => stream.find((e) => e.start <= bar && bar < e.start + e.bars)
  const five = at(startBar + 4)
  if (first?.family !== 'dominant' || five?.family !== 'dominant' || !first.root) return null
  return interval(first.pc, five.pc) === 5 ? makeKey(first.root, false) : null
}

/** §5.4: few chords take part in cadences, and chords last two bars or more */
export function isModal(stream: readonly Entry[], cadences: readonly Cadence[]): boolean {
  if (!stream.length) return false
  const inCadence = new Set<number>()
  for (const c of cadences) {
    for (let i = c.approach; i <= c.dominant; i++) inCadence.add(i)
    inCadence.add(c.target)
  }
  const bars = stream.map((e) => e.bars).sort((a, b) => a - b)
  const median = bars[Math.floor(bars.length / 2)] ?? 0
  return inCadence.size < stream.length / 3 && median >= 2
}

/** §5.2: score the 24 keys when the chart doesn't say */
export function scoreKey(stream: readonly Entry[], cadences: readonly Cadence[]): Key | null {
  const readable = stream.filter((e) => e.root)
  if (!readable.length) return null
  const keys = readable.flatMap((e) => (e.root ? [makeKey(e.root, false), makeKey(e.root, true)] : []))
  const unique = keys.filter((k, i) => keys.findIndex((o) => sameKey(o, k)) === i)
  const lastE = readable[readable.length - 1]
  const firstE = readable[0]
  const score = (k: Key): number => {
    let s = 0
    for (const c of cadences) if (sameKey(c.key, k)) s += c.tritone ? 2 : 3 + (c.ii ? 2 : 0)
    if (lastE && lastE.pc === k.tonic && (lastE.family === 'minor') === k.minor && isTonicType(lastE)) s += 3
    if (firstE && firstE.pc === k.tonic && (firstE.family === 'minor') === k.minor && isTonicType(firstE)) s += 1
    for (const e of readable) if (diatonic(e, k)) s += e.bars
    return s
  }
  const ranked = unique.map((k) => ({ k, s: score(k) })).sort((a, b) => b.s - a.s)
  const best = ranked[0]?.s ?? 0
  const top = ranked.filter((r) => r.s === best).map((r) => r.k)
  // ties: the key of the final chord, then minor over its relative major
  return top.find((k) => lastE && lastE.pc === k.tonic) ?? top.find((k) => k.minor) ?? top[0] ?? null
}

/**
 * §5.3: each entry's local key. A cadence into a chord diatonic to the key of the moment stays in it; one into a
 * chord diatonic to the global key returns there; any other opens an area in the cadence's key, from the start of
 * its approach until a later cadence moves on.
 */
export function localKeys(stream: readonly Entry[], cadences: readonly Cadence[], global: Key): Key[] {
  const keys: Key[] = stream.map(() => global)
  let current = global
  const ordered = [...cadences].sort((a, b) => a.approach - b.approach)
  // ii–Vs that don't land: in a major area, one implying a chord of the home key but not of the area brings the
  // home key back
  // (Lady Bird's Am7 D7 after the Ab section is the ii–V of G, in C)
  const implied = stream.flatMap((e, i) => {
    const p = stream[i - 1]
    if (!isDominantLike(e) || cadences.some((c) => c.dominant === i) || !p || i === 0) return []
    if (!((p.family === 'minor' || p.family === 'halfdim') && interval(e.pc, p.pc) === 7)) return []
    return [{ at: i - 1, pc: (e.pc + 5) % 12, minor: p.family === 'halfdim' }]
  })
  const changes: { at: number; key: Key }[] = []
  const events = [...ordered.map((c) => ({ at: c.approach, c })), ...implied.map((x) => ({ at: x.at, x }))].sort((a, b) => a.at - b.at)
  for (const ev of events) {
    if ('x' in ev) {
      const { pc, minor } = ev.x
      if (!current.minor && !impliedDiatonic(pc, minor, current) && impliedDiatonic(pc, minor, global) && !sameKey(current, global)) {
        changes.push({ at: ev.at, key: global })
        current = global
      }
      continue
    }
    const c = ev.c
    const target = stream[c.target]
    if (!target) continue
    // a minor chord that is itself the ii of the next ii–V passes through (Dm7 G7 | Cm7 F7 | Bb7): no area of its own
    const after = nextOf(stream, c.target)
    if (target.family === 'minor' && isDominantLike(after) && after && interval(target.pc, after.pc) === 5) continue
    // a cadence into the home tonic always comes home (Gm7 C7 | FMaj7 after a bridge in C); otherwise one into a
    // chord of the key of the moment stays there, and one into a chord of the global key returns to it
    const home = sameKey(c.key, global) && target.pc === global.tonic
    // in a minor key, a full ii–V–I into a major chord (its relative major, its bVI) tonicizes it: Bernie's Tune's
    // bridge is in Bb, not on bVI of D minor
    const tonicized = current.minor && c.ii && !c.tritone && !c.key.minor && !sameKey(c.key, current)
    const next = home ? global : tonicized ? c.key : diatonic(target, current) ? current : diatonic(target, global) ? global : c.key
    if (!sameKey(next, current)) changes.push({ at: c.approach, key: next })
    current = next
  }
  for (const { at, key } of changes) for (let i = at; i < keys.length; i++) keys[i] = key
  // the form repeats: a turnaround that resolves into the top carries its key into the opening bars (Giant Steps'
  // F#7 | BMaj7), up to the first change
  const wraps = ordered.some((c) => c.target < c.dominant)
  const opening = changes[0]?.at ?? keys.length
  if (wraps && !sameKey(current, global)) for (let i = 0; i < opening; i++) keys[i] = current
  // a section that starts on the home tonic is home again, until the next change (Nardis: the last A after a
  // bridge in C is in E minor, with no cadence to say so)
  stream.forEach((e, i) => {
    const prev = stream[i - 1]
    const away = keys[i]
    if (!prev || prev.section === e.section || !away || sameKey(away, global) || !isHomeTonic(e, global)) return
    for (let j = i; j < keys.length && keys[j] === away; j++) keys[j] = global
  })
  return keys
}

const isHomeTonic = (e: Entry, key: Key): boolean => e.pc === key.tonic && e.family === (key.minor ? 'minor' : 'major')

/** a chord that isn't there, only implied by a ii–V, is in the key when its triad is (Bb in Eb: Bb D F) */
export function impliedDiatonic(pc: number, minor: boolean, key: Key): boolean {
  const ref = new Set(reference(key))
  return [0, minor ? 3 : 4, 7].every((s) => ref.has((pc + s) % 12))
}

/** the chord before e is its related ii: a minor or half-diminished chord a fifth above it */
export const hasRelatedII = (stream: readonly Entry[], i: number): boolean => {
  const e = stream[i]
  const p = prevOf(stream, i)
  return !!e && !!p && (p.family === 'minor' || p.family === 'halfdim') && interval(e.pc, p.pc) === 7
}

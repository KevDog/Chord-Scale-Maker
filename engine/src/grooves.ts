/**
 * The pattern sets (#509, roadmap Phase 4; docs/superpowers/specs/2026-10-24-pattern-sets-design.md): a groove for
 * the chart's changes, drums, piano comping and a bass line, chosen by its style (styles.json). Pure: the app plays
 * them (useClick), booked from the click's clock as Hear line's notes are. Each line is reproducible: a chart's
 * groove draws its choices from a PRNG seeded by its title.
 */
import styles from '../styles.json'
import { defaultTempo } from './click'
import { BASS, bassNotes, bassPc, chordOf, type HarmonyBar, pianoNotes, scaleSemis, type Span, voicedSpans } from './harmony'
import { mod } from './pitch'
import type { VoiceNote } from './voice'

/**
 * the kit's voices (#540). ride and bell: the ride cymbal's stick and bell; hat: the hi-hat foot's chick; tip: a closed
 * hat struck; open: an open hat; stick: a cross-stick on the snare; kick; sweep and brush: a brush swept round the
 * snare, and a brush tap
 */
export const DRUM_KINDS = ['ride', 'bell', 'hat', 'tip', 'open', 'stick', 'kick', 'sweep', 'brush'] as const
export type DrumKind = (typeof DRUM_KINDS)[number]

export const GROOVE_SETS = ['swing', 'ballad', 'bossa'] as const
export type GrooveSet = (typeof GROOVE_SETS)[number]
/** a style's set, its tempo (the click's) and how far its 8ths swing */
export type StyleGroove = Readonly<{ set: GrooveSet; tempo: number; swing: number }>

const STYLES: Readonly<Record<string, StyleGroove>> = styles as Record<string, StyleGroove>
const has = (style: string, ...words: readonly string[]): boolean => words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(style))

/** a style's groove (decision groove.style): styles.json's entry, else by its words (ballad, Latin, bossa or samba, else swing) */
export function styleGroove(style: string): StyleGroove {
  const listed = STYLES[style.trim().toLowerCase()]
  if (listed) return listed
  const set: GrooveSet = has(style, 'ballad') ? 'ballad' : has(style, 'latin', 'bossa', 'samba') ? 'bossa' : 'swing'
  const straight = set === 'bossa' || has(style, 'even', 'straight', 'funk', 'rock')
  return { set, tempo: defaultTempo(style), swing: straight ? 0.5 : has(style, 'shuffle') ? 0.72 : 0.67 }
}

/** a drum hit: bar, the drawn bar from 0; at, beats from its start; velocity 0 to 1 */
export type DrumHit = Readonly<{ bar: number; at: number; kind: DrumKind; velocity: number }>
/** a groove's three tracks: piano and bass notes as Hear line's (voice.ts), at concert pitch */
export type Groove = Readonly<{ drums: readonly DrumHit[]; piano: readonly VoiceNote[]; bass: readonly VoiceNote[] }>

/** a chart's seed: its title, hashed (FNV-1a) */
export function seedOf(text: string): number {
  let h = 0x811c9dc5
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0
  return h
}

/** mulberry32: a small seeded PRNG, [0, 1) */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!

/** the swing set's ride and hat over a bar of beats (decision groove.swing): the ride on each beat, its skip note after 2 and 4 (2 in 3/4), the hat's foot on 2 and 4 (2 and 3) */
function swingDrums(bar: number, beats: number): DrumHit[] {
  const backbeat = (b: number) => (beats === 3 ? b > 0 : b % 2 === 1)
  const skip = (b: number) => (beats === 3 ? b === 1 : b % 2 === 1 && b + 1 <= beats)
  const out: DrumHit[] = []
  for (let b = 0; b < beats; b++) {
    out.push({ bar, at: b, kind: 'ride', velocity: backbeat(b) && beats !== 3 ? 0.75 : 0.6 })
    if (skip(b) && b + 0.5 < beats) out.push({ bar, at: b + 0.5, kind: 'ride', velocity: 0.45 })
  }
  for (let b = 0; b < beats; b++) if (backbeat(b)) out.push({ bar, at: b, kind: 'hat', velocity: 0.7 })
  return out.sort((x, y) => x.at - y.at)
}

/** the ballad set's brushes over a bar (decision groove.ballad): a sweep on each beat, a tap and the hat's foot on 2 and 4 (2 and 3 in 3/4) */
function brushDrums(bar: number, beats: number): DrumHit[] {
  const backbeat = (b: number) => (beats === 3 ? b > 0 : b % 2 === 1)
  return Array.from({ length: beats }, (_, b) => [
    { bar, at: b, kind: 'sweep' as const, velocity: b === 0 ? 0.7 : 0.55 },
    ...(backbeat(b) ? [{ bar, at: b, kind: 'brush' as const, velocity: 0.6 }, { bar, at: b, kind: 'hat' as const, velocity: 0.5 }] : []),
  ]).flat()
}

/** the bossa set's kit over a bar (decision groove.bossa): the cross-stick's two-bar pattern, the closed hat on each 8th, the kick on 1 and 3 with a pickup before each */
function bossaDrums(bar: number, beats: number): DrumHit[] {
  const stick = bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]
  const out: DrumHit[] = []
  for (let e = 0; e < beats * 2; e++) out.push({ bar, at: e / 2, kind: 'tip', velocity: e % 2 ? 0.35 : 0.5 })
  for (const at of stick) if (at < beats) out.push({ bar, at, kind: 'stick', velocity: 0.7 })
  for (const at of [0, 1.5, 2, 3.5]) if (at < beats) out.push({ bar, at, kind: 'kick', velocity: at % 1 ? 0.45 : 0.65 })
  return out.sort((x, y) => x.at - y.at)
}

type Rhythms = Readonly<Record<number, readonly (readonly (readonly [number, number])[])[]>>

/** the comping rhythms (decision groove.swing): onsets and lengths in beats from a chord's start, by the beats it lasts */
const COMPS: Rhythms = {
  4: [
    [[0, 1], [1.5, 0.5]], // the Charleston
    [[1.5, 0.5], [3, 0.75]],
    [[1, 0.75], [3, 0.75]], // 2 and 4
    [[0, 1.5], [2.5, 0.5]],
    [[0.5, 1]], // the and of 1, held
    [[1.5, 1.5]], // the and of 2, held
    [[0, 0.5], [1.5, 0.5], [3, 0.5]],
    [[2.5, 1]],
    [[1, 0.5], [2.5, 0.5]],
    [[0, 2]],
    [[0.5, 0.5], [2, 1]],
    [[1.5, 0.5], [2.5, 0.5], [3.5, 0.5]],
  ],
  3: [
    [[1, 0.75], [2, 0.75]], // 2 and 3
    [[0, 1], [1.5, 0.5]],
    [[0.5, 0.5], [2, 0.75]],
    [[1.5, 1]],
  ],
  2: [[[0, 1]], [[1, 0.75]], [[0.5, 0.5]], [[0, 0.5], [1.5, 0.5]], [[1.5, 0.5]]],
  1: [[[0, 0.75]]],
}

/** the bossa's comping (decision groove.bossa): its syncopations, straight 8ths off the beat */
const BOSSA_COMPS: Rhythms = {
  4: [
    [[0, 1], [1.5, 1], [3, 1]],
    [[0.5, 1], [2, 1], [3.5, 0.5]],
    [[0, 1.5], [2.5, 1]],
    [[1.5, 1], [3, 1]],
  ],
  3: [[[0, 1], [1.5, 1]]],
  2: [[[0, 1], [1.5, 0.5]], [[0.5, 1]]],
  1: [[[0, 0.75]]],
}

/** a strike's notes (decision groove.swing): the voicing at first, then now and then its lowest note an octave up, or its top three alone */
function strike(voicing: readonly number[], k: number, rnd: () => number): readonly number[] {
  if (k === 0) return voicing
  const r = rnd()
  if (r < 0.3 && voicing[0]! + 12 <= COMP_TOP) return [...voicing.slice(1), voicing[0]! + 12]
  if (r < 0.5 && voicing.length > 3) return voicing.slice(1)
  return voicing
}
/** the highest note comping reaches with a voicing moved up */
const COMP_TOP = 84
const onsets = (hits: readonly (readonly [number, number])[]): string => hits.map(([on]) => on).join(',')

/**
 * the piano's comping: each chord struck in a rhythm drawn for it, never the last chord's rhythm again, held no
 * further than its chord. With vary (the swing set): the voicing moves between strikes, a chord a bar long is now and
 * then left out, and about a chord in four is anticipated, struck on the and of the beat before it and held over
 */
function comp(spans: ReturnType<typeof voicedSpans>, rnd: () => number, table: Rhythms = COMPS, vary = false): VoiceNote[] {
  const out: VoiceNote[] = []
  let last = ''
  let pushed = false // this chord already struck, early
  spans.forEach((s, i) => {
    const v = s.voicing
    if (!v) {
      pushed = false
      return
    }
    if (vary && !pushed && s.beats >= 4 && rnd() < 0.08) {
      last = ''
      return
    }
    const next = spans[i + 1]
    const push = vary && !!next?.voicing && next.bar === s.bar + 1 && next.at === 0 && s.beats >= 2 && rnd() < 0.25
    const rhythms = table[s.beats] ?? (s.beats > 4 ? table[4]! : [[[0, Math.min(1, s.beats)] as const]])
    const fit = (r: (typeof rhythms)[number]) =>
      r.filter(([on]) => on < s.beats && !(pushed && on === 0) && !(push && on >= s.beats - 1)).map(([on, len]) => [on, Math.min(len, s.beats - on)] as const)
    const fresh = rhythms.map(fit).filter((h) => h.length && onsets(h) !== last)
    const hits = fresh.length ? pick(rnd, fresh) : fit(rhythms[0]!)
    last = onsets(hits)
    hits.forEach(([on, len], k) => {
      for (const midi of vary ? strike(v, k, rnd) : v) out.push({ bar: s.bar, at: s.at + on, beats: len, midi })
    })
    if (push) for (const midi of next!.voicing!) out.push({ bar: s.bar, at: s.at + s.beats - 0.5, beats: 1.5, midi })
    pushed = push
  })
  return out
}

/** the walking bass's range: E1 to G3 */
const WALK = { lo: 28, hi: 55 } as const
/** the midi of pc nearest to from, in the walk's range */
function nearest(pc: number, from: number, lo: number = WALK.lo, hi: number = WALK.hi): number {
  let best = lo + mod(pc - lo, 12)
  for (let m = best; m <= hi; m += 12) if (Math.abs(m - from) < Math.abs(best - from)) best = m
  return best
}

/**
 * the walking bass (decision groove.swing): a quarter a beat; the chord's root (a slash chord's bass) on its first,
 * its last a half step from the next chord's root or that root's 5th, and the beats between stepping through the
 * chord's scale toward it, chord tones likelier; a 3/4 bar plays its root for two beats and a lead-in on 3
 */
function walk(spans: readonly Span[], rnd: () => number): VoiceNote[] {
  const out: VoiceNote[] = []
  let prev: number = BASS.centre
  spans.forEach((s, i) => {
    const pc = bassPc(s.text)
    const c = chordOf(s.text)
    if (pc === null || !c) return
    const root = nearest(pc, prev)
    const next = spans.slice(i + 1).concat(spans.slice(0, i + 1)).find((x) => bassPc(x.text) !== null)
    const target = next ? nearest(bassPc(next.text)!, root) : root
    // a half step either side, two times in three, else the 5th above or below
    const lead = (from: number): number => {
      const fits = (m: number) => m >= WALK.lo && m <= WALK.hi && m !== from
      const half = [target - 1, target + 1].filter(fits)
      const fifth = [target + 7, target - 5].filter(fits)
      if (!half.length && !fifth.length) return target
      return pick(rnd, half.length && (rnd() < 0.65 || !fifth.length) ? half : fifth)
    }
    const beats = Math.round(s.beats)
    if (beats !== s.beats || beats < 2) {
      out.push({ bar: s.bar, at: s.at, beats: s.beats, midi: root })
      prev = root
      return
    }
    if (beats === 3) {
      const l = lead(root)
      out.push({ bar: s.bar, at: s.at, beats: 2, midi: root }, { bar: s.bar, at: s.at + 2, beats: 1, midi: l })
      prev = l
      return
    }
    const approach = lead(root)
    const tones = new Set(c.tones.map((t) => mod(c.root + t, 12)))
    const palette = new Set([...tones, ...[...scaleSemis(s.scale, c.root)].map((t) => mod(c.root + t, 12))])
    const line = [root]
    for (let k = 1; k < beats - 1; k++) {
      const from = line.at(-1)!
      const left = beats - 1 - k // the steps still to reach the approach note
      const dir = Math.sign(approach - from) || (rnd() < 0.5 ? 1 : -1)
      const steps = Array.from({ length: 5 }, (_, d) => from + dir * (d + 1)).filter((m) => m >= WALK.lo && m <= WALK.hi && palette.has(mod(m, 12)) && Math.abs(approach - m) <= 4 * left + 2)
      const options = steps.length ? steps : [nearest(c.root + (c.fifth ?? 7), from)]
      const weighted = options.flatMap((m) => (tones.has(mod(m, 12)) ? [m, m] : [m]))
      line.push(pick(rnd, weighted))
    }
    line.push(approach)
    line.forEach((midi, k) => out.push({ bar: s.bar, at: s.at + k, beats: 1, midi }))
    prev = approach
  })
  return out
}

/** the bossa bass (decision groove.bossa): the root on a chord's first beat and its 5th two beats on, each a dotted quarter */
function bossaBass(spans: readonly Span[]): VoiceNote[] {
  let prev: number = BASS.centre
  return spans.flatMap((s) => {
    const pc = bassPc(s.text)
    if (pc === null) return []
    const root = nearest(pc, prev)
    prev = root
    const first = { bar: s.bar, at: s.at, beats: Math.min(1.5, s.beats), midi: root }
    if (s.beats < 3) return [first]
    return [first, { bar: s.bar, at: s.at + 2, beats: Math.min(1.5, s.beats - 2), midi: nearest(pc + 7, root) }]
  })
}

/** a set's groove for the drawn bars, its choices from seed (seedOf the chart's title) */
export function grooveFor(set: GrooveSet, bars: readonly HarmonyBar[], seed: number): Groove {
  const rnd = prng(seed)
  const voiced = voicedSpans(bars)
  if (set === 'ballad') return { drums: bars.flatMap((b, bar) => brushDrums(bar, b.beats)), piano: pianoNotes(bars), bass: bassNotes(bars, 'two') }
  if (set === 'bossa') return { drums: bars.flatMap((b, bar) => bossaDrums(bar, b.beats)), piano: comp(voiced, rnd, BOSSA_COMPS), bass: bossaBass(voiced) }
  return { drums: bars.flatMap((b, bar) => swingDrums(bar, b.beats)), piano: comp(voiced, rnd, COMPS, true), bass: walk(voiced, rnd) }
}

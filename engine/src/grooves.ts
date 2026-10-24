/**
 * The pattern sets (#509, roadmap Phase 4; docs/superpowers/specs/2026-10-24-pattern-sets-design.md): a groove for
 * the chart's changes, drums, piano comping and a bass line, chosen by its style (styles.json). Pure: the app plays
 * them (useClick), booked from the click's clock as Hear line's notes are. Each line is reproducible: a chart's
 * groove draws its choices from a PRNG seeded by its title.
 */
import styles from '../styles.json'
import { defaultTempo } from './click'
import { BASS, bassPc, chordOf, type HarmonyBar, scaleSemis, type Span, voicedSpans } from './harmony'
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

/** the comping rhythms (decision groove.swing): onsets and lengths in beats from a chord's start, by the beats it lasts */
const COMPS: Readonly<Record<number, readonly (readonly (readonly [number, number])[])[]>> = {
  4: [
    [[0, 1], [1.5, 0.5]], // the Charleston
    [[1.5, 0.5], [3, 0.75]],
    [[1, 0.75], [3, 0.75]], // 2 and 4
    [[0, 1.5], [2.5, 0.5]],
  ],
  3: [
    [[1, 0.75], [2, 0.75]], // 2 and 3
    [[0, 1], [1.5, 0.5]],
  ],
  2: [[[0, 1]], [[1, 0.75]], [[0.5, 0.5]]],
  1: [[[0, 0.75]]],
}

/** the piano's comping: each chord's voicing struck in a rhythm drawn for it, held no further than its chord */
function comp(spans: ReturnType<typeof voicedSpans>, rnd: () => number): VoiceNote[] {
  return spans.flatMap((s) => {
    if (!s.voicing) return []
    const rhythms = COMPS[s.beats] ?? (s.beats > 4 ? COMPS[4]! : [[[0, Math.min(1, s.beats)] as const]])
    return pick(rnd, rhythms)
      .filter(([on]) => on < s.beats)
      .flatMap(([on, len]) => s.voicing!.map((midi) => ({ bar: s.bar, at: s.at + on, beats: Math.min(len, s.beats - on), midi })))
  })
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

/** a set's groove for the drawn bars, its choices from seed (seedOf the chart's title) */
export function grooveFor(set: GrooveSet, bars: readonly HarmonyBar[], seed: number): Groove {
  const rnd = prng(seed)
  const voiced = voicedSpans(bars)
  const drums = bars.flatMap((b, bar) => swingDrums(bar, b.beats))
  return { drums, piano: comp(voiced, rnd), bass: walk(voiced, rnd) }
}

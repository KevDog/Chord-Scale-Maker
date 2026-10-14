import type { FormPart } from './chart'
import { pitchClasses, rankByFifths, sharedCount } from './ladder'
import { glyphs, pcOf, rootName, shiftBy, type Spelled } from './pitch'
import { SCALES, simplifyRoot } from './scales'

/**
 * Pentatonic tension ladders (issue #255, docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md): a key's 12
 * minor pentatonics by how many notes they share with its scale, walked round the circle of fifths from home (the
 * key's tonic minor: Am in C major, Cm in C minor). Rung d shares 5 5 4 3 2 1 0 notes for d = 0 … 6.
 */
export type PentatonicSide = 'flat' | 'sharp'
/** the player's pick: a rung 0–6 and, where a rung has two, a side */
export type PentatonicView = Readonly<{ rung: number; side: PentatonicSide }>
/** one pentatonic on a key's ladder; name: its root and "m", with glyphs ("E♭m") */
export type PentatonicRung = Readonly<{ rung: number; side: PentatonicSide | null; root: Spelled; name: string; shared: number }>

const MINOR_PENT = pitchClasses(SCALES['minor pentatonic'][0])

const entry = (rung: number, side: PentatonicSide | null, walked: Spelled, scale: ReadonlySet<number>): PentatonicRung => {
  const root = simplifyRoot(walked, 'aeolian')
  return { rung, side, root, name: glyphs(`${rootName(root)}m`), shared: sharedCount(MINOR_PENT, pcOf(root), scale) }
}

/** a key's ladder from its home (written for the part): Home, then 1♭, 1♯ … 5♭, 5♯, then 6 (both walks reach the same pitch class, spelled differently: the ♭ walk's spelling) */
export function pentatonicLadder(home: Spelled): readonly PentatonicRung[] {
  const scale = pitchClasses(SCALES.aeolian[0], pcOf(home))
  const out: PentatonicRung[] = [entry(0, null, home, scale)]
  let flat = home
  let sharp = home
  for (let rung = 1; rung <= 5; rung++) {
    flat = shiftBy(flat, -4, -7) // a fifth down
    sharp = shiftBy(sharp, 4, 7) // a fifth up
    out.push(entry(rung, 'flat', flat, scale), entry(rung, 'sharp', sharp, scale))
  }
  out.push(entry(6, null, shiftBy(flat, -4, -7), scale))
  return out
}

/** the pentatonic at a view's rung and side (the side ignored at 0 and 6) */
export function pentatonicAt(ladder: readonly PentatonicRung[], view: PentatonicView): PentatonicRung {
  const found = ladder.find((r) => r.rung === view.rung && (r.side === null || r.side === view.side))
  if (!found) throw new Error(`no pentatonic at rung ${view.rung}`)
  return found
}

export const isPentatonicView = (v: unknown): v is PentatonicView => {
  if (typeof v !== 'object' || v === null) return false
  const { rung, side } = v as Partial<PentatonicView>
  return Number.isInteger(rung) && rung! >= 0 && rung! <= 6 && (side === 'flat' || side === 'sharp')
}

/** how a chart's sections take their rungs (#264): one rung for all, a preset laid over the form, or edited by hand */
export type PentatonicPathName = 'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'
export const PENTATONIC_PATHS: readonly PentatonicPathName[] = ['one', 'side-slip', 'fifths', 'minor-thirds', 'major-thirds', 'custom']
export const isPentatonicPathName = (v: unknown): v is PentatonicPathName => typeof v === 'string' && (PENTATONIC_PATHS as readonly string[]).includes(v)
export const PENTATONIC_HOME: PentatonicView = { rung: 0, side: 'flat' }
/** a section of the Changes sheet as a preset sees it: its key (the block's section) and whether it is in the form */
export type PentatonicSection = Readonly<{ key: string; part: FormPart }>

/** the rung and side of the pentatonic `semitones` above home: 7s mod 12 fifths, ♯ side up to 6, ♭ side past it */
export function pentatonicStep(semitones: number): PentatonicView {
  const d = (((7 * semitones) % 12) + 12) % 12
  if (d === 0) return PENTATONIC_HOME
  if (d === 6) return { rung: 6, side: 'flat' }
  return d < 6 ? { rung: d, side: 'sharp' } : { rung: 12 - d, side: 'flat' }
}

/** what a preset steps by (#276): each section of the form, each run of one key area, or every `bars` bars of the form */
export type PentatonicStepUnit = 'section' | 'key-area' | 'bars'
export type PentatonicStep = Readonly<{ unit: PentatonicStepUnit; bars: 2 | 4 | 8 }>
export const PENTATONIC_STEP_UNITS: readonly PentatonicStepUnit[] = ['section', 'key-area', 'bars']
export const PENTATONIC_STEP_BARS = [2, 4, 8] as const
export const PENTATONIC_STEP: PentatonicStep = { unit: 'section', bars: 4 }
export const isPentatonicStep = (v: unknown): v is PentatonicStep => {
  if (typeof v !== 'object' || v === null) return false
  const { unit, bars } = v as Partial<PentatonicStep>
  return (PENTATONIC_STEP_UNITS as readonly unknown[]).includes(unit) && (PENTATONIC_STEP_BARS as readonly unknown[]).includes(bars)
}

export const PENTATONIC_PATH_LABELS: Readonly<Record<PentatonicPathName, string>> = {
  one: 'One rung',
  'side-slip': 'Side-slip',
  fifths: 'Fifths',
  'minor-thirds': 'Minor thirds',
  'major-thirds': 'Major thirds',
  custom: 'Custom',
}
/** a path laid over the form by the cycle (not One rung, not a stored Custom) */
export const isPentatonicPreset = (p: PentatonicPathName | undefined): boolean => p !== undefined && p !== 'one' && p !== 'custom'

/** unit i's view under a preset (#276): i steps of it from Home, wrapping round; Home for One rung and Custom */
export function pentatonicCycle(path: PentatonicPathName, i: number): PentatonicView {
  switch (path) {
    case 'side-slip':
      return i % 2 === 1 ? pentatonicStep(1) : PENTATONIC_HOME
    case 'fifths':
      return pentatonicStep(7 * i)
    case 'minor-thirds':
      return pentatonicStep(3 * i)
    case 'major-thirds':
      return pentatonicStep(4 * i)
    default:
      return PENTATONIC_HOME
  }
}

/** "Pentatonics: Minor thirds · every 4 bars"; null for One rung and Custom */
export function pentatonicPathCaption(path: PentatonicPathName, step: PentatonicStep = PENTATONIC_STEP): string | null {
  if (!isPentatonicPreset(path)) return null
  const unit = step.unit === 'bars' ? `every ${step.bars} bars` : step.unit === 'section' ? 'by section' : 'by key area'
  return `Pentatonics: ${PENTATONIC_PATH_LABELS[path]} · ${unit}`
}

/**
 * each section's view under a preset (none for 'one' or 'custom'). The form's sections take roles by position:
 * the first is inside and the last returning (both Home), the one before last outside, any between climbing; with
 * two, inside and outside. Sections outside the form are Home. The thirds presets step section i by i thirds.
 */
export function pentatonicPreset(path: PentatonicPathName, sections: readonly PentatonicSection[]): Readonly<Record<string, PentatonicView>> {
  if (path === 'one' || path === 'custom') return {}
  const form = sections.filter((s) => s.part === 'form').map((s) => s.key)
  const n = form.length
  const outside = n === 2 ? 1 : n - 2
  const climbers = Math.max(0, n - 3)
  const viewAt = (i: number): PentatonicView => {
    if (i === 0 || (n >= 3 && i === n - 1)) return PENTATONIC_HOME
    if (path === 'minor-thirds') return pentatonicStep(3 * i)
    if (path === 'major-thirds') return pentatonicStep(4 * i)
    if (i === outside) return path === 'side-slip' ? pentatonicStep(1) : { rung: 6, side: 'flat' }
    if (path === 'side-slip') return PENTATONIC_HOME
    return { rung: Math.round((6 * i) / (climbers + 1)), side: 'sharp' } // climber i of climbers (i = 1 … climbers)
  }
  const views = new Map(form.map((key, i) => [key, viewAt(i)]))
  return Object.fromEntries(sections.map((s) => [s.key, views.get(s.key) ?? PENTATONIC_HOME]))
}

/** the Scales sheet's Pentatonic practice preset (#266): ranks 1 (closest to the staff's scale) to 12 */
export const PENTATONIC_RANKS = 12
export type PentatonicRank = Readonly<{ rank: number; root: Spelled; name: string; shared: number }>

/** the chord root walked `fifths` round the circle (+ up, − down), spelled as the ladder spells */
const walkFifths = (from: Spelled, fifths: number): Spelled => {
  let n = from
  for (let i = 0; i < Math.abs(fifths); i++) n = fifths > 0 ? shiftBy(n, 4, 7) : shiftBy(n, -4, -7)
  return simplifyRoot(n, 'aeolian')
}

/** the 12 minor pentatonics against a scale (any), most shared first, ties by fewest fifths from the chord root, ♭ side first */
export function pentatonicRanking(scale: ReadonlySet<number>, chordRoot: Spelled): readonly PentatonicRank[] {
  return rankByFifths(MINOR_PENT, scale, pcOf(chordRoot)).map((t, i) => {
    const root = walkFifths(chordRoot, t.fifths)
    return { rank: i + 1, root, name: glyphs(`${rootName(root)}m`), shared: t.shared }
  })
}

/** a staff's pentatonic under the preset: best is rank 1's shared count */
export type StaffPentatonic = Readonly<{ name: string; rank: number; shared: number; best: number }>

/** the pentatonic at `rank` against a staff's notes (their pitch classes, in order), and which notes it lights */
export function pentatonicPick(pcs: readonly number[], chordRoot: Spelled, rank: number): Readonly<{ pentatonic: StaffPentatonic; lit: boolean[] }> {
  const ranked = pentatonicRanking(new Set(pcs), chordRoot)
  const at = ranked[(Number.isInteger(rank) ? Math.min(Math.max(rank, 1), PENTATONIC_RANKS) : 1) - 1]!
  const shape = pitchClasses(SCALES['minor pentatonic'][0]!, pcOf(at.root))
  return { pentatonic: { name: at.name, rank: at.rank, shared: at.shared, best: ranked[0]!.shared }, lit: pcs.map((pc) => shape.has(pc)) }
}

/** "Dm pent"; with the rank and shared count where no pentatonic fits the scale whole ("F♯m pent · #2 · 3 shared") */
export const pentatonicCaption = (p: StaffPentatonic): string => `${p.name} pent${p.best < 5 ? ` · #${p.rank} · ${p.shared} shared` : ''}`

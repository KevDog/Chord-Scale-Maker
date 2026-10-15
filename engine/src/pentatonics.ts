import { pitchClasses, rankByFifths, sharedCount } from './ladder'
import { glyphs, mod, pcOf, rootName, shiftBy, type Spelled } from './pitch'
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
 * the Pentatonic choice (#266, #286): the degree a minor pentatonic is built on, in semitones above the chord root
 * (0 = on the 1 … 11 = on the 7), or Auto: the most shared with the staff's scale, nearest the chord root by fifths
 */
export type PentatonicDegree = 'auto' | number
/** the degrees' names, chromatically from 1 (index = semitones above the chord root) */
export const PENTATONIC_DEGREE_LABELS: readonly string[] = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7']
const isDegree = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 11
/** a degree read from untrusted data (storage, a share link): an integer 0–11, else Auto */
export const pentatonicDegreeFrom = (v: unknown): PentatonicDegree => (isDegree(v) ? v : 'auto')

/** one of a scale's 12 minor pentatonics: the degree it's built on, its root (written), its name ("Dm") and the notes it shares */
export type RankedPentatonic = Readonly<{ degree: number; root: Spelled; name: string; shared: number }>

/** the chord root walked `fifths` round the circle (+ up, − down), spelled as the ladder spells */
const walkFifths = (from: Spelled, fifths: number): Spelled => {
  let n = from
  for (let i = 0; i < Math.abs(fifths); i++) n = fifths > 0 ? shiftBy(n, 4, 7) : shiftBy(n, -4, -7)
  return simplifyRoot(n, 'aeolian')
}

/** the 12 minor pentatonics against a scale (any), most shared first, ties by fewest fifths from the chord root, ♭ side first: the first is Auto */
export function pentatonicRanking(scale: ReadonlySet<number>, chordRoot: Spelled): readonly RankedPentatonic[] {
  const ref = pcOf(chordRoot)
  return rankByFifths(MINOR_PENT, scale, ref).map((t) => {
    const root = walkFifths(chordRoot, t.fifths)
    return { degree: mod(t.root - ref, 12), root, name: glyphs(`${rootName(root)}m`), shared: t.shared }
  })
}

/** a staff's pentatonic under the preset: its name, the degree it's built on (Auto resolved), the notes it shares with the staff; picked: a chord pick (#303); sheet: what the degree plays */
export type StaffPentatonic = Readonly<{ name: string; degree: number; shared: number; picked: boolean; sheet: string }>

/**
 * the pentatonic on `degree` (a bad one reads as Auto) against a staff's notes (their pitch classes, in order), and
 * which notes it lights; a pick (#303, the written pc of its root) plays over the degree
 */
export function pentatonicPick(pcs: readonly number[], chordRoot: Spelled, degree: PentatonicDegree, picked: number | null = null): Readonly<{ pentatonic: StaffPentatonic; lit: boolean[] }> {
  const ranked = pentatonicRanking(new Set(pcs), chordRoot)
  const auto = (isDegree(degree) ? ranked.find((p) => p.degree === degree) : undefined) ?? ranked[0]!
  const found = picked === null ? undefined : ranked.find((p) => pcOf(p.root) === picked)
  const at = found ?? auto
  const shape = pitchClasses(SCALES['minor pentatonic'][0]!, pcOf(at.root))
  return { pentatonic: { name: at.name, degree: at.degree, shared: at.shared, picked: !!found, sheet: auto.name }, lit: pcs.map((pc) => shape.has(pc)) }
}

/** "Dm pent · 5 shared": how inside the choice is, always; " · varies" where the staff's chords have different picks */
export const pentatonicCaption = (p: StaffPentatonic, varies = false): string => `${p.name} pent · ${p.shared} shared${varies ? ' · varies' : ''}`

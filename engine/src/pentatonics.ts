import { pitchClasses, sharedCount } from './ladder'
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

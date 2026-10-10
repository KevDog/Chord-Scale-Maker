import type { Clef } from './instruments'
import { pcOf } from './pitch'
import { type Candidate, type GuideTone, type GuideTones, RANGES } from './voiceLeading'

/**
 * Guide tone lines (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md): two single voices over a chart,
 * line A from the first chord's "3rd" and line B from its "7th", each moving to whichever of the next chord's two
 * guide tones is nearer, so that it steps or holds almost everywhere. Greedy, one chord at a time, so that a reader
 * could apply the rules by hand; the two lines are always built together, since they must differ at every chord.
 * Rule numbers below are the spec's. Pure; no DOM.
 */

/** a line's note at one chord (role 0: the chord's "3rd", 1: its "7th"); held: it repeats the chord before (rule 5) */
export type LineNote = Candidate & Readonly<{ held: boolean }>

type Pair = readonly [Candidate, Candidate] // line A, line B

const tone = (t: GuideTones, role: 0 | 1): GuideTone => (role ? t.seventh : t.third)
const spelledAlike = (x: GuideTone, y: GuideTone): boolean => x.note.letter === y.note.letter && x.note.acc === y.note.acc

/** a guide tone at every octave inside the written range: no other pitch is a candidate (rule 4) */
function octaves(t: GuideTones, role: 0 | 1, clef: Clef): Candidate[] {
  const { lo, hi } = RANGES[clef]
  const { note, label } = tone(t, role)
  const out: Candidate[] = []
  for (let midi = lo; midi <= hi; midi++) if (midi % 12 === pcOf(note)) out.push({ pitch: { letter: note.letter, acc: note.acc, midi }, label, role })
  return out
}

/**
 * the candidate nearest `to` (rule 2); equally near, the one nearer the centre, then the lower (rule 3, and the
 * rulings: also between two octaves of one tone). Every pitch class has an octave in the range, so never null there.
 */
function nearest(cands: readonly Candidate[], to: number, centre: number): Candidate | null {
  const key = (c: Candidate): readonly [number, number, number] => [Math.abs(c.pitch.midi - to), Math.abs(c.pitch.midi - centre), c.pitch.midi]
  const before = (x: Candidate, y: Candidate): boolean => {
    const [kx, ky] = [key(x), key(y)]
    return kx[0] !== ky[0] ? kx[0] < ky[0] : kx[1] !== ky[1] ? kx[1] < ky[1] : kx[2] < ky[2]
  }
  return cands.reduce<Candidate | null>((best, c) => (!best || before(c, best) ? c : best), null)
}

/**
 * rule 7.2: when both lines choose the same tone, the smaller move keeps it; with equal moves, the line moving down
 * (otherwise A, which can't arise: lines on different pitch classes can only meet with equal moves from opposite
 * sides). The other line takes the remaining tone in the octave nearest its own note.
 */
function together(from: Pair, [a, b]: Pair, t: GuideTones, clef: Clef, centre: number): Pair {
  if (a.role !== b.role) return [a, b]
  const [ma, mb] = [a.pitch.midi - from[0].pitch.midi, b.pitch.midi - from[1].pitch.midi]
  const aKeeps = Math.abs(ma) !== Math.abs(mb) ? Math.abs(ma) < Math.abs(mb) : !(mb < 0 && ma >= 0)
  const remaining = (line: Candidate): Candidate => nearest(octaves(t, a.role ? 0 : 1, clef), line.pitch.midi, centre) ?? line
  return aKeeps ? [a, remaining(from[1])] : [remaining(from[0]), b]
}

/**
 * lines A and B, one note per chord in written order (rule 9), or null (a rest in both) for a chord without guide
 * tones, which ends the run (rule 6). blocks: each chord's block on the sheet (none given: all one); a chord that
 * repeats the previous chord's guide tones, by spelling, in the same block holds both lines (rule 5).
 */
export function guideToneLines(tones: readonly (GuideTones | null)[], clef: Clef, blocks: readonly number[] = []): readonly [(LineNote | null)[], (LineNote | null)[]] {
  const centre = (RANGES[clef].comfortLo + RANGES[clef].comfortHi) / 2
  const lines: [(LineNote | null)[], (LineNote | null)[]] = [[], []]
  let last: readonly [number, number] = [centre, centre] // each line's last sounded note: a run starts nearest it (rules 1, 6)
  let prev: Readonly<{ tones: GuideTones; notes: Pair; block: number | undefined }> | null = null
  tones.forEach((t, j) => {
    const block = blocks[j]
    const held = !!t && !!prev && prev.block === block && spelledAlike(prev.tones.third, t.third) && spelledAlike(prev.tones.seventh, t.seventh)
    let notes: Pair | null = null
    if (t && prev && held) notes = [{ ...prev.notes[0], label: tone(t, prev.notes[0].role).label }, { ...prev.notes[1], label: tone(t, prev.notes[1].role).label }]
    else if (t && prev) {
      const all = [...octaves(t, 0, clef), ...octaves(t, 1, clef)]
      const [a, b] = [nearest(all, prev.notes[0].pitch.midi, centre), nearest(all, prev.notes[1].pitch.midi, centre)] // rule 7.1
      if (a && b) notes = together(prev.notes, [a, b], t, clef, centre)
    } else if (t) {
      const [a, b] = [nearest(octaves(t, 0, clef), last[0], centre), nearest(octaves(t, 1, clef), last[1], centre)] // rule 1
      if (a && b) notes = [a, b]
    }
    lines[0].push(notes && { ...notes[0], held })
    lines[1].push(notes && { ...notes[1], held })
    if (notes) last = [notes[0].pitch.midi, notes[1].pitch.midi]
    prev = t && notes ? { tones: t, notes, block } : null
  })
  return lines
}

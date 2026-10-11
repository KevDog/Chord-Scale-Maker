import type { Range } from './instruments'
import { pcOf } from './pitch'
import type { Candidate, GuideTone, GuideTones } from './voiceLeading'

/**
 * Guide tone lines (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md): a single voice over a chart, line A
 * from the first chord's "3rd" or line B from its "7th", moving to whichever of the next chord's two guide tones is
 * nearer, so that it steps or holds almost everywhere. One chord at a time, except that a run's starting octave looks
 * ahead to the next rest (P). Rule 7, the lines taking different tones, is removed
 * (docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md); instead both lines are built together so
 * that lines that meet part gently (G1–G3 and D3, docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md). Rule numbers
 * below are the specs'. Pure; no DOM.
 */

/** a line's note at one chord (role 0: the chord's "3rd", 1: its "7th"); held: it repeats the chord before (rule 5) */
export type LineNote = Candidate & Readonly<{ held: boolean }>

const tone = (t: GuideTones, role: 0 | 1): GuideTone => (role ? t.seventh : t.third)
const spelledAlike = (x: GuideTone, y: GuideTone): boolean => x.note.letter === y.note.letter && x.note.acc === y.note.acc

/** a guide tone at every octave inside the written range: no other pitch is a candidate (rule 4) */
function octaves(t: GuideTones, role: 0 | 1, range: Range): Candidate[] {
  const { lo, hi } = range
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

type Pair = readonly [Candidate, Candidate] // line A, line B

/** a move of at most a tritone (6 semitones) is one a line may make because of the other line (G1–G3) */
const TRITONE = 6
const within = (c: Candidate | null, at: number): Candidate | null => (c && Math.abs(c.pitch.midi - at) <= TRITONE ? c : null)

/**
 * G1–G3 (docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md, "Next: gentle variant"): the lines left a
 * shared pitch `at`; `up` is the line that was above before they met (the other was below). G1: if `at` is a guide tone
 * of this chord, the line below keeps it and the other goes to the chord's other guide tone: its nearest octave above
 * `at` if within a tritone, else its nearest either way if within a tritone, else (G3) it stays with the keeper. G2:
 * otherwise the line above takes its nearest candidate strictly above `at`, the other strictly below, each only within
 * a tritone; a line with none moves as it would alone (rules 2–4), and the lines may coincide again. No candidate at
 * all (only in a range narrower than an octave): null, a rest, as elsewhere.
 */
function meet(t: GuideTones, range: Range, at: number, up: 0 | 1): Pair | null {
  const centre = range.centre
  const all = both(t, range)
  const keep = all.find((c) => c.pitch.midi === at)
  const order = (upper: Candidate, lower: Candidate): Pair => (up ? [lower, upper] : [upper, lower])
  if (keep) {
    const other = octaves(t, keep.role ? 0 : 1, range).filter((c) => c.pitch.midi !== at)
    const moved = within(nearest(other.filter((c) => c.pitch.midi > at), at, centre), at) ?? within(nearest(other, at, centre), at) ?? keep
    return order(moved, keep)
  }
  const alone = nearest(all, at, centre)
  const upper = within(nearest(all.filter((c) => c.pitch.midi > at), at, centre), at) ?? alone
  const lower = within(nearest(all.filter((c) => c.pitch.midi < at), at, centre), at) ?? alone
  return upper && lower ? order(upper, lower) : null
}

type Prev = Readonly<{ tones: GuideTones; block: number | undefined }>
/** a chord that repeats the previous chord's guide tones, by spelling, in the same block (rule 5) */
const holds = (prev: Prev | null, t: GuideTones, block: number | undefined): boolean =>
  !!prev && prev.block === block && spelledAlike(prev.tones.third, t.third) && spelledAlike(prev.tones.seventh, t.seventh)
const both = (t: GuideTones, range: Range): Candidate[] => [...octaves(t, 0, range), ...octaves(t, 1, range)]

/** one line alone from chord j, starting on `start`, up to the next rest (rules 2–5, no meetings): its pitches */
function soloRun(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[], j: number, start: Candidate): number[] {
  const out = [start.pitch.midi]
  let at = start.pitch.midi
  for (let k = j + 1; k < tones.length; k++) {
    const t = tones[k]
    if (!t) break
    const prev = tones[k - 1]
    if (!prev || !holds({ tones: prev, block: blocks[k - 1] }, t, blocks[k])) at = nearest(both(t, range), at, range.centre)?.pitch.midi ?? at
    out.push(at)
  }
  return out
}

/**
 * placing a run (rules 1 and 6, as amended by the diverge note, approved by the user 2026-10-11): of the chosen
 * degree's octaves in range, the one whose run alone, up to the next rest, averages nearest the centre; a tie, the higher
 */
function place(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[], j: number, t: GuideTones, role: 0 | 1): Candidate | null {
  // every octave's run reaches the same rest, so comparing |sum - centre × length| compares the averages, exactly
  const off = (c: Candidate): number => {
    const run = soloRun(tones, range, blocks, j, c)
    return Math.abs(run.reduce((x, y) => x + y, 0) - range.centre * run.length)
  }
  const scored = octaves(t, role, range).map((c) => ({ c, d: off(c) }))
  return scored.reduce<{ c: Candidate; d: number } | null>((best, x) => (!best || x.d < best.d || (x.d === best.d && x.c.pitch.midi > best.c.pitch.midi) ? x : best), null)?.c ?? null
}

/**
 * lines A and B, one note per chord in written order (rule 9), or null (a rest in both) for a chord without guide
 * tones, which ends the run (rule 6). Each line's run is placed nearest the centre (place) and moves by rules 2–6 on
 * its own, except that lines on one pitch part gently at the next new chord (G1–G3, D3): the line that was below before
 * they met keeps the pitch if the chord has it, or else goes down while the other goes up, never more than a tritone
 * because of each other (together since a restart: line A was below). blocks: as guideToneLine.
 */
function guideToneLines(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[]): (readonly [LineNote, LineNote] | null)[] {
  const centre = range.centre
  let up: 0 | 1 = 1 // the line above when they were last apart in this run (none yet: B)
  let prev: (Prev & Readonly<{ notes: Pair }>) | null = null
  return tones.map((t, j) => {
    const block = blocks[j]
    const held = !!t && holds(prev, t, block)
    let notes: Pair | null = null
    if (t && prev && held) {
      const keep = (c: Candidate): Candidate => ({ ...c, label: tone(t, c.role).label })
      notes = [keep(prev.notes[0]), keep(prev.notes[1])]
    } else if (t && prev) {
      const [a, b] = prev.notes
      if (a.pitch.midi === b.pitch.midi) notes = meet(t, range, a.pitch.midi, up) // G1–G3
      else {
        const all = both(t, range)
        const [x, y] = [nearest(all, a.pitch.midi, centre), nearest(all, b.pitch.midi, centre)] // rules 2–4 (D3)
        if (x && y) notes = [x, y]
      }
    } else if (t) {
      up = 1
      const [x, y] = [place(tones, range, blocks, j, t, 0), place(tones, range, blocks, j, t, 1)] // rules 1, 6
      if (x && y) notes = [x, y]
    }
    if (notes && notes[0].pitch.midi !== notes[1].pitch.midi) up = notes[0].pitch.midi > notes[1].pitch.midi ? 0 : 1
    prev = t && notes ? { tones: t, notes, block } : null
    return notes && [{ ...notes[0], held }, { ...notes[1], held }]
  })
}

/**
 * one line, A (from: 'third') or B ('seventh'), one note per chord in written order (rule 9), or null (a rest) for a
 * chord without guide tones, which ends the run (rule 6). Both lines are built together, but only so that lines on one
 * pitch can part (guideToneLines); otherwise each moves on its own (rule 7 stays removed,
 * docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md). blocks: each chord's block on the sheet
 * (none given: all one); a chord that repeats the previous chord's guide tones, by spelling, in the same block holds
 * the note (rule 5).
 */
export function guideToneLine(tones: readonly (GuideTones | null)[], range: Range, from: 'third' | 'seventh', blocks: readonly number[] = []): (LineNote | null)[] {
  const i = from === 'third' ? 0 : 1
  return guideToneLines(tones, range, blocks).map((pair) => pair?.[i] ?? null)
}

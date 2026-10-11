import type { Range } from './instruments'
import { pcOf } from './pitch'
import type { Candidate, GuideTone, GuideTones } from './voiceLeading'

/**
 * Guide tone lines (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md): a single voice over a chart, line A
 * from the first chord's "3rd" or line B from its "7th", moving to whichever of the next chord's two guide tones is
 * nearer, so that it steps or holds almost everywhere. Greedy, one chord at a time, so that a reader could apply the
 * rules by hand; each line is built on its own (docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md
 * removed rule 7, the lines taking different tones). Rule numbers below are the spec's. Pure; no DOM.
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

/**
 * D1, D2 (docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md): the lines left a shared pitch `at`; `up` is
 * the line that goes up (the other goes down). Each takes its nearest candidate strictly on its side; with none there,
 * the nearest strictly on the other side that is not its partner's; with none of those either, its partner's.
 */
function apart(all: readonly Candidate[], at: number, up: 0 | 1, centre: number): Pair {
  const above = all.filter((c) => c.pitch.midi > at)
  const below = all.filter((c) => c.pitch.midi < at)
  const own = (i: 0 | 1): readonly Candidate[] => (i === up ? above : below)
  const other = (i: 0 | 1): readonly Candidate[] => (i === up ? below : above)
  const first: 0 | 1 = own(up).length ? up : up ? 0 : 1 // a line with room on its side chooses first
  const second: 0 | 1 = first ? 0 : 1
  const x = nearest(own(first), at, centre) ?? nearest(other(first), at, centre)
  if (!x) throw new Error('a guide tone has an octave on one side of any pitch in range')
  const y = nearest(own(second), at, centre) ?? nearest(other(second).filter((c) => c.pitch.midi !== x.pitch.midi), at, centre) ?? x
  return first === 0 ? [x, y] : [y, x]
}

/**
 * lines A and B, one note per chord in written order (rule 9), or null (a rest in both) for a chord without guide
 * tones, which ends the run (rule 6). Each line moves by rules 1–6 on its own, except that lines on one pitch leave it
 * in opposite directions at the next new chord (D1–D3): the line that was above before they met goes up (together
 * since a restart: line B). blocks: as guideToneLine.
 */
function guideToneLines(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[]): (readonly [LineNote, LineNote] | null)[] {
  const centre = range.centre
  let last: readonly [number, number] = [centre, centre] // each line's last sounded note: a run starts nearest it (rules 1, 6)
  let up: 0 | 1 = 1 // the line above when they were last apart in this run (none yet: B)
  let prev: Readonly<{ tones: GuideTones; notes: Pair; block: number | undefined }> | null = null
  return tones.map((t, j) => {
    const block = blocks[j]
    const held = !!t && !!prev && prev.block === block && spelledAlike(prev.tones.third, t.third) && spelledAlike(prev.tones.seventh, t.seventh)
    let notes: Pair | null = null
    if (t && prev && held) {
      const keep = (c: Candidate): Candidate => ({ ...c, label: tone(t, c.role).label })
      notes = [keep(prev.notes[0]), keep(prev.notes[1])]
    }
    else if (t && prev) {
      const all = [...octaves(t, 0, range), ...octaves(t, 1, range)]
      const [a, b] = prev.notes
      if (a.pitch.midi === b.pitch.midi) notes = apart(all, a.pitch.midi, up, centre) // D1, D2
      else {
        const [x, y] = [nearest(all, a.pitch.midi, centre), nearest(all, b.pitch.midi, centre)] // rules 2–4 (D3)
        if (x && y) notes = [x, y]
      }
    } else if (t) {
      up = 1
      const [x, y] = [nearest(octaves(t, 0, range), last[0], centre), nearest(octaves(t, 1, range), last[1], centre)] // rule 1
      if (x && y) notes = [x, y]
    }
    if (notes && notes[0].pitch.midi !== notes[1].pitch.midi) up = notes[0].pitch.midi > notes[1].pitch.midi ? 0 : 1
    if (notes) last = [notes[0].pitch.midi, notes[1].pitch.midi]
    prev = t && notes ? { tones: t, notes, block } : null
    return notes && [{ ...notes[0], held }, { ...notes[1], held }]
  })
}

/**
 * one line, A (from: 'third') or B ('seventh'), one note per chord in written order (rule 9), or null (a rest) for a
 * chord without guide tones, which ends the run (rule 6). Both lines are built together, but only so that lines on one
 * pitch can go apart (guideToneLines); otherwise each moves on its own (rule 7 stays removed,
 * docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md). blocks: each chord's block on the sheet
 * (none given: all one); a chord that repeats the previous chord's guide tones, by spelling, in the same block holds
 * the note (rule 5).
 */
export function guideToneLine(tones: readonly (GuideTones | null)[], range: Range, from: 'third' | 'seventh', blocks: readonly number[] = []): (LineNote | null)[] {
  const i = from === 'third' ? 0 : 1
  return guideToneLines(tones, range, blocks).map((pair) => pair?.[i] ?? null)
}

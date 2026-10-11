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

/**
 * one line, A (from: 'third') or B ('seventh'), one note per chord in written order (rule 9), or null (a rest) for a
 * chord without guide tones, which ends the run (rule 6). The line knows nothing of the other: each is built on its
 * own (rule 7 was removed, docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md). blocks: each
 * chord's block on the sheet (none given: all one); a chord that repeats the previous chord's guide tones, by
 * spelling, in the same block holds the note (rule 5).
 */
export function guideToneLine(tones: readonly (GuideTones | null)[], range: Range, from: 'third' | 'seventh', blocks: readonly number[] = []): (LineNote | null)[] {
  const centre = range.centre
  const start: 0 | 1 = from === 'third' ? 0 : 1
  let last = centre // the line's last sounded note: a run starts nearest it (rules 1, 6)
  let prev: Readonly<{ tones: GuideTones; note: Candidate; block: number | undefined }> | null = null
  return tones.map((t, j) => {
    const block = blocks[j]
    const held = !!t && !!prev && prev.block === block && spelledAlike(prev.tones.third, t.third) && spelledAlike(prev.tones.seventh, t.seventh)
    let note: Candidate | null = null
    if (t && prev && held) note = { ...prev.note, label: tone(t, prev.note.role).label }
    else if (t && prev) note = nearest([...octaves(t, 0, range), ...octaves(t, 1, range)], prev.note.pitch.midi, centre) // rules 2–4
    else if (t) note = nearest(octaves(t, start, range), last, centre) // rule 1
    if (note) last = note.pitch.midi
    prev = t && note ? { tones: t, note, block } : null
    return note && { ...note, held }
  })
}

/**
 * lines A and B, each built on its own by guideToneLine. A thin adapter for guideVoices until Task 2 of the
 * independent-lines plan voices one line and deletes it.
 */
export function guideToneLines(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[] = []): readonly [(LineNote | null)[], (LineNote | null)[]] {
  return [guideToneLine(tones, range, 'third', blocks), guideToneLine(tones, range, 'seventh', blocks)]
}

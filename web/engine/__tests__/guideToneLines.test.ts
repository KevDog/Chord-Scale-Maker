import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import { guideToneLine, type LineNote } from '../guideToneLines'
import { guideToneTimeline } from '../guideToneTimeline'
import { guideLabel, guideTonesFor } from '../guideTones'
import { INSTRUMENTS, type InstrumentName } from '../instruments'
import { octaveOf } from '../keySignature'
import { CONCERT, type Part, partFor, rangeOf } from '../part'
import { rootName } from '../pitch'
import { isSyncCopy } from '../util'

const BASS: Part = { clef: 'bass', trans: 'C' }
const TENOR: Part = { clef: 'treble', trans: 'Bb' }

type From = 'third' | 'seventh'

/** a note as the spec's tables write it: "Bb4 (7)", then ~ when held from the chord before */
const text = (n: LineNote | null): string | null => n && `${rootName(n.pitch)}${octaveOf(n.pitch)} (${guideLabel(n.label)})${n.held ? '~' : ''}`
const same = (n: LineNote, t: { note: { letter: number; acc: number }; label: string }): boolean =>
  n.pitch.letter === t.note.letter && n.pitch.acc === t.note.acc && n.label === t.label
/** one line (A: from the 3rd, B: from the 7th) over chords in concert pitch (or for a part), as text per chord */
const lineOf = (chords: readonly string[], part: Part = CONCERT, from: From = 'third', blocks?: readonly number[]): (string | null)[] =>
  guideToneLine(
    chords.map((c) => guideTonesFor(part, c)),
    rangeOf(part),
    from,
    blocks,
  ).map(text)

describe('a guide tone line', () => {
  it('rule 1: line A starts on the 3rd, in the octave nearest the centre (A4)', () => {
    expect(lineOf(['Dm7'], CONCERT, 'third')).toEqual(['F4 (3)'])
    expect(lineOf(['Bb6'], CONCERT, 'third')).toEqual(['D5 (3)'])
  })

  it('rule 1: line B starts on the 7th, in the octave nearest the centre (A4)', () => {
    expect(lineOf(['Dm7'], CONCERT, 'seventh')).toEqual(['C5 (7)'])
    expect(lineOf(['Bb6'], CONCERT, 'seventh')).toEqual(['G4 (6)'])
  })

  it('rule 1: an octave as far above the centre as below takes the lower (Eb4/Eb5 around A4; G2/G3 around C#3)', () => {
    expect(lineOf(['Cm7'], CONCERT, 'third')).toEqual(['Eb4 (3)'])
    expect(lineOf(['Eb7'], BASS, 'third')).toEqual(['G2 (3)'])
  })

  it('rule 2: a common tone before any move (line A: F4 holds as the b7 of G7)', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
  })

  it('rule 2: a step before a leap (line B: C5 to B4)', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'B4 (3)'])
  })

  it('rule 2: with nothing within a step, the smaller leap (line A: A4 to C5, not F4)', () => {
    expect(lineOf(['F7', 'Dm7'], CONCERT, 'third')).toEqual(['A4 (3)', 'C5 (7)'])
    expect(lineOf(['F7', 'Dm7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F4 (3)'])
  })

  it('rule 2: the role follows the nearer tone, so it keeps on a root moving by a step', () => {
    expect(lineOf(['CMaj7', 'Cm7'], CONCERT, 'third')).toEqual(['E4 (3)', 'Eb4 (3)'])
    expect(lineOf(['CMaj7', 'Cm7'], CONCERT, 'seventh')).toEqual(['B4 (7)', 'Bb4 (7)'])
  })

  it('rule 3.1: two tones equally near: the one nearer the centre (line A: B4 rather than F5 from D5)', () => {
    expect(lineOf(['Bb6', 'G7'], CONCERT, 'third')).toEqual(['D5 (3)', 'B4 (3)'])
  })

  it('rule 3.1: two tones equally near, the lower further from the centre: the upper (line A: F#4 rather than D4 from E4)', () => {
    expect(lineOf(['CMaj7', 'D'], CONCERT, 'third')).toEqual(['E4 (3)', 'F#4 (3)'])
  })

  it('rule 3.1 on line B: F#4 rather than C4 from Eb4, both a minor 3rd away', () => {
    expect(lineOf(['F7', 'D7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F#4 (3)'])
  })

  it('rule 3.2: equally near and equally central: the lower (line A: F#4 rather than C5 from A4)', () => {
    expect(lineOf(['F7', 'D7'], CONCERT, 'third')).toEqual(['A4 (3)', 'F#4 (3)'])
  })

  it('rule 4: candidates lie inside the written range: at C4, the bottom of the treble range, B3 is out, so line A turns up to F4', () => {
    expect(lineOf(['C7', 'Am', 'Db7'], CONCERT, 'third')).toEqual(['E4 (3)', 'C4 (3)', 'F4 (3)'])
  })

  it('rule 4: at E2, the bottom of the bass range, Eb2 is out, so line B turns up to G2', () => {
    expect(lineOf(['Ab', 'G', 'Gb', 'F', 'E', 'Eb'], BASS, 'seventh')).toEqual(['Ab2 (1)', 'G2 (1)', 'Gb2 (1)', 'F2 (1)', 'E2 (1)', 'G2 (3)'])
    expect(lineOf(['Ab', 'G', 'Gb', 'F', 'E', 'Eb'], BASS, 'third')).toEqual(['C3 (3)', 'B2 (3)', 'Bb2 (3)', 'A2 (3)', 'G#2 (3)', 'G2 (3)'])
  })

  it('rule 5: a chord repeating the guide tones holds the line (the same chord again, or a change of extension)', () => {
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'third')).toEqual(['E4 (3)', 'E4 (3)~', 'E4 (3)~'])
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'seventh')).toEqual(['Bb4 (7)', 'Bb4 (7)~', 'Bb4 (7)~'])
    expect(lineOf(['Dm7', 'Dm7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'C5 (7)~'])
  })

  it('rule 5: a common tone of a different chord is struck again, not held', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
  })

  it('rule 5: the same two pitches in swapped roles are struck again, not held (F and C: Dm7 3 7, G7sus4 7 4)', () => {
    expect(lineOf(['Dm7', 'G7sus4'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
    expect(lineOf(['Dm7', 'G7sus4'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'C5 (4)'])
  })

  it('rule 5: no hold across a block boundary: the same pitch, struck again', () => {
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'third', [0, 0, 1])).toEqual(['E4 (3)', 'E4 (3)~', 'E4 (3)'])
  })

  it('rule 6: a chord without guide tones rests and the next restarts the line on its own degree (A: the 3rd, B: the 7th)', () => {
    expect(lineOf(['Dm7', 'Cm7#5#9x', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', null, 'B4 (3)']) // not F4
    expect(lineOf(['Dm7', 'Cm7#5#9x', 'G7'], CONCERT, 'seventh')).toEqual(['C5 (7)', null, 'F5 (7)']) // not B4
  })

  it("rule 6: the restart takes the octave nearest the line's last sounded note, or the centre if there is none", () => {
    expect(lineOf(['Dm7', '???', 'G7', '???', 'A7'], CONCERT, 'seventh')).toEqual(['C5 (7)', null, 'F5 (7)', null, 'G5 (7)']) // G5 from F5, not G4
    expect(lineOf(['???', 'A7'], CONCERT, 'seventh')).toEqual([null, 'G4 (7)'])
    expect(lineOf(['C7', '???', 'C7'], CONCERT, 'third')).toEqual(['E4 (3)', null, 'E4 (3)']) // not held over the rest
  })

  it('rule 9: a line does not loop or look ahead: a longer chart only extends it', () => {
    const tune = ['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7']
    for (const from of ['third', 'seventh'] as const) {
      const whole = lineOf(tune, CONCERT, from)
      for (let n = 1; n < tune.length; n++) expect(lineOf(tune.slice(0, n), CONCERT, from)).toEqual(whole.slice(0, n))
    }
  })

  it("rule 10: a guide tone keeps its chord's spelling, whatever the octave (line B: Fb4, then D#4 a half step below it)", () => {
    expect(lineOf(['Gb7', 'B7'], CONCERT, 'seventh')).toEqual(['Fb4 (7)', 'D#4 (3)'])
    expect(lineOf(['Gb7', 'B7'], CONCERT, 'third')).toEqual(['Bb4 (3)', 'A4 (7)'])
  })
})

/** rule 7 is gone (docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md): no collision rule, no trade */
describe('each line built on its own', () => {
  it('Cmaj7 | Ebmaj7: both lines take D (A falls E4 to D4; B rises B4 to D5, the nearer D)', () => {
    expect(lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'third')).toEqual(['E4 (3)', 'D4 (7)'])
    expect(lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'seventh')).toEqual(['B4 (7)', 'D5 (7)'])
  })

  it('both lines may land on the same pitch, where the collision rule once moved one of them', () => {
    expect(lineOf(['F7', 'D7'], CONCERT, 'third')).toEqual(['A4 (3)', 'F#4 (3)'])
    expect(lineOf(['F7', 'D7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F#4 (3)']) // was C4
    expect(lineOf(['Cm6', 'D7'], CONCERT, 'third')).toEqual(['Eb4 (3)', 'F#4 (3)']) // was C4
    expect(lineOf(['Cm6', 'D7'], CONCERT, 'seventh')).toEqual(['A4 (6)', 'F#4 (3)'])
    expect(lineOf(['Fm7', 'GMaj7'], CONCERT, 'third')).toEqual(['Ab4 (3)', 'F#4 (7)']) // was B4 (the trade)
    expect(lineOf(['Fm7', 'GMaj7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F#4 (7)'])
    expect(lineOf(['F', 'G'], CONCERT, 'third')).toEqual(['A4 (3)', 'G4 (1)'])
    expect(lineOf(['F', 'G'], CONCERT, 'seventh')).toEqual(['F4 (1)', 'G4 (1)']) // was B4
  })

  it('a line takes the nearer octave of a tone the other line also takes (B: D5, not F5)', () => {
    expect(lineOf(['Cm', 'Dm', 'Bbm'], CONCERT, 'third')).toEqual(['Eb4 (3)', 'D4 (1)', 'Db4 (3)'])
    expect(lineOf(['Cm', 'Dm', 'Bbm'], CONCERT, 'seventh')).toEqual(['C5 (1)', 'D5 (1)', 'Db5 (3)']) // was F5, Bb4
  })
})

/** the spec's worked examples (treble, concert): each table row is a line, each cell "pitch (label)" */
describe('the worked examples', () => {
  it('ii–V–I in C: Dm7 | G7 | Cmaj7 | Cmaj7, line A', () => {
    expect(lineOf(['Dm7', 'G7', 'CMaj7', 'CMaj7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)', 'E4 (3)', 'E4 (3)~']) // the second Cmaj7 holds (rule 5)
  })

  it('ii–V–I in C: Dm7 | G7 | Cmaj7 | Cmaj7, line B', () => {
    expect(lineOf(['Dm7', 'G7', 'CMaj7', 'CMaj7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'B4 (3)', 'B4 (7)', 'B4 (7)~'])
  })

  const RHYTHM = ['Bb6', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7']
  it('Rhythm changes, bars 1–4: Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7, line A', () => {
    expect(lineOf(RHYTHM, CONCERT, 'third')).toEqual(['D5 (3)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)', 'C5 (7)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)'])
  })

  it('Rhythm changes, bars 1–4: Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7, line B', () => {
    expect(lineOf(RHYTHM, CONCERT, 'seventh')).toEqual(['G4 (6)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)', 'F4 (3)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)'])
  })
})

describe('a guide tone line in an instrument’s range', () => {
  const VIBES = partFor('vibes')

  it('rule 4 on vibes: at C4 line A steps down to Cb4 (written below C4), where the treble default turned up to F4', () => {
    expect(lineOf(['C7', 'Am', 'Db7'], CONCERT, 'third')).toEqual(['E4 (3)', 'C4 (3)', 'F4 (3)']) // the default range: C4 is the floor
    expect(lineOf(['C7', 'Am', 'Db7'], VIBES, 'third')).toEqual(['E4 (3)', 'C4 (3)', 'Cb4 (7)'])
  })

  it('rule 1 on vibes: a line starts in the octave nearest B♭4', () => {
    expect(lineOf(['Dm7'], VIBES, 'third')).toEqual(['F4 (3)'])
    expect(lineOf(['Dm7'], VIBES, 'seventh')).toEqual(['C5 (7)'])
    expect(lineOf(['Ebm7'], VIBES, 'third')).toEqual(['Gb4 (3)']) // Gb4 (66) and Gb5 (78): 4 and 8 from B♭4
  })

  for (const from of ['third', 'seventh'] as const) {
    it(`a trumpet’s line from the ${from} stays within G3–G5 written`, () => {
      const trumpet = partFor('trumpet')
      const line = guideToneLine(['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7'].map((c) => guideTonesFor(trumpet, c)), rangeOf(trumpet), from)
      expect(line.every((n) => n !== null)).toBe(true)
      for (const n of line) expect(n && n.pitch.midi >= 55 && n.pitch.midi <= 79).toBe(true)
    })
  }
})

describe('guide tone lines over the library', () => {
  const LIBRARY = new URL('../../../charts/', import.meta.url)
  const charts = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))

  const PARTS: readonly (readonly [string, Part])[] = [
    ['treble (concert)', CONCERT],
    ['bass', BASS],
    ['Bb tenor', TENOR],
    ...(Object.keys(INSTRUMENTS) as InstrumentName[]).map((n) => [n, partFor(n)] as const),
  ]
  for (const [name, part] of PARTS)
    for (const from of ['third', 'seventh'] as const) {
      it(`${name}, from the ${from}: the line sounds at every voiced chord, on its guide tones, inside the range`, () => {
        expect(charts.length).toBeGreaterThan(200)
        const { lo, hi } = rangeOf(part)
        const faults: string[] = []
        let voiced = 0
        for (const { f, doc } of charts) {
          const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
          const tones = events.map((e) => guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined))
          const line = guideToneLine(tones, rangeOf(part), from)
          if (line.length !== tones.length) faults.push(`${f}: ${line.length} notes for ${tones.length} chords`)
          tones.forEach((t, i) => {
            const n = line[i]
            const at = `${f} chord ${i} (${events[i]?.chord})`
            if (!t) return void (n && faults.push(`${at}: sounds without guide tones`))
            if (!n) return void faults.push(`${at}: rests`)
            voiced++
            if (n.pitch.midi < lo || n.pitch.midi > hi) faults.push(`${at}: ${rootName(n.pitch)}${octaveOf(n.pitch)} out of range`)
            if (!same(n, n.role ? t.seventh : t.third)) faults.push(`${at}: ${rootName(n.pitch)} is not the chord's guide tone`)
          })
        }
        expect(faults).toEqual([])
        expect(voiced).toBeGreaterThan(8000)
      })
    }
})

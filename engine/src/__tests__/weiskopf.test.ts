import { describe, expect, it } from 'vitest'
import { type ChainTriad, chainTriad, hexatonicAuto, hexatonicPairs, keyedPair, keyPair, type TriadQuality } from '../hexatonics'
import { parseRoot, pcOf } from '../pitch'
import { type ScaleKey, spellScale } from '../scales'

/**
 * An oracle from Walt Weiskopf, Intervalic Improvisation (1995), Table of Triad Pairs, pp. 20–22: one cited row per
 * chord-scale, the pair the book gives it. A few rows only; the table itself is the book's.
 */
type Row = Readonly<{ chord: string; root: string; quality: string; scale: ScaleKey; book: readonly [string, TriadQuality, string, TriadQuality]; page: number }>
const ROWS: readonly Row[] = [
  { chord: 'Dm7', root: 'D', quality: 'm7', scale: 'dorian', book: ['F', 'maj', 'G', 'maj'], page: 20 },
  { chord: 'G7', root: 'G', quality: '7', scale: 'mixolydian', book: ['F', 'maj', 'G', 'maj'], page: 20 },
  { chord: 'Cmaj7', root: 'C', quality: 'Maj7', scale: 'ionian', book: ['F', 'maj', 'G', 'maj'], page: 20 },
  { chord: 'Fmaj7♯11', root: 'F', quality: 'Maj7', scale: 'lydian', book: ['F', 'maj', 'G', 'maj'], page: 20 },
  { chord: 'Bm7♭5', root: 'B', quality: 'm7b5', scale: 'locrian', book: ['F', 'maj', 'G', 'maj'], page: 20 },
  { chord: 'Dm(maj7)', root: 'D', quality: 'mMaj7', scale: 'melodic minor', book: ['G', 'maj', 'A', 'aug'], page: 20 },
  { chord: 'G7♯11', root: 'G', quality: '7#11', scale: 'lydian dominant', book: ['G', 'maj', 'A', 'aug'], page: 20 },
  { chord: 'C♯7alt', root: 'C#', quality: '7alt', scale: 'altered', book: ['G', 'maj', 'A', 'aug'], page: 20 },
  { chord: 'Bm9♭5', root: 'B', quality: 'm7b5', scale: 'locrian natural 2', book: ['G', 'maj', 'A', 'aug'], page: 20 },
  { chord: 'Dm(maj7), first cousin', root: 'D', quality: 'mMaj7', scale: 'melodic minor', book: ['G', 'maj', 'A', 'maj'], page: 20 },
  { chord: 'Dm', root: 'D', quality: 'm', scale: 'harmonic minor', book: ['G', 'min', 'A', 'aug'], page: 21 },
  { chord: 'A7♭9', root: 'A', quality: '7b9', scale: 'phrygian dominant', book: ['G', 'min', 'A', 'aug'], page: 21 },
  { chord: 'G7♭9', root: 'G', quality: '7b9', scale: 'half whole diminished', book: ['G', 'maj', 'D♭', 'maj'], page: 21 },
  { chord: 'D°7', root: 'D', quality: 'dim7', scale: 'whole half diminished', book: ['G', 'maj', 'D♭', 'maj'], page: 21 },
  { chord: 'G7♯5', root: 'G', quality: '7', scale: 'whole tone', book: ['G', 'aug', 'A', 'aug'], page: 22 },
]

const triad = (root: string, q: TriadQuality): ChainTriad => chainTriad(parseRoot(root.replace('♭', 'b').replace('♯', '#')), q)
const sameTriad = (a: ChainTriad, b: ChainTriad): boolean => a.pcs.length === b.pcs.length && a.pcs.every((pc) => b.pcs.includes(pc))
const samePair = (a: readonly [ChainTriad, ChainTriad], b: readonly [ChainTriad, ChainTriad]): boolean =>
  (sameTriad(a[0], b[0]) && sameTriad(a[1], b[1])) || (sameTriad(a[0], b[1]) && sameTriad(a[1], b[0]))
const bookPair = (r: Row): readonly [ChainTriad, ChainTriad] => [triad(r.book[0], r.book[1]), triad(r.book[2], r.book[3])]
const pairsOf = (r: Row) => hexatonicPairs(spellScale(parseRoot(r.root), r.scale), parseRoot(r.root), r.quality)

/**
 * Where CSM's Auto (Campbell's chain, ranked by chord-tone coverage then fifths) gives another pair than the book:
 * the list for the owner (#432). Fixing one fails the test until it leaves the list.
 */
const AUTO_DIFFERS = new Set([
  'Dm7',
  'G7',
  'Cmaj7',
  'Fmaj7♯11',
  'Bm7♭5',
  'Dm(maj7)',
  'G7♯11',
  'C♯7alt',
  'Bm9♭5',
  'Dm(maj7), first cousin',
  'Dm',
  'A7♭9',
])

describe("Weiskopf's Table of Triad Pairs (pp. 20–22) against Auto", () => {
  for (const r of ROWS) {
    it(`${r.chord} ${r.scale}: Auto ${AUTO_DIFFERS.has(r.chord) ? 'differs from' : 'matches'} the book (p. ${r.page})`, () => {
      const auto = hexatonicAuto(pairsOf(r), parseRoot(r.root))
      const matches = !!auto && samePair([auto.lower, auto.upper], bookPair(r))
      expect(matches).toBe(!AUTO_DIFFERS.has(r.chord))
    })
  }
})

describe('the key pair (Weiskopf p. 5, pp. 9–10)', () => {
  it('takes the major triads on 4 and 5 of a major key', () => {
    expect(keyPair(parseRoot('C'), 'major').name).toBe('F/G')
    expect(keyPair(parseRoot('Bb'), 'major').name).toBe('E♭/F')
    expect(keyPair(parseRoot('F#'), 'major').name).toBe('B/C♯')
  })

  it('takes harmonic minor\'s iv and augmented V in a minor key', () => {
    expect(keyPair(parseRoot('D'), 'minor').name).toBe('Gm/A+')
    expect(keyPair(parseRoot('C'), 'minor').name).toBe('Fm/G+')
  })

  it("is found in every church mode's chain of its key, under the key's name", () => {
    for (const r of ROWS.filter((r) => r.page === 20 && r.book[3] === 'maj' && r.book[0] === 'F')) {
      const found = keyedPair(pairsOf(r), keyPair(parseRoot('C'), 'major'))
      expect(found?.name, r.chord).toBe('F/G')
      expect(samePair([found!.lower, found!.upper], bookPair(r)), r.chord).toBe(true)
    }
  })

  it("finds harmonic minor's pair on the V7♭9 of the key, whichever way its chain spells the augmented triad", () => {
    const a7 = ROWS.find((r) => r.chord === 'A7♭9')!
    const found = keyedPair(pairsOf(a7), keyPair(parseRoot('D'), 'minor'))
    expect(found?.name).toBe('Gm/A+')
    expect(new Set(found!.tones)).toEqual(new Set(bookPair(a7).flatMap((t) => t.pcs)))
  })

  it("is null where the chord's chain lacks the key's pair", () => {
    const dm = spellScale(parseRoot('D'), 'aeolian')
    expect(keyedPair(hexatonicPairs(dm, parseRoot('D'), 'm7'), keyPair(parseRoot('D'), 'minor'))).toBeNull()
    expect(pcOf(keyPair(parseRoot('D'), 'minor').upper.root)).toBe(9)
  })
})

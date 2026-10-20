import { describe, expect, it } from 'vitest'
import { HEX_GROUPINGS, HEX_PAIRS, hexatonicAuto, hexatonicCaption, hexatonicPick, type HexGrouping, hexatonicPairs, hexatonicRanking, resolvePair, triadChain, type ChainTriad } from '../hexatonics'
import { glyphs, mod, parseRoot, pcOf, rootName, type Spelled } from '../pitch'
import { SCALES, type ScaleKey, spellScale } from '../scales'

const C = parseRoot('C')
const scale = (root: string, key: ScaleKey): readonly Spelled[] => spellScale(parseRoot(root), key)
const SEVEN_NOTE_SCALES = 16 // the 7 major modes, 7 melodic minor modes, harmonic minor and phrygian dominant: a guard that never fired would count 0
const SUFFIX = { maj: '', min: 'm', dim: '°', aug: '+' } as const
const chainNames = (s: readonly Spelled[]): string[] => triadChain(s).map((t: ChainTriad | null) => (t ? t.name : '·'))
const pairNames = (root: string, key: ScaleKey, chordRoot = root, quality: string | null = null): string[] =>
  hexatonicPairs(scale(root, key), parseRoot(chordRoot), quality).map((p) => p.name)

describe('the triad chain', () => {
  it('stacks the seven-note scales from degree 1', () => {
    expect(chainNames(scale('C', 'ionian'))).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'])
    expect(chainNames(scale('C', 'melodic minor'))).toEqual(['Cm', 'Dm', 'E♭+', 'F', 'G', 'A°', 'B°'])
    expect(chainNames(scale('C', 'harmonic minor'))).toEqual(['Cm', 'D°', 'E♭+', 'Fm', 'G', 'A♭', 'B°'])
    expect(triadChain(scale('C', 'harmonic minor')).map((t) => t?.quality)).toEqual(['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'])
  })

  it('stacks harmonic major (not in SCALES) from a spelled scale', () => {
    const harmonicMajor = ['C', 'D', 'E', 'F', 'G', 'Ab', 'B'].map(parseRoot)
    expect(chainNames(harmonicMajor)).toEqual(['C', 'D°', 'Em', 'Fm', 'G', 'A♭+', 'B°'])
  })

  it("follows Campbell's half-whole chain (p. 7), from the first major triad", () => {
    expect(chainNames(scale('C', 'half whole diminished'))).toEqual(['C', 'F♯m', 'E♭', 'Am', 'F♯', 'Cm', 'A', 'E♭m'])
  })

  it('starts whole-half on its degree 2 major triad', () => {
    expect(chainNames(scale('C', 'whole half diminished'))).toEqual(['D', 'A♭m', 'F', 'Bm', 'A♭', 'Dm', 'B', 'Fm'])
  })

  it('marks the links of bebop major that are not triads, and keeps 4 valid pairs', () => {
    expect(chainNames(scale('C', 'bebop major'))).toEqual(['C', 'D°', '·', 'F°', '·', 'A♭°', 'Am', 'B°'])
    expect(pairNames('C', 'bebop major')).toEqual(['C/D°', 'A♭°/Am', 'Am/B°', 'B°/C'])
    expect(hexatonicPairs(scale('C', 'bebop major'), C, null).map((p) => p.link)).toEqual([1, 2, 3, 4])
  })

  it('has no chain on whole tone, and no pairs on blues or the pentatonics', () => {
    expect(triadChain(scale('C', 'whole tone'))).toEqual([])
    for (const key of ['blues', 'major pentatonic', 'minor pentatonic'] as const) expect(pairNames('C', key)).toEqual([])
  })

  it('adds the off-chain pairs of a diminished scale after its chain (#432): the major triads a tritone apart, then the minor ones', () => {
    expect(pairNames('C', 'half whole diminished').slice(8)).toEqual(['C/F♯', 'E♭/A', 'Cm/F♯m', 'E♭m/Am'])
    expect(pairNames('C', 'whole half diminished').slice(8)).toEqual(['D/A♭', 'F/B', 'Dm/A♭m', 'Fm/Bm'])
    expect(hexatonicPairs(scale('C', 'half whole diminished'), C, null).map((p) => p.link)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('pairs the whole-tone scale’s two augmented triads, a whole step apart (#432)', () => {
    expect(pairNames('C', 'whole tone')).toEqual(['C+/D+'])
    expect(pairNames('G', 'whole tone', 'G', '7')).toEqual(['G+/A+'])
    expect(hexatonicPairs(scale('G', 'whole tone'), parseRoot('G'), '7')[0]?.coverage).toBe(3) // G B, and F of A+ (A C♯ F)
  })

  it('pairs the augmented scale’s two augmented triads, a minor third apart (#432)', () => {
    expect(chainNames(scale('C', 'augmented'))).toEqual(['C', '·', 'E', '·', 'G♯', '·'])
    expect(pairNames('C', 'augmented')).toEqual(['C+/D♯+'])
    expect(hexatonicPairs(scale('C', 'augmented'), C, 'Maj7#5')[0]?.coverage).toBe(4)
  })

  it('adds no off-chain pairs to a scale that is not symmetric', () => {
    expect(pairNames('C', 'bebop major')).toHaveLength(4)
    expect(pairNames('C', 'ionian')).toHaveLength(7)
  })

  it("lists major's seven pairs in chain order", () => {
    expect(pairNames('C', 'ionian')).toEqual(['C/Dm', 'Dm/Em', 'Em/F', 'F/G', 'G/Am', 'Am/B°', 'B°/C'])
  })
})

describe('the pairs on every scale', () => {
  const sevenNote: ScaleKey[] = []
  for (const key of Object.keys(SCALES) as ScaleKey[]) {
    it(`${key}: two disjoint triads inside the scale`, () => {
      const s = scale('C', key)
      const pcs = new Set(s.map(pcOf))
      const chain = triadChain(s)
      const pairs = hexatonicPairs(s, C, null)
      for (const p of pairs) {
        const lower = new Set(p.lower.pcs)
        expect(p.upper.pcs.some((pc) => lower.has(pc))).toBe(false)
        expect([...p.lower.pcs, ...p.upper.pcs].every((pc) => pcs.has(pc))).toBe(true)
        expect(new Set(p.tones).size).toBe(6)
        expect(p.name).toBe(`${p.lower.name}/${p.upper.name}`)
        for (const t of [p.lower, p.upper]) {
          const third = t.quality === 'min' || t.quality === 'dim' ? 3 : 4
          const fifth = t.quality === 'dim' ? 6 : t.quality === 'aug' ? 8 : 7
          expect(t.pcs).toEqual([pcOf(t.root), mod(pcOf(t.root) + third, 12), mod(pcOf(t.root) + fifth, 12)])
          expect(t.name).toBe(glyphs(rootName(t.root)) + SUFFIX[t.quality])
        }
      }
      if (s.length === 7 && chain.every((t) => t !== null)) {
        sevenNote.push(key)
        expect(pairs).toHaveLength(7)
        pairs.forEach((p, i) => {
          const left = s.filter((n) => !p.tones.includes(pcOf(n)))
          expect(left).toEqual([s[mod(i - 1, 7)]]) // pair n (i + 1) leaves out degree n − 1
        })
      }
    })
  }
  it('takes the seven-note branch on every scale of seven standard triads', () => {
    expect(sevenNote).toHaveLength(SEVEN_NOTE_SCALES)
  })
})

describe('pair names', () => {
  it("spell with the staff's scale", () => {
    expect(pairNames('C', 'ionian')).toContain('B°/C')
    expect(pairNames('C', 'melodic minor')).toEqual(['Cm/Dm', 'Dm/E♭+', 'E♭+/F', 'F/G', 'G/A°', 'A°/B°', 'B°/Cm'])
    expect(pairNames('F#', 'ionian')).toEqual(['F♯/G♯m', 'G♯m/A♯m', 'A♯m/B', 'B/C♯', 'C♯/D♯m', 'D♯m/E♯°', 'E♯°/F♯'])
    expect(pairNames('Db', 'ionian')[4]).toBe('A♭/B♭m')
  })

  it('lists the six tones ascending from the lower root', () => {
    const [first] = hexatonicPairs(scale('C', 'ionian'), C, null)
    expect(first?.tones).toEqual([0, 2, 4, 5, 7, 9])
    expect(hexatonicPairs(scale('C', 'ionian'), C, null)[6]?.tones).toEqual([11, 0, 2, 4, 5, 7])
  })
})

const pairsOn = (root: string, key: ScaleKey, quality: string | null, chordRoot = root) => hexatonicPairs(scale(root, key), parseRoot(chordRoot), quality)
const auto = (root: string, key: ScaleKey, quality: string | null): string | undefined => hexatonicAuto(pairsOn(root, key, quality), parseRoot(root))?.name

describe('Auto', () => {
  it('picks the worked table', () => {
    expect(auto('C', 'ionian', 'Maj7')).toBe('G/Am')
    expect(auto('D', 'dorian', 'm7')).toBe('C/Dm')
    expect(auto('G', 'mixolydian', '7')).toBe('Dm/Em')
    expect(auto('C', 'half whole diminished', '7')).toBe('C/F♯') // Campbell's table gives E♭/Am; the tritone pair (#432) covers as many and sits on the root
  })

  it("matches the table's coverage-4 pairs", () => {
    const four = (root: string, key: ScaleKey, q: string) => pairsOn(root, key, q).filter((p) => p.coverage === 4).map((p) => p.name)
    expect(four('C', 'ionian', 'Maj7')).toEqual(['Em/F', 'G/Am', 'B°/C'])
    expect(four('D', 'dorian', 'm7')).toEqual(['F/G', 'Am/B°', 'C/Dm'])
    expect(four('G', 'mixolydian', '7')).toEqual(['B°/C', 'Dm/Em', 'F/G'])
    expect(four('C', 'half whole diminished', '7')).toEqual(['E♭/Am', 'E♭m/C', 'C/F♯'])
  })

  it('ranks a pair of major and minor triads ahead of a coverage tie with a diminished one', () => {
    expect(auto('C', 'ionian', 'Maj7')).toBe('G/Am') // over B°/C (coverage 4)
    // Bm7♭5, B Locrian: Am/B° is a fifth nearer (−2) than Dm/Em (−3); the major/minor rule puts Dm/Em first
    expect(pairsOn('B', 'locrian', 'm7b5').filter((p) => p.coverage === 4).map((p) => p.name)).toEqual(['Dm/Em', 'F/G', 'Am/B°'])
    expect(auto('B', 'locrian', 'm7b5')).toBe('Dm/Em')
  })

  it('drops the coverage rule for an unknown quality', () => {
    expect(pairsOn('C', 'ionian', null).every((p) => p.coverage === 0)).toBe(true)
    expect(auto('C', 'ionian', null)).toBe('C/Dm') // fifths alone: the pair on the chord root
    expect(auto('G', 'mixolydian', null)).toBe('G/Am')
  })

  it('has no pick without pairs', () => {
    expect(hexatonicAuto([], C)).toBeNull()
  })
})

describe('hexatonicRanking', () => {
  const TABLE: readonly [string, ScaleKey, string, string][] = [
    ['C', 'ionian', 'Maj7', 'G/Am'],
    ['D', 'dorian', 'm7', 'C/Dm'],
    ['G', 'mixolydian', '7', 'Dm/Em'],
    ['C', 'half whole diminished', '7', 'C/F♯'],
  ]
  it('puts Auto’s pair first on the worked table, and is a permutation of the pairs', () => {
    for (const [root, key, q, first] of TABLE) {
      const pairs = pairsOn(root, key, q)
      const ranked = hexatonicRanking(pairs, parseRoot(root))
      expect(ranked[0]?.name).toBe(first)
      expect(ranked[0]).toBe(hexatonicAuto(pairs, parseRoot(root)))
      expect([...ranked].sort((a, b) => a.link - b.link)).toEqual([...pairs].sort((a, b) => a.link - b.link))
    }
  })
  it('is empty without pairs', () => {
    expect(hexatonicRanking([], C)).toEqual([])
  })
})

describe('resolvePair', () => {
  const major = pairsOn('C', 'ionian', 'Maj7')
  const bebop = pairsOn('C', 'bebop major', 'Maj7')
  it('reads 0 as Auto', () => expect(resolvePair(major, 0, C)?.name).toBe('G/Am'))
  it('takes pair n within the count', () => {
    expect(resolvePair(major, 1, C)?.name).toBe('C/Dm')
    expect(resolvePair(major, 7, C)?.name).toBe('B°/C')
  })
  it('wraps past the end', () => {
    expect(HEX_PAIRS).toBe(8)
    expect(resolvePair(major, 8, C)?.name).toBe('C/Dm')
    expect(resolvePair(bebop, 3, C)?.name).toBe('Am/B°')
    expect(resolvePair(bebop, 6, C)?.name).toBe('A♭°/Am')
  })
  it('is null with no pairs', () => {
    expect(resolvePair([], 0, C)).toBeNull()
    expect(resolvePair(pairsOn('C', 'blues', '7'), 3, C)).toBeNull()
  })
})

/** group A and B pitch classes of the staff's notes, sorted */
const groups = (root: string, key: ScaleKey, quality: string | null, pair: number, grouping: HexGrouping, chordRoot = root) => {
  const s = scale(root, key)
  const { lit, second } = hexatonicPick(s, parseRoot(chordRoot), quality, pair, grouping)
  const pcs = s.map(pcOf)
  const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
  return { a: sorted(pcs.filter((_, i) => lit[i] && !second[i])), b: sorted(pcs.filter((_, i) => second[i])) }
}
const ab = (a: number[], b: number[]) => ({ a: [...a].sort((x, y) => x - y), b: [...b].sort((x, y) => x - y) })

describe('the groupings', () => {
  it('lists four', () => expect(HEX_GROUPINGS).toEqual(['triads', 'tones', 'pent', 'trichords']))

  it('Triad pair: the lower triad, then the upper', () => {
    expect(groups('C', 'ionian', 'Maj7', 1, 'triads')).toEqual(ab([0, 4, 7], [2, 5, 9])) // C/Dm
    expect(groups('C', 'ionian', 'Maj7', 3, 'triads')).toEqual(ab([4, 7, 11], [5, 9, 0])) // Em/F
    expect(groups('C', 'ionian', 'Maj7', 7, 'triads')).toEqual(ab([11, 2, 5], [0, 4, 7])) // B°/C
    expect(groups('C', 'half whole diminished', '7', 3, 'triads')).toEqual(ab([3, 7, 10], [9, 0, 4])) // E♭/Am
  })

  it('Chord tones + color: the chord tones, then the rest', () => {
    expect(groups('C', 'ionian', 'Maj7', 1, 'tones')).toEqual(ab([0, 4, 7], [2, 5, 9]))
    expect(groups('C', 'ionian', 'Maj7', 3, 'tones')).toEqual(ab([4, 7, 11, 0], [5, 9]))
    expect(groups('C', 'ionian', 'Maj7', 7, 'tones')).toEqual(ab([11, 0, 4, 7], [2, 5]))
    expect(groups('C', 'half whole diminished', '7', 3, 'tones')).toEqual(ab([4, 7, 10, 0], [3, 9]))
  })

  it('Chord tones + color: all six as group A for an unknown quality', () => {
    expect(groups('C', 'ionian', null, 1, 'tones')).toEqual(ab([0, 2, 4, 5, 7, 9], []))
  })

  it('Pentatonic + 1: the fifths rule picks between two pentatonics inside', () => {
    expect(groups('C', 'ionian', 'Maj7', 1, 'pent')).toEqual(ab([2, 5, 7, 9, 0], [4])) // Dm (2 fifths from C) over Am (3)
    expect(groups('C', 'ionian', 'Maj7', 1, 'pent', 'A')).toEqual(ab([9, 0, 2, 4, 7], [5])) // Am, on an A chord
  })

  it('Pentatonic + 1: the best four-note fit where none lies inside', () => {
    expect(groups('C', 'ionian', 'Maj7', 3, 'pent')).toEqual(ab([5, 7, 9, 0], [4, 11])) // Em/F: Dm, Em, Am share 4; Dm nearest C
    expect(groups('C', 'ionian', 'Maj7', 7, 'pent')).toEqual(ab([7, 0, 2, 5], [11, 4])) // B°/C: Gm
    expect(groups('C', 'half whole diminished', '7', 3, 'pent')).toEqual(ab([0, 3, 7, 10], [4, 9])) // E♭/Am: Cm
  })

  it('Trichords 3+3: the lowest three from the lower root, then the highest', () => {
    expect(groups('C', 'ionian', 'Maj7', 1, 'trichords')).toEqual(ab([0, 2, 4], [5, 7, 9]))
    expect(groups('C', 'ionian', 'Maj7', 3, 'trichords')).toEqual(ab([4, 5, 7], [9, 11, 0]))
    expect(groups('C', 'ionian', 'Maj7', 7, 'trichords')).toEqual(ab([11, 0, 2], [4, 5, 7]))
    expect(groups('C', 'half whole diminished', '7', 3, 'trichords')).toEqual(ab([3, 4, 7], [9, 10, 0]))
  })
})

describe('hexatonicPick', () => {
  it("lights only the staff's notes in the hexatonic, group B inside them", () => {
    for (const grouping of HEX_GROUPINGS)
      for (let pair = 0; pair <= HEX_PAIRS; pair++) {
        const s = scale('C', 'ionian')
        const { hexatonic, lit, second } = hexatonicPick(s, C, 'Maj7', pair, grouping)
        expect(lit.filter(Boolean)).toHaveLength(6)
        expect(lit).toHaveLength(7)
        expect(second.every((b, i) => !b || lit[i])).toBe(true)
        expect(hexatonic).not.toBeNull()
      }
  })

  it('names the pair it used: Auto, a number, a wrap', () => {
    expect(hexatonicPick(scale('C', 'ionian'), C, 'Maj7', 0, 'triads').hexatonic).toEqual({ name: 'G/Am', link: 5, picked: false, sheet: 'G/Am', offKey: false })
    expect(hexatonicPick(scale('C', 'ionian'), C, 'Maj7', 8, 'triads').hexatonic).toEqual({ name: 'C/Dm', link: 1, picked: false, sheet: 'C/Dm', offKey: false })
  })

  it('maps the pick onto given staff notes (an octave, From X)', () => {
    const pcs = [7, 9, 11, 0, 2, 4, 5, 7] // G to G over C Ionian
    const { lit, second } = hexatonicPick(scale('C', 'ionian'), C, 'Maj7', 5, 'triads', pcs) // G/Am leaves out F
    expect(lit).toEqual([true, true, true, true, true, true, false, true])
    expect(second).toEqual([false, true, false, true, false, true, false, false])
  })

  it('lights nothing where there is no pair', () => {
    const s = scale('C', 'blues')
    const pick = hexatonicPick(s, C, '7', 0, 'triads')
    expect(pick).toEqual({ hexatonic: null, lit: s.map(() => false), second: s.map(() => false) })
  })

  it('captions both forms', () => {
    expect(hexatonicCaption({ name: 'G/Am', link: 5, picked: false, sheet: 'G/Am', offKey: false })).toBe('G/Am hex')
    expect(hexatonicCaption(null)).toBe('no triad pair')
  })

  it('adds varies to the caption (#303)', () => {
    expect(hexatonicCaption({ name: 'G/Am', link: 5, picked: false, sheet: 'G/Am', offKey: false }, true)).toBe('G/Am hex · varies')
    expect(hexatonicCaption({ name: 'G/Am', link: 5, picked: false, sheet: 'G/Am', offKey: true })).toBe('G/Am hex · off key')
    expect(hexatonicCaption(null, true)).toBe('no triad pair')
  })

  it('plays a pick (written roots among the pairs) over the Pair control, and names the control’s as the sheet’s (#303)', () => {
    const s = scale('C', 'ionian')
    const picked = hexatonicPick(s, C, 'Maj7', 0, 'triads', undefined, [0, 2]) // C/Dm over Auto G/Am
    expect(picked.hexatonic).toEqual({ name: 'C/Dm', link: 1, picked: true, sheet: 'G/Am', offKey: false })
    expect(picked.lit).toEqual(s.map((n) => [0, 4, 7, 2, 5, 9].includes(pcOf(n))))
    expect(picked.second).toEqual(s.map((n) => [2, 5, 9].includes(pcOf(n))))
  })

  it('ignores roots not among the pairs (reversed too): the Pair control’s pair, not picked', () => {
    const s = scale('C', 'ionian')
    for (const roots of [[1, 3], [2, 0], [0, 4]] as const) expect(hexatonicPick(s, C, 'Maj7', 8, 'triads', undefined, roots).hexatonic).toEqual({ name: 'C/Dm', link: 1, picked: false, sheet: 'C/Dm', offKey: false })
    expect(hexatonicPick(s, C, 'Maj7', 0, 'triads', undefined, null).hexatonic).toMatchObject({ name: 'G/Am', picked: false })
    expect(hexatonicPick(scale('C', 'blues'), C, '7', 0, 'triads', undefined, [0, 2]).hexatonic).toBeNull() // no pairs: no pick lands
  })
})

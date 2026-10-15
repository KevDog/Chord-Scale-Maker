import { describe, expect, it } from 'vitest'
import { HEX_PAIRS, hexatonicAuto, hexatonicPairs, resolvePair, triadChain, type ChainTriad } from '../hexatonics'
import { mod, parseRoot, pcOf, type Spelled } from '../pitch'
import { SCALES, type ScaleKey, spellScale } from '../scales'

const C = parseRoot('C')
const scale = (root: string, key: ScaleKey): readonly Spelled[] => spellScale(parseRoot(root), key)
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
    for (const key of ['whole tone', 'blues', 'major pentatonic', 'minor pentatonic'] as const) expect(pairNames('C', key)).toEqual([])
  })

  it("lists major's seven pairs in chain order", () => {
    expect(pairNames('C', 'ionian')).toEqual(['C/Dm', 'Dm/Em', 'Em/F', 'F/G', 'G/Am', 'Am/B°', 'B°/C'])
  })
})

describe('the pairs on every scale', () => {
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
          expect(t.name.endsWith(SUFFIX[t.quality]) || t.quality === 'maj').toBe(true)
        }
      }
      if (s.length === 7 && chain.every((t) => t !== null)) {
        expect(pairs).toHaveLength(7)
        pairs.forEach((p, i) => {
          const left = s.filter((n) => !p.tones.includes(pcOf(n)))
          expect(left).toEqual([s[mod(i - 1, 7)]]) // pair n (i + 1) leaves out degree n − 1
        })
      }
    })
  }
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
    expect(auto('C', 'half whole diminished', '7')).toBe('E♭/Am')
  })

  it("matches the table's coverage-4 pairs", () => {
    const four = (root: string, key: ScaleKey, q: string) => pairsOn(root, key, q).filter((p) => p.coverage === 4).map((p) => p.name)
    expect(four('C', 'ionian', 'Maj7')).toEqual(['Em/F', 'G/Am', 'B°/C'])
    expect(four('D', 'dorian', 'm7')).toEqual(['F/G', 'Am/B°', 'C/Dm'])
    expect(four('G', 'mixolydian', '7')).toEqual(['B°/C', 'Dm/Em', 'F/G'])
    expect(four('C', 'half whole diminished', '7')).toEqual(['E♭/Am', 'E♭m/C'])
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

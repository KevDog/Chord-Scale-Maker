import { HEX_GROUPING_LABELS, HEX_GROUPINGS, HEX_PAIRS, type HexatonicBasis, type HexGrouping } from '@chord-scale-maker/engine'

/** the Practice panel's Hexatonic controls (docs/superpowers/specs/2026-10-14-hexatonic-practice-design.md): Pair 0 (Auto) … HEX_PAIRS, and the grouping */
export const hexPairLabel = (pair: number): string => (pair === 0 ? 'Auto' : String(pair))
export const HEX_PAIR_CHOICES: readonly number[] = Array.from({ length: HEX_PAIRS + 1 }, (_, i) => i)
export const HEX_GROUPING_CHOICES: readonly { value: HexGrouping; label: string }[] = HEX_GROUPINGS.map((value) => ({ value, label: HEX_GROUPING_LABELS[value] }))
export const groupingLabel = (g: HexGrouping): string => HEX_GROUPING_LABELS[g] ?? ''

/** what the Hexatonic pairs rank against (#432): each chord's own scale (Auto), or its key area's IV and V triads */
export const HEX_BASES: readonly { value: HexatonicBasis; label: string; title: string }[] = [
  { value: 'key', label: 'Key', title: 'One pair per key area: its IV and V triads (harmonic minor’s iv and V+ in minor), where the chord’s scale holds them' },
  { value: 'chord', label: 'Chord', title: 'Each chord’s own pair, from its scale (Auto)' },
]

/** the legend's names for groups A and B; Pentatonic + 1's group B is often two notes, so never "+1" */
export const HEX_GROUP_NAMES: Readonly<Record<HexGrouping, readonly [string, string]>> = {
  triads: ['Lower triad', 'Upper triad'],
  tones: ['Chord tones', 'Color'],
  pent: ['Pentatonic', 'Other'],
  trichords: ['Lower three', 'Upper three'],
}

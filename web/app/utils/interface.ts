import { type Approach, isHexatonicSelection, isPentatonicSelection, type PracticeSelection, type RhythmId, type ScaleLevel } from '@chord-scale-maker/engine'
import type { LineMode } from '~/utils/sheetLine'
import type { Overlay } from '~/utils/overlay'
import type { Spell } from '~/utils/scaleChoices'
import type { SheetKind } from '~/utils/sheets'

/** the Interface setting (#273, docs/superpowers/specs/2026-10-14-interface-levels-design.md): which controls show; each level a superset of the one before */
export type InterfaceLevel = 'essentials' | 'intermediate' | 'everything'
export const INTERFACE_LEVELS: readonly InterfaceLevel[] = ['essentials', 'intermediate', 'everything']
export const isInterfaceLevel = (s: string): s is InterfaceLevel => (INTERFACE_LEVELS as readonly string[]).includes(s)
const LABELS: Readonly<Record<InterfaceLevel, string>> = { essentials: 'Essentials', intermediate: 'Intermediate', everything: 'Everything' }
export const levelLabel = (l: InterfaceLevel): string => LABELS[l]

/** the lowest level that shows each control above Essentials; a control not here shows at every level */
export const CONTROL_TIERS = {
  'scale-level': 'intermediate', // Level and Shuffle
  analysis: 'intermediate', // Numerals, Scales toggles
  line: 'intermediate', // Line modes, guide line, arpeggio pattern
  spell: 'intermediate', // Spell Scale
  practice: 'intermediate', // the Practice panel
  patterns: 'intermediate', // the Patterns sheet (#298)
  cells: 'intermediate', // the Cells line's cell choice (#298), its Order and Phrase (#376)
  approaches: 'intermediate', // the guide tone line's Approach listbox (#298)
  rhythm: 'intermediate', // the Changes sheet's rhythm line and target beats (rhythm spec §9)
  'scale-choice': 'intermediate', // a chord's scale: the scale label picker, ChordChoices' Scale section
  'form-editing': 'intermediate', // Repeat a section, Write out, endings, segno, coda, Jump, New section here, Paste bars
  why: 'intermediate', // the "why" notes on numerals and scales, ChordChoices' why
  pentatonics: 'everything', // Analysis: Superimpose and its sub-controls
  'chord-picks': 'everything', // the chord pick popovers on both sheets (#303)
  'practice-pentatonic': 'everything', // the Practice panel's Pentatonic preset
  'practice-hexatonic': 'everything', // the Practice panel's Hexatonic preset, its Pair and grouping
  'practice-quartal': 'everything', // the Practice panel's Quartal preset, its Built on, Notes and Perfect only (#432)
  'key-change': 'everything', // Key change here
  'function-choice': 'everything', // the numeral label picker, ChordChoices' Function section
  source: 'everything', // Show/Hide source, Source, Chart text
} as const satisfies Readonly<Record<string, Exclude<InterfaceLevel, 'essentials'>>>
export type ControlId = keyof typeof CONTROL_TIERS

const rank = (l: InterfaceLevel): number => INTERFACE_LEVELS.indexOf(l)
export const shows = (level: InterfaceLevel, id: ControlId): boolean => rank(level) >= rank(CONTROL_TIERS[id])

/** the sheet's settings a control governs: what decides the notice */
export type ViewSettings = Readonly<{ sheet: SheetKind; scaleLevel: ScaleLevel; numerals: boolean; scaleNames: boolean; lineMode: LineMode; spell: Spell; practice: PracticeSelection | null; overlay: Overlay; picks: boolean; approach: Approach; rhythm: RhythmId; targets: boolean }> // picks: live chord picks of the kind the sheet shows (#303)
export type HiddenSetting = 'scale-level' | 'numerals' | 'scale-names' | 'line' | 'spell' | 'practice' | 'pentatonics' | 'chord-picks' | 'patterns' | 'approaches' | 'rhythm'

/** each setting away from its default on this sheet, and the level its control needs */
function setAway(v: ViewSettings): readonly (readonly [HiddenSetting, InterfaceLevel])[] {
  const changes = v.sheet === 'changes'
  const scales = v.sheet === 'scales'
  return [
    ...((changes || scales) && v.scaleLevel !== 'standard' ? [['scale-level', 'intermediate'] as const] : []),
    ...(changes && !v.numerals ? [['numerals', 'intermediate'] as const] : []),
    ...(changes && !v.scaleNames ? [['scale-names', 'intermediate'] as const] : []),
    ...(changes && v.lineMode !== 'off' ? [['line', 'intermediate'] as const] : []),
    ...(scales && v.spell !== 'key' ? [['spell', 'intermediate'] as const] : []),
    ...(scales && v.practice ? [['practice', isPentatonicSelection(v.practice) || isHexatonicSelection(v.practice) ? 'everything' : 'intermediate'] as const] : []),
    ...(changes && v.overlay !== 'off' ? [['pentatonics', 'everything'] as const] : []), // Superimpose's control id
    ...(changes && v.approach !== 'none' ? [['approaches', 'intermediate'] as const] : []),
    ...(changes && (v.rhythm !== 'off' || v.targets) ? [['rhythm', 'intermediate'] as const] : []),
    ...(v.sheet === 'patterns' ? [['patterns', 'intermediate'] as const] : []),
    ...((changes || scales) && v.picks ? [['chord-picks', 'everything'] as const] : []),
  ]
}

/** the settings in force whose controls this level hides, and the lowest level that shows them all; null when none */
export function hiddenSettings(level: InterfaceLevel, v: ViewSettings): Readonly<{ settings: readonly HiddenSetting[]; needs: InterfaceLevel }> | null {
  const hidden = setAway(v).filter(([, needs]) => rank(needs) > rank(level))
  if (!hidden.length) return null
  const needs = INTERFACE_LEVELS[Math.max(...hidden.map(([, n]) => rank(n)))] ?? 'everything'
  return { settings: hidden.map(([s]) => s), needs }
}

/** a stored level; else Everything for a browser that already holds preferences (no returning player loses a control), else Essentials */
export function initialLevel(stored: string | null, keys: readonly string[]): InterfaceLevel {
  if (stored !== null && isInterfaceLevel(stored)) return stored
  return keys.some((k) => k.startsWith('csm-') && k !== 'csm-interface') ? 'everything' : 'essentials'
}

import { type ArpeggioPattern, isArpeggioPattern, type SheetLine } from '@chord-scale-maker/engine'

/** the Changes sheet's line as the toolbar picks it: a mode, and each mode's own choice */
export type LineMode = 'off' | 'guide' | 'arpeggio'
export type GuideFrom = 'third' | 'seventh'

/** the line shown: the mode with its choice; with the arpeggios flag off, an arpeggio mode shows none */
export const sheetLineOf = (mode: LineMode, guide: GuideFrom, arpeggio: ArpeggioPattern, arpeggiosOn: boolean): SheetLine =>
  mode === 'guide' ? guide : mode === 'arpeggio' && arpeggiosOn ? arpeggio : 'off'

/** a line (a share link's) as the mode and the choice it sets */
export function lineChoiceOf(line: SheetLine | undefined): Readonly<{ mode: LineMode; guide?: GuideFrom; arpeggio?: ArpeggioPattern }> {
  if (line === 'third' || line === 'seventh') return { mode: 'guide', guide: line }
  if (isArpeggioPattern(line)) return { mode: 'arpeggio', arpeggio: line }
  return { mode: 'off' }
}

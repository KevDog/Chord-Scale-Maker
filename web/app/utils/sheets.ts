/** the preview's sheets: the Changes (a study lead sheet), chord scales, arpeggios and practice patterns (one staff per scale line) */
export type SheetKind = 'scales' | 'changes' | 'arpeggios' | 'patterns'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'scales', label: 'Scales' },
  { value: 'arpeggios', label: 'Arpeggios' },
  { value: 'patterns', label: 'Patterns' },
]

/** the sheets on offer: Patterns only with its flag on (#298) */
export const sheetsFor = (patterns: boolean): readonly { value: SheetKind; label: string }[] => (patterns ? SHEETS : SHEETS.filter((s) => s.value !== 'patterns'))

/** the sheet a chart opens on: a share link's own sheet (a Patterns link needs the flag), else the Changes */
export const firstSheet = (shared: SheetKind | undefined, patterns = false): SheetKind => (shared === 'patterns' && !patterns ? 'changes' : (shared ?? 'changes'))

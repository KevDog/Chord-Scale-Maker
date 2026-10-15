/** the preview's sheets: the Changes (a study lead sheet), chord scales and arpeggios (one staff per scale line) */
export type SheetKind = 'scales' | 'changes' | 'arpeggios'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'scales', label: 'Scales' },
  { value: 'arpeggios', label: 'Arpeggios' },
]

/** the sheet a chart opens on: a share link's own sheet, else the Changes */
export const firstSheet = (shared: SheetKind | undefined): SheetKind => shared ?? 'changes'

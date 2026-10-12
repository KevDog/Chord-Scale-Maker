/** the preview's sheets: the Changes (a study lead sheet), chord scales and arpeggios (one staff per scale line) */
export type SheetKind = 'scales' | 'changes' | 'arpeggios'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'scales', label: 'Scales' },
  { value: 'arpeggios', label: 'Arpeggios' },
]

/** the sheet a chart opens on: a share link's own sheet (Arpeggios only with its flag), else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ changes: boolean; arpeggios: boolean }>): SheetKind {
  if (shared === 'arpeggios' && on.arpeggios) return 'arpeggios'
  return shared === 'scales' || !on.changes ? 'scales' : 'changes'
}

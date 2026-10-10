/** the preview's sheets: chord scales (one staff per chord), or the Changes (a study lead sheet, with guide tones on request) */
export type SheetKind = 'scales' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'changes', label: 'Changes' },
]

/** the sheet a chart opens on: a share link's own sheet, else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ changes: boolean }>): SheetKind {
  return shared === 'scales' || !on.changes ? 'scales' : 'changes'
}

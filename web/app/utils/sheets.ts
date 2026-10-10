/** the preview's sheets: chord scales (one staff per chord), guide tone lines, or the Changes (a study lead sheet) */
export type SheetKind = 'scales' | 'guideTones' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'guideTones', label: 'Guide Tones' },
  { value: 'changes', label: 'Changes' },
]

/** the sheet a chart opens on: a share link's own sheet if it's on, else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ guideTones: boolean; changes: boolean }>): SheetKind {
  if (shared === 'guideTones' && on.guideTones) return 'guideTones'
  if (shared === 'scales' || !on.changes) return 'scales'
  return 'changes'
}

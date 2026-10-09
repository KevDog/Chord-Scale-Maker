/** the preview's sheets: chord scales (one staff per chord), guide tone lines, or the Changes (a study lead sheet) */
export type SheetKind = 'scales' | 'guideTones' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'guideTones', label: 'Guide tones' },
  { value: 'changes', label: 'Changes' },
]

/** the preview's sheets: chord scales (one staff per chord) or guide tone lines */
export type SheetKind = 'scales' | 'guideTones'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'guideTones', label: 'Guide tones' },
]

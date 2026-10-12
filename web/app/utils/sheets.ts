import type { ShareSheet } from '@chord-scale-maker/engine'

/** the preview's sheets: chord scales (one staff per chord), or the Changes (a study lead sheet, with guide tones on request) */
export type SheetKind = 'scales' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'scales', label: 'Scales' },
]

/** the sheet a chart opens on: a share link's own sheet, else the Changes (Scales when that sheet is off); an Arpeggios link has no sheet in the preview yet, so it opens as a plain Changes */
export function firstSheet(shared: ShareSheet | undefined, on: Readonly<{ changes: boolean }>): SheetKind {
  return shared === 'scales' || !on.changes ? 'scales' : 'changes'
}

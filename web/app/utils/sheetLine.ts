import { type ArpDirection, type ArpeggioPattern, type CellId, type CellOrder, type ChangesLineChoice, isArpeggioPattern, isCellId, isCellOrder, type PairLineShape, type PentatonicLeave, type ShareLine, type SheetLine } from '@chord-scale-maker/engine'
import type { Overlay } from '~/utils/overlay'

/** the Changes sheet's line as the toolbar picks it: a mode, and each mode's own choice */
export type LineMode = 'off' | 'guide' | 'arpeggio' | 'cells'
export type GuideFrom = 'third' | 'seventh'

/** the line shown: the mode with its choice */
export const sheetLineOf = (mode: LineMode, guide: GuideFrom, arpeggio: ArpeggioPattern): SheetLine =>
  mode === 'guide' ? guide : mode === 'arpeggio' ? arpeggio : 'off'

/** the line as a share link carries it: the Cells line is cells:<id>, then ~<order> unless as written and ~free with Phrase off (#376) */
export function shareLineOf(mode: LineMode, guide: GuideFrom, arpeggio: ArpeggioPattern, cells: CellId, order: CellOrder = 'as-written', phrase = true): ShareLine {
  if (mode !== 'cells') return sheetLineOf(mode, guide, arpeggio)
  const suffix = [...(order === 'as-written' ? [] : [order]), ...(phrase ? [] : ['free'])].join('~')
  return suffix ? `cells:${cells}~${suffix}` : `cells:${cells}`
}

/**
 * the line the Changes sheet draws: the stored line, but the arpeggio slot under the Pentatonic overlay is the
 * Pentatonic line (#284), each chord's labelled pentatonic in cells less `leave`, and under the Hexatonic overlay the
 * Triad pair line (#325), each chord's labelled pair a triad at a time in its shape (#432), and under the Quartal the Quartal line (#432); all going `dir` (its pattern kept for a chord with none)
 */
export function changesLineOf(c: Readonly<{ mode: LineMode; guide: GuideFrom; arpeggio: ArpeggioPattern; overlay: Overlay; leave: PentatonicLeave; dir: ArpDirection; cells: CellId; shape?: PairLineShape; order?: CellOrder; phrase?: boolean }>): ChangesLineChoice {
  if (c.mode === 'cells' && c.overlay === 'off') return { kind: 'cells', id: c.cells, ...(c.order ? { order: c.order } : {}), ...(c.phrase === undefined ? {} : { phrase: c.phrase }) }
  // a stored Cells line shares the 7th Chords slot (#298), so under an overlay the slot plays the overlay line
  if ((c.mode === 'arpeggio' || c.mode === 'cells') && c.overlay === 'pentatonic') return { kind: 'pentatonic', leave: c.leave, dir: c.dir, arpeggio: c.arpeggio }
  if ((c.mode === 'arpeggio' || c.mode === 'cells') && c.overlay === 'hexatonic') return { kind: 'triad-pair', dir: c.dir, arpeggio: c.arpeggio, shape: c.shape ?? 'nearest' }
  if ((c.mode === 'arpeggio' || c.mode === 'cells') && c.overlay === 'quartal') return { kind: 'quartal', dir: c.dir, arpeggio: c.arpeggio }
  return sheetLineOf(c.mode, c.guide, c.arpeggio)
}

/** whether the Approach leads the line (#381): the guide tone line, and the 7th Chords and Cells lines while no Superimpose takes their slot */
export const approachApplies = (mode: LineMode, overlay: Overlay): boolean => mode === 'guide' || ((mode === 'arpeggio' || mode === 'cells') && overlay === 'off')

/** the Line control's modes: the arpeggio slot reads Pentatonic under the Pentatonic overlay (#284), Triad pair under the Hexatonic (#325), Quartal under the Quartal (#432), 7th Chords otherwise; the Cells line (#298) lives in that slot's listbox, not a mode of its own */
export function lineModes(overlay: Overlay): readonly { value: LineMode; label: string; title: string }[] {
  return [
    { value: 'off', label: 'Off', title: 'No line: slashes' },
    { value: 'guide', label: 'Guide Tones', title: "A line that starts on the first chord's 3rd or 7th and moves to the nearest guide tone of each chord" },
    overlay === 'pentatonic'
      ? { value: 'arpeggio', label: 'Pentatonic', title: "Each chord's pentatonic, as its label shows it, in four-note cells: quarters, eighths or sixteenths as the bar has one, two or more chords" }
      : overlay === 'hexatonic'
        ? { value: 'arpeggio', label: 'Triad pair', title: "Each chord's triad pair, as its label shows it, a triad at a time: quarters, eighths or sixteenths as the bar has one, two or more chords" }
        : overlay === 'quartal'
          ? { value: 'arpeggio', label: 'Quartal', title: "Each chord's stack of fourths, as its label shows it, then its next stacks, each played whole: quarters, eighths or sixteenths as the bar has one, two or more chords" }
          : { value: 'arpeggio', label: '7th Chords', title: "Each chord's four chord tones, arpeggiated: quarters, eighths or sixteenths as the bar has one, two or more chords" },
  ]
}

/** a line (a share link's) as the mode and the choice it sets */
export function lineChoiceOf(line: ShareLine | undefined): Readonly<{ mode: LineMode; guide?: GuideFrom; arpeggio?: ArpeggioPattern; cells?: CellId; order?: CellOrder; phrase?: boolean }> {
  if (typeof line === 'string' && line.startsWith('cells:')) {
    const [id, ...suffixes] = line.slice(6).split('~')
    return isCellId(id) ? { mode: 'cells', cells: id, order: suffixes.find(isCellOrder) ?? 'as-written', phrase: !suffixes.includes('free') } : { mode: 'off' }
  }
  if (line === 'third' || line === 'seventh') return { mode: 'guide', guide: line }
  if (isArpeggioPattern(line)) return { mode: 'arpeggio', arpeggio: line }
  return { mode: 'off' }
}

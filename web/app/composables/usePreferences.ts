import type { Ref, WritableComputedRef } from 'vue'
import { type Approach, type ArpDirection, type CellId, fitRange, formatPattern, isCellId, parsePattern, type PatternNotes, type ArpeggioPattern, type ArpNotes, type InstrumentName, INSTRUMENTS, isApproach, isArpDirection, isArpeggioPattern, isArpNotes, isInstrumentName, isPatternNotes, isPentatonicLeave, type PentatonicBasis, PENTATONIC_LEAVE, type PentatonicLeave, type PentatonicDegree, pentatonicDegreeFrom, type PentatonicSide, type Range, type ShareView } from '@chord-scale-maker/engine'
import { type GuideFrom, type LineMode, lineChoiceOf } from '~/utils/sheetLine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'
import { isSpell, type Spell } from '~/utils/scaleChoices'
import { isOverlay, type Overlay } from '~/utils/overlay'

/** the pattern the Changes sheet and the Patterns sheet start with */
export const DEFAULT_PATTERN = '+1 +1 +1 −2'

/** a pattern's canonical text, or undefined when it doesn't parse */
function canonicalPattern(text: string): string | undefined {
  const parsed = parsePattern(text)
  return 'moves' in parsed ? formatPattern(parsed.moves) : undefined
}

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** #359: the player's range for the instrument, kept per instrument ("58-82" under csm-range-<name>, fitted when read); the preset's until set */
function rangeRef(instrument: Ref<InstrumentName>): WritableComputedRef<Range> {
  const read = (name: InstrumentName): Range => {
    const m = /^(\d+)-(\d+)$/.exec(readStored(`csm-range-${name}`) ?? '')
    return m ? fitRange(name, { lo: Number(m[1]), hi: Number(m[2]) }) : INSTRUMENTS[name].range
  }
  const range = ref(read(instrument.value))
  watch(instrument, (name) => (range.value = read(name)))
  return computed({
    get: () => range.value,
    set: (r) => {
      range.value = r
      writeStored(`csm-range-${instrument.value}`, `${r.lo}-${r.hi}`)
    },
  })
}

/** the preview's instrument, spelling (from the chart's key until another is picked) and interval labels, and whether the editor is shown, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (s === 'concert' ? 'piano' : isInstrumentName(s) ? s : undefined), 'piano') // #332: 'concert', the retired choice, reads as piano
  const spell = storedRef<Spell>('csm-spell', (s) => (isSpell(s) ? s : undefined), 'key') // csm-start, the old note, is ignored
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor: hidden until shown, song-first
  // the Changes sheet's study rows: each chord's numeral and its scale, both on until turned off
  const numerals = storedRef<boolean>('csm-numerals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  const scaleNames = storedRef<boolean>('csm-scale-names', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the Changes sheet's line: off, guide tones (from the 3rd or the 7th) or 7th chord arpeggios (a pattern) or cells; off until
  // chosen. A stored Cells line with the flag off reads as Off but stays stored, for when the flag is on again
  const cellsOn = useFeature('cells')
  const lineMode = storedRef<LineMode>('csm-line', (s) => (s === 'off' || s === 'guide' || s === 'arpeggio' || (s === 'cells' && cellsOn) ? s : undefined), 'off')
  const guideLine = storedRef<GuideFrom>('csm-guide-line', (s) => (s === 'third' || s === 'seventh' ? s : undefined), 'third')
  const arpeggio = storedRef<ArpeggioPattern>('csm-arpeggio', (s) => (isArpeggioPattern(s) ? s : undefined), 'up-root')
  // the guide tone line's Approach (#298): None until chosen; with the flag off a stored one reads as None but stays stored
  const approachesOn = useFeature('approaches')
  const approach = storedRef<Approach>('csm-approach', (s) => (isApproach(s) && approachesOn ? s : undefined), 'none')
  // the Cells line's system or cell (#298)
  const cells = storedRef<CellId>('csm-cells', (s) => (isCellId(s) ? s : undefined), '3rd-3rd')
  // the Arpeggios sheet: 7th chords or extended, and the direction
  const arpNotes = storedRef<ArpNotes>('csm-arp-notes', (s) => (isArpNotes(s) ? s : undefined), 'seventh')
  const arpDir = storedRef<ArpDirection>('csm-arp-dir', (s) => (isArpDirection(s) ? s : undefined), 'up')
  // the Patterns sheet (#298): the moves (kept in canonical text; text that doesn't parse is the default), what they run over, the direction
  const pattern = storedRef<string>('csm-pattern', canonicalPattern, DEFAULT_PATTERN, (v) => canonicalPattern(v) ?? v)
  const patternNotes = storedRef<PatternNotes>('csm-pattern-notes', (s) => (isPatternNotes(s) ? s : undefined), 'scale')
  const patternDir = storedRef<ArpDirection>('csm-pattern-dir', (s) => (isArpDirection(s) ? s : undefined), 'up')
  // the Changes sheet's overlay row: Off until chosen (a value it can't read is Off); the old Pentatonics toggle (#255), on, reads as Pentatonic
  const overlay = storedRef<Overlay>('csm-overlay', (s) => (isOverlay(s) ? s : 'off'), readStored('csm-pentatonics') === 'on' ? 'pentatonic' : 'off')
  // the Pentatonic overlay's rung (0 Home … 6) and side
  const pentRung = storedRef<number>('csm-pent-rung', (s) => (/^[0-6]$/.test(s) ? Number(s) : undefined), 0)
  const pentSide = storedRef<PentatonicSide>('csm-pent-side', (s) => (s === 'flat' || s === 'sharp' ? s : undefined), 'flat')
  // #272: what the row ranks against; #286: the degree the chord basis builds on (csm-pent-rank, the old 1–12, is ignored: Auto)
  const pentBasis = storedRef<PentatonicBasis>('csm-pent-basis', (s) => (s === 'key' || s === 'chord' ? s : undefined), 'key')
  const pentDegree = storedRef<PentatonicDegree>('csm-pent-degree', (s) => pentatonicDegreeFrom(/^\d+$/.test(s) ? Number(s) : s), 'auto')
  // #284: the Pentatonic line's Leave out (its direction is arpDir's)
  const pentLeave = storedRef<PentatonicLeave>('csm-pent-leave', (s) => (isPentatonicLeave(s) ? s : undefined), PENTATONIC_LEAVE)
  // the editor's Source (the chart's text): hidden until shown
  const source = storedRef<boolean>('csm-source', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the /functions page's key: C major until another is picked
  const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')
  return { instrument, range: rangeRef(instrument), spell, intervals, showEditor, numerals, scaleNames, lineMode, guideLine, approach, arpeggio, cells, arpNotes, arpDir, pattern, patternNotes, patternDir, overlay, pentRung, pentSide, pentBasis, pentDegree, pentLeave, source, functionsKey }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const choice = lineChoiceOf(view.line)
  // a link's spelling: from the root, its note, or (from, without a note) the key
  const note = PICKER_ROOTS.find((r) => r === view.start)
  const linked: Spell | undefined = view.mode === 'root' ? 'root' : view.mode === 'from' ? (note ?? 'key') : undefined
  const instrument = ref<InstrumentName>(view.instrument ?? own.instrument.value)
  return {
    instrument,
    range: rangeRef(instrument), // not in links: yours, for the link's instrument (#359)
    spell: ref<Spell>(linked ?? own.spell.value),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    numerals: ref<boolean>(view.numerals ?? own.numerals.value),
    scaleNames: ref<boolean>(view.scaleNames ?? own.scaleNames.value),
    lineMode: ref<LineMode>(choice.mode === 'cells' && !useFeature('cells') ? 'off' : choice.mode), // a link without a line (or a Cells line, the flag off) shows none
    guideLine: ref<GuideFrom>(choice.guide ?? own.guideLine.value),
    approach: ref<Approach>(useFeature('approaches') ? (view.approach ?? 'none') : 'none'), // a link shows what it was sent with: none without
    arpeggio: ref<ArpeggioPattern>(choice.arpeggio ?? own.arpeggio.value),
    cells: ref<CellId>(choice.cells ?? own.cells.value),
    arpNotes: ref<ArpNotes>(view.arpNotes ?? own.arpNotes.value),
    arpDir: ref<ArpDirection>(view.arpDir ?? own.arpDir.value),
    pattern: ref<string>((view.pattern && canonicalPattern(view.pattern)) || own.pattern.value),
    patternNotes: ref<PatternNotes>(view.patternNotes ?? own.patternNotes.value),
    patternDir: ref<ArpDirection>(view.patternDir ?? own.patternDir.value),
    overlay: own.overlay, // not in links: yours
    pentRung: own.pentRung,
    pentSide: own.pentSide,
    pentBasis: own.pentBasis,
    pentDegree: own.pentDegree,
    pentLeave: ref<PentatonicLeave>(view.pentLeave ?? own.pentLeave.value), // the link's, else yours (an old link has none), as arpDir
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    source: own.source,
  }
}

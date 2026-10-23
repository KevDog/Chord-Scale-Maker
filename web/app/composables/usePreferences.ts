import type { Ref, WritableComputedRef } from 'vue'
import { type Approach, type ArpDirection, type CellId, type CellOrder, CHROMATIC_CELLS, fitRange, formatPattern, isCellId, parsePattern, type PatternNotes, type ArpeggioPattern, type ArpNotes, type InstrumentName, INSTRUMENTS, isApproach, isArpDirection, isArpeggioPattern, isArpNotes, isCellOrder, isInstrumentName, isAnticipate, isRhythmStart, type RhythmStart, isPairLineShape, isPairShape, isPatternNotes, isPentatonicLeave, isNotesPerBar, isRhythmId, type NotesPerBar, type RhythmId, type HexatonicBasis, type PairLineShape, type PairShape, type QuartalNotesChoice, type PentatonicBasis, PENTATONIC_LEAVE, type PentatonicLeave, type PentatonicDegree, pentatonicDegreeFrom, type PentatonicSide, type Range, type ShareView } from '@chord-scale-maker/engine'
import { type GuideFrom, type LineMode, lineChoiceOf } from '~/utils/sheetLine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'
import { isSpell, type Spell } from '~/utils/scaleChoices'
import { isOverlay, type Overlay } from '~/utils/overlay'
import { isGearsRhythm } from '~/utils/rhythmText'

/** the pattern the Changes sheet and the Patterns sheet start with */
export const DEFAULT_PATTERN = '+1 +1 +1 −2'

/** the Cells line's cell until another is picked */
const DEFAULT_CELLS: CellId = '3rd-3rd'

/** a chromatic cell (#377): under the phraseCells flag */
const isChromatic = (id: CellId): boolean => CHROMATIC_CELLS.some((c) => c.id === id)

/** a pattern's canonical text, or undefined when it doesn't parse */
function canonicalPattern(text: string): string | undefined {
  const parsed = parsePattern(text)
  return 'moves' in parsed ? formatPattern(parsed.moves) : undefined
}

/** a stored Notes per bar: 'whole' or 1 to 7 */
function notesPerBarFrom(s: string): NotesPerBar | undefined {
  const n = s === 'whole' ? s : /^[1-7]$/.test(s) ? Number(s) : undefined
  return isNotesPerBar(n) ? n : undefined
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
  // the Changes sheet's rhythm line and target beats (rhythm spec §9): Off until chosen; with the flag off stored ones read as off but stay stored
  // a rhythm at a tuplet pulse plays with the rhythmGears flag on only (Phase 4 spec D8); off, it reads as off but stays stored
  const rhythmOn = useFeature('rhythm')
  const gearsOn = useFeature('rhythmGears')
  const rhythm = storedRef<RhythmId>('csm-rhythm', (s) => (isRhythmId(s) && rhythmOn && (gearsOn || !isGearsRhythm(s)) ? s : undefined), 'off')
  const targets = storedRef<boolean>('csm-targets', (s) => (rhythmOn && (s === 'on' || s === 'off') ? s === 'on' : undefined), false, (v) => (v ? 'on' : 'off'))
  // where the rhythm starts, its timing and Restate (rhythm spec §10): on the beat, on time and off until chosen
  const rhythmStart = storedRef<RhythmStart>('csm-rhythm-start', (s) => (isRhythmStart(s) && rhythmOn ? s : undefined), 'beat')
  const anticipate = storedRef<number>('csm-anticipate', (s) => (rhythmOn && isAnticipate(Number(s)) ? Number(s) : undefined), 0, String)
  const restate = storedRef<boolean>('csm-guide-restate', (s) => (rhythmOn && (s === 'on' || s === 'off') ? s === 'on' : undefined), false, (v) => (v ? 'on' : 'off'))
  // the Scales sheet's Notes per bar (rhythm-scales-arpeggios spec §9): Whole notes until chosen, and with the rhythmSheets flag off (stored still)
  const rhythmSheetsOn = useFeature('rhythmSheets')
  const notesPerBar = storedRef<NotesPerBar>('csm-notes-per-bar', (s) => (rhythmSheetsOn ? notesPerBarFrom(s) : undefined), 'whole')
  // the Cells line's system or cell (#298); a chromatic cell (#377) with the flag off reads as the default but stays stored
  const phraseOn = useFeature('phraseCells')
  const cells = storedRef<CellId>('csm-cells', (s) => (isCellId(s) && (phraseOn || !isChromatic(s)) ? s : undefined), DEFAULT_CELLS)
  // its Order and Phrase (#376): as written and on until chosen; with the flag off stored ones read as those but stay stored
  const cellsOrder = storedRef<CellOrder>('csm-cells-order', (s) => (isCellOrder(s) && phraseOn ? s : undefined), 'as-written')
  const cellsPhrase = storedRef<boolean>('csm-cells-phrase', (s) => (phraseOn && (s === 'on' || s === 'off') ? s === 'on' : undefined), true, (v) => (v ? 'on' : 'off'))
  // the Arpeggios sheet: 7th chords, extended or triad pairs, the direction, and Triad pairs' shape (#436)
  const arpNotes = storedRef<ArpNotes>('csm-arp-notes', (s) => (isArpNotes(s) ? s : undefined), 'seventh')
  const arpDir = storedRef<ArpDirection>('csm-arp-dir', (s) => (isArpDirection(s) ? s : undefined), 'up')
  const arpShape = storedRef<PairShape>('csm-arp-shape', (s) => (isPairShape(s) ? s : undefined), 'arpeggiated')
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
  // #432: what the Hexatonic pairs rank against: each chord's scale (Auto) until Key is chosen
  const hexBasis = storedRef<HexatonicBasis>('csm-hex-basis', (s) => (s === 'key' || s === 'chord' ? s : undefined), 'chord')
  // #432: the Quartal overlay's stacks: notes a stack (Auto, by the range, until 3 or 4 is chosen), and perfect fourths only (off until on)
  const quartNotes = storedRef<QuartalNotesChoice>('csm-quart-notes', (s) => (s === '3' ? 3 : s === '4' ? 4 : s === 'auto' ? 'auto' : undefined), 'auto')
  const quartPerfect = storedRef<boolean>('csm-quart-perfect', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  const pentDegree = storedRef<PentatonicDegree>('csm-pent-degree', (s) => pentatonicDegreeFrom(/^\d+$/.test(s) ? Number(s) : s), 'auto')
  // #284: the Pentatonic line's Leave out (its direction is arpDir's)
  const pentLeave = storedRef<PentatonicLeave>('csm-pent-leave', (s) => (isPentatonicLeave(s) ? s : undefined), PENTATONIC_LEAVE)
  // #432: the Triad pair line's shape (its direction is arpDir's): Nearest until chosen
  const pairLine = storedRef<PairLineShape>('csm-pair-line', (s) => (isPairLineShape(s) ? s : undefined), 'nearest')
  // the editor's Source (the chart's text): hidden until shown
  const source = storedRef<boolean>('csm-source', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the /functions page's key: C major until another is picked
  const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')
  return { instrument, range: rangeRef(instrument), spell, intervals, showEditor, numerals, scaleNames, lineMode, guideLine, approach, rhythm, targets, rhythmStart, anticipate, restate, notesPerBar, arpeggio, cells, cellsOrder, cellsPhrase, arpNotes, arpDir, arpShape, pattern, patternNotes, patternDir, overlay, pentRung, pentSide, pentBasis, pentDegree, pentLeave, pairLine, hexBasis, quartNotes, quartPerfect, source, functionsKey }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const choice = lineChoiceOf(view.line)
  const phraseOn = useFeature('phraseCells')
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
    rhythm: ref<RhythmId>(useFeature('rhythm') && (useFeature('rhythmGears') || !isGearsRhythm(view.rhythm ?? 'off')) ? (view.rhythm ?? 'off') : 'off'), // a link shows what it was sent with: off without (or at a tuplet pulse, the rhythmGears flag off)
    targets: ref<boolean>(useFeature('rhythm') ? (view.targets ?? false) : false),
    rhythmStart: ref<RhythmStart>(useFeature('rhythm') ? (view.rhythmStart ?? 'beat') : 'beat'),
    anticipate: ref<number>(useFeature('rhythm') ? (view.anticipate ?? 0) : 0),
    restate: ref<boolean>(useFeature('rhythm') ? (view.restate ?? false) : false),
    notesPerBar: ref<NotesPerBar>(useFeature('rhythmSheets') ? (view.notesPerBar ?? 'whole') : 'whole'), // a link shows what it was sent with: Whole notes without
    arpeggio: ref<ArpeggioPattern>(choice.arpeggio ?? own.arpeggio.value),
    cells: ref<CellId>(choice.cells === undefined ? own.cells.value : phraseOn || !isChromatic(choice.cells) ? choice.cells : DEFAULT_CELLS), // a chromatic cell (#377), the flag off: the default
    cellsOrder: ref<CellOrder>(phraseOn ? (choice.order ?? 'as-written') : 'as-written'), // a link shows what it was sent with: as written and on without (#376)
    cellsPhrase: ref<boolean>(phraseOn ? (choice.phrase ?? true) : true),
    arpNotes: ref<ArpNotes>(view.arpNotes ?? own.arpNotes.value),
    arpDir: ref<ArpDirection>(view.arpDir ?? own.arpDir.value),
    arpShape: ref<PairShape>(view.arpShape ?? own.arpShape.value),
    pattern: ref<string>((view.pattern && canonicalPattern(view.pattern)) || own.pattern.value),
    patternNotes: ref<PatternNotes>(view.patternNotes ?? own.patternNotes.value),
    patternDir: ref<ArpDirection>(view.patternDir ?? own.patternDir.value),
    overlay: own.overlay, // not in links: yours
    pentRung: own.pentRung,
    pentSide: own.pentSide,
    pentBasis: own.pentBasis,
    pentDegree: own.pentDegree,
    hexBasis: own.hexBasis,
    quartNotes: own.quartNotes,
    quartPerfect: own.quartPerfect,
    pentLeave: ref<PentatonicLeave>(view.pentLeave ?? own.pentLeave.value), // the link's, else yours (an old link has none), as arpDir
    pairLine: ref<PairLineShape>(view.pairLine ?? own.pairLine.value), // likewise
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    source: own.source,
  }
}

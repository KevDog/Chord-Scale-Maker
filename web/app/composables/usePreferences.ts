import type { Ref } from 'vue'
import { type ArpDirection, type ArpeggioPattern, type ArpNotes, type InstrumentName, isArpDirection, isArpeggioPattern, isArpNotes, isInstrumentName, type PentatonicBasis, type PentatonicSide, type ShareView } from '@chord-scale-maker/engine'
import { type GuideFrom, type LineMode, lineChoiceOf } from '~/utils/sheetLine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'
import { isSpell, type Spell } from '~/utils/scaleChoices'
import { isOverlay, type Overlay } from '~/utils/overlay'

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** the preview's instrument, spelling (from the chart's key until another is picked) and interval labels, and whether the editor is shown, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (isInstrumentName(s) ? s : undefined), 'concert')
  const spell = storedRef<Spell>('csm-spell', (s) => (isSpell(s) ? s : undefined), 'key') // csm-start, the old note, is ignored
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor: hidden until shown, song-first
  // the Changes sheet's study rows: each chord's numeral and its scale, both on until turned off
  const numerals = storedRef<boolean>('csm-numerals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  const scaleNames = storedRef<boolean>('csm-scale-names', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the Changes sheet's line: off, guide tones (from the 3rd or the 7th) or 7th chord arpeggios (a pattern); off until chosen
  const lineMode = storedRef<LineMode>('csm-line', (s) => (s === 'off' || s === 'guide' || s === 'arpeggio' ? s : undefined), 'off')
  const guideLine = storedRef<GuideFrom>('csm-guide-line', (s) => (s === 'third' || s === 'seventh' ? s : undefined), 'third')
  const arpeggio = storedRef<ArpeggioPattern>('csm-arpeggio', (s) => (isArpeggioPattern(s) ? s : undefined), 'up-root')
  // the Arpeggios sheet: 7th chords or extended, and the direction
  const arpNotes = storedRef<ArpNotes>('csm-arp-notes', (s) => (isArpNotes(s) ? s : undefined), 'seventh')
  const arpDir = storedRef<ArpDirection>('csm-arp-dir', (s) => (isArpDirection(s) ? s : undefined), 'up')
  // the Changes sheet's overlay row: Off until chosen (a value it can't read is Off); the old Pentatonics toggle (#255), on, reads as Pentatonic
  const overlay = storedRef<Overlay>('csm-overlay', (s) => (isOverlay(s) ? s : 'off'), readStored('csm-pentatonics') === 'on' ? 'pentatonic' : 'off')
  // the Pentatonic overlay's rung (0 Home … 6) and side
  const pentRung = storedRef<number>('csm-pent-rung', (s) => (/^[0-6]$/.test(s) ? Number(s) : undefined), 0)
  const pentSide = storedRef<PentatonicSide>('csm-pent-side', (s) => (s === 'flat' || s === 'sharp' ? s : undefined), 'flat')
  // #272: what the row ranks against, and the chord basis's rank
  const pentBasis = storedRef<PentatonicBasis>('csm-pent-basis', (s) => (s === 'key' || s === 'chord' ? s : undefined), 'key')
  const pentRank = storedRef<number>('csm-pent-rank', (s) => (/^([1-9]|1[0-2])$/.test(s) ? Number(s) : undefined), 1)
  // the editor's Source (the chart's text): hidden until shown
  const source = storedRef<boolean>('csm-source', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the /functions page's key: C major until another is picked
  const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')
  return { instrument, spell, intervals, showEditor, numerals, scaleNames, lineMode, guideLine, arpeggio, arpNotes, arpDir, overlay, pentRung, pentSide, pentBasis, pentRank, source, functionsKey }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const choice = lineChoiceOf(view.line)
  // a link's spelling: from the root, its note, or (from, without a note) the key
  const note = PICKER_ROOTS.find((r) => r === view.start)
  const linked: Spell | undefined = view.mode === 'root' ? 'root' : view.mode === 'from' ? (note ?? 'key') : undefined
  return {
    instrument: ref<InstrumentName>(view.instrument ?? own.instrument.value),
    spell: ref<Spell>(linked ?? own.spell.value),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    numerals: ref<boolean>(view.numerals ?? own.numerals.value),
    scaleNames: ref<boolean>(view.scaleNames ?? own.scaleNames.value),
    lineMode: ref<LineMode>(choice.mode), // a link without a line shows none
    guideLine: ref<GuideFrom>(choice.guide ?? own.guideLine.value),
    arpeggio: ref<ArpeggioPattern>(choice.arpeggio ?? own.arpeggio.value),
    arpNotes: ref<ArpNotes>(view.arpNotes ?? own.arpNotes.value),
    arpDir: ref<ArpDirection>(view.arpDir ?? own.arpDir.value),
    overlay: own.overlay, // not in links: yours
    pentRung: own.pentRung,
    pentSide: own.pentSide,
    pentBasis: own.pentBasis,
    pentRank: own.pentRank,
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    source: own.source,
  }
}

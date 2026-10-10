import { parseChart } from '../chart'
import { enharmonics, pcOf, rootName, type Spelled } from '../pitch'
import { functionRoot, parseFunction } from './functions'
import { analyse } from './index'
import { type Key, keyCode } from './keys'
import type { Family } from './stream'

/**
 * The reference page's table (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §1.2): each function the
 * rules know, in a key, with the chord it puts there and the scale the rules give it. Not a lookup: each row is a
 * one-row chart `<chord> | <function>` through analyse(), so the page can't drift from the engine. Pure.
 */

export type FunctionGroup = 'diatonic' | 'secondary' | 'substitutes' | 'chromatic'
export const FUNCTION_GROUPS: readonly Readonly<{ id: FunctionGroup; title: string }>[] = [
  { id: 'diatonic', title: 'Diatonic' },
  { id: 'secondary', title: 'Secondary' },
  { id: 'substitutes', title: 'Substitutes and borrowings' },
  { id: 'chromatic', title: 'Chromatic' },
]
/** fn: as the sheet writes it; fallback: the rules could only guess */
export type FunctionRow = Readonly<{ group: FunctionGroup; fn: string; chord: string; scale: string | null; rule: string; reason: string; fallback: boolean }>

/** the 30 keys: every major and minor key signature */
export const CATALOGUE_KEYS: readonly string[] = [
  ...['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  ...['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'],
]

/** a function's chord quality as a chart writes it, by family and by the sheet's written suffix */
const QUALITY: Readonly<Record<Family, Readonly<Record<string, string>>>> = {
  major: { '': '', maj7: 'Maj7', 'maj7♯5': 'Maj7#5', '6': '6' },
  dominant: { '7': '7' },
  minor: { '': 'm', '7': 'm7', '6': 'm6', '(maj7)': 'mMaj7' },
  halfdim: { ø7: 'm7b5' },
  dim: { '°7': 'dim7' },
  sus: { '7sus': '7sus4' },
}

const MAJOR_DIATONIC = ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']
const MINOR_DIATONIC = ['i7', 'iiø7', '♭IIImaj7', 'iv7', 'v7', 'V7', '♭VImaj7', '♭VII7', 'vii°7']
/** the diatonic chords a secondary function can lead to: not the tonic, not a ø7 or °7 */
const MAJOR_TARGETS = ['ii', 'iii', 'IV', 'V', 'vi']
const MINOR_TARGETS = ['♭III', 'iv', 'v', '♭VI', '♭VII']
const isMinorTarget = (t: string): boolean => t === t.toLowerCase()

function rowsFor(key: Key): readonly (readonly [FunctionGroup, string])[] {
  const targets = key.minor ? MINOR_TARGETS : MAJOR_TARGETS
  return [
    ...(key.minor ? MINOR_DIATONIC : MAJOR_DIATONIC).map((fn) => ['diatonic', fn] as const),
    // a minor target takes the minor ii–V's iiø7 (iiø7/vi); a major one the major ii–V's ii7 (ii7/IV)
    ...targets.flatMap((t) => [['secondary', `V7/${t}`] as const, ['secondary', `${isMinorTarget(t) ? 'iiø7' : 'ii7'}/${t}`] as const]),
    ...[
      'subV7',
      ...targets.map((t) => `subV7/${t}`),
      ...(key.minor ? [] : ['♭VII7', '♭VImaj7', '♭IIImaj7']),
      '♭IImaj7',
      'IV7',
      'I7',
      '♯iv°7',
      ...targets.map((t) => `vii°7/${t}`),
      'V7sus',
    ].map((fn) => ['substitutes', fn] as const),
    ...['♭vi7', '♯ivø7', '♭iii°7', 'II7', '♯IV7'].map((fn) => ['chromatic', fn] as const),
  ]
}

/** a root a chart can read: a double accidental (F## for vii°7/iii in E) is respelled by its plainest enharmonic */
function readable(root: Spelled): Spelled {
  if (Math.abs(root.acc) <= 1) return root
  const best = enharmonics(root).sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc) || Number(Math.sign(b.acc) === Math.sign(root.acc)) - Number(Math.sign(a.acc) === Math.sign(root.acc)))[0]
  return best && pcOf(best) === pcOf(root) ? best : root
}

function tonicChord(key: Key): string {
  const f = parseFunction(key.minor ? 'i7' : 'Imaj7')
  return typeof f === 'string' ? '' : rootName(functionRoot(f, key)) + (key.minor ? 'm7' : 'Maj7')
}

/** one function in the key, through the real pipeline; null when the function won't read */
function rowOf(group: FunctionGroup, text: string, key: Key): FunctionRow | null {
  const f = parseFunction(text)
  if (typeof f === 'string') return null
  const written = f.text.replace(/^(sub)?[♭♯]?[ivIV]+/, '').replace(/\/.*$/, '')
  const quality = QUALITY[f.family][written] ?? ''
  const chord = `${rootName(readable(functionRoot(f, key)))}${quality}`
  // a diminished chord with no target is read between tonics, where the rules can only call it passing (a guess)
  const between = group === 'chromatic' && f.family === 'dim' ? `A | 1 | ${tonicChord(key)} | |\n` : ''
  const doc = parseChart(`key: ${keyCode(key)}\nbars: ${between ? 2 : 1}\n${between}A | ${between ? 2 : 1} | ${chord} | | ${text}\n`).value
  const a = analyse(doc).rows.at(-1)
  if (!a) return null
  return { group, fn: f.text, chord, scale: a.scale, rule: a.rule, reason: a.reason.replace(/^\* /, ''), fallback: !!a.fallback }
}

export function functionsTable(key: Key): readonly FunctionRow[] {
  return rowsFor(key).flatMap(([group, text]) => rowOf(group, text, key) ?? [])
}

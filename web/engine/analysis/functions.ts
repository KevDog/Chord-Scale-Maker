import { mod, parseRoot, pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { type Key, keyText, parseKey, sameKey } from './keys'
import { glyph, ownNumeral } from './numerals'
import { roman } from './rules'
import type { Family } from './stream'

/**
 * An author's harmonic function for a row, the chart's fifth cell (docs/superpowers/specs/2026-10-09-chart-functions-
 * design.md): the numerals the Changes sheet prints, read back. Relative to the row's key area, or to the key before
 * a colon ("D: V7/ii"). Degrees count from the key's tonic as in a major key (roman()): ♭III in C minor is E♭.
 */

export type Degree = Readonly<{ steps: number; semis: number }>
export type Target = Degree & Readonly<{ minor: boolean }>
export type StatedFunction = Readonly<{
  /** in the Changes sheet's spelling: "V7/ii", "♭VII7", "iiø7/vi" (without the key) */
  text: string
  /** the key before a colon; null: the row's key area */
  key: Key | null
  /** a tritone substitute: subV7 */
  sub: boolean
  degree: Degree
  family: Family
  /** the chord it leads to, as a degree of the key; null when it names none */
  target: Target | null
}>

const ROMAN: Readonly<Record<string, Degree>> = {
  I: { steps: 0, semis: 0 },
  II: { steps: 1, semis: 2 },
  III: { steps: 2, semis: 4 },
  IV: { steps: 3, semis: 5 },
  V: { steps: 4, semis: 7 },
  VI: { steps: 5, semis: 9 },
  VII: { steps: 6, semis: 11 },
}
const NUMERAL = 'VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i'
/** each quality spelling, and how the Changes sheet writes it */
const SUFFIXES: Readonly<Record<string, string>> = {
  '': '',
  maj7: 'maj7',
  Maj7: 'maj7',
  M7: 'maj7',
  maj: 'maj7',
  'maj7#5': 'maj7♯5',
  '6': '6',
  m: '',
  m7: '7',
  m6: '6',
  '(maj7)': '(maj7)',
  mMaj7: '(maj7)',
  '7': '7',
  ø7: 'ø7',
  ø: 'ø7',
  m7b5: 'ø7',
  o7: '°7',
  o: '°7',
  dim7: '°7',
  '7sus4': '7sus',
  '7sus': '7sus',
  sus: '7sus',
}
const SUFFIX = Object.keys(SUFFIXES)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)
  .map((s) => s.replace(/[()]/g, '\\$&'))
  .join('|')
const FUNCTION_RE = new RegExp(`^(sub)?([b#]?)(${NUMERAL})(${SUFFIX})?(?:/([b#]?)(${NUMERAL}))?$`)

/** glyphs to the ASCII the pattern reads: ♭ ♯ ° Δ */
const ascii = (s: string): string => s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/°/g, 'o').replace(/Δ7?/g, 'maj7')
const isUpper = (numeral: string): boolean => numeral === numeral.toUpperCase()
const degreeOf = (acc: string, numeral: string): Degree => {
  const d = ROMAN[numeral.toUpperCase()] ?? { steps: 0, semis: 0 }
  return { steps: d.steps, semis: d.semis + (acc === 'b' ? -1 : acc === '#' ? 1 : 0) }
}

function familyOf(suffix: string, upper: boolean): Family {
  if (/^(ø7?|m7b5)$/.test(suffix)) return 'halfdim'
  if (/^(o7?|dim7)$/.test(suffix)) return 'dim'
  if (/sus/.test(suffix)) return 'sus'
  if (/^(\(maj7\)|mMaj7|m|m7|m6)$/.test(suffix)) return 'minor'
  if (/^(maj7|Maj7|M7|maj|maj7#5)$/.test(suffix)) return 'major'
  if (suffix === '7') return upper ? 'dominant' : 'minor'
  return upper ? 'major' : 'minor' // a triad, or a sixth chord
}

const LOWER: ReadonlySet<Family> = new Set(['minor', 'halfdim', 'dim'])

export function parseFunction(text: string): StatedFunction | string {
  const colon = text.indexOf(':')
  const keyPart = colon >= 0 ? text.slice(0, colon).trim() : ''
  const body = (colon >= 0 ? text.slice(colon + 1) : text).trim()
  const key = keyPart ? parseKey(keyPart) : null
  if (keyPart && !key) return `"${keyPart}" isn't a key (Eb, Cm)`
  const m = FUNCTION_RE.exec(ascii(body))
  if (!m) return `"${body}" isn't a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)`
  const [, sub = '', acc = '', num = '', suffix = '', tacc = '', tnum = ''] = m
  const family = familyOf(suffix, isUpper(num))
  if (sub && family !== 'dominant') return 'sub only goes on a dominant (subV7)'
  if (!isUpper(num) && family === 'major') return `${body}: a major quality on a lower-case numeral`
  const cased = LOWER.has(family) ? num.toLowerCase() : num.toUpperCase()
  const target = tnum ? { ...degreeOf(tacc, tnum), minor: !isUpper(tnum) } : null
  return {
    text: `${sub ? 'sub' : ''}${glyph(acc)}${cased}${SUFFIXES[suffix] ?? ''}${tnum ? `/${glyph(tacc)}${tnum}` : ''}`,
    key,
    sub: !!sub,
    degree: degreeOf(acc, num),
    family,
    target,
  }
}

/** two texts that state the same function in the same key ("bVII7" and "♭VII7"); false if either won't read */
export function sameFunction(a: string, b: string): boolean {
  const x = parseFunction(a)
  const y = parseFunction(b)
  if (typeof x === 'string' || typeof y === 'string') return false
  return x.text === y.text && (x.key === null ? y.key === null : y.key !== null && sameKey(x.key, y.key))
}

const TONIC: Target = { steps: 0, semis: 0, minor: false }

/** the chord a function leads to: its target, or the tonic for V7, subV7, ♭VII7, ii(ø)7 and vii°7; null for none */
export function impliedTarget(f: StatedFunction, key: Key): Target | null {
  if (f.target) return f.target
  const s = mod(f.degree.semis, 12)
  if ((f.family === 'dominant' || f.family === 'sus') && (f.sub || s === 7)) return { ...TONIC, minor: key.minor }
  if (f.family === 'dominant' && s === 10) return TONIC // the back door
  if (f.family === 'minor' && s === 2) return TONIC
  if (f.family === 'halfdim' && s === 2) return { ...TONIC, minor: true }
  if (f.family === 'dim' && s === 11) return { ...TONIC, minor: key.minor }
  return null
}

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
/** the key's tonic as spelled ("Eb major" -> Eb); from its pitch for a key made without a name */
export const tonicOf = (key: Key): Spelled => parseRoot(/^[A-G][b#]?/.exec(key.name)?.[0] ?? FLAT_NAMES[key.tonic] ?? 'C')

/** the root the function puts its chord on: V7/V in Eb is F, subV7/IV in C is Gb */
export function functionRoot(f: StatedFunction, key: Key): Spelled {
  const t = f.target ?? TONIC
  const d = f.sub ? { steps: 1, semis: 1 } : f.degree
  return shiftBy(tonicOf(key), t.steps + d.steps, t.semis + d.semis)
}

const FAMILY_NAME: Readonly<Record<Family, string>> = { major: 'major', minor: 'minor', dominant: 'dominant', halfdim: 'half-diminished', dim: 'diminished', sus: 'sus' }
const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a')

/** why the function can't be this chord's, or null when it fits (a sus chord can be a dominant's function) */
export function fitError(f: StatedFunction, chord: Readonly<{ chord: string; pc: number; family: Family | null }>, key: Key): string | null {
  if (!chord.family) return `${chord.chord} can't be read, so its function can't be checked`
  const dominantLike = (x: Family): boolean => x === 'dominant' || x === 'sus'
  if (f.family !== chord.family && !(dominantLike(f.family) && dominantLike(chord.family)))
    return `${f.text} is ${article(FAMILY_NAME[f.family])} ${FAMILY_NAME[f.family]} chord, ${chord.chord} ${article(FAMILY_NAME[chord.family])} ${FAMILY_NAME[chord.family]} one`
  const root = functionRoot(f, key)
  return pcOf(root) === chord.pc ? null : `${f.text} in ${keyText(key)} is on ${rootName(root)}, not ${chord.chord}`
}

/**
 * the functions that fit a chord in its key, for the grid's dropdown and the --ambiguous report: where it could lead
 * (a fifth down, a half step down as a tritone substitute, a step up by the back door; for a ii, the chord a step
 * down), then its own degree
 */
export function functionCandidates(e: Readonly<{ pc: number; family: Family | null; quality: string }>, key: Key): string[] {
  if (!e.family || e.pc < 0) return []
  const at = (base: string, pc: number, minor: boolean): string => {
    const to = mod(pc, 12)
    return to === key.tonic && minor === key.minor ? base : `${base}/${glyph(roman({ pc: to, family: minor ? 'minor' : 'major' }, key))}`
  }
  const leads: Readonly<Record<Family, readonly string[]>> = {
    dominant: [at('V7', e.pc + 5, false), at('V7', e.pc + 5, true), at('subV7', e.pc - 1, false), at('subV7', e.pc - 1, true), at('♭VII7', e.pc + 2, false)],
    sus: [at('V7sus', e.pc + 5, false), at('V7sus', e.pc + 5, true)],
    minor: [at('ii7', e.pc - 2, false)],
    halfdim: [at('iiø7', e.pc - 2, true)],
    dim: [at('vii°7', e.pc + 1, false), at('vii°7', e.pc + 1, true)],
    major: [],
  }
  return [...new Set([...leads[e.family], ownNumeral({ pc: e.pc, family: e.family, quality: e.quality }, key)])]
}

import { mod, parseRoot, pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { type Key, keyText, parseKey, sameKey } from './keys'
import { glyph, ownNumeral, roman } from './degrees'
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
  /** written in parentheses, (V7/ii): the expected resolution doesn't come; the chord keeps that resolution's scale */
  deceptive: boolean
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
/** each quality spelling, and how the Changes sheet writes it; a hyphen (or en dash) is minor, as Berklee writes it */
export const SUFFIXES: Readonly<Record<string, string>> = {
  '': '',
  maj7: 'maj7',
  Maj7: 'maj7',
  M7: 'maj7',
  maj: 'maj7',
  'maj7#5': 'maj7♯5',
  '6': '6',
  m: '',
  '-': '',
  m7: '7',
  '-7': '7',
  m6: '6',
  '-6': '6',
  '(maj7)': '(maj7)',
  mMaj7: '(maj7)',
  '-(maj7)': '(maj7)',
  '-Maj7': '(maj7)',
  '7': '7',
  ø7: 'ø7',
  ø: 'ø7',
  m7b5: 'ø7',
  'm7(b5)': 'ø7',
  '-7b5': 'ø7',
  '-7(b5)': 'ø7',
  o7: '°7',
  o: '°7',
  dim7: '°7',
  '7sus4': '7sus4',
  '7(sus4)': '7sus4',
  '7sus': '7sus4',
  sus4: '7sus4',
  sus: '7sus4',
  '+': '+',
  aug: '+',
}
const SUFFIX = Object.keys(SUFFIXES)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)
  .map((s) => s.replace(/[()+]/g, '\\$&'))
  .join('|')
const FUNCTION_RE = new RegExp(`^(sub)?([b#]?)(${NUMERAL})(${SUFFIX})?(?:/([b#]?)(${NUMERAL}))?$`)

/** glyphs to the ASCII the pattern reads: ♭ ♯ ° Δ ∆ (U+0394, U+2206) Ø, the en dash as a hyphen, and Sub in any case */
const ascii = (s: string): string =>
  s
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/°/g, 'o')
    .replace(/[\u0394\u2206]7?/g, 'maj7')
    .replace(/Ø/g, 'ø')
    .replace(/–/g, '-')
    .replace(/^sub/i, 'sub')
const isUpper = (numeral: string): boolean => numeral === numeral.toUpperCase()
const degreeOf = (acc: string, numeral: string): Degree => {
  const d = ROMAN[numeral.toUpperCase()] ?? { steps: 0, semis: 0 }
  return { steps: d.steps, semis: d.semis + (acc === 'b' ? -1 : acc === '#' ? 1 : 0) }
}

const HALFDIM: ReadonlySet<string> = new Set(['ø7', 'ø', 'm7b5', 'm7(b5)', '-7b5', '-7(b5)'])
const DIM: ReadonlySet<string> = new Set(['o7', 'o', 'dim7'])
const MINOR: ReadonlySet<string> = new Set(['(maj7)', 'mMaj7', 'm', 'm7', 'm6', '-', '-7', '-6', '-(maj7)', '-Maj7'])
const MAJOR: ReadonlySet<string> = new Set(['maj7', 'Maj7', 'M7', 'maj', 'maj7#5', '+', 'aug'])

function familyOf(suffix: string, upper: boolean): Family {
  if (HALFDIM.has(suffix)) return 'halfdim'
  if (DIM.has(suffix)) return 'dim'
  if (/sus/.test(suffix)) return 'sus'
  if (MINOR.has(suffix)) return 'minor'
  if (MAJOR.has(suffix)) return 'major'
  if (suffix === '7') return upper ? 'dominant' : 'minor'
  return upper ? 'major' : 'minor' // a triad, or a sixth chord
}

const LOWER: ReadonlySet<Family> = new Set(['minor', 'halfdim', 'dim'])

/** the messages parseFunction gives, so the reference page can show them verbatim */
export const FUNCTION_ERRORS = {
  notAKey: (keyPart: string): string => `"${keyPart}" isn't a key (Eb, Cm)`,
  notAFunction: (body: string): string => `"${body}" isn't a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)`,
  subNotDominant: (): string => 'sub only goes on a dominant (subV7)',
  majorOnLowerCase: (body: string): string => `${body}: a major quality on a lower-case numeral`,
} as const

/**
 * an author's function, read leniently (Berklee's II-7, VII-7(♭5), SubV/II, I∆7 as well as the sheet's own ii7,
 * viiø7, subV7/ii, Imaj7) into the text the sheet prints. In parentheses, (V7/ii), it is deceptive: the chord's
 * expected resolution doesn't come, and it still takes that resolution's scale.
 */
export function parseFunction(text: string): StatedFunction | string {
  const colon = text.indexOf(':')
  const keyPart = colon >= 0 ? text.slice(0, colon).trim() : ''
  const body = (colon >= 0 ? text.slice(colon + 1) : text).trim()
  const key = keyPart ? parseKey(keyPart.replace(/♭/g, 'b').replace(/♯/g, '#')) : null
  if (keyPart && !key) return FUNCTION_ERRORS.notAKey(keyPart)
  const inner = /^\((.+)\)$/.exec(body)?.[1]?.trim()
  const m = FUNCTION_RE.exec(ascii(inner ?? body))
  if (!m) return FUNCTION_ERRORS.notAFunction(body)
  const [, sub = '', acc = '', num = '', written = '', tacc = '', tnum = ''] = m
  const suffix = sub && !written ? '7' : written // subV is subV7
  const family = familyOf(suffix, isUpper(num))
  if (sub && family !== 'dominant') return FUNCTION_ERRORS.subNotDominant()
  if (!isUpper(num) && family === 'major') return FUNCTION_ERRORS.majorOnLowerCase(body)
  const cased = LOWER.has(family) ? num.toLowerCase() : num.toUpperCase()
  const target = tnum ? { ...degreeOf(tacc, tnum), minor: !isUpper(tnum) } : null
  const fnText = `${sub ? 'sub' : ''}${glyph(acc)}${cased}${SUFFIXES[suffix] ?? ''}${tnum ? `/${glyph(tacc)}${tnum}` : ''}`
  return {
    text: inner === undefined ? fnText : `(${fnText})`,
    key,
    sub: !!sub,
    deceptive: inner !== undefined,
    degree: degreeOf(acc, num),
    family,
    target,
  }
}

/** one family's quality spellings, grouped by how the sheet writes them ("maj7" <- maj7, Maj7, M7, maj) */
export type Spelling = Readonly<{ family: Family; written: string; spellings: readonly string[] }>

/** every spelling the grammar accepts, on an upper- and a lower-case numeral, minus the one it rejects (a major quality on lower case) */
export function spellings(): readonly Spelling[] {
  const groups = new Map<string, { family: Family; written: string; spellings: string[] }>()
  for (const [spelling, written] of Object.entries(SUFFIXES)) {
    for (const upper of [true, false]) {
      const family = familyOf(spelling, upper)
      if (!upper && family === 'major') continue
      const k = `${family}|${written}`
      const g = groups.get(k) ?? { family, written, spellings: [] }
      if (!g.spellings.includes(spelling)) g.spellings.push(spelling)
      groups.set(k, g)
    }
  }
  return [...groups.values()]
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
    sus: [at('V7sus4', e.pc + 5, false), at('V7sus4', e.pc + 5, true)],
    minor: [at('ii7', e.pc - 2, false)],
    halfdim: [at('iiø7', e.pc - 2, true)],
    dim: [at('vii°7', e.pc + 1, false), at('vii°7', e.pc + 1, true)],
    major: [],
  }
  return [...new Set([...leads[e.family], ownNumeral({ pc: e.pc, family: e.family, quality: e.quality }, key)])]
}

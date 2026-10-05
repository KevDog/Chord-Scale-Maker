import { type Part, writtenRoot } from './part'
import { type Spelled, accFor, LETTERS, mod, parseRoot, pcOf, toLetter } from './pitch'
import { parseScale, simplifyRoot } from './scales'
import { orNull } from './util'

/** root, quality (everything between root and /bass), optional bass; same regex as jazz_scales.py */
export const CHORD_RE = /^([A-G])([b#♭♯]?)(.*?)(?:\/([A-G])([b#♭♯]?))?$/

export type ChordParts = Readonly<{ root: Spelled; quality: string; bass?: Spelled }>
export type ChordToken = Readonly<{ kind: 'text'; text: string } | { kind: 'acc'; acc: 'b' | '#' }>

export function parseChord(text: string): ChordParts {
  const m = CHORD_RE.exec(text.trim())
  if (!m) throw new Error(`cannot parse chord ${JSON.stringify(text)}`)
  const [, letter = '', acc = '', quality = '', bassLetter, bassAcc = ''] = m
  const root = parseRoot(letter + acc)
  return bassLetter === undefined ? { root, quality } : { root, quality, bass: parseRoot(bassLetter + bassAcc) }
}

const text = (t: string): ChordToken => ({ kind: 'text', text: t })
const accTokens = (acc: number): ChordToken[] =>
  Array.from({ length: Math.abs(acc) }, () => ({ kind: 'acc', acc: acc > 0 ? '#' : 'b' }) as const)

/** "m7b5" -> "–7(", ♭, "5)": minor as en dash, alterations in parentheses */
function qualityTokens(quality: string): ChordToken[] {
  const rest = quality
    .replace(/[()]/g, '')
    .replace(/^(?:min|mi|m(?!a))/, '–')
    .replace(/^-/, '–')
    .replace(/^ma(?:j)?/, 'Maj')
  const out: ChordToken[] = []
  let pos = 0
  for (const run of rest.matchAll(/(?:[b#]\d+)+/g)) {
    const start = run.index
    if (start > pos) out.push(text(rest.slice(pos, start)))
    out.push(text('('))
    const alts = [...run[0].matchAll(/([b#])(\d+)/g)]
    alts.forEach((a, i) => {
      out.push({ kind: 'acc', acc: a[1] === 'b' ? 'b' : '#' })
      out.push(text(a[2] + (i < alts.length - 1 ? ',' : '')))
    })
    out.push(text(')'))
    pos = start + run[0].length
  }
  if (pos < rest.length) out.push(text(rest.slice(pos)))
  return out
}

const mergeText = (tokens: readonly ChordToken[]): ChordToken[] =>
  tokens.reduce<ChordToken[]>((out, t) => {
    const last = out[out.length - 1]
    return t.kind === 'text' && last?.kind === 'text'
      ? [...out.slice(0, -1), text(last.text + t.text)]
      : [...out, t]
  }, [])

/** the chord's written root: its scale's spelling when they share a pitch (throws if either can't be read) */
export function writtenChordRoot(part: Part, chord: string, scaleText?: string): Spelled {
  const c = parseChord(chord)
  const s = scaleText ? parseScale(scaleText) : undefined
  return s && pcOf(s.root) === pcOf(c.root) ? writtenRoot(part, s.root, s.key) : writtenRoot(part, c.root)
}

/**
 * written chord symbol as display tokens. The root follows the scale's spelling when
 * they share a pitch; a slash bass keeps its interval from the root (D7/F# -> E7/G# on Bb).
 */
export function chordTokens(part: Part, chord: string, scaleText?: string): ChordToken[] {
  const c = parseChord(chord)
  const root = writtenChordRoot(part, chord, scaleText)
  const tokens = [text(LETTERS[root.letter]), ...accTokens(root.acc), ...qualityTokens(c.quality)]
  if (c.bass) {
    const letter = toLetter(root.letter + (c.bass.letter - c.root.letter))
    const acc = accFor(mod(pcOf(root) + (pcOf(c.bass) - pcOf(c.root)), 12), letter)
    const bass = Math.abs(acc) > 1 ? simplifyRoot({ letter, acc }) : { letter, acc }
    tokens.push(text('/' + LETTERS[bass.letter]), ...accTokens(bass.acc))
  }
  return mergeText(tokens)
}

/** chordTokens for display: a scale that can't be read is ignored; null only if the chord itself can't be read */
export const chordTokensOrNull = (part: Part, chord: string, scaleText?: string | null): readonly ChordToken[] | null =>
  orNull(() => chordTokens(part, chord, scaleText ?? undefined)) ?? orNull(() => chordTokens(part, chord))

/** writtenChordRoot, ignoring a scale that can't be read (throws only if the chord can't be read) */
export const writtenChordRootLenient = (part: Part, chord: string, scaleText?: string | null): Spelled =>
  orNull(() => writtenChordRoot(part, chord, scaleText ?? undefined)) ?? writtenChordRoot(part, chord)

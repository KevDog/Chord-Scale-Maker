import { cellError } from '../edit'
import { baseQuality } from '../qualities'

/** an iReal chord as ours: ^ is Maj, - minor, h half-diminished, o diminished; null when we have nothing like it */
export type ChordMapping = Readonly<{ chord: string; note?: string } | { chord: null; note: string }>

const CHORD = /^([A-G][b#]?)(.*?)(\/[A-G][b#]?)?$/

/** iReal spellings first (exact), then glyph rewrites */
const EXACT: Readonly<Record<string, string>> = { '^': 'Maj7', h: 'm7b5', h7: 'm7b5', h9: 'm7b5', o: 'dim', '-69': 'm6/9', '7b9sus': '7sus4b9' }
/** qualities we don't have, written as the nearest we do (and said so) */
const NEAREST: Readonly<Record<string, string>> = { '^13': 'Maj9', '-^9': 'mMaj7', '-^11': 'mMaj7', '-^13': 'mMaj7', '2': 'add9', '5': '', '7susadd3': '7sus', '7b13sus': '7sus', '7add13': '7' }

const rewrite = (q: string): string => q.replace(/^-\^/, 'mMaj').replace(/^\^/, 'Maj').replace(/^-/, 'm').replace(/^o(?=\d)/, 'dim')

export function irealChord(text: string): ChordMapping {
  const m = CHORD.exec(text)
  const dropped = { chord: null, note: `${text}: no chord like it here, left out` } as const
  if (!m) return dropped
  const [, root = '', quality = '', bass = ''] = m
  const near = NEAREST[quality]
  const ours = near ?? EXACT[quality] ?? rewrite(quality)
  if (quality !== '' && ours !== '' && baseQuality(ours) === null) return dropped
  const chord = root + ours + bass
  if (cellError(chord)) return dropped
  return near === undefined ? { chord } : { chord, note: `${text} written as ${chord}` }
}

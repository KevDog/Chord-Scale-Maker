import type { Key } from './keys'
import { type Entry, interval } from './stream'

/**
 * A chord's degree in its key, as the Changes sheet and the report write it: shared by the rules (rules.ts), the
 * numerals (numerals.ts) and the function grammar (functions.ts), so none of them imports another for it.
 */

const DEGREES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']
/** "ii", "bVII", "V": the entry's degree in the key, lower case for minor-type chords */
export function roman(e: Pick<Entry, 'pc' | 'family'>, key: Key): string {
  const d = DEGREES[interval(key.tonic, e.pc)] ?? '?'
  return e.family === 'minor' || e.family === 'halfdim' || e.family === 'dim' ? d.toLowerCase() : d
}

/** each chord quality, as the sheet writes it after the numeral */
export const SUFFIX: Readonly<Record<string, string>> = {
  maj: '',
  Maj7: 'maj7',
  'Maj7#11': 'maj7',
  'Maj7#5': 'maj7♯5',
  '6': '6',
  m: '',
  m7: '7',
  m6: '6',
  mMaj7: '(maj7)',
  m7b5: 'ø7',
  dim7: '°7',
  '7sus4': '7sus4',
  '7sus4b9': '7sus4',
}
/** "bVII" -> "♭VII" */
export const glyph = (r: string): string => r.replace(/^b/, '♭').replace(/^#/, '♯')
/** the entry's degree with its glyph: "♭VII", "ii" */
export const degreeOf = (e: Pick<Entry, 'pc' | 'family'>, key: Key): string => glyph(roman(e, key))
/** the chord's own degree and quality in the key: "II7", "vi7", "IVmaj7", "vii°7" */
export const ownNumeral = (e: Pick<Entry, 'pc' | 'family' | 'quality'>, key: Key): string => degreeOf(e, key) + (e.family === 'dominant' ? '7' : (SUFFIX[e.quality] ?? ''))

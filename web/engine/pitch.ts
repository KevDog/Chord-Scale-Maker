/**
 * Spelled notes: a letter (C=0 … B=6) plus an accidental count, their pitch classes and enharmonic spellings.
 */

export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6 // C D E F G A B
export type Spelled = Readonly<{ letter: Letter; acc: number }>

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const NAT_PC = [0, 2, 4, 5, 7, 9, 11] as const

/** always-positive modulo (JS % keeps the sign of the dividend) */
export const mod = (n: number, m: number): number => ((n % m) + m) % m
export const toLetter = (n: number): Letter => mod(n, 7) as Letter

export function parseRoot(tok: string): Spelled {
  const m = /^([A-Ga-g])([b#♭♯]*)$/.exec(tok)
  if (!m) throw new Error(`bad note name: ${JSON.stringify(tok)}`)
  const [, letter = '', accs = ''] = m
  const acc = [...accs].reduce((s, c) => s + (c === '#' || c === '♯' ? 1 : -1), 0)
  return { letter: 'CDEFGAB'.indexOf(letter.toUpperCase()) as Letter, acc }
}

/**
 * "Eb" -> "E♭", "b9" -> "♭9": typed accidentals as music glyphs, for display. A `b` flanked by lowercase letters is
 * part of a word, not a flat (so "Bebop" stays "Bebop", not "Be♭op"); every `#` is a sharp.
 */
export const glyphs = (text: string): string =>
  text.replaceAll('#', '♯').replace(/b/g, (_m, i: number) => (/[a-z]/.test(text[i - 1] ?? '') && /[a-z]/.test(text[i + 1] ?? '') ? 'b' : '♭'))

export const accText = (acc: number): string => (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc))
export const rootName = (n: Spelled): string => LETTERS[n.letter] + accText(n.acc)
export const pcOf = (n: Spelled): number => mod(NAT_PC[n.letter] + n.acc, 12)
export const accFor = (pc: number, letter: Letter): number => mod(pc - NAT_PC[letter] + 6, 12) - 6

/** move a spelled note up by `steps` letters and `semis` semitones, respelling the accidental for the new letter */
export const shiftBy = (n: Spelled, steps: number, semis: number): Spelled => {
  const letter = toLetter(n.letter + steps)
  return { letter, acc: accFor(mod(pcOf(n) + semis, 12), letter) }
}

/** all spellings of this pitch class with at most one accidental, in letter order */
export function enharmonics(n: Spelled): Spelled[] {
  const pc = pcOf(n)
  return LETTERS.map((_, l) => ({ letter: l as Letter, acc: accFor(pc, l as Letter) })).filter(
    (s) => Math.abs(s.acc) <= 1,
  )
}

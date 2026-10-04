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
  const acc = [...m[2]].reduce((s, c) => s + (c === '#' || c === '♯' ? 1 : -1), 0)
  return { letter: 'CDEFGAB'.indexOf(m[1].toUpperCase()) as Letter, acc }
}

export const accText = (acc: number): string => (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc))
export const rootName = (n: Spelled): string => LETTERS[n.letter] + accText(n.acc)
export const pcOf = (n: Spelled): number => mod(NAT_PC[n.letter] + n.acc, 12)
export const accFor = (pc: number, letter: Letter): number => mod(pc - NAT_PC[letter] + 6, 12) - 6

/** all spellings of this pitch class with at most one accidental, in letter order */
export function enharmonics(n: Spelled): Spelled[] {
  const pc = pcOf(n)
  return LETTERS.map((_, l) => ({ letter: l as Letter, acc: accFor(pc, l as Letter) })).filter(
    (s) => Math.abs(s.acc) <= 1,
  )
}

/**
 * The rhythm model's text form (rhythm spec §1, §2): `<pulse>: <cells>`, e.g. `8: >xx.x_`.
 * Pure TypeScript; nothing here knows about metre, sheets or notation.
 */

export type Pulse = '4' | '8' | '8t' | '16'

export const PULSES: readonly Pulse[] = ['4', '8', '8t', '16']

/** Pulses in one beat (a beat is a quarter note in every metre). */
export const PULSE_PER_BEAT: Readonly<Record<Pulse, number>> = { '4': 1, '8': 2, '8t': 3, '16': 4 }

/** 0, 1, …, n − 1: the rhythm modules' pulse and beat indexes (not in the engine's API) */
export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

export const PULSE_LABELS: Readonly<Record<Pulse, string>> = {
  '4': 'Quarters',
  '8': '8ths',
  '8t': 'Triplets',
  '16': '16ths',
}

/** `x` attack, `.` rest, `_` tie to the note before, `>x` accented attack (one cell). */
export type Cell = 'x' | '.' | '_' | '>x'

export type Rhythm = Readonly<{ pulse: Pulse; cells: readonly Cell[] }>

const MAX_CELLS = 64

/** The rhythm a text spells, or null when it isn't valid (spec §2). */
export function parseRhythm(text: string): Rhythm | null {
  const colon = text.indexOf(':')
  if (colon < 0) return null
  const pulse = text.slice(0, colon).trim()
  if (!(PULSES as readonly string[]).includes(pulse)) return null
  const body = text.slice(colon + 1).replace(/[|\s]/g, '')
  const cells: Cell[] = []
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === 'x' || c === '.' || c === '_') cells.push(c)
    else if (c === '>' && body[i + 1] === 'x') {
      cells.push('>x')
      i++
    } else return null
  }
  if (cells.length < 1 || cells.length > MAX_CELLS) return null
  if (!cells.some(c => c !== '.' && c !== '_')) return null
  if (cells.some((c, i) => c === '_' && cells[i - 1] === '.')) return null
  return { pulse: pulse as Pulse, cells }
}

/** The canonical spelling: no `|` or spaces, one space after the colon. */
export function formatRhythm(r: Rhythm): string {
  return `${r.pulse}: ${r.cells.join('')}`
}

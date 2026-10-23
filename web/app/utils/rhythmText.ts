import { parseRhythm, PULSES } from '@chord-scale-maker/engine'

const CELLS = /^(?:>x|[x._])*$/
const MAX_CELLS = 64 // the rhythm text form's limit (rhythm spec §2)

/**
 * what's wrong with a typed rhythm (Your rhythm…, rhythm spec §9): '' when it reads, or the box is empty; the limits
 * when its cells read but have no x or are too many; a hold after a rest; else how to write one
 */
export function rhythmTextError(text: string): string {
  if (!text.trim() || parseRhythm(text)) return ''
  const colon = text.indexOf(':')
  const pulse = text.slice(0, colon).trim()
  const body = text.slice(colon + 1).replace(/[|\s]/g, '')
  if (colon >= 0 && (PULSES as readonly string[]).includes(pulse) && CELLS.test(body)) {
    const cells = body.replaceAll('>x', 'x')
    if (!cells.includes('x') || cells.length > MAX_CELLS) return 'At least one x, and at most 64 cells.'
    if (cells.includes('._')) return 'A _ holds a note, so it can’t follow a rest (.).'
  }
  return 'Use x, ., _ and > after 4:, 8:, 8t: or 16:'
}

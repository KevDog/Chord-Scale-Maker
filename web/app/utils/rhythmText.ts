import { isPhase4Pulse, parseRhythm, parseRhythmId, type Pulse, PULSES, type Rhythm, type RhythmId, UNIT_GROUPS } from '@chord-scale-maker/engine'

const CELLS = /^(?:>x|[x._])*$/
const MAX_CELLS = 64 // the rhythm text form's limit (rhythm spec §2)

/** the pulses a typed rhythm may use: the tuplet pulses with the rhythmGears flag on (Phase 4 spec D8) */
const pulsesFor = (gears: boolean): readonly Pulse[] => (gears ? PULSES : PULSES.filter((p) => !isPhase4Pulse(p)))

/** a typed rhythm, or null where it doesn't read or its pulse is a tuplet pulse with the rhythmGears flag off */
export function typedRhythm(text: string, gears: boolean): Rhythm | null {
  const r = parseRhythm(text)
  return r && pulsesFor(gears).includes(r.pulse) ? r : null
}

/**
 * what's wrong with a typed rhythm (Your rhythm…, rhythm spec §9): '' when it reads, or the box is empty; the limits
 * when its cells read but have no x or are too many; a hold after a rest; else how to write one. gears: the
 * rhythmGears flag, which lets the tuplet pulses in
 */
export function rhythmTextError(text: string, gears = false): string {
  if (!text.trim() || typedRhythm(text, gears)) return ''
  const pulses = pulsesFor(gears)
  const colon = text.indexOf(':')
  const pulse = text.slice(0, colon).trim()
  const body = text.slice(colon + 1).replace(/[|\s]/g, '')
  if (colon >= 0 && (pulses as readonly string[]).includes(pulse) && CELLS.test(body)) {
    const cells = body.replaceAll('>x', 'x')
    if (!cells.includes('x') || cells.length > MAX_CELLS) return 'At least one x, and at most 64 cells.'
    if (cells.includes('._')) return 'A _ holds a note, so it can’t follow a rest (.).'
  }
  return `Use x, ., _ and > after ${pulses.slice(0, -1).map((p) => `${p}:`).join(', ')} or ${pulses.at(-1)}:`
}

const MAX_GROUPS = 8 // a Groups path's longest list (Phase 4 spec §3)

/** a typed Groups list (Your list…, Phase 4 spec §3): 1 to 8 unit groups (2–7), separated by spaces or commas; else null */
export function typedGroups(text: string): number[] | null {
  const words = text.split(/[\s,]+/).filter(Boolean)
  const groups = words.map((w) => (/^\d+$/.test(w) ? Number(w) : NaN))
  return words.length >= 1 && words.length <= MAX_GROUPS && groups.every((g) => UNIT_GROUPS.includes(g)) ? groups : null
}

/** what's wrong with a typed Groups list: '' when it reads or the box is empty, else how to write one */
export function groupsTextError(text: string): string {
  return !text.trim() || typedGroups(text) ? '' : `Groups of ${UNIT_GROUPS[0]} to ${UNIT_GROUPS.at(-1)}, separated by spaces: up to ${MAX_GROUPS} of them.`
}

/** a rhythm at one of Phase 4's tuplet pulses (Phase 4 spec D8, D22): a unit's, a run's or your rhythm's pulse; off and cards are at none */
export function isGearsRhythm(id: RhythmId): boolean {
  const p = parseRhythmId(id)
  const pulse = p?.kind === 'unit' || p?.kind === 'run' ? p.pulse : p?.kind === 'custom' ? p.rhythm.pulse : null
  return pulse !== null && isPhase4Pulse(pulse)
}

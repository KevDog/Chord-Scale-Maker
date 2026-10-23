/**
 * Rhythm paths (Phase 4 spec §3): a Groups path and a Gears path that step through the form by the pentatonic path's
 * Step, and the plan they make, one rhythm id per run of drawn bars. Pure TypeScript.
 */
import { isPentatonicStep, PENTATONIC_STEP, type PentatonicStep } from '../pentatonics'
import { formatRhythm, PULSES, type Pulse } from './rhythm'
import { parseRhythmId, UNIT_GROUPS, type RhythmId } from './library'

export type RhythmStep = PentatonicStep

/** A list is null for *One* (the rhythm's own group or pulse); step i plays `groups[i mod G]` and `gears[i mod P]` (D16). */
export type RhythmPath = Readonly<{ groups: readonly number[] | null; gears: readonly Pulse[] | null; step: RhythmStep }>

export const RHYTHM_PATH_OFF: RhythmPath = { groups: null, gears: null, step: PENTATONIC_STEP }

export const RHYTHM_GROUP_PRESETS = { up: [3, 4, 5, 6, 7], down: [7, 6, 5, 4, 3] } as const satisfies Readonly<Record<string, readonly number[]>>

/** Bergonzi's five gears, up and down */
export const RHYTHM_GEAR_PRESETS = {
  up: ['4t', '8', '8t', '16', '16t'],
  down: ['16t', '16', '8t', '8', '4t'],
} as const satisfies Readonly<Record<string, readonly Pulse[]>>

const MAX_ENTRIES = 8

const isList = <T>(v: unknown, ok: (x: unknown) => x is T): v is readonly T[] | null =>
  v === null || (Array.isArray(v) && v.length >= 1 && v.length <= MAX_ENTRIES && v.every(ok))

export function isRhythmPath(v: unknown): v is RhythmPath {
  if (typeof v !== 'object' || v === null) return false
  const { groups, gears, step } = v as Partial<Record<keyof RhythmPath, unknown>>
  return (
    isList(groups, (g): g is number => typeof g === 'number' && UNIT_GROUPS.includes(g)) &&
    isList(gears, (p): p is Pulse => (PULSES as readonly unknown[]).includes(p)) &&
    isPentatonicStep(step)
  )
}

/** The plan: from each entry's first drawn bar to the next entry's, the bars play its id (Phase 4 spec §3). */
export type RhythmSteps = readonly Readonly<{ from: number; id: RhythmId }>[]

/**
 * The plan for `id` under `path`, given each drawn bar's step unit (`stepUnits(…).ofDrawnBar`; null outside the form,
 * which plays step 0, D15). Runs of one id merge. Groups change a unit's group only, Gears a unit's or a custom
 * rhythm's pulse; a per-bar rhythm, Off or no path is one entry (D12).
 */
export function rhythmSteps(id: RhythmId, path: RhythmPath, units: readonly (number | null)[]): RhythmSteps {
  const parsed = id === 'off' ? null : parseRhythmId(id)
  const p = parsed?.kind === 'unit' || parsed?.kind === 'custom' ? parsed : null
  const { groups, gears } = path
  if (!p || (gears === null && (groups === null || p.kind === 'custom'))) return [{ from: 0, id }]
  const idAt = (i: number): RhythmId => {
    const pulse = gears ? gears[i % gears.length]! : p.kind === 'unit' ? p.pulse : p.rhythm.pulse
    if (p.kind === 'custom') return `custom:${formatRhythm({ ...p.rhythm, pulse }).replace(': ', ':')}`
    return `unit:${pulse}:${groups ? groups[i % groups.length]! : p.group}:${p.variation}`
  }
  const bars = units.length === 0 ? [null] : units
  return bars.reduce<{ from: number; id: RhythmId }[]>((out, u, b) => {
    const here = idAt(u ?? 0)
    if (out.at(-1)?.id !== here) out.push({ from: b, id: here })
    return out
  }, [])
}

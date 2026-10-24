/**
 * Rhythm paths (Phase 4 spec §3): a Groups path and a Gears path that step through the form by the pentatonic path's
 * Step, and the plan they make, one rhythm id per run of drawn bars. Pure TypeScript.
 */
import { isPentatonicStep, PENTATONIC_STEP, stepLabel, type PentatonicStep } from '../pentatonics'
import { formatRhythm, PULSE_LABELS, PULSES, type Pulse } from './rhythm'
import { parseRhythmId, UNIT_GROUPS, VARIATION_LABELS, type RhythmId } from './library'

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

/** the lists of `path` that act on `id` (D12): Groups on a unit, Gears on a unit or a custom rhythm; null for neither */
function acting(id: RhythmId, path: RhythmPath | undefined) {
  const p = id === 'off' || !path ? null : parseRhythmId(id)
  const groups = p?.kind === 'unit' ? path!.groups : null
  const gears = p?.kind === 'unit' || p?.kind === 'custom' ? path!.gears : null
  return p && (groups || gears) ? { p, groups, gears } : null
}

const gearName = (pulse: Pulse): string => PULSE_LABELS[pulse].replace(/^./, (c) => c.toLowerCase())

/**
 * The caption's label and path with a path that acts on `id` (Phase 4 spec §3): the label drops what the path
 * changes (the group under Groups, the pulse under Gears), then each path and the step. Null when no path acts.
 */
export function rhythmPathCaption(id: RhythmId, path: RhythmPath | undefined): string | null {
  const on = acting(id, path)
  if (!on) return null
  const { p, groups, gears } = on
  const label =
    p.kind === 'custom'
      ? `Your rhythm (${p.rhythm.cells.join('')})` // its cells alone, not formatRhythm's: only Gears acts on it, so its pulse is the path's
      : p.kind === 'unit'
        ? `${gears ? 'Units' : PULSE_LABELS[p.pulse]}${groups ? '' : ` in ${p.group}`}, ${VARIATION_LABELS[p.variation]}`
        : ''
  const parts = [label, groups && `in ${groups.join(' → ')}`, gears && gears.map(gearName).join(' → '), stepLabel(path!.step)]
  return parts.filter(Boolean).join(' · ')
}

/** a step's mark over its first bar (D17): its group where it changes, its pulse where it changes */
export type RhythmStepMark = Readonly<{ group: number | null; pulse: Pulse | null }>

/**
 * Each drawn bar's step mark under `path`, from the plan `steps` (`rhythmSteps`) over `bars` drawn bars: on step 0,
 * the group whenever Groups acts and the pulse whenever Gears acts; on a later step, each only where it differs from
 * the step before. Null on every other bar, and everywhere with no path acting (a custom rhythm shows no group).
 */
export function rhythmStepMarks(id: RhythmId, path: RhythmPath | undefined, steps: RhythmSteps, bars: number): readonly (RhythmStepMark | null)[] {
  const out = Array<RhythmStepMark | null>(bars).fill(null)
  const on = acting(id, path)
  if (!on) return out
  const values = steps.map(({ id: at }) => {
    const p = parseRhythmId(at)
    return { group: p?.kind === 'unit' ? p.group : null, pulse: p?.kind === 'unit' ? p.pulse : p?.kind === 'custom' ? p.rhythm.pulse : null }
  })
  steps.forEach(({ from }, i) => {
    const prev = values[i - 1]
    const group = on.groups && values[i]!.group !== prev?.group ? values[i]!.group : null
    const pulse = on.gears && values[i]!.pulse !== prev?.pulse ? values[i]!.pulse : null
    if ((group !== null || pulse !== null) && from < bars) out[from] = { group, pulse }
  })
  return out
}

/** a step's rhythm card (#575): its id, and what the path changes there: its group under Groups, its pulse under Gears */
export type RhythmStepCard = Readonly<{ id: RhythmId; group: number | null; pulse: Pulse | null }>

/**
 * The cards a sheet with the Line off shows for `id` under `path`, from the plan `steps` (`rhythmSteps`): one a step,
 * in the order the form first plays it (a path that cycles shows each once). With no path acting, the rhythm's one
 * card, unnamed.
 */
export function rhythmStepCards(id: RhythmId, path: RhythmPath | undefined, steps: RhythmSteps): readonly RhythmStepCard[] {
  const on = acting(id, path)
  if (!on) return [{ id, group: null, pulse: null }]
  return [...new Set(steps.map((s) => s.id))].map((at) => {
    const p = parseRhythmId(at)
    const pulse = p?.kind === 'unit' ? p.pulse : p?.kind === 'custom' ? p.rhythm.pulse : null
    return { id: at, group: on.groups && p?.kind === 'unit' ? p.group : null, pulse: on.gears ? pulse : null }
  })
}

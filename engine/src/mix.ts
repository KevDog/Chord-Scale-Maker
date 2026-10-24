/**
 * The mixer (#509; docs/superpowers/specs/2026-10-24-pattern-sets-design.md): a level and a mute for each sound the
 * click plays, and the duo presets, which mute the rhythm section's other players so a player can practise in a duo.
 */
export const MIX_TRACKS = ['click', 'line', 'rhythm', 'piano', 'bass', 'drums'] as const
export type MixTrack = (typeof MIX_TRACKS)[number]
/** a track's level, 0 to 1, and whether it's muted (its level kept) */
export type TrackMix = Readonly<{ level: number; mute: boolean }>
export type Mix = Readonly<Record<MixTrack, TrackMix>>

const FULL: TrackMix = { level: 1, mute: false }
export const DEFAULT_MIX: Mix = Object.fromEntries(MIX_TRACKS.map((t) => [t, FULL])) as Mix

/** band: everyone; a duo: you and the piano, or the bass; no piano or no bass: the band without yours */
export const MIX_PRESETS = ['band', 'piano-duo', 'bass-duo', 'no-piano', 'no-bass'] as const
export type MixPreset = (typeof MIX_PRESETS)[number]
const SECTION = ['piano', 'bass', 'drums'] as const
const MUTED: Readonly<Record<MixPreset, readonly (typeof SECTION)[number][]>> = {
  band: [],
  'piano-duo': ['bass', 'drums'],
  'bass-duo': ['piano', 'drums'],
  'no-piano': ['piano'],
  'no-bass': ['bass'],
}

/** a track's gain: its level, or 0 muted */
export const trackGain = (mix: Mix, track: MixTrack): number => (mix[track].mute ? 0 : mix[track].level)

/** the mix with a preset's mutes on the rhythm section, its levels and the other tracks as they were */
export function withPreset(mix: Mix, preset: MixPreset): Mix {
  return { ...mix, ...Object.fromEntries(SECTION.map((t) => [t, { ...mix[t], mute: MUTED[preset].includes(t) }])) }
}

/** the preset whose mutes the mix's rhythm section has, else null */
export const presetOf = (mix: Mix): MixPreset | null =>
  MIX_PRESETS.find((p) => SECTION.every((t) => mix[t].mute === MUTED[p].includes(t))) ?? null

/** a stored mix: each track read, a bad or missing one at its default, levels clamped to 0–1 */
export function parseMix(v: unknown): Mix {
  const stored = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return Object.fromEntries(
    MIX_TRACKS.map((t) => {
      const s = stored[t] as Record<string, unknown> | undefined
      if (!s || typeof s !== 'object') return [t, FULL]
      const level = typeof s.level === 'number' && Number.isFinite(s.level) ? Math.min(1, Math.max(0, s.level)) : 1
      return [t, { level, mute: s.mute === true }]
    }),
  ) as Mix
}

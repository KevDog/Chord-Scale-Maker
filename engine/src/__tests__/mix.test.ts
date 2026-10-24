import { describe, expect, it } from 'vitest'
import { DEFAULT_MIX, MIX_PRESETS, MIX_TRACKS, parseMix, presetOf, trackGain, withPreset } from '../mix'

describe('the mixer (#509)', () => {
  it('starts every track at its full level, none muted: the Band preset', () => {
    for (const t of MIX_TRACKS) expect(trackGain(DEFAULT_MIX, t)).toBe(1)
    expect(presetOf(DEFAULT_MIX)).toBe('band')
  })

  it('a track’s gain is its level, 0 when muted', () => {
    const mix = { ...DEFAULT_MIX, piano: { level: 0.4, mute: false }, bass: { level: 0.7, mute: true } }
    expect(trackGain(mix, 'piano')).toBe(0.4)
    expect(trackGain(mix, 'bass')).toBe(0)
  })

  it('the duo presets mute the rhythm section’s other players, keeping the levels', () => {
    const leveled = { ...DEFAULT_MIX, piano: { level: 0.5, mute: false } }
    const muted = (p: (typeof MIX_PRESETS)[number]) =>
      (['piano', 'bass', 'drums'] as const).filter((t) => withPreset(leveled, p)[t].mute)
    expect(muted('band')).toEqual([])
    expect(muted('piano-duo')).toEqual(['bass', 'drums'])
    expect(muted('bass-duo')).toEqual(['piano', 'drums'])
    expect(muted('no-piano')).toEqual(['piano'])
    expect(muted('no-bass')).toEqual(['bass'])
    expect(withPreset(leveled, 'bass-duo').piano.level).toBe(0.5)
    expect(withPreset(leveled, 'bass-duo').click).toEqual(leveled.click)
    for (const p of MIX_PRESETS) expect(presetOf(withPreset(leveled, p))).toBe(p)
  })

  it('a mix no preset gives has none', () => {
    expect(presetOf({ ...DEFAULT_MIX, drums: { level: 1, mute: true } })).toBe(null)
  })

  it('reads a stored mix, a bad or missing track at its default, levels kept from 0 to 1', () => {
    expect(parseMix(undefined)).toEqual(DEFAULT_MIX)
    expect(parseMix({ piano: { level: 2, mute: true }, bass: 'x', drums: { level: 0.25, mute: 1 } })).toEqual({
      ...DEFAULT_MIX,
      piano: { level: 1, mute: true },
      drums: { level: 0.25, mute: false },
    })
  })
})

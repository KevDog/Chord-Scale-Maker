import { describe, expect, it } from 'vitest'
import { CONTROL_TIERS, hiddenSettings, initialLevel, INTERFACE_LEVELS, isInterfaceLevel, levelLabel, shows, type ViewSettings } from '~/utils/interface'

const DEFAULTS: ViewSettings = { sheet: 'changes', scaleLevel: 'standard', numerals: true, scaleNames: true, lineMode: 'off', spell: 'key', practice: null, overlay: 'off', picks: false, approach: 'none', rhythm: 'off', targets: false, rhythmStart: 'beat', anticipate: 0, rhythmLine: false }

describe('interface levels', () => {
  it('orders the levels and names them', () => {
    expect(INTERFACE_LEVELS).toEqual(['essentials', 'intermediate', 'everything'])
    expect(INTERFACE_LEVELS.map(levelLabel)).toEqual(['Essentials', 'Intermediate', 'Everything'])
    expect(isInterfaceLevel('intermediate')).toBe(true)
    expect(isInterfaceLevel('pro')).toBe(false)
  })

  it('follows the spec tier tables', () => {
    expect(CONTROL_TIERS).toEqual({
      'scale-level': 'intermediate',
      analysis: 'intermediate',
      line: 'intermediate',
      spell: 'intermediate',
      practice: 'intermediate',
      patterns: 'intermediate',
      cells: 'intermediate',
      approaches: 'intermediate',
      rhythm: 'intermediate',
      'rhythm-phrasing': 'everything',
      'scale-choice': 'intermediate',
      'form-editing': 'intermediate',
      why: 'intermediate',
      pentatonics: 'everything',
      'chord-picks': 'everything',
      'practice-pentatonic': 'everything',
      'practice-hexatonic': 'everything',
      'practice-quartal': 'everything',
      'key-change': 'everything',
      'function-choice': 'everything',
      source: 'everything',
    })
  })

  it('shows a control from its tier up', () => {
    expect(shows('essentials', 'line')).toBe(false)
    expect(shows('intermediate', 'line')).toBe(true)
    expect(shows('intermediate', 'pentatonics')).toBe(false)
    expect(shows('everything', 'pentatonics')).toBe(true)
  })
})

describe('hiddenSettings', () => {
  it('is null when every setting is at its default', () => {
    expect(hiddenSettings('essentials', DEFAULTS)).toBeNull()
  })

  it('names settings away from their defaults whose controls are hidden, and the lowest level that shows them all', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, scaleLevel: 'advanced', numerals: false })).toEqual({ settings: ['scale-level', 'numerals'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, lineMode: 'guide', overlay: 'pentatonic' })).toEqual({ settings: ['line', 'pentatonics'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, lineMode: 'guide', overlay: 'pentatonic' })).toEqual({ settings: ['pentatonics'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, overlay: 'hexatonic' })).toEqual({ settings: ['pentatonics'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', overlay: 'hexatonic' })).toBeNull() // the overlay is the Changes sheet's
    expect(hiddenSettings('everything', { ...DEFAULTS, overlay: 'pentatonic' })).toBeNull()
  })

  it('counts only what the current sheet uses', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', numerals: false, lineMode: 'guide' })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'changes', spell: 'root', practice: { preset: 'chordTones' } })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', spell: 'root' })).toEqual({ settings: ['spell'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'arpeggios', scaleLevel: 'advanced', spell: 'root' })).toBeNull()
  })

  it('names a Patterns sheet at Essentials, and not at Intermediate', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'patterns' })).toEqual({ settings: ['patterns'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'patterns' })).toBeNull()
  })

  it('names an Approach in force on the Changes sheet at Intermediate, and not on other sheets', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, approach: 'enclosure' })).toEqual({ settings: ['approaches'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, approach: 'enclosure' })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', approach: 'enclosure' })).toBeNull()
  })

  it('names Start and timing in force only when the Line takes the rhythm', () => {
    const away = { ...DEFAULTS, lineMode: 'arpeggio', rhythm: 'card:upbeats', rhythmLine: true, rhythmStart: 'pickup-1' } as const satisfies ViewSettings
    expect(hiddenSettings('intermediate', away)).toEqual({ settings: ['rhythm-phrasing'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...away, rhythmStart: 'beat', anticipate: -1 })).toEqual({ settings: ['rhythm-phrasing'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...away, rhythmLine: false })).toBeNull()
    expect(hiddenSettings('intermediate', { ...away, rhythm: 'off' })).toBeNull() // a Line that would take a rhythm, but none is on (#505)
    expect(hiddenSettings('everything', away)).toBeNull()
  })

  it('names a rhythm or target beats in force on the Changes sheet at Intermediate', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, rhythm: 'card:upbeats' })).toEqual({ settings: ['rhythm'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, targets: true })).toEqual({ settings: ['rhythm'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'card:upbeats', targets: true })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', rhythm: 'card:upbeats' })).toBeNull()
  })

  it('names a rhythm only where it draws: the rhythm line, or a Line that takes it (#505)', () => {
    const guide = { ...DEFAULTS, lineMode: 'guide', rhythm: 'card:upbeats' } as const satisfies ViewSettings
    expect(hiddenSettings('essentials', guide)).toEqual({ settings: ['line'], needs: 'intermediate' }) // guide tones hold, without Restate
    expect(hiddenSettings('essentials', { ...guide, rhythmLine: true })).toEqual({ settings: ['line', 'rhythm'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...guide, targets: true })).toEqual({ settings: ['line', 'rhythm'], needs: 'intermediate' })
  })

  it('puts a pentatonic practice selection at Everything', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'chordTones' } })).toEqual({ settings: ['practice'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'pentatonic', degree: 2 } })).toEqual({ settings: ['practice'], needs: 'everything' })
  })

  it('names chord picks in force on the Changes and Scales sheets at Everything, never on the Arpeggios sheet', () => {
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', picks: true })).toEqual({ settings: ['chord-picks'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'changes', picks: true })).toEqual({ settings: ['chord-picks'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, sheet: 'scales', picks: true })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'arpeggios', picks: true })).toBeNull()
  })

  it('puts a hexatonic practice selection at Everything', () => {
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'hexatonic', pair: 0, grouping: 'triads' } })).toEqual({ settings: ['practice'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'hexatonic', pair: 3, grouping: 'pent' } })).toBeNull()
    expect(shows('intermediate', 'practice-hexatonic')).toBe(false)
  })
})

describe('initialLevel', () => {
  it('keeps a stored level', () => expect(initialLevel('intermediate', ['csm-interface'])).toBe('intermediate'))
  it('starts a new browser at Essentials', () => expect(initialLevel(null, ['other-site-key'])).toBe('essentials'))
  it('starts a browser that already has preferences at Everything', () => expect(initialLevel(null, ['csm-instrument'])).toBe('everything'))
  it('treats an unknown stored value as unset', () => {
    expect(initialLevel('pro', ['csm-interface'])).toBe('essentials')
    expect(initialLevel('pro', ['csm-interface', 'csm-level:x'])).toBe('everything')
  })
})

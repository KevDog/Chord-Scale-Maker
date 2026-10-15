import { describe, expect, it } from 'vitest'
import { CONTROL_TIERS, hiddenSettings, initialLevel, INTERFACE_LEVELS, isInterfaceLevel, levelLabel, shows, type ViewSettings } from '~/utils/interface'

const DEFAULTS: ViewSettings = { sheet: 'changes', scaleLevel: 'standard', numerals: true, scaleNames: true, lineMode: 'off', spell: 'key', practice: null, overlay: 'off', picks: false }

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
      'scale-choice': 'intermediate',
      'form-editing': 'intermediate',
      why: 'intermediate',
      pentatonics: 'everything',
      'chord-picks': 'everything',
      'practice-pentatonic': 'everything',
      'practice-hexatonic': 'everything',
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

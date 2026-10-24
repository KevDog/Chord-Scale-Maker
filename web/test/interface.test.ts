import { describe, expect, it } from 'vitest'
import { RHYTHM_PATH_OFF } from '@chord-scale-maker/engine'
import { CONTROL_TIERS, hiddenSettings, INTERMEDIATE_RHYTHMS, initialLevel, INTERFACE_LEVELS, isInterfaceLevel, levelLabel, shows, type ViewSettings } from '~/utils/interface'

const DEFAULTS: ViewSettings = { sheet: 'changes', scaleLevel: 'standard', numerals: true, scaleNames: true, lineMode: 'off', spell: 'key', practice: null, overlay: 'off', picks: false, approach: 'none', rhythm: 'off', targets: false, rhythmStart: 'beat', anticipate: 0, rhythmLine: false, notesPerBar: 'whole', rhythmPath: RHYTHM_PATH_OFF, feel: 4 }

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
      'notes-per-bar': 'intermediate',
      'rhythm-phrasing': 'everything',
      'rhythm-gears': 'everything',
      'rhythm-detail': 'everything',
      feel: 'everything',
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
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', targets: true })).toBeNull() // target beats are the Changes sheet's
  })

  it('lists the rhythm on the Scales sheet', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', rhythm: 'unit:8:3:accents' })).toEqual({ settings: ['rhythm'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', rhythm: 'off' })).toBeNull() // what EditorView passes with the rhythmSheets flag off
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'arpeggios', rhythm: 'unit:8:3:accents' })).toEqual({ settings: ['rhythm'], needs: 'intermediate' })
  })

  it('lists a rhythm at a tuplet pulse under rhythm-gears, at Everything, where the rhythm draws (Phase 4 spec D22)', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, rhythm: 'unit:8q:5:accents' })).toEqual({ settings: ['rhythm', 'rhythm-gears'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'unit:8q:5:accents' })).toEqual({ settings: ['rhythm-gears'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', rhythm: 'custom:16s:>xxxxxx' })).toEqual({ settings: ['rhythm-gears'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, rhythm: 'unit:8q:5:accents' })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'unit:8t:3:accents' })).toBeNull() // the old pulses stay Intermediate's
    expect(hiddenSettings('intermediate', { ...DEFAULTS, lineMode: 'guide', rhythm: 'unit:8q:5:accents' })).toBeNull() // a Line that doesn't take it
  })

  it('lists a rhythm path that acts under rhythm-gears, on the Changes only (Phase 4 spec §7)', () => {
    const up = { ...RHYTHM_PATH_OFF, groups: [3, 4, 5, 6, 7] }
    const gears = { ...RHYTHM_PATH_OFF, gears: ['8', '16'] as const }
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'unit:8:3:accents', rhythmPath: up })).toEqual({ settings: ['rhythm-gears'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'custom:8:>xx', rhythmPath: gears })).toEqual({ settings: ['rhythm-gears', 'rhythm-detail'], needs: 'everything' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, lineMode: 'arpeggio', rhythmLine: true, rhythm: 'unit:8:3:accents', rhythmPath: up })).toEqual({ settings: ['line', 'rhythm', 'rhythm-gears'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, rhythm: 'unit:8:3:accents', rhythmPath: up })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'custom:8:>xx', rhythmPath: up })).toEqual({ settings: ['rhythm-detail'], needs: 'everything' }) // Groups act on a unit only
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'run:8:4:0', rhythmPath: up })).toBeNull() // nor on a per-bar rhythm
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'off', rhythmPath: up })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', rhythm: 'unit:8:3:accents', rhythmPath: up })).toBeNull() // paths are the Changes' (D13)
  })

  it('lists Feel in 2 or in 1 under feel, at Everything, on the Changes only, with or without a rhythm (Phase 4 spec §7, D13)', () => {
    expect(hiddenSettings('intermediate', { ...DEFAULTS, feel: 2 })).toEqual({ settings: ['feel'], needs: 'everything' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, feel: 1, rhythm: 'unit:8:3:accents' })).toEqual({ settings: ['rhythm', 'feel'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, lineMode: 'guide', feel: 1 })).toEqual({ settings: ['feel'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, feel: 2 })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, feel: 4 })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', feel: 2 })).toBeNull() // Feel is the Changes' (D13)
  })

  it('lists Notes per bar on the Scales sheet only (rhythm-scales-arpeggios spec §9)', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', notesPerBar: 3 })).toEqual({ settings: ['notes-per-bar'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', notesPerBar: 3 })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'arpeggios', notesPerBar: 3 })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', notesPerBar: 'whole' })).toBeNull()
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

describe('the Intermediate rhythms (#577)', () => {
  it('lists the presets: each pulse with accents on the beat, 8ths in 3, a run of 8ths, the cards', () => {
    expect(INTERMEDIATE_RHYTHMS).toEqual(['unit:4:4:accents', 'unit:8:2:accents', 'unit:8t:3:accents', 'unit:16:4:accents', 'unit:8:3:accents', 'run:8:4:0', 'card:downbeats', 'card:upbeats', 'card:halves'])
  })

  it('names another rhythm in force at Intermediate under rhythm-detail, where it draws', () => {
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'unit:8:5:rests' })).toEqual({ settings: ['rhythm-detail'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', rhythm: 'run:16:3:2' })).toEqual({ settings: ['rhythm-detail'], needs: 'everything' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, rhythm: 'unit:8:5:rests' })).toEqual({ settings: ['rhythm', 'rhythm-detail'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, rhythm: 'unit:8:5:rests' })).toBeNull()
    expect(hiddenSettings('intermediate', { ...DEFAULTS, lineMode: 'guide', rhythm: 'unit:8:5:rests' })).toBeNull() // a Line that doesn't take it
    for (const rhythm of INTERMEDIATE_RHYTHMS) expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm })).toBeNull()
  })

  it('leaves a tuplet pulse to rhythm-gears alone', () => {
    expect(hiddenSettings('intermediate', { ...DEFAULTS, rhythm: 'unit:8q:5:rests' })).toEqual({ settings: ['rhythm-gears'], needs: 'everything' })
  })
})

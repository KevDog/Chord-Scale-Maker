import { describe, expect, it } from 'vitest'
import { formatRhythm } from '../rhythm/rhythm'
import {
  LIBRARY_IDS,
  isRhythmId,
  positionLabel,
  rhythmLabel,
  rhythmOf,
  unitRhythm,
  type RhythmId,
} from '../rhythm/library'

const bar = (id: RhythmId, beats: number) => {
  const r = rhythmOf(id)
  return r?.kind === 'bar' ? r.bar(beats).join('') : null
}

describe('rhythm library', () => {
  it('lays every unit variation', () => {
    expect(formatRhythm(unitRhythm('8', 3, 'accents'))).toBe('8: >xxx')
    expect(formatRhythm(unitRhythm('8', 3, 'rests'))).toBe('8: x..')
    expect(formatRhythm(unitRhythm('8', 3, 'rest-last'))).toBe('8: xx.')
    expect(formatRhythm(unitRhythm('8', 3, 'syncopated'))).toBe('8: _xx')
    expect(formatRhythm(unitRhythm('8', 3, 'tied'))).toBe('8: x__')
  })

  it('labels', () => {
    expect(rhythmLabel('unit:8:5:accents')).toBe('8ths in 5, with accents')
    expect(rhythmLabel('run:8:4:3')).toBe('4 8ths from the and of 2')
    expect(rhythmLabel('card:upbeats')).toBe('Upbeats')
    expect(rhythmLabel('card:halves')).toBe('Half notes')
    expect(rhythmLabel('custom:8:x.x')).toBe('Your rhythm (8: x.x)')
  })

  it('names positions', () => {
    expect(positionLabel('8', 0)).toBe('1')
    expect(positionLabel('8', 3)).toBe('the and of 2')
    expect(positionLabel('8t', 4)).toBe('the trip of 2')
    expect(positionLabel('8t', 2)).toBe('the let of 1')
    expect(positionLabel('16', 1)).toBe('the e of 1')
    expect(positionLabel('16', 3)).toBe('the a of 1')
  })

  it('accepts and rejects ids', () => {
    for (const bad of ['unit:8:8:accents', 'unit:32:3:accents', 'run:4:3:0', 'run:8:4:8', 'card:fours', 'custom:8:...', 'x'])
      expect(isRhythmId(bad)).toBe(false)
    expect(isRhythmId('off')).toBe(true)
    expect(isRhythmId('run:16:7:15')).toBe(true)
    expect(isRhythmId('run:8t:2:12')).toBe(false)
  })

  it('cards in 3/4, 4/4 and 5/4', () => {
    expect(bar('card:halves', 3)).toBe('x___x_')
    expect(bar('card:halves', 4)).toBe('x___x___')
    expect(bar('card:halves', 5)).toBe('x___x___x_')
    expect(bar('card:upbeats', 4)).toBe('.x.x.x.x')
    expect(bar('card:upbeats', 3)).toBe('.x.x.x')
    expect(bar('card:downbeats', 3)).toBe('x_x_x_')
    expect(bar('card:downbeats', 5)).toBe('x_x_x_x_x_')
  })

  it('runs keep only the bar own cells', () => {
    expect(bar('run:8:3:6', 3)).toBe('......')
    expect(bar('run:8:3:6', 4)).toBe('......xx')
    expect(bar('run:8:4:1', 4)).toBe('.xxxx...')
    expect(bar('run:8:4:0', 4)).toBe('xxxx....')
    expect(bar('run:8t:3:10', 3)).toBe('.........')
    expect(bar('run:16:2:15', 4)).toBe('...............x')
    expect(rhythmOf('run:8:4:3')).toMatchObject({ kind: 'bar', pulse: '8', n: 4, k: 3 })
    expect(rhythmOf('card:halves')).toMatchObject({ kind: 'bar', pulse: '8', n: 0, k: 0 })
  })

  it('repeats units and customs; off is null', () => {
    expect(rhythmOf('unit:8:3:rests')).toEqual({ kind: 'repeat', rhythm: unitRhythm('8', 3, 'rests') })
    expect(rhythmOf('custom:8:x.x')).toEqual({ kind: 'repeat', rhythm: { pulse: '8', cells: ['x', '.', 'x'] } })
    expect(rhythmOf('off')).toBeNull()
    expect(rhythmOf('custom:8:...' as RhythmId)).toBeNull()
  })

  it('every library id is valid and resolves', () => {
    expect(new Set(LIBRARY_IDS).size).toBe(LIBRARY_IDS.length)
    expect(LIBRARY_IDS.length).toBe(4 * 6 * 5 + 6 * (8 + 12 + 16) + 3)
    expect(LIBRARY_IDS[0]).toBe('unit:4:2:accents')
    expect(LIBRARY_IDS.at(-1)).toBe('card:halves')
    for (const id of LIBRARY_IDS) {
      expect(isRhythmId(id), id).toBe(true)
      expect(rhythmOf(id), id).not.toBeNull()
      expect(rhythmLabel(id), id).not.toBe('')
    }
  })
})

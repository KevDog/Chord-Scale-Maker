import { describe, expect, it } from 'vitest'
import { drawnChords } from '../changes'
import { type ChartDoc, parseChart } from '../chart'
import { deleteBar, insertBar, repeatSection, setBarChords, splitSection } from '../edit'
import { carryChordPicks, carryPicks } from '../picks'

const C4 = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | Cmaj7\nB | 5 | Em7\nB | 6 | A7').value
const carried = (before: ChartDoc, after: ChartDoc, picks: Record<string, number>) => carryPicks(drawnChords(before), drawnChords(after), picks)

describe('carryPicks', () => {
  it('keeps picks on their chords when a bar goes in before them', () => {
    expect(carried(C4, insertBar(C4, 'A', 2, ['F7']), { 'A:3:0': 7, 'B:6:0': 2 })).toEqual({ 'A:4:0': 7, 'B:7:0': 2 })
  })

  it('keeps picks on their chords when a bar before them goes', () => {
    expect(carried(C4, deleteBar(C4, 'A', 2), { 'A:1:0': 9, 'A:3:0': 7, 'B:5:0': 4 })).toEqual({ 'A:1:0': 9, 'A:2:0': 7, 'B:4:0': 4 })
  })

  it('drops a pick on a removed chord', () => {
    expect(carried(C4, deleteBar(C4, 'A', 2), { 'A:2:0': 7 })).toEqual({})
  })

  it('drops a pick on a chord written over', () => {
    expect(carried(C4, setBarChords(C4, 'A', 3, ['Db7']), { 'A:3:0': 7, 'A:4:0': 9 })).toEqual({ 'A:4:0': 9 })
  })

  it('follows a chord into a section split off', () => {
    expect(carried(C4, splitSection(C4, 'A', 3, 'A2'), { 'A:3:0': 7, 'A:1:0': 9 })).toEqual({ 'A2:3:0': 7, 'A:1:0': 9 })
  })

  it('keeps picks where a repeated section is added after them', () => {
    expect(carried(C4, repeatSection(C4, 'B', 'B2'), { 'B:6:0': 2 })).toEqual({ 'B:6:0': 2 })
  })

  it('keeps a pick in place when a copy of its chord goes in after it', () => {
    expect(carried(C4, insertBar(C4, 'A', 2, ['Cmaj7']), { 'A:1:0': 9 })).toEqual({ 'A:1:0': 9 })
  })

  it('drops a pick on a chord the chart no longer draws', () => {
    expect(carried(C4, C4, { 'Z:9:0': 3 })).toEqual({})
  })

  it('carries both kinds of chord picks, for and all', () => {
    const picks = { pentatonic: { 'A:3:0': { pc: 7, for: 'G7|G Mixolydian' } }, hexatonic: { 'B:6:0': { roots: [0, 2] as const } } }
    expect(carryChordPicks(drawnChords(C4), drawnChords(insertBar(C4, 'A', 2, ['F7'])), picks)).toEqual({ pentatonic: { 'A:4:0': { pc: 7, for: 'G7|G Mixolydian' } }, hexatonic: { 'B:7:0': { roots: [0, 2] } } })
  })
})

describe('drawnChords', () => {
  it('lists each drawn chord by the key the Changes sheet gives it, with its text', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 1 | Dm7\nB | 2 | G7').value
    expect(drawnChords(doc)).toEqual([{ at: 'A:1:0', text: 'Cmaj7' }, { at: 'A:1:1', text: 'Dm7' }, { at: 'B:2:0', text: 'G7' }])
  })
})

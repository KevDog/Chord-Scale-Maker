import { describe, expect, it } from 'vitest'
import * as vf from 'vexflow/bravura'
import { buildArpeggioSheet, buildSheet, CONCERT, type PracticeSelection, type StaffModel } from '@chord-scale-maker/engine'
import { drawArpeggioStaff, drawStaff } from '~/utils/vexflow'

const staffOf = (practice: PracticeSelection | null): StaffModel => buildSheet([{ section: 'A', bar: '1', chord: 'G7', scale: '' }], CONCERT, 'root', 'C', 12, practice)[0]!.pages.flat()[0]!
const tags = (staff: StaffModel): string[] => {
  const el = document.body.appendChild(document.createElement('div')) // VexFlow finds a note's group by id in the document
  drawStaff(vf, el, staff, 'treble')
  el.remove()
  return [...el.querySelectorAll('.vf-stavenote')].map((g) => ['vf-selected', 'vf-dimmed', 'vf-second'].filter((c) => g.classList.contains(c)).join(' '))
}

describe('drawStaff practice tags', () => {
  it('tags group B of a hexatonic vf-second beside vf-selected', () => {
    const staff = staffOf({ preset: 'hexatonic', pair: 0, grouping: 'triads' })
    expect(staff.second).not.toBeNull()
    const expected = staff.selected!.map((on, i) => (on ? (staff.second![i] ? 'vf-selected vf-second' : 'vf-selected') : 'vf-dimmed'))
    expect(expected.filter((t) => t.includes('vf-second'))).toHaveLength(3)
    expect(tags(staff)).toEqual(expected)
  })

  it('tags a pentatonic’s added notes vf-second and names them in the label (#308)', () => {
    const staff = staffOf({ preset: 'pentatonic', degree: 0 }) // Gm over G Mixolydian: B♭ from outside
    expect(staff.outside?.filter(Boolean)).toHaveLength(1)
    expect(tags(staff)).toEqual(staff.selected!.map((on, i) => (staff.outside![i] ? 'vf-selected vf-second' : on ? 'vf-selected' : 'vf-dimmed')))
    const el = document.body.appendChild(document.createElement('div'))
    drawStaff(vf, el, staff, 'treble')
    el.remove()
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toMatch(/; added from the pentatonic: bb4$/)
  })

  // rhythm-scales-arpeggios spec §7: a run's label is its notes, then the rhythm it is poured into, then the practice part
  it('names a poured run’s rhythm between its notes and the practice part; an even run names none', () => {
    const label = (rhythm: 'off' | 'unit:8:3:accents', caption: string | null): string => {
      const staff = buildSheet([{ section: 'A', bar: '1', chord: 'G7', scale: '' }], CONCERT, 'root', 'C', 12, { preset: 'chordTones' }, undefined, undefined, undefined, undefined, { rhythm, notesPerBar: 4 })[0]!.pages.flat()[0]!
      const el = document.body.appendChild(document.createElement('div'))
      drawStaff(vf, el, staff, 'treble', undefined, caption)
      el.remove()
      return el.querySelector('svg')?.getAttribute('aria-label') ?? ''
    }
    expect(label('unit:8:3:accents', 'Rhythm: 8ths in 3, with accents')).toMatch(/^[^;]+ rest; rhythm: 8ths in 3, with accents; practice: [^;]+$/)
    expect(label('off', null)).toMatch(/^[^;]+; practice: [^;]+$/)
  })

  it('tags none vf-second without a hexatonic', () => {
    expect(tags(staffOf({ preset: 'chordTones' })).some((t) => t.includes('vf-second'))).toBe(false)
    expect(tags(staffOf(null)).every((t) => t === '')).toBe(true)
  })
})

// rhythm-scales-arpeggios spec §4, §7: an Arpeggios run drawn bar by bar, as the Scales run is; no Saindon bracket (P2 D19)
describe('drawArpeggioStaff with a rhythm', () => {
  const draw = (rhythm?: 'unit:8:3:accents'): HTMLElement => {
    const staff = buildArpeggioSheet([{ section: 'A', bar: '1', chord: 'Cmaj7', scale: '' }], CONCERT, 12, 'seventh', 'up', undefined, undefined, rhythm ? { rhythm } : {}).pages.flat()[0]!
    const el = document.body.appendChild(document.createElement('div'))
    drawArpeggioStaff(vf, el, staff, 'treble', rhythm ? 'Rhythm: 8ths in 3, with accents' : null)
    el.remove()
    return el
  }

  it('pours the notes into bars with the time signature, its label naming the rhythm', () => {
    const el = draw('unit:8:3:accents')
    const svg = el.querySelector('svg')!
    expect(svg.getAttribute('data-time-sig')).toBe('4/4')
    expect(svg.getAttribute('aria-label')).toBe('c4 e4 g4 b4 c5 e5 g5 b5 c6 rest rest rest; rhythm: 8ths in 3, with accents')
    expect(el.querySelectorAll('.vf-stave')).toHaveLength(2)
    expect(el.querySelectorAll('[data-rhythm-bracket]')).toHaveLength(0)
  })

  it('draws today’s barless run without one', () => {
    const svg = draw().querySelector('svg')!
    expect(svg.hasAttribute('data-time-sig')).toBe(false)
    expect(svg.getAttribute('aria-label')).toBe('c4 e4 g4 b4 c5 e5 g5 b5 c6')
  })
})

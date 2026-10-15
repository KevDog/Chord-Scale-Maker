import { describe, expect, it } from 'vitest'
import * as vf from 'vexflow/bravura'
import { buildSheet, CONCERT, type PracticeSelection, type StaffModel } from '@chord-scale-maker/engine'
import { drawStaff } from '~/utils/vexflow'

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

  it('tags none vf-second without a hexatonic', () => {
    expect(tags(staffOf({ preset: 'chordTones' })).some((t) => t.includes('vf-second'))).toBe(false)
    expect(tags(staffOf(null)).every((t) => t === '')).toBe(true)
  })
})

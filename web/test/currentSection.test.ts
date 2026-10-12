import { describe, expect, it } from 'vitest'
import { currentSection } from '~/utils/currentSection'

const tops = [
  { id: 'a', top: -400 },
  { id: 'b', top: -20 },
  { id: 'c', top: 300 },
]

describe('currentSection', () => {
  it('is the last section whose top has reached the line', () => {
    expect(currentSection(tops, 0)).toBe('b')
    expect(currentSection(tops, 300)).toBe('c')
  })

  it('is the first section before any has reached it', () => {
    expect(currentSection([{ id: 'a', top: 100 }, { id: 'b', top: 500 }], 0)).toBe('a')
  })

  it('at the page’s end: the section a link just went to, while on screen, else the last', () => {
    expect(currentSection(tops, 0, { height: 800, hash: '' })).toBe('c')
    expect(currentSection(tops, 0, { height: 800, hash: 'c' })).toBe('c')
    expect(currentSection([...tops, { id: 'd', top: 600 }], 0, { height: 800, hash: 'c' })).toBe('c')
    expect(currentSection([...tops, { id: 'd', top: 600 }], 0, { height: 800, hash: 'b' })).toBe('d') // b's top is off screen
  })

  it('is nothing without sections', () => {
    expect(currentSection([], 0)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { keyChanges } from '~/utils/vexflow'

describe('keyChanges', () => {
  it('marks a bar whose key differs from the bar before it, with the key it cancels', () => {
    const bars = ['Bb', 'Bb', 'D', 'D', null].map((keySig) => ({ keySig }))
    expect(keyChanges(bars)).toEqual([null, null, { keySig: 'D', previous: 'Bb' }, null, { keySig: 'C', previous: 'D' }])
  })

  it('never marks the first bar (it carries the clef and its own signature)', () => {
    expect(keyChanges([{ keySig: 'Eb' }])).toEqual([null])
    expect(keyChanges([])).toEqual([])
  })
})

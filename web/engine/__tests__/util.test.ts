import { describe, expect, it } from 'vitest'
import { chunk, isSyncCopy, orNull } from '../util'

describe('util', () => {
  it('chunks into runs', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([1, 2], 0)).toEqual([[1], [2]])
  })

  it('returns null for a throw', () => {
    expect(orNull(() => 1)).toBe(1)
    expect(orNull(() => { throw new Error('x') })).toBeNull()
  })

  it('spots sync-tool copies', () => {
    expect(['giant_steps 2.txt', '../../../charts/so_what 12.txt', 'levels 2.ts'].map(isSyncCopy)).toEqual([true, true, true])
    expect(['giant_steps.txt', 'take_5.txt', 'charts 2/x.txt', 'a2.txt'].map(isSyncCopy)).toEqual([false, false, false, false])
  })
})

import { describe, expect, it } from 'vitest'
import { practiceKey } from '~/utils/practiceKey'

describe('practiceKey', () => {
  it('builds the practice localStorage key from a slug and a mode', () => {
    expect(practiceKey('autumn_leaves', 'root')).toBe('csm-practice:autumn_leaves:root')
    expect(practiceKey('mine:42', 'from')).toBe('csm-practice:mine:42:from')
  })
})

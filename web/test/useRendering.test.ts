import { describe, expect, it } from 'vitest'
import { useRendering } from '~/composables/useRendering'

describe('useRendering', () => {
  it('counts concurrent renders and never goes negative', () => {
    const r = useRendering()
    const a = r.begin()
    const b = r.begin()
    expect(r.active.value).toBe(2)
    a()
    b()
    expect(r.active.value).toBe(0)
    b() // double-done is a no-op
    expect(r.active.value).toBe(0)
  })
})

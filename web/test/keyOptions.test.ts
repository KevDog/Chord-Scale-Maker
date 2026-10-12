import { describe, expect, it } from 'vitest'
import { LIBRARY } from '~/utils/library'
import { KEY_OPTIONS } from '~/utils/keyOptions'

describe('KEY_OPTIONS', () => {
  it('offers every key a library chart is in, so the heading’s key field shows it (#143)', () => {
    const offered = new Set<string>(KEY_OPTIONS)
    const keys = new Set(LIBRARY.map((c) => /^key:\s*(\S+)/m.exec(c.text)?.[1] ?? ''))
    expect([...keys].filter((k) => k && !offered.has(k))).toEqual([])
  })
})

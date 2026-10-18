import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSession, removeSession, writeSession } from '~/utils/storage'

describe('the sessionStorage wrappers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('read, write and remove a value', () => {
    writeSession('k', 'v')
    expect(readSession('k')).toBe('v')
    removeSession('k')
    expect(readSession('k')).toBeNull()
  })

  it('carry on without storage: a read is null, a write or remove does nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readSession('k')).toBeNull()
    expect(() => writeSession('k', 'v')).not.toThrow()
    expect(() => removeSession('k')).not.toThrow()
  })
})

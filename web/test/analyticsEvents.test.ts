import { describe, expect, it, vi } from 'vitest'
import { sendEvent, songOf } from '~/utils/analytics'
import { LIBRARY } from '~/utils/library'

describe('sendEvent', () => {
  it('sends only with the flag on and the script present', () => {
    const va = vi.fn()
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, false, { va })
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, true, {})
    expect(va).not.toHaveBeenCalled()
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, true, { va })
    expect(va).toHaveBeenCalledWith('event', { name: 'Sheet chosen', data: { sheet: 'scales' } })
  })

  it('never sends more than two properties or a value over 255 characters', () => {
    const va = vi.fn()
    sendEvent({ name: 'Transposed', data: { song: 'x'.repeat(300), to: 'Eb' } }, true, { va })
    const data = va.mock.calls[0]?.[1].data as Record<string, string>
    expect(Object.keys(data).length).toBeLessThanOrEqual(2)
    expect(Object.values(data).every((v) => v.length <= 255)).toBe(true)
  })

  it("doesn't throw if the call fails", () => {
    const va = () => {
      throw new Error('blocked')
    }
    expect(() => sendEvent({ name: 'Printed', data: { sheet: 'changes', song: 'own' } }, true, { va })).not.toThrow()
  })
})

describe('songOf', () => {
  const lib = { kind: 'library', slug: 'autumn-leaves', libraryText: 'A | 1 | Cm7\n' } as const

  it('names a library chart as published, else own', () => {
    expect(songOf(lib, lib.libraryText)).toBe('autumn-leaves')
    expect(songOf(lib, 'A | 1 | Cm9\n')).toBe('own')
    expect(songOf({ kind: 'mine', id: 'x' }, 'title: My Secret Tune\n')).toBe('own')
  })

  it('names a shared chart only when its text is a library chart', () => {
    expect(songOf(undefined, 'title: My Secret Tune\nA | 1 | C\n', true)).toBe('own')
    const first = LIBRARY[0]
    expect(first && songOf(undefined, first.text, true)).toBe(first?.slug)
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initInterface, useInterface } from '~/composables/useInterface'

describe('useInterface', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => (useRuntimeConfig().public.features.interfaceLevels = false))

  it('flag off: shows everything and stores nothing', () => {
    initInterface()
    expect(useInterface().shows('pentatonics')).toBe(true)
    expect(localStorage.getItem('csm-interface')).toBeNull()
  })

  it('a new browser starts at Essentials, written at once', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    const ui = useInterface()
    expect(ui.level.value).toBe('essentials')
    expect(ui.shows('line')).toBe(false)
    expect(localStorage.getItem('csm-interface')).toBe('essentials')
  })

  it('is decided once: a csm-* key written later does not change it', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    localStorage.setItem('csm-recent', '[]')
    initInterface()
    expect(useInterface().level.value).toBe('essentials')
  })

  it('a browser with preferences starts at Everything', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    localStorage.setItem('csm-instrument', 'tenor-sax')
    initInterface()
    expect(useInterface().level.value).toBe('everything')
  })

  it('remembers a chosen level', async () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    useInterface().level.value = 'intermediate'
    await nextTick()
    expect(localStorage.getItem('csm-interface')).toBe('intermediate')
    expect(useInterface().shows('line')).toBe(true)
  })
})

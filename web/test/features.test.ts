import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '~/components/AppShell.vue'
import Index from '~/pages/index.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const myChartsLinks = (html: string) => html.match(/song\?new=1/g) ?? []

describe('feature flags', () => {
  beforeEach(() => navigate.mockClear())

  it('reads flags from runtime config', () => {
    expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, guideTones: true, practice: true, changes: true, scaleLevels: true, functions: true, keySignatures: true })
    expect(useFeature('myCharts')).toBe(true)
  })

  it('offers New chart in the library, not the header', async () => {
    expect(myChartsLinks((await mountSuspended(AppShell)).html())).toEqual([])
    const index = await mountSuspended(Index)
    expect(myChartsLinks(index.html())).toHaveLength(1)
    expect(index.text()).toContain('start a new chart')
  })

  it('opens library, new and saved charts, and sends a bare /song home', async () => {
    const song = (await import('~/pages/song.vue')).default
    for (const route of ['/song?new=1', '/song?chart=f_blues', '/song?mine=abcdef123456']) {
      await mountSuspended(song, { route })
      expect(navigate, route).not.toHaveBeenCalled()
    }
    await mountSuspended(song, { route: '/song' })
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})

import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '~/components/AppShell.vue'
import Index from '~/pages/index.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const myChartsLinks = (html: string) => html.match(/song\?new=1/g) ?? []

describe('feature flags', () => {
  beforeEach(() => navigate.mockClear())

  it('has its flags off until they ship: offline (#324), analyticsEvents (#149); recordings is on', () => {
    expect(useRuntimeConfig().public.features).toEqual({ offline: false, analyticsEvents: false, recordings: true })
  })

  it('offers New chart in the library, not the header', async () => {
    expect(myChartsLinks((await mountSuspended(AppShell)).html())).toEqual([])
    const index = await mountSuspended(Index)
    expect(myChartsLinks(index.html())).toHaveLength(1)
    expect(index.text()).toContain('start a new chart')
  })

  it('opens library, new and saved charts, and sends a bare /song to the library', async () => {
    const song = (await import('~/pages/song/[[slug]].vue')).default
    for (const route of ['/song?new=1', '/song/f-blues', '/song?mine=abcdef123456']) {
      await mountSuspended(song, { route })
      expect(navigate, route).not.toHaveBeenCalled()
    }
    await mountSuspended(song, { route: '/song' })
    expect(navigate).toHaveBeenCalledWith('/library', { replace: true })
  })

  it('moves an old ?chart= link to /song/<name>, without a history entry', async () => {
    const song = (await import('~/pages/song/[[slug]].vue')).default
    await mountSuspended(song, { route: '/song?chart=f_blues' })
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ path: '/song/f-blues' }), { replace: true })
  })
})

import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '~/components/AppShell.vue'
import Index from '~/pages/index.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const myChartsLinks = (html: string) => html.match(/editor\?new=1/g) ?? []

describe('feature flags', () => {
  beforeEach(() => navigate.mockClear())

  it('reads flags from runtime config', () => {
    expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, guideTones: true, practice: true })
    expect(useFeature('myCharts')).toBe(true)
  })

  it('offers New chart in the library, not the header', async () => {
    expect(myChartsLinks((await mountSuspended(AppShell)).html())).toEqual([])
    const index = await mountSuspended(Index)
    expect(myChartsLinks(index.html())).toHaveLength(1)
    expect(index.text()).toContain('start a new chart')
  })

  it('opens library, new and saved charts, and sends a bare /editor home', async () => {
    const editor = (await import('~/pages/editor.vue')).default
    for (const route of ['/editor?new=1', '/editor?chart=f_blues', '/editor?mine=abcdef123456']) {
      await mountSuspended(editor, { route })
      expect(navigate, route).not.toHaveBeenCalled()
    }
    await mountSuspended(editor, { route: '/editor' })
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})

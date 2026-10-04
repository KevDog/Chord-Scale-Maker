import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '~/components/AppShell.vue'
import Index from '~/pages/index.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const newChartLinks = (html: string) => html.match(/editor\?new=1/g) ?? []

describe('features off by default', () => {
  beforeEach(() => navigate.mockClear())

  it('reads flags from runtime config', () => {
    expect(useRuntimeConfig().public.features).toEqual({ newChart: false })
    expect(useFeature('newChart')).toBe(false)
  })

  it('hides New chart in the navbar, the mobile menu and the library', async () => {
    expect(newChartLinks((await mountSuspended(AppShell)).html())).toEqual([])
    const index = await mountSuspended(Index)
    expect(newChartLinks(index.html())).toEqual([])
    expect(index.text()).not.toContain('start a new chart')
  })

  it('sends the editor home unless it opens a library chart', async () => {
    await mountSuspended((await import('~/pages/editor.vue')).default, { route: '/editor?new=1' })
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    navigate.mockClear()
    await mountSuspended((await import('~/pages/editor.vue')).default, { route: '/editor?chart=f_blues' })
    expect(navigate).not.toHaveBeenCalled()
  })
})

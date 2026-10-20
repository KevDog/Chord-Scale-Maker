import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import RecentCharts from '~/components/RecentCharts.vue'
import { RECENT_KEY } from '~/utils/recentCharts'

afterEach(() => localStorage.removeItem(RECENT_KEY))

describe('Recently opened', () => {
  it('names a version by its label, so two versions of a tune read apart (#423)', async () => {
    const now = Date.now()
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ kind: 'library', id: 'summertime-jazz-mind-accelerator', at: now }, { kind: 'library', id: 'summertime', at: now }]))
    const w = await mountSuspended(RecentCharts)
    await flushPromises()
    expect(w.findAll('a').map((a) => a.text())).toEqual(['Summertime (Jazz Mind Accelerator)', 'Summertime'])
  })
})

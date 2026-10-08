import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { SAVE_DEBOUNCE_MS, type SaveTarget, useSavedChart } from '~/composables/useSavedChart'
import { listCharts, loadChart, versionOf } from '~/utils/myCharts'

const LIB = 'title: Autumn Leaves\nA1 | 1 | Cm7\n'
const text = ref('')

async function harness(target: SaveTarget, created?: (id: string) => void) {
  let api: ReturnType<typeof useSavedChart> | undefined
  const w = await mountSuspended(
    defineComponent({
      setup() {
        api = useSavedChart(text, target, created)
        return () => h('div')
      },
    }),
  )
  if (!api) throw new Error('not mounted')
  return { api, w }
}
async function type(value: string): Promise<void> {
  text.value = value
  await nextTick()
  vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
}

describe('useSavedChart', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('keeps edits to a library chart as your version, and drops it when edited back', async () => {
    text.value = LIB
    const { api } = await harness({ kind: 'library', slug: 'autumn_leaves', libraryText: LIB })
    expect(api.status.value.state).toBe('clean')
    await type(`${LIB}A1 | 2 | F7\n`)
    expect(api.status.value.state).toBe('saved')
    expect(api.edited.value).toBe(true)
    expect(versionOf('autumn_leaves')).toMatchObject({ kind: 'edited', title: 'Autumn Leaves' })
    await type(LIB)
    expect(versionOf('autumn_leaves')).toBeNull()
    expect(api.edited.value).toBe(false)
  })

  it('saves a new chart on its first edit, and says so once', async () => {
    text.value = 'title: Untitled\n'
    const created = vi.fn()
    const { api } = await harness({ kind: 'new', id: 'newchart01', savedKind: 'new' }, created)
    await type('title: My Tune\n')
    await type('title: My Tune\nA | 1 | C\n')
    expect(created).toHaveBeenCalledTimes(1)
    expect(created).toHaveBeenCalledWith('newchart01')
    expect(loadChart('newchart01')?.text).toContain('A | 1 | C')
    expect(api.status.value.state).toBe('saved')
  })

  it('saves at once when the editor closes', async () => {
    text.value = 'title: X\n'
    const { w } = await harness({ kind: 'new', id: 'closeme01', savedKind: 'new' })
    text.value = 'title: Closed\n'
    await nextTick()
    w.unmount()
    expect(listCharts().map((m) => m.title)).toEqual(['Closed'])
  })

  it('reports a failed save and tries again later', async () => {
    text.value = 'title: X\n'
    const { api } = await harness({ kind: 'new', id: 'fullfull1', savedKind: 'new' })
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await type('title: Y\n')
    expect(api.status.value).toEqual({ state: 'failed', reason: 'full' })
    full.mockRestore()
    api.flush()
    expect(api.status.value.state).toBe('saved')
  })
})

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenChart } from '~/composables/useOpenChart'
import { irealLink } from '../../engine/src/ireal/__tests__/link'
import { loadChart } from '~/utils/myCharts'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
mockNuxtImport('useFeature', () => () => true)

const BLUES = '[*AC7 |F7 |C7 |G7 Z'
const mineId = (): string => navigateTo.mock.calls.at(-1)?.[0]?.query?.mine

describe('useOpenChart with iReal', () => {
  beforeEach(() => {
    localStorage.clear()
    navigateTo.mockReset()
  })

  it('one clean song opens straight away as a new chart', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'Blues', music: BLUES }]))
    expect(navigateTo).toHaveBeenCalledOnce()
    expect(loadChart(mineId())?.text).toMatch(/^title: Blues\n/)
  })

  it('a playlist asks which song; choosing opens it', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'One', music: BLUES }, { title: 'Two', music: BLUES }], 'Set'))
    expect(o.songs.value.map((s) => s.title)).toEqual(['One', 'Two'])
    expect(o.playlist.value).toBe('Set')
    expect(navigateTo).not.toHaveBeenCalled()
    await o.choose(1)
    expect(loadChart(mineId())?.text).toMatch(/^title: Two\n/)
    expect(o.songs.value).toEqual([])
  })

  it('a song with a report waits for Open anyway; cancel leaves nothing behind', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'Odd', music: '[*AC7 W/E |F7 Z' }]))
    expect(o.report.value.map((d) => d.message)).toEqual(['A bar 1: a bass note with no chord (W/E) is left out'])
    expect(navigateTo).not.toHaveBeenCalled()
    o.cancel()
    expect(o.report.value).toEqual([])
    await o.openIReal(irealLink([{ title: 'Odd', music: '[*AC7 W/E |F7 Z' }]))
    await o.confirm()
    expect(loadChart(mineId())?.text).toMatch(/^title: Odd\n/)
  })

  it('a link it can’t read is an error', async () => {
    const o = useOpenChart()
    await o.openIReal('irealb://%E0%A4%A')
    expect(o.error.value).toMatch(/damaged/)
    o.cancel()
    expect(o.error.value).toBe('')
  })

  it('an iReal export opened as a file becomes a chart', async () => {
    const o = useOpenChart()
    const html = `<a href="${irealLink([{ title: 'Blues', music: BLUES }], undefined, true)}">Blues</a>`
    await o.open(new File([html], 'Blues.html', { type: 'text/html' }))
    expect(o.error.value).toBe('')
    expect(loadChart(mineId())?.text).toMatch(/^title: Blues\n/)
  })

  it('cancel puts a playlist away', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'One', music: BLUES }, { title: 'Two', music: BLUES }], 'Set'))
    expect(o.songs.value).toHaveLength(2)
    o.cancel()
    expect(o.songs.value).toEqual([])
  })
})

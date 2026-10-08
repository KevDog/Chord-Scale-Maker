import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteChart, filenameFor, listCharts, loadChart, migrateDraft, MY_CHARTS_MAX, newChartId, saveChart, versionOf } from '~/utils/myCharts'

const chart = (title: string, chord = 'Cm7'): string => `title: ${title}\nA | 1 | ${chord}\n`

describe('My charts', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves, lists newest first, loads and deletes', () => {
    const a = saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    saveChart({ id: 'bbbbbb2', text: chart('Beta'), kind: 'copy', basedOn: 'autumn_leaves' }, 2)
    expect(a).toMatchObject({ ok: true, meta: { title: 'Alpha', kind: 'new', createdAt: 1 } })
    expect(listCharts().map((m) => m.title)).toEqual(['Beta', 'Alpha'])
    expect(loadChart('aaaaaa1')?.text).toBe(chart('Alpha'))
    deleteChart('aaaaaa1')
    expect(loadChart('aaaaaa1')).toBeNull()
    expect(localStorage.getItem('csm-chart:aaaaaa1')).toBeNull()
  })

  it('updates a chart in place, keeping its kind and origin', () => {
    saveChart({ id: 'eeeeee1', text: chart('Autumn Leaves'), kind: 'edited', basedOn: 'autumn_leaves' }, 1)
    saveChart({ id: 'eeeeee1', text: chart('Autumn Leaves', 'F7'), kind: 'new' }, 5)
    expect(versionOf('autumn_leaves')).toMatchObject({ id: 'eeeeee1', kind: 'edited', createdAt: 1, updatedAt: 5 })
    expect(loadChart('eeeeee1')?.text).toContain('F7')
    expect(versionOf('so_what')).toBeNull()
  })

  it('stops at the cap and at the size limit, and says why', () => {
    for (let i = 0; i < MY_CHARTS_MAX; i++) saveChart({ id: `chart${String(i).padStart(3, '0')}`, text: chart(`C${i}`), kind: 'new' })
    expect(saveChart({ id: 'oneMore1', text: chart('More'), kind: 'new' })).toEqual({ ok: false, reason: 'full' })
    expect(saveChart({ id: 'chart000', text: chart('Still fine'), kind: 'new' }).ok).toBe(true) // updates are fine
    expect(saveChart({ id: 'chart001', text: 'x'.repeat(20_001), kind: 'new' })).toEqual({ ok: false, reason: 'tooLong' })
  })

  it('reports a full or blocked storage instead of losing the index', () => {
    saveChart({ id: 'keep001', text: chart('Keep'), kind: 'new' })
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveChart({ id: 'nope001', text: chart('Nope'), kind: 'new' })).toEqual({ ok: false, reason: 'full' })
    full.mockRestore()
    expect(listCharts().map((m) => m.id)).toEqual(['keep001'])
  })

  it('ignores index entries that are not saved charts', () => {
    localStorage.setItem('csm-charts', JSON.stringify([{ id: '<x>', kind: 'new' }, { id: 'goodid1', kind: 'hacked', createdAt: 1, updatedAt: 1 }, 'x']))
    expect(listCharts()).toEqual([])
    localStorage.setItem('csm-charts', 'not json')
    expect(listCharts()).toEqual([])
  })

  it('moves the old draft in once, unless it was the untouched starter', () => {
    localStorage.setItem('csm-draft', chart('My Tune'))
    migrateDraft(chart('Untitled'))
    expect(listCharts().map((m) => [m.title, m.kind])).toEqual([['My Tune', 'new']])
    expect(localStorage.getItem('csm-draft')).toBeNull()
    localStorage.setItem('csm-draft', chart('Untitled'))
    migrateDraft(chart('Untitled'))
    expect(listCharts()).toHaveLength(1)
  })

  it('makes URL-safe ids and safe file names', () => {
    expect(newChartId()).toMatch(/^[a-f0-9]{12}$/)
    expect(['Autumn Leaves', 'Blues for Alice / Bird', '  ', 'Café Ré:mi?', '../../etc'].map(filenameFor)).toEqual([
      'Autumn Leaves.txt',
      'Blues for Alice Bird.txt',
      'chart.txt',
      'Cafe Re mi.txt',
      'etc.txt',
    ])
  })
})

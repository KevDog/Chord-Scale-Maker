import { afterEach, describe, expect, it, vi } from 'vitest'
import { chartText, deleteChart, filenameFor, listCharts, loadChart, migrateChartNames, migrateDraft, MY_CHARTS_MAX, newChartId, saveChart, savedRevision, versionOf } from '~/utils/myCharts'

const chart = (title: string, chord = 'Cm7'): string => `title: ${title}\nsection: A\n1 | ${chord}\n`

describe('My charts', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves, lists newest first, loads and deletes', () => {
    const a = saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    saveChart({ id: 'bbbbbb2', text: chart('Beta'), kind: 'copy', basedOn: 'autumn-leaves' }, 2)
    expect(a).toMatchObject({ ok: true, meta: { title: 'Alpha', kind: 'new', createdAt: 1 } })
    expect(listCharts().map((m) => m.title)).toEqual(['Beta', 'Alpha'])
    expect(loadChart('aaaaaa1')?.text).toBe(chart('Alpha'))
    deleteChart('aaaaaa1')
    expect(loadChart('aaaaaa1')).toBeNull()
    expect(localStorage.getItem('csm-chart:aaaaaa1')).toBeNull()
  })

  it('counts each save and delete, so a view of your charts can follow them, and reads a chart\'s text alone', () => {
    const before = savedRevision.value
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    expect(savedRevision.value).toBe(before + 1)
    expect(chartText('aaaaaa1')).toBe(chart('Alpha'))
    deleteChart('aaaaaa1')
    expect(savedRevision.value).toBe(before + 2)
    expect(chartText('aaaaaa1')).toBeNull()
  })

  it('updates a chart in place, keeping its kind and origin', () => {
    saveChart({ id: 'eeeeee1', text: chart('Autumn Leaves'), kind: 'edited', basedOn: 'autumn-leaves' }, 1)
    saveChart({ id: 'eeeeee1', text: chart('Autumn Leaves', 'F7'), kind: 'new' }, 5)
    expect(versionOf('autumn-leaves')).toMatchObject({ id: 'eeeeee1', kind: 'edited', createdAt: 1, updatedAt: 5 })
    expect(loadChart('eeeeee1')?.text).toContain('F7')
    expect(versionOf('so-what')).toBeNull()
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

  it('leaves behind an old draft still holding the starter from before section blocks', () => {
    localStorage.setItem('csm-draft', 'title: Untitled\nA | 1 | Dm7\n')
    migrateDraft(chart('Untitled'), Date.now(), 'title: Untitled\nA | 1 | Dm7\n')
    expect(listCharts()).toEqual([])
    expect(localStorage.getItem('csm-draft')).toBeNull()
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

describe('migrateChartNames', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })
  const meta = (id: string, basedOn?: string) => ({ id, title: 'T', kind: basedOn ? 'edited' : 'new', ...(basedOn ? { basedOn } : {}), createdAt: 1, updatedAt: 1 })

  it('moves practice picks and the scale level saved under a chart’s old name', () => {
    localStorage.setItem('csm-practice:autumn_leaves:root', '{"a":1}')
    localStorage.setItem('csm-practice:autumn_leaves:from', '{"b":2}')
    localStorage.setItem('csm-level:autumn_leaves', '{"level":"advanced","seed":1}')
    migrateChartNames()
    expect(localStorage.getItem('csm-practice:autumn-leaves:root')).toBe('{"a":1}')
    expect(localStorage.getItem('csm-practice:autumn-leaves:from')).toBe('{"b":2}')
    expect(localStorage.getItem('csm-level:autumn-leaves')).toBe('{"level":"advanced","seed":1}')
    expect(localStorage.getItem('csm-practice:autumn_leaves:root')).toBeNull()
    expect(localStorage.getItem('csm-level:autumn_leaves')).toBeNull()
  })

  it('points an edited library chart at the new name', () => {
    localStorage.setItem('csm-charts', JSON.stringify([meta('aaaaaa1', 'autumn_leaves'), meta('bbbbbb2')]))
    migrateChartNames()
    expect(versionOf('autumn-leaves')?.id).toBe('aaaaaa1')
    expect(listCharts().find((m) => m.id === 'bbbbbb2')?.basedOn).toBeUndefined()
  })

  it('keeps the new key when both exist, and drops the old', () => {
    localStorage.setItem('csm-level:so_what', 'old')
    localStorage.setItem('csm-level:so-what', 'new')
    migrateChartNames()
    expect(localStorage.getItem('csm-level:so-what')).toBe('new')
    expect(localStorage.getItem('csm-level:so_what')).toBeNull()
  })

  it('leaves your own charts’ keys alone', () => {
    localStorage.setItem('csm-practice:mine:ab_cd12:root', 'x')
    localStorage.setItem('csm-level:mine:ab_cd12', 'y')
    migrateChartNames()
    expect(localStorage.getItem('csm-practice:mine:ab_cd12:root')).toBe('x')
    expect(localStorage.getItem('csm-level:mine:ab_cd12')).toBe('y')
  })

  it('moves only the documented shapes: practice with a mode, level without', () => {
    localStorage.setItem('csm-practice:so_what', 'p')
    localStorage.setItem('csm-level:so_what:root', 'l')
    migrateChartNames()
    expect(localStorage.getItem('csm-practice:so_what')).toBe('p')
    expect(localStorage.getItem('csm-level:so_what:root')).toBe('l')
    expect(localStorage.getItem('csm-practice:so-what')).toBeNull()
    expect(localStorage.getItem('csm-level:so-what:root')).toBeNull()
  })

  it('keeps the old key when the new one can’t be written (storage full)', () => {
    localStorage.setItem('csm-level:so_what', 'old')
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    migrateChartNames()
    full.mockRestore()
    expect(localStorage.getItem('csm-level:so_what')).toBe('old')
  })

  it('changes nothing the second time', () => {
    localStorage.setItem('csm-level:so_what', 'v')
    localStorage.setItem('csm-charts', JSON.stringify([meta('aaaaaa1', 'so_what')]))
    migrateChartNames()
    const once = JSON.stringify({ ...localStorage })
    migrateChartNames()
    expect(JSON.stringify({ ...localStorage })).toBe(once)
  })
})

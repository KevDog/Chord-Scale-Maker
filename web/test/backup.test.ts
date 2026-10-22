import { parseBackup } from '@chord-scale-maker/engine'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { backupDownload, planRestore, restore, snapshot } from '~/utils/backup'
import { listCharts, MY_CHARTS_MAX, saveChart, savedRevision } from '~/utils/myCharts'

const chart = (title: string, chord = 'Cm7'): string => `title: ${title}\nsection: A\n1 | ${chord}\n`
const LEVEL = JSON.stringify({ level: 'advanced', seed: 7 })

/** a backup made from what this browser holds now, then the browser emptied */
function backupThenClear() {
  const file = backupDownload('2026.10.21 · abc1234', new Date(2026, 9, 21))
  localStorage.clear()
  const parsed = parseBackup(file.text)
  if (!parsed) throw new Error('not a backup')
  return parsed.backup
}

describe('backup', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('snapshots this browser’s storage', () => {
    localStorage.setItem('csm-theme', 'dark')
    localStorage.setItem('other', 'x')
    expect(snapshot()).toMatchObject({ 'csm-theme': 'dark', other: 'x' })
  })

  it('downloads as a dated file holding the version', () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    const file = backupDownload('2026.10.21 · abc1234', new Date(2026, 9, 21, 9))
    expect(file.filename).toBe('chord-scale-maker-backup-2026-10-21.json')
    expect(parseBackup(file.text)?.backup).toMatchObject({ version: '2026.10.21 · abc1234', exportedAt: new Date(2026, 9, 21, 9).toISOString(), charts: [{ meta: { id: 'aaaaaa1' } }] })
  })

  it('restores into an empty browser: the same charts, state and preferences', () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    localStorage.setItem('csm-level:mine:aaaaaa1', LEVEL)
    localStorage.setItem('csm-level:blue-bossa', LEVEL)
    localStorage.setItem('csm-theme', 'dark')
    const before = snapshot()
    const backup = backupThenClear()
    const rev = savedRevision.value
    expect(restore(planRestore(backup), {})).toEqual({ ok: true, written: ['Alpha', 'blue-bossa', 'Preferences'] })
    expect(snapshot()).toEqual(before)
    expect(savedRevision.value).toBeGreaterThan(rev)
  })

  it('writes nothing when the charts would pass My charts’ limit', () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    const backup = backupThenClear()
    const index = Array.from({ length: MY_CHARTS_MAX }, (_, i) => ({ id: `local${String(i).padStart(4, '0')}`, title: 'x', kind: 'new', createdAt: 1, updatedAt: 1 }))
    localStorage.setItem('csm-charts', JSON.stringify(index))
    for (const m of index) localStorage.setItem(`csm-chart:${m.id}`, chart('x'))
    const before = snapshot()
    expect(restore(planRestore(backup), {})).toEqual({ ok: false, reason: 'tooMany', written: [], notWritten: ['Alpha'] })
    expect(snapshot()).toEqual(before)
  })

  it('stops when storage fills, says what landed, and leaves the item it stopped on as it was', () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    saveChart({ id: 'bbbbbb2', text: chart('Beta'), kind: 'new' }, 2)
    localStorage.setItem('csm-theme', 'dark')
    const backup = backupThenClear()
    const setItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k === 'csm-charts' && v.includes('bbbbbb2')) throw new DOMException('full', 'QuotaExceededError')
      setItem(k, v)
    })
    expect(restore(planRestore(backup), {})).toEqual({ ok: false, reason: 'full', written: ['Alpha'], notWritten: ['Beta', 'Preferences'] })
    expect(listCharts().map((m) => m.id)).toEqual(['aaaaaa1'])
    expect(localStorage.getItem('csm-chart:bbbbbb2')).toBeNull()
    expect(localStorage.getItem('csm-theme')).toBeNull()
  })

  it('a step that fails puts back what it replaced', () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    localStorage.setItem('csm-level:mine:aaaaaa1', LEVEL)
    const backup = backupThenClear()
    saveChart({ id: 'aaaaaa1', text: chart('Mine', 'F7'), kind: 'new' }, 1)
    localStorage.setItem('csm-practice:mine:aaaaaa1:root', '{"preset":"guideTones"}')
    const before = snapshot()
    const setItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k === 'csm-charts' && v.includes('"Alpha"')) throw new DOMException('full', 'QuotaExceededError')
      setItem(k, v)
    })
    expect(restore(planRestore(backup), { charts: { aaaaaa1: 'imported' } })).toMatchObject({ ok: false, reason: 'full', written: [] })
    expect(snapshot()).toEqual(before)
  })
})

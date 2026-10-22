import { mountSuspended } from '@nuxt/test-utils/runtime'
import { type Backup, backupFrom } from '@chord-scale-maker/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import RestoreDialog from '~/components/RestoreDialog.vue'
import { listCharts, loadChart, saveChart } from '~/utils/myCharts'

const chart = (title: string, chord = 'Cm7'): string => `title: ${title}\nsection: A\n1 | ${chord}\n`
const meta = (id: string, title: string, updatedAt = 1) => ({ id, title, kind: 'new' as const, createdAt: 1, updatedAt })
/** a backup holding these charts, made without touching this browser */
const backupOf = (...charts: [id: string, title: string][]): Backup =>
  backupFrom(
    {
      'csm-charts': JSON.stringify(charts.map(([id, t]) => meta(id, t, 2))),
      ...Object.fromEntries(charts.map(([id, t]) => [`csm-chart:${id}`, chart(t, 'F7')])),
      'csm-theme': 'dark',
    },
    { exportedAt: '', version: '' },
  )

const mount = async (backup: Backup, dropped = 0) => {
  const w = await mountSuspended(RestoreDialog, { props: { restoring: { backup, dropped } }, attachTo: document.body })
  await nextTick()
  const dialog = document.querySelector('[role=dialog]') as HTMLElement
  const button = (name: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
  const select = (label: string) => dialog.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null
  const choose = async (label: string, value: string) => {
    const s = select(label)!
    s.value = value
    s.dispatchEvent(new Event('change'))
    await nextTick()
  }
  return { w, dialog, button, select, choose }
}

describe('RestoreDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  it('counts what’s new and already here, and says what it couldn’t read', async () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha', 'F7'), kind: 'new' }, 1)
    const { dialog } = await mount(backupOf(['aaaaaa1', 'Alpha'], ['bbbbbb2', 'Beta']), 2)
    expect(dialog.textContent).toContain('1 new chart')
    expect(dialog.textContent).toContain('1 already here')
    expect(dialog.textContent).toContain('2 entries in the file couldn’t be read')
  })

  it('a chart that differs from yours: Keep both by default, both kept', async () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    const { dialog, select, button } = await mount(backupOf(['aaaaaa1', 'Alpha']))
    expect(dialog.textContent).toContain('1 differs from yours')
    expect(select('What to do with Alpha')?.value).toBe('both')
    button('Restore')?.click()
    await nextTick()
    expect(listCharts().map((m) => m.title).sort()).toEqual(['Alpha', 'Alpha (imported)'])
    expect(dialog.textContent).toContain('Restored')
  })

  it('Use imported replaces yours; Apply to all sets every chart', async () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha'), kind: 'new' }, 1)
    saveChart({ id: 'bbbbbb2', text: chart('Beta'), kind: 'new' }, 1)
    const { choose, select, button } = await mount(backupOf(['aaaaaa1', 'Alpha'], ['bbbbbb2', 'Beta']))
    await choose('Apply to all', 'imported')
    expect(select('What to do with Beta')?.value).toBe('imported')
    await choose('What to do with Beta', 'mine')
    button('Restore')?.click()
    await nextTick()
    expect(loadChart('aaaaaa1')?.text).toBe(chart('Alpha', 'F7'))
    expect(loadChart('bbbbbb2')?.text).toBe(chart('Beta'))
    expect(listCharts()).toHaveLength(2)
  })

  it('preferences: on in a fresh browser, and a reload to use them', async () => {
    const { dialog, button } = await mount(backupOf(['aaaaaa1', 'Alpha']))
    const box = [...dialog.querySelectorAll('input[type=checkbox]')][0] as HTMLInputElement
    expect(box.checked).toBe(true)
    button('Restore')?.click()
    await nextTick()
    expect(localStorage.getItem('csm-theme')).toBe('dark')
    expect(button('Reload')).toBeTruthy()
  })

  it('preferences: off where this browser has its own', async () => {
    localStorage.setItem('csm-theme', 'light')
    const { dialog, button } = await mount(backupOf(['aaaaaa1', 'Alpha']))
    expect((dialog.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false)
    button('Restore')?.click()
    await nextTick()
    expect(localStorage.getItem('csm-theme')).toBe('light')
  })

  it('nothing to restore when everything is already here', async () => {
    saveChart({ id: 'aaaaaa1', text: chart('Alpha', 'F7'), kind: 'new' }, 1)
    localStorage.setItem('csm-theme', 'dark')
    const { dialog, button } = await mount(backupOf(['aaaaaa1', 'Alpha']))
    expect(dialog.textContent).toContain('Everything in this backup is already here.')
    expect(button('Restore')?.disabled).toBe(true)
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ChordPickPopover from '~/components/ChordPickPopover.vue'

const base = {
  text: 'Dm♪',
  triggerLabel: 'Pentatonic: D minor',
  header: 'Cmaj7 Ionian · bars 6, 22',
  footer: 'Sets bars 6 and 22.',
  sheetChoice: 'Dm',
  picked: false,
  rows: [
    { id: 'p2', label: 'Dm pent · on 2 · 5 shared', current: true },
    { id: 'p9', label: 'Am pent · on 6 · 5 shared', current: false },
    { id: 'p4', label: 'Em pent · on 3 · 5 shared', current: false },
  ],
}
const open = async (props: Partial<typeof base> = {}) => {
  const w = await mountSuspended(ChordPickPopover, { props: { ...base, ...props }, attachTo: document.body })
  await w.find('button').trigger('click')
  await flushPromises()
  return w
}

describe('the chord pick popover', () => {
  it('shows its text on a trigger named by its label, dotted, or solid with “your pick”', async () => {
    const w = await mountSuspended(ChordPickPopover, { props: base })
    const b = w.find('button')
    expect(b.text()).toBe('Dm♪')
    expect(b.attributes('aria-label')).toBe('Pentatonic: D minor. Show the choices')
    expect(b.classes()).toEqual(expect.arrayContaining(['decoration-dotted', 'print:no-underline']))
    const p = await mountSuspended(ChordPickPopover, { props: { ...base, picked: true } })
    expect(p.find('button').attributes('aria-label')).toBe('Pentatonic: D minor, your pick. Show the choices')
    expect(p.find('button').classes()).toContain('decoration-solid')
  })

  it('heads the dialog, offers the sheet’s choice, then each row, then the footer', async () => {
    const w = await open()
    const d = w.find('[role="dialog"]')
    expect(d.attributes('aria-label')).toBeUndefined()
    const id = d.attributes('aria-labelledby')
    expect(id).toBeTruthy()
    expect(d.find(`[id="${id}"]`).text()).toBe(base.header)
    expect(d.classes()).toEqual(expect.arrayContaining(['print:hidden', 'text-left'])) // left-aligned under a right-aligned Scales caption
    expect(d.text().startsWith(base.header)).toBe(true)
    expect(d.text().endsWith(base.footer)).toBe(true)
    const sheet = w.find('[data-sheet-choice]')
    expect(sheet.text()).toBe('Sheet’s choice (Dm)')
    expect(sheet.attributes('aria-current')).toBe('true')
    const rows = w.findAll('[data-choice]')
    expect(rows.map((r) => r.text())).toEqual(base.rows.map((r) => r.label))
    expect(rows.map((r) => r.attributes('aria-current'))).toEqual([undefined, undefined, undefined]) // nothing picked: only the sheet's choice is current
    expect(w.findAll('[aria-current]')).toHaveLength(1)
    w.unmount()
  })

  it('marks no sheet’s choice under a pick', async () => {
    const w = await open({ picked: true })
    expect(w.find('[data-sheet-choice]').attributes('aria-current')).toBeUndefined()
    expect(w.findAll('[data-choice]').map((r) => r.attributes('aria-current'))).toEqual(['true', undefined, undefined])
    w.unmount()
  })

  it('emits a row’s id and closes', async () => {
    const w = await open()
    await w.findAll('[data-choice]')[1]!.trigger('click')
    await flushPromises()
    expect(w.emitted('choose')?.[0]).toEqual(['p9'])
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
  })

  it('clears from the sheet’s choice and closes', async () => {
    const w = await open({ picked: true })
    await w.find('[data-sheet-choice]').trigger('click')
    await flushPromises()
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
  })
})

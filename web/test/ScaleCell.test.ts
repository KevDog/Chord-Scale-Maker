import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ScaleCell from '~/components/ScaleCell.vue'

const mount = (chord: string, scale = '') => mountSuspended(ScaleCell, { props: { chord, scale } })
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}

describe('ScaleCell', () => {
  it('offers the default, the alternates and Other', async () => {
    const w = await mount('Cm7')
    const labels = w.findAll('option').map((o) => o.text())
    expect(labels[0]).toBe('Default · C Dorian')
    expect(labels).toContain('C Aeolian (when the chord is vi or iv)')
    expect(labels.at(-1)).toBe('Other…')
  })

  it('emits the chosen alternate, or empty for the default', async () => {
    const w = await mount('Cm7')
    await w.find('select').setValue('C Aeolian')
    await w.find('select').setValue('')
    expect(w.emitted('update')).toEqual([['C Aeolian'], ['']])
  })

  it('shows a scale typed in the text even if it is not an option', async () => {
    const w = await mount('Cm7', 'C Bebop Dominant')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('C Bebop Dominant')
  })

  it('prompts for unknown chords and picks any scale in a dialog', async () => {
    const w = await mountSuspended(ScaleCell, { props: { chord: 'Cm7#5#9x', scale: '' }, attachTo: document.body })
    expect(w.find('option').text()).toBe('Choose a scale…')
    await w.find('select').setValue('__other')
    await settle()
    const dialog = document.querySelector('[role=dialog]')
    expect(dialog?.textContent).toContain('Choose a scale')
    const name = dialog?.querySelector('[aria-label="Scale name"]') as HTMLSelectElement
    name.value = 'Altered'
    name.dispatchEvent(new Event('change'))
    ;[...(dialog?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes('Set scale'))?.click()
    await settle()
    expect(w.emitted('update')).toEqual([['C Altered']])
    w.unmount()
  })

  it('starts the picker on a playable spelling of the chord root, and cancels without a change', async () => {
    const w = await mountSuspended(ScaleCell, { props: { chord: 'Cb7#5#9x', scale: '' }, attachTo: document.body })
    await w.find('select').setValue('__other')
    await settle()
    expect((document.querySelector('[aria-label="Scale root"]') as HTMLSelectElement).value).toBe('B')
    ;[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent?.includes('Cancel'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).toBeNull())
    expect(w.emitted('update')).toBeUndefined()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('') // back from "Other…"
    w.unmount()
  })

  it('treats a typed scale equal to the default as the default', async () => {
    const w = await mount('Cm7', 'C Dorian')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('')
    expect(w.findAll('option').filter((o) => o.text().includes('C Dorian'))).toHaveLength(1)
  })
})

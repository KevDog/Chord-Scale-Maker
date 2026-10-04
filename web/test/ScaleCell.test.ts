import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ScaleCell from '~/components/ScaleCell.vue'

const mount = (chord: string, scale = '') => mountSuspended(ScaleCell, { props: { chord, scale, field: '' } })

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

  it('prompts for unknown chords and picks any scale via Other', async () => {
    const w = await mount('Cm7#5#9x')
    expect(w.find('option').text()).toBe('Choose a scale…')
    await w.find('select').setValue('__other')
    await w.find('[aria-label="Scale name"]').setValue('Altered')
    await w.find('[aria-label="Set scale"]').trigger('click')
    expect(w.emitted('update')).toEqual([['C Altered']])
  })

  it('starts the picker on a playable spelling of the chord root, and cancels with Escape', async () => {
    const w = await mount('Cb7#5#9x')
    await w.find('select').setValue('__other')
    expect((w.find('[aria-label="Scale root"]').element as HTMLSelectElement).value).toBe('B')
    await w.find('[aria-label="Scale root"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[aria-label="Scale root"]').exists()).toBe(false)
    expect(w.emitted('update')).toBeUndefined()
  })

  it('treats a typed scale equal to the default as the default', async () => {
    const w = await mount('Cm7', 'C Dorian')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('')
    expect(w.findAll('option').filter((o) => o.text().includes('C Dorian'))).toHaveLength(1)
  })
})

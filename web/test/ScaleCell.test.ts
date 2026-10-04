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
    await w.find('button').trigger('click')
    expect(w.emitted('update')).toEqual([['C Altered']])
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import FunctionCell from '~/components/FunctionCell.vue'

const CHOICES = [
  { value: '', label: 'Auto: II7', scale: 'D Mixolydian' },
  { value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' },
  { value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' },
]
const mount = (value: string, problem: string | null = null) => mountSuspended(FunctionCell, { props: { choices: CHOICES, value, problem, label: 'function for row 2' } })

describe('FunctionCell', () => {
  it('offers Auto and each function that fits, with the scale it gives', async () => {
    const w = await mount('')
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Auto: II7 → D Mixolydian', 'V7/V (to G) → D Mixolydian', 'subV7/♭II (to Db) → D Lydian Dominant'])
    expect((w.find('select').element as HTMLSelectElement).value).toBe('')
  })

  it('emits the chosen function, and Auto as empty', async () => {
    const w = await mount('V7/V')
    await w.find('select').setValue('subV7/♭II')
    await w.find('select').setValue('')
    expect(w.emitted('update')).toEqual([['subV7/♭II'], ['']])
  })

  it('shows a function written another way as the matching option', async () => {
    const w = await mount('subV7/bII')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('subV7/♭II')
    expect(w.findAll('option')).toHaveLength(3)
  })

  it('keeps a function the list does not hold, and marks a problem', async () => {
    const w = await mount('Db: V7/ii', 'V7/ii in Db is on Bb, not D7')
    const select = w.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('Db: V7/ii')
    expect(w.findAll('option').at(-1)?.text()).toBe('Db: V7/ii')
    expect(select.attributes('aria-invalid')).toBe('true')
    expect(select.attributes('title')).toBe('V7/ii in Db is on Bb, not D7')
  })
})

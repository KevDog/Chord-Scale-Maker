import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart } from '~~/engine'
import ChartGrid from '~/components/ChartGrid.vue'

const doc = parseChart('title: T\nA | 1 | Cm7\n@copy A B 8\nbad line\n').value
const lastDoc = (w: { emitted: (e: string) => unknown[][] | undefined }): ChartDoc | undefined =>
  w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc | undefined

describe('ChartGrid', () => {
  it('shows rows, copies and invalid lines', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    expect(w.find('[aria-label="chord for row 1"]').element).toHaveProperty('value', 'Cm7')
    expect(w.text()).toContain('repeat section A as B, bars +8')
    expect(w.text()).toContain('bad line')
  })

  it('emits a new doc for valid cell edits', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    await w.find('[aria-label="chord for row 1"]').setValue('Dm7')
    expect(lastDoc(w)?.lines[1]).toMatchObject({ kind: 'row', chord: 'Dm7' })
  })

  it('keeps invalid values out of the doc but leaves them visible to fix', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    const input = w.find('[aria-label="chord for row 1"]')
    await input.setValue('C|7')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(input.attributes('title')).toMatch(/\|/)
    expect(input.attributes('aria-invalid')).toBe('true')
    expect((input.element as HTMLInputElement).value).toBe('C|7') // not snapped back
    await input.setValue('C7')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(lastDoc(w)?.lines[1]).toMatchObject({ chord: 'C7' })
  })

  it('drops a stale error when the row changes underneath it', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    await w.find('[aria-label="chord for row 1"]').setValue('C|7')
    await w.setProps({ doc: parseChart('title: T\nA | 1 | Gm7\n').value })
    const input = w.find('[aria-label="chord for row 1"]')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('Gm7')
  })

  it('edits the title and adds rows', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    await w.find('input').setValue('New title')
    expect(lastDoc(w)?.lines[0]).toEqual({ kind: 'meta', key: 'title', value: 'New title' })
    await w.find('[aria-label="Add row after row 1"]').trigger('click')
    expect(lastDoc(w)?.lines[2]).toEqual({ kind: 'row', section: 'A', bar: '1', chord: '', scale: '' })
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

describe('ChartGrid with functions', () => {
  beforeEach(() => {
    useRuntimeConfig().public.features.functions = true
    localStorage.clear()
  })
  afterEach(() => {
    useRuntimeConfig().public.features.functions = true
  })
  const fdoc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n@key A 9 D\n').value

  it("offers each row's functions and writes the one chosen", async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    const select = w.find('select[aria-label="function for row 2"]')
    expect(select.find('option').text()).toBe('II7 → D Mixolydian')
    await select.setValue('V7/V')
    expect(lastDoc(w)?.lines[3]).toMatchObject({ kind: 'row', chord: 'D7', function: 'V7/V' })
  })

  it('shows notes on demand', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    expect(w.text()).not.toContain('not resolving: natural tensions')
    await w.find('button[aria-pressed]').trigger('click')
    expect(w.text()).toContain('II7 in C, not resolving: natural tensions')
  })

  it('edits an @key line with a key select, and shows its problem', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    expect(w.text()).toContain('@key A 9: no bar 9 in section A')
    await w.find('select[aria-label="Key from A 9"]').setValue('Eb')
    expect(lastDoc(w)?.lines[6]).toEqual({ kind: 'key', section: 'A', bar: 9, key: 'Eb' })
  })

  it('starts a key change at a row, in that row’s key area, and returns to the next area', async () => {
    const moves = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | CMaj7\nB | 5 | Am7\nB | 6 | D7\nB | 7 | GMaj7\nB | 8 | GMaj7\nC | 9 | Dm7\nC | 10 | G7\n').value
    const w = await mountSuspended(ChartGrid, { props: { doc: moves } })
    await w.find('[aria-label="Key change at row 6"]').trigger('click')
    const lines = lastDoc(w)?.lines ?? []
    expect(lines.slice(7, 9)).toEqual([
      { kind: 'key', section: 'B', bar: 6, key: 'G' },
      { kind: 'row', section: 'B', bar: '6', chord: 'D7', scale: '' },
    ])
    expect(lines.slice(11, 13)).toEqual([
      { kind: 'key', section: 'C', bar: 9, key: 'C' },
      { kind: 'row', section: 'C', bar: '9', chord: 'Dm7', scale: '' },
    ])
  })
})

describe('ChartGrid without functions', () => {
  beforeEach(() => {
    useRuntimeConfig().public.features.functions = false
  })
  afterEach(() => {
    useRuntimeConfig().public.features.functions = true
  })

  it('has no Function column and no key-change buttons', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    expect(w.find('[aria-label="function for row 1"]').exists()).toBe(false)
    expect(w.find('[aria-label="Key change at row 1"]').exists()).toBe(false)
  })

  it('shows an @key line read-only, like a @copy, with a delete button', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: parseChart('title: T\nkey: C\nA | 1 | Cm7\n@key A 1 Eb\n').value } })
    expect(w.find('select[aria-label="Key from A 1"]').exists()).toBe(false)
    expect(w.text()).toContain('@key')
    expect(w.text()).toMatch(/from A 1 in\s*E♭\s*\(edit in text\)/)
    await w.find('[aria-label="Delete line 4"]').trigger('click')
    expect(lastDoc(w)?.lines).toHaveLength(3)
  })
})

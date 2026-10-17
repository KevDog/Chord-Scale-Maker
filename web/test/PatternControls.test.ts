import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

mockNuxtImport('useFeature', () => (name: string) => name === 'patterns')

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'patterns', instrument: 'piano', spell: 'key', intervals: true, keyStart: 'C', overlay: 'off', pentRung: 0, pentSide: 'flat', pentPath: 'one', pentBasis: 'key', pentDegree: 'auto', pattern: '+1 +1 +1 −2', patternNotes: 'scale', patternDir: 'up', ...props } })

type Wrapper = Awaited<ReturnType<typeof mount>>
const listbox = (w: Wrapper) => w.find('[aria-label="Pattern"]')
const options = async (w: Wrapper) => {
  await listbox(w).trigger('click')
  return w.findAll('[role=option]')
}

describe('the Patterns controls', () => {
  it('lists the 13 library patterns and Custom', async () => {
    const labels = (await options(await mount())).map((o) => o.text())
    expect(labels).toHaveLength(14)
    expect(labels.at(-1)).toBe('Custom…')
    expect(labels).toContain('Thirds')
  })

  it('shows the library entry the stored pattern is, and Custom for any other', async () => {
    expect(listbox(await mount()).text()).toContain('1 2 3 4')
    const w = await mount({ pattern: '+1 +2 −2' })
    expect(listbox(w).text()).toContain('Custom')
    expect((w.find('input[aria-label="Custom pattern"]').element as HTMLInputElement).value).toBe('+1 +2 −2')
  })

  it('writes the canonical text of a chosen library pattern', async () => {
    const w = await mount()
    await (await options(w)).find((o) => o.text() === 'Thirds')!.trigger('click')
    expect(w.emitted('update:pattern')?.[0]).toEqual(['+2 −1'])
  })

  it('shows no Custom box for a library pattern', async () => {
    expect((await mount()).find('input[aria-label="Custom pattern"]').exists()).toBe(false)
  })

  it('opens the Custom box on choosing Custom, with the stored text', async () => {
    const w = await mount()
    await (await options(w)).find((o) => o.text() === 'Custom…')!.trigger('click')
    expect((w.find('input[aria-label="Custom pattern"]').element as HTMLInputElement).value).toBe('+1 +1 +1 −2')
    expect(w.emitted('update:pattern')).toBeUndefined()
  })

  it('shows an error for a pattern that does not parse, and writes nothing', async () => {
    const w = await mount({ pattern: '+1 +2 −2' })
    const input = w.find('input[aria-label="Custom pattern"]')
    await input.setValue('+0')
    const id = input.attributes('aria-describedby')
    expect(id).toBeTruthy()
    expect(w.find(`p[id="${id}"]`).text()).not.toBe('')
    expect(w.emitted('update:pattern')).toBeUndefined()
  })

  it('writes a typed pattern that parses', async () => {
    const w = await mount({ pattern: '+1 +2 −2' })
    await w.find('input[aria-label="Custom pattern"]').setValue('+2 +1 -2')
    expect(w.emitted('update:pattern')?.at(-1)).toEqual(['+2 +1 −2'])
  })

  it('has Notes and the direction, not the Arpeggio group', async () => {
    const w = await mount()
    expect(w.text()).toContain('Chord tones')
    expect(w.find('[aria-label="Pattern direction"]').exists()).toBe(true)
    expect(w.find('[aria-label="Arpeggio direction"]').exists()).toBe(false)
  })
})

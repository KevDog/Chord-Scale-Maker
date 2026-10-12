import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { parseChart } from '@chord-scale-maker/engine'
import SheetLabelPicker from '~/components/SheetLabelPicker.vue'

// lines: 0 title, 1 key, 2 A1 Dm7, 3 A2 G7, 4 A3 CMaj7
const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (kind: 'numeral' | 'scale', over: Partial<{ fallback: boolean; pinned: boolean; blank: boolean }> = {}) =>
  mountSuspended(SheetLabelPicker, {
    props: { doc, line: 3, kind, chord: 'G7', fallback: false, pinned: false, ...over },
    slots: { default: () => (kind === 'numeral' ? 'V7' : 'G Mixolydian') },
    attachTo: document.body,
  })
const panel = () => document.querySelector('[role=dialog]')

describe('SheetLabelPicker', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('blank (no label to click): a dash named for its picker, which opens it (#143)', async () => {
    for (const [kind, name] of [['numeral', 'Function: G7'], ['scale', 'Scale: G7']] as const) {
      document.body.innerHTML = ''
      const w = await mountSuspended(SheetLabelPicker, { props: { doc, line: 3, kind, chord: 'G7', fallback: false, pinned: false, blank: true }, attachTo: document.body })
      const button = w.find('button')
      expect(button.text()).toBe('—')
      expect(button.attributes('aria-label')).toBe(name)
      await button.trigger('click')
      await settle()
      expect(panel()?.getAttribute('aria-label')).toBe(name)
    }
  })

  it('the numeral opens the function list, with Why under it', async () => {
    const w = await mount('numeral')
    expect(w.find('button').text()).toBe('V7')
    await w.find('button').trigger('click')
    await settle()
    expect(panel()?.getAttribute('aria-label')).toBe('Function: G7')
    expect(panel()?.querySelector('[role=radiogroup][aria-label=Function]')).not.toBeNull()
    expect(panel()?.querySelector('[role=radiogroup][aria-label=Scale]')).toBeNull()
    expect(panel()?.textContent).toContain('Why')
  })

  it('the scale opens the scale list', async () => {
    const w = await mount('scale')
    await w.find('button').trigger('click')
    await settle()
    expect(panel()?.getAttribute('aria-label')).toBe('Scale: G7')
    expect(panel()?.querySelector('[role=radiogroup][aria-label=Scale]')).not.toBeNull()
    expect(panel()?.querySelector('[role=radiogroup][aria-label=Function]')).toBeNull()
  })

  it('marks a guessed function in amber and says stating it settles it', async () => {
    const w = await mount('numeral', { fallback: true })
    expect(w.find('button').classes()).toContain('decoration-amber-500')
    await w.find('button').trigger('click')
    await settle()
    expect(panel()?.textContent).toContain('could only guess here')
  })

  it('shows the pin before a pinned scale', async () => {
    const w = await mount('scale', { pinned: true })
    expect(w.find('[data-pin] svg').exists()).toBe(true)
    expect((await mount('scale')).find('[data-pin]').exists()).toBe(false)
  })

  it('writes a chosen scale into the row', async () => {
    const w = await mount('scale')
    await w.find('button').trigger('click')
    await settle()
    const alt = [...document.querySelectorAll('[role=dialog] [role=radio]')].find((r) => r.textContent?.includes('G Altered')) as HTMLElement
    alt.click()
    await settle()
    const next = (w.emitted('update:doc')?.[0] as [typeof doc])[0]
    expect(next.lines[3]).toMatchObject({ kind: 'row', scale: 'G Altered' })
    expect(w.emitted('said')?.[0]?.[0]).toContain('G Altered')
  })
})

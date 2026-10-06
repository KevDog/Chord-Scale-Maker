import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'

const TEXT = 'title: T\nA | 1 | Cm7\n'
const mount = () =>
  mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true } }, attachTo: document.body })
type Wrapper = Awaited<ReturnType<typeof mount>>
const sheet = (w: Wrapper) => w.findComponent({ name: 'ScaleSheet' })
/** the control a toolbar label (Catalyst Field) points at */
const control = (w: Wrapper, label: string) => {
  const id = w.findAll('label').find((l) => l.text() === label)?.attributes('for')
  const el = id ? w.find(`[id="${id}"]`) : undefined
  if (!el?.exists()) throw new Error(`no ${label} control`)
  return el
}
/** open the Instrument listbox and pick an option by its visible name */
async function chooseInstrument(w: Wrapper, name: string): Promise<void> {
  await control(w, 'Instrument').trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text().startsWith(name))
  if (!option) throw new Error(`no option ${name}`)
  await option.trigger('click')
  await nextTick()
}

describe('EditorView', () => {
  afterEach(() => localStorage.clear())

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C', mode: 'root' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('offers one spelling at a time, with Start on only for From', async () => {
    const w = await mount()
    expect(w.findAll('input[name=mode]').map((i) => i.attributes('value'))).toEqual(['from', 'root'])
    expect(w.findAll('label').some((l) => l.text() === 'Start on')).toBe(false)
    await w.find('input[name=mode][value=from]').setValue(true)
    expect(sheet(w).props('mode')).toBe('from')
    expect(w.findAll('label').some((l) => l.text() === 'Start on')).toBe(true)
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseInstrument(w, 'Tenor sax')
    await w.find('input[name=mode][value=from]').setValue(true)
    await control(w, 'Start on').setValue('Eb')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: 'Tenor Sax (Bb)', start: 'Eb' })
    expect(w.text()).toContain('the preview is transposed for tenor sax')
    expect(w.text()).toContain('From E♭')
  })

  it('uses the bass clef for trombone', async () => {
    const w = await mount()
    await chooseInstrument(w, 'Trombone')
    expect(sheet(w).props('part')).toEqual({ clef: 'bass', trans: 'C' })
    expect(w.text()).toContain('The preview is in bass clef, concert pitch, for trombone')
  })

  it('focus mode shows the sheet alone; Escape or Exit focus leaves it, back to the Focus button', async () => {
    const w = await mount()
    const button = (name: string) => w.findAll('button').find((b) => b.text().startsWith(name))
    const dialog = () => w.find('[role=dialog]')
    button('Focus')?.element.focus()
    await button('Focus')?.trigger('click')
    await nextTick()
    expect(dialog().attributes('aria-label')).toBe('Focus mode')
    expect(dialog().find('fieldset').isVisible()).toBe(false) // the preview controls are hidden
    expect(dialog().findComponent({ name: 'ScaleSheet' }).exists()).toBe(true)
    expect(document.activeElement?.textContent).toContain('Exit focus')
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await nextTick()
    expect(dialog().exists()).toBe(false)
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false)
    expect(document.activeElement?.textContent).toBe('Focus')

    await button('Focus')?.trigger('click')
    await button('Exit focus')?.trigger('click')
    expect(dialog().exists()).toBe(false)
  })
})

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
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseInstrument(w, 'Tenor sax')
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
})

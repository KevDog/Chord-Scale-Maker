import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import EditorView from '~/components/EditorView.vue'

const TEXT = 'title: T\nA | 1 | Cm7\n'
const mount = () =>
  mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true } } })
type Wrapper = Awaited<ReturnType<typeof mount>>
const sheet = (w: Wrapper) => w.findComponent({ name: 'ScaleSheet' })
/** the select inside the toolbar label that starts with this text */
const control = (w: Wrapper, label: string) => {
  const select = w.findAll('label').find((l) => l.text().startsWith(label))?.find('select')
  if (!select?.exists()) throw new Error(`no ${label} control`)
  return select
}

describe('EditorView', () => {
  afterEach(() => localStorage.clear())

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C' })
    expect(w.text()).not.toContain('concert pitch; the preview is written for')
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await control(w, 'Instrument').setValue('tenor-sax')
    await control(w, 'Start on').setValue('Eb')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: 'Tenor Sax (Bb)', start: 'Eb' })
    expect(w.text()).toContain('the preview is written for tenor sax')
    expect(w.text()).toContain('From E♭')
  })

  it('uses the bass clef for trombone', async () => {
    const w = await mount()
    await control(w, 'Instrument').setValue('trombone')
    expect(sheet(w).props('part')).toEqual({ clef: 'bass', trans: 'C' })
  })
})

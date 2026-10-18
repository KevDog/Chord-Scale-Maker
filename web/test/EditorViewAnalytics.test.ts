import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { parseChart, setMeta } from '@chord-scale-maker/engine'
import EditorView from '~/components/EditorView.vue'
import { LIBRARY } from '~/utils/library'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

mockNuxtImport('useFeature', () => (name: string) => name === 'analyticsEvents')

const TEXT = 'title: My Secret Tune\nkey: C\n\nsection: A\nbars: 4\n1 | Cm7\n'
const va = vi.fn()
beforeEach(() => {
  va.mockClear()
  ;(window as { va?: unknown }).va = va
})
afterEach(() => {
  delete (window as { va?: unknown }).va
  document.body.innerHTML = ''
})

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(EditorView, {
    props: { initialText: TEXT, ...props },
    global: { stubs: { ScaleSheet: true, ChangesSheet: true, ArpeggioSheet: true } },
    attachTo: document.body,
  })
type Wrapper = Awaited<ReturnType<typeof mount>>
const events = () => va.mock.calls.filter(([k]) => k === 'event').map(([, e]) => e)
const buttonCalled = (w: Wrapper, name: string) => w.findAll('button').find((b) => b.text() === name)
const control = (w: Wrapper, label: string) => {
  const id = w.findAll('label').find((l) => l.text() === label)?.attributes('for')
  const el = id ? w.find(`[id="${id}"]`) : undefined
  if (!el?.exists()) throw new Error(`no ${label} control`)
  return el
}
async function choose(w: Wrapper, label: string, name: string): Promise<void> {
  if (label === 'Instrument') {
    // its pitch first (#417)
    const pitch = INSTRUMENT_GROUPS.find((g) => g.instruments.some((n) => instrumentOption(n).startsWith(name)))?.pitch
    const button = w.findAll('button').find((b) => b.attributes('aria-label') === 'Pitch')
    if (pitch && button && button.text() !== pitch) {
      await button.trigger('click')
      await nextTick()
      await w.findAll('[role=option]').find((o) => o.text() === pitch)?.trigger('click')
      await nextTick()
    }
  }
  await control(w, label).trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text().startsWith(name))
  if (!option) throw new Error(`no option ${name}`)
  await option.trigger('click')
  await nextTick()
}

describe('EditorView analytics events (#149)', () => {
  it('sends nothing on load, then one event per sheet change and one instrument per visit', async () => {
    const w = await mount()
    expect(events()).toEqual([])
    await choose(w, 'Work on', 'Scales')
    await choose(w, 'Instrument', 'Tenor Sax')
    await choose(w, 'Instrument', 'Alto Sax')
    expect(events()).toEqual([
      { name: 'Sheet chosen', data: { sheet: 'scales' } },
      { name: 'Instrument chosen', data: { instrument: 'tenor-sax' } },
    ])
  })

  it('names a library chart by its slug when printing and sharing, never by its title', async () => {
    const lib = LIBRARY[0]!
    window.print = vi.fn()
    const w = await mount({ initialText: lib.text, saveTarget: { kind: 'library', slug: lib.slug, libraryText: lib.text } })
    await buttonCalled(w, 'Print')?.trigger('click')
    await buttonCalled(w, 'Share')?.trigger('click')
    await vi.waitFor(() => expect(events()).toHaveLength(2))
    expect(events()).toEqual([
      { name: 'Printed', data: { sheet: 'changes', song: lib.slug } },
      { name: 'Share created', data: { song: lib.slug } },
    ])
  })

  it('counts a shared link opened as own, without its title', async () => {
    await mount({ shared: { sheet: 'changes' } })
    expect(events()).toEqual([{ name: 'Shared link opened', data: { song: 'own' } }])
    expect(JSON.stringify(va.mock.calls)).not.toContain('Secret')
  })

  it('sends the target key and the chart as it was before transposing', async () => {
    const lib = LIBRARY[0]!
    const w = await mount({ initialText: lib.text, saveTarget: { kind: 'library', slug: lib.slug, libraryText: lib.text } })
    w.findComponent({ name: 'ChartTranspose' }).vm.$emit('update:doc', setMeta(parseChart(lib.text).value, 'key', 'Eb'))
    await nextTick()
    expect(events()).toEqual([{ name: 'Transposed', data: { song: lib.slug, to: 'Eb' } }])
  })
})

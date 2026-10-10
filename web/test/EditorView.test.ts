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
/** open the "Where each scale starts" listbox and pick a mode by its visible label */
async function chooseMode(w: Wrapper, label: string): Promise<void> {
  const btn = w.findAll('button').find((b) => b.attributes('aria-label') === 'Where each scale starts')
  if (!btn) throw new Error('no mode control')
  await btn.trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text() === label)
  if (!option) throw new Error(`no mode option ${label}`)
  await option.trigger('click')
  await nextTick()
}

describe('EditorView help', () => {
  afterEach(() => {
    useRuntimeConfig().public.features.functions = true
    localStorage.clear()
  })
  it('mentions functions and @key only with the flag on', async () => {
    useRuntimeConfig().public.features.functions = true
    const on = await mount()
    await on.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(on.html()).toContain('@key B 17 D')
    on.unmount()
    useRuntimeConfig().public.features.functions = false
    const off = await mount()
    await off.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(off.html()).not.toMatch(/function|@key/)
    expect(off.html()).toContain("Leave the scale out to use the chord's default.")
    off.unmount()
  })

  it('with functions on, gives the grid the full width and lets the text editor collapse', async () => {
    useRuntimeConfig().public.features.functions = true
    const w = await mount()
    await w.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('section[aria-labelledby="grid-heading"]').element.parentElement?.className).not.toContain('lg:grid-cols-2')
    const toggle = w.find('button[aria-controls="chart-text-body"]')
    expect([toggle.text(), toggle.attributes('aria-expanded')]).toEqual(['Hide text', 'true'])
    await toggle.trigger('click')
    await nextTick()
    expect(w.find('#chart-text-body').exists()).toBe(false)
    expect([toggle.text(), toggle.attributes('aria-expanded')]).toEqual(['Show text', 'false'])
    w.unmount()
  })

  it('with functions off, keeps the side-by-side layout and no text toggle', async () => {
    useRuntimeConfig().public.features.functions = false
    const w = await mount()
    await w.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('section[aria-labelledby="grid-heading"]').element.parentElement?.className).toContain('lg:grid-cols-2')
    expect(w.find('button[aria-controls="chart-text-body"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('EditorView', () => {
  afterEach(() => localStorage.clear())

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C', mode: 'root' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('offers one spelling at a time, with Start on only for From', async () => {
    const w = await mount()
    expect(w.find('[aria-label="Start on"]').exists()).toBe(false)
    await chooseMode(w, 'From C')
    expect(sheet(w).props('mode')).toBe('from')
    expect(w.find('[aria-label="Start on"]').exists()).toBe(true)
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseInstrument(w, 'Tenor Sax')
    await chooseMode(w, 'From C')
    await w.find('[aria-label="Start on"]').setValue('Eb')
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

describe('EditorView key signatures', () => {
  const KEYED = 'title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n'
  const mountWith = (shared?: { sheet: 'guideTones' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, ...(shared ? { shared } : {}) },
      global: { stubs: { ScaleSheet: true, GuideToneSheet: true, ChangesSheet: true } },
    })
  afterEach(() => {
    useRuntimeConfig().public.features.keySignatures = false
    localStorage.clear()
  })

  it("with the flag on, gives the scale and guide tone sheets the chart's key, and the Changes sheet signatures", async () => {
    useRuntimeConfig().public.features.keySignatures = true
    const scales = await mountWith()
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const guide = await mountWith({ sheet: 'guideTones' })
    expect(guide.findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const changes = await mountWith({ sheet: 'changes' })
    expect(changes.findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(true)
  })

  it('with the flag off, passes no key and no signatures', async () => {
    expect((await mountWith()).findComponent({ name: 'ScaleSheet' }).props('homeKey')).toBeUndefined()
    expect((await mountWith({ sheet: 'guideTones' })).findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toBeUndefined()
    expect((await mountWith({ sheet: 'changes' })).findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(false)
  })
})

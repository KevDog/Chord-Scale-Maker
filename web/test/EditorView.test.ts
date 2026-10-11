import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { CHART_REPORT_KEY } from '~/utils/chartReport'
import { decodeShare, type ShareView } from '@chord-scale-maker/engine'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const TEXT = 'title: T\nA | 1 | Cm7\n'
const mount = (shared?: ShareView) =>
  mountSuspended(EditorView, {
    props: { initialText: TEXT, ...(shared ? { shared } : {}) },
    global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
    attachTo: document.body,
  })
type Wrapper = Awaited<ReturnType<typeof mount>>
const sheet = (w: Wrapper) => w.findComponent({ name: 'ScaleSheet' })
const changesSheet = (w: Wrapper) => w.findComponent({ name: 'ChangesSheet' })
/** a button by its exact visible text */
const buttonCalled = (w: Wrapper, name: string) => w.findAll('button').find((b) => b.text() === name)
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
/** open the Work on listbox and pick a sheet by its visible label */
async function chooseSheet(w: Wrapper, label: string): Promise<void> {
  await control(w, 'Work on').trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text() === label)
  if (!option) throw new Error(`no sheet ${label}`)
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

  it('opens on the Changes sheet', async () => {
    const w = await mount()
    expect(changesSheet(w).exists()).toBe(true)
    expect(sheet(w).exists()).toBe(false)
    w.unmount()
  })

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C', mode: 'root' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('offers one spelling at a time, with Start on only for From', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(w.find('[aria-label="Start on"]').exists()).toBe(false)
    await chooseMode(w, 'From C')
    expect(sheet(w).props('mode')).toBe('from')
    expect(w.find('[aria-label="Start on"]').exists()).toBe(true)
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseInstrument(w, 'Tenor Sax')
    await chooseMode(w, 'From C')
    await w.find('[aria-label="Start on"]').setValue('Eb')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: 'Tenor Sax (Bb)', start: 'Eb' })
    expect(w.text()).toContain('the preview is transposed for tenor sax')
    expect(w.text()).toContain('From E♭')
  })

  it('uses the bass clef for trombone', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseInstrument(w, 'Trombone')
    expect(sheet(w).props('part')).toEqual({ clef: 'bass', trans: 'C', range: { lo: 40, hi: 64, centre: 56 } })
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
    expect(dialog().find('#preview-toolbar').isVisible()).toBe(false) // the preview controls are hidden
    expect(dialog().findComponent({ name: 'ChangesSheet' }).exists()).toBe(true)
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

describe('EditorView guide tones', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    navigate.mockClear()
  })

  /** the Guide Tones control's radios, by visible label */
  const guideOptions = (w: Wrapper) =>
    w.findAll('label').filter((l) => l.find('input[type="radio"][name="guide-line"]').exists())
  const checkedGuide = (w: Wrapper) => guideOptions(w).filter((l) => (l.find('input').element as HTMLInputElement).checked).map((l) => l.text())
  async function chooseGuide(w: Wrapper, label: string): Promise<void> {
    const option = guideOptions(w).find((l) => l.text() === label)
    if (!option) throw new Error(`no guide option ${label}`)
    await option.find('input').setValue(true)
    await nextTick()
  }

  it('shows Off, From 3rd and From 7th as one choice under Guide Tones, Off chosen', async () => {
    const w = await mount()
    expect(w.findAll('label').some((l) => l.text() === 'Guide Tones')).toBe(true)
    expect(w.findAll('fieldset').find((f) => f.find('legend').text() === 'Guide tones')?.exists()).toBe(true)
    expect(guideOptions(w).map((l) => l.text())).toEqual(['Off', 'From 3rd', 'From 7th'])
    expect(checkedGuide(w)).toEqual(['Off'])
    expect(changesSheet(w).props('guideLine')).toBe('off')
    expect(guideOptions(w)[1]?.attributes('title')).toBe("A line that starts on the first chord's 3rd and moves to the nearest guide tone of each chord")
    expect(guideOptions(w)[2]?.attributes('title')).toBe("A line that starts on the first chord's 7th and moves to the nearest guide tone of each chord")
    expect(buttonCalled(w, 'From 3rd')).toBeUndefined() // no toggle buttons
    w.unmount()
  })

  it('passes the line chosen to the Changes sheet, one at a time, and remembers it', async () => {
    const w = await mount()
    await chooseGuide(w, 'From 3rd')
    expect(changesSheet(w).props('guideLine')).toBe('third')
    expect(checkedGuide(w)).toEqual(['From 3rd'])
    await chooseGuide(w, 'From 7th')
    expect(changesSheet(w).props('guideLine')).toBe('seventh')
    expect(checkedGuide(w)).toEqual(['From 7th'])
    expect(localStorage.getItem('csm-guide-line')).toBe('seventh')
    await chooseGuide(w, 'Off')
    expect(changesSheet(w).props('guideLine')).toBe('off')
    expect(localStorage.getItem('csm-guide-line')).toBe('off')
    w.unmount()
  })

  it('starts on the line remembered', async () => {
    localStorage.setItem('csm-guide-line', 'third')
    const w = await mount()
    expect(checkedGuide(w)).toEqual(['From 3rd'])
    expect(changesSheet(w).props('guideLine')).toBe('third')
    w.unmount()
  })

  it('offers the guide tone line on the Changes sheet only', async () => {
    const w = await mount()
    expect(guideOptions(w)).toHaveLength(3)
    await chooseSheet(w, 'Scales')
    expect(guideOptions(w)).toHaveLength(0)
    expect(buttonCalled(w, 'Intervals')).toBeDefined()
    w.unmount()
  })

  const linkOf = async (w: Wrapper) => {
    await buttonCalled(w, 'Share')?.trigger('click')
    const link = await vi.waitFor(() => {
      const l = w.findComponent({ name: 'ShareDialog' }).props('link')
      if (typeof l !== 'string') throw new Error('no link yet')
      return l
    })
    return (await decodeShare(link.split('#s=')[1] ?? ''))?.view
  }

  it("applies a share link's line for the visit, and a share link carries it", async () => {
    const w = await mount({ sheet: 'changes', guideLine: 'seventh' })
    expect(changesSheet(w).props('guideLine')).toBe('seventh')
    expect(checkedGuide(w)).toEqual(['From 7th'])
    expect(localStorage.getItem('csm-guide-line')).toBeNull()
    expect(await linkOf(w)).toMatchObject({ sheet: 'changes', guideLine: 'seventh' })
    w.unmount()
  })

  it('opens a link without a line with the line off, whatever your own, and shares no line with it off', async () => {
    localStorage.setItem('csm-guide-line', 'third')
    const w = await mount({ sheet: 'changes' })
    expect(changesSheet(w).props('guideLine')).toBe('off')
    expect(await linkOf(w)).not.toHaveProperty('guideLine')
    w.unmount()
  })

  it('reports the sheet and the guides with a chart error', async () => {
    const w = await mount()
    await chooseGuide(w, 'From 7th')
    await buttonCalled(w, 'Report a chart error')?.trigger('click')
    expect(JSON.parse(sessionStorage.getItem(CHART_REPORT_KEY) ?? '{}')).toMatchObject({ sheet: 'changes', guides: 'from 7th' })
    expect(navigate).toHaveBeenCalledWith('/contact')
    w.unmount()
  })
})

describe('EditorView key signatures', () => {
  const KEYED = 'title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n'
  const mountWith = (shared: { sheet: 'scales' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, shared },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
    })
  afterEach(() => {
    useRuntimeConfig().public.features.keySignatures = true
    localStorage.clear()
  })

  it("with the flag on, gives the scale sheet the chart's key, and the Changes sheet signatures", async () => {
    useRuntimeConfig().public.features.keySignatures = true
    const scales = await mountWith({ sheet: 'scales' })
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const changes = await mountWith({ sheet: 'changes' })
    expect(changes.findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(true)
  })

  it('with the flag off, passes no key and no signatures', async () => {
    useRuntimeConfig().public.features.keySignatures = false
    expect((await mountWith({ sheet: 'scales' })).findComponent({ name: 'ScaleSheet' }).props('homeKey')).toBeUndefined()
    expect((await mountWith({ sheet: 'changes' })).findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(false)
  })
})

describe('EditorView with the bar editor', () => {
  afterEach(() => {
    useRuntimeConfig().public.features.barEditor = false
    localStorage.clear()
  })

  it('shows the bars in place of the rows, in concert pitch, with the Source under ⋯', async () => {
    useRuntimeConfig().public.features.barEditor = true
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell][aria-label="A, bar 1: Cm7"]').exists()).toBe(true)
    expect(w.find('[aria-label="chord for row 1"]').exists()).toBe(false)
    expect(w.text()).toContain('Concert pitch')
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(false)
    await w.find('button[aria-label="More editing options"]').trigger('click')
    await nextTick()
    await buttonCalled(w, 'Show source')?.trigger('click')
    await nextTick()
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(true)
    await buttonCalled(w, 'Hide source')?.trigger('click')
    await nextTick()
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(false)
    w.unmount()
  })

  it('a grid edit can be undone from the header', async () => {
    useRuntimeConfig().public.features.barEditor = true
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    const undo = buttonCalled(w, 'Undo')
    expect(undo?.attributes('disabled')).toBeDefined()
    await w.find('[role=gridcell]').trigger('keydown', { key: 'D' })
    await nextTick()
    const input = w.find('input[aria-label=Chord]')
    await input.setValue('Dm7')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(w.find('[role=gridcell]').attributes('aria-label')).toBe('A, bar 1: Dm7')
    await buttonCalled(w, 'Undo')?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell]').attributes('aria-label')).toBe('A, bar 1: Cm7')
    w.unmount()
  })
})

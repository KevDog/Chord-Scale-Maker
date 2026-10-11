import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { CHART_REPORT_KEY } from '~/utils/chartReport'
import { loadChart, saveChart } from '~/utils/myCharts'
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

/** open the editor, then its Source under ⋯ */
async function showSource(w: Wrapper): Promise<void> {
  await buttonCalled(w, 'Edit')?.trigger('click')
  await nextTick()
  await w.find('button[aria-label="More editing options"]').trigger('click')
  await nextTick()
  await buttonCalled(w, 'Show source')?.trigger('click')
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
    await showSource(on)
    expect(on.html()).toContain('@key B 17 D')
    on.unmount()
    localStorage.clear()
    useRuntimeConfig().public.features.functions = false
    const off = await mount()
    await showSource(off)
    expect(off.html()).not.toMatch(/function|@key/)
    expect(off.html()).toContain("Leave the scale out to use the chord's default.")
    off.unmount()
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

describe('EditorView editing', () => {
  afterEach(() => localStorage.clear())

  it('puts Edit next to the title, and Done closes the editor', async () => {
    const w = await mount()
    const edit = buttonCalled(w, 'Edit')
    expect(edit?.element.parentElement?.querySelector('h1')?.textContent).toBe('T')
    expect(edit?.attributes('aria-expanded')).toBe('false')
    await edit?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell]').exists()).toBe(true)
    const done = buttonCalled(w, 'Done')
    expect(done?.attributes('aria-expanded')).toBe('true')
    await done?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell]').exists()).toBe(false)
    w.unmount()
  })

  it('opens a new chart in the editor, and Done still closes it', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, isNew: true }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(w.find('[role=gridcell]').exists()).toBe(true)
    await buttonCalled(w, 'Done')?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell]').exists()).toBe(false)
    expect(buttonCalled(w, 'Edit')?.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('shows the bars, in concert pitch, with the Source under ⋯', async () => {
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('[role=gridcell][aria-label="A, bar 1: Cm7"]').exists()).toBe(true)
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

describe('EditorView scale level', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })
  /** open the Level listbox and pick a level by its visible label */
  async function chooseLevel(w: Wrapper, label: string): Promise<void> {
    await control(w, 'Level').trigger('click')
    await nextTick()
    const option = w.findAll('[role=option]').find((o) => o.text() === label)
    if (!option) throw new Error(`no level ${label}`)
    await option.trigger('click')
    await nextTick()
  }
  const undoable = (w: Wrapper) => buttonCalled(w, 'Undo')?.attributes('disabled') === undefined
  const cells = (doc: unknown) => (doc as { lines: { kind: string; scale?: string }[] }).lines.filter((l) => l.kind === 'row').map((l) => l.scale)

  it('a level change plays on the sheets and leaves the chart alone', async () => {
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    const before = changesSheet(w).props('doc')
    await chooseLevel(w, 'Basic')
    expect(changesSheet(w).props('doc')).toBe(before) // no edit
    expect(changesSheet(w).props('view')).toEqual({ level: 'basic', seed: expect.any(Number) })
    expect(undoable(w)).toBe(false) // not an undoable edit
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props('resolved').get(0)).toMatchObject({ scale: 'C Minor Pentatonic' })
  })

  const LEVELLED = 'title: T\nA | 1 | Cm7 | C Minor Pentatonic\nA | 2 | F7 | F Lydian Dominant\nA | 3 | Bbmaj7 | Bb Major Pentatonic\n'
  const STORED = JSON.stringify({ level: 'basic', seed: 1, owned: ['1:Cm7', '2:F7'] }) // a level once wrote Cm7 and F7; F7 was changed by hand since; Bbmaj7 is a pick of your own
  const mountMine = () => {
    saveChart({ id: 'abc123abc123', text: LEVELLED, kind: 'new' })
    localStorage.setItem('csm-level:mine:abc123abc123', STORED)
    return mountSuspended(EditorView, {
      props: { initialText: LEVELLED, practiceKey: 'mine:abc123abc123', saveTarget: { kind: 'mine', id: 'abc123abc123' } },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
      attachTo: document.body,
    })
  }

  it('blanks the cells a level wrote into a saved chart, once, and forgets which rows it owned', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const w = await mountMine()
    expect(cells(changesSheet(w).props('doc'))).toEqual(['', 'F Lydian Dominant', 'Bb Major Pentatonic'])
    expect(loadChart('abc123abc123')?.text).not.toContain('C Minor Pentatonic') // saved
    expect(JSON.parse(localStorage.getItem('csm-level:mine:abc123abc123') ?? '{}')).toEqual({ level: 'basic', seed: 1 })
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/1 scale/))
    await buttonCalled(w, 'Edit')?.trigger('click')
    expect(undoable(w)).toBe(false)
    expect(w.findComponent({ name: 'PreviewControls' }).text()).toContain('Basic')
  })

  it('keeps the level when your version is reverted to the library’s', async () => {
    saveChart({ id: 'eeeeee1', text: TEXT, kind: 'edited', basedOn: 'autumn_leaves' })
    localStorage.setItem('csm-level:autumn_leaves', JSON.stringify({ level: 'basic', seed: 7 }))
    const w = await mountSuspended(EditorView, {
      props: { initialText: TEXT, practiceKey: 'autumn_leaves', saveTarget: { kind: 'library', slug: 'autumn_leaves', libraryText: TEXT, id: 'eeeeee1' } },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
      attachTo: document.body,
    })
    await buttonCalled(w, 'Revert to library version')?.trigger('click')
    await nextTick()
    const confirm = [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent?.trim() === 'Revert')
    if (!(confirm instanceof HTMLElement)) throw new Error('no Revert in the dialog')
    confirm.click()
    await nextTick()
    expect(w.emitted('reload')).toHaveLength(1)
    expect(loadChart('eeeeee1')).toBeNull()
    expect(JSON.parse(localStorage.getItem('csm-level:autumn_leaves') ?? '{}')).toEqual({ level: 'basic', seed: 7 })
    expect(changesSheet(w).props('view')).toEqual({ level: 'basic', seed: 7 })
  })
})

describe('EditorView Save', () => {
  afterEach(() => {
    localStorage.clear()
    navigate.mockClear()
  })
  const ID = 'abc123abc123'
  const mountMine = () => {
    saveChart({ id: ID, text: TEXT, kind: 'new' })
    return mountSuspended(EditorView, {
      props: { initialText: TEXT, practiceKey: `mine:${ID}`, saveTarget: { kind: 'mine', id: ID } },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
      attachTo: document.body,
    })
  }
  const saveButton = (w: Wrapper) => buttonCalled(w, 'Save')

  it('saves an edit at once from beside Undo, and rests while nothing is unsaved', async () => {
    const w = await mountMine()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(saveButton(w)?.attributes('disabled')).toBeDefined()
    await w.find('[role=gridcell]').trigger('keydown', { key: 'D' })
    await nextTick()
    const input = w.find('input[aria-label=Chord]')
    await input.setValue('Dm7')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(loadChart(ID)?.text).not.toContain('Dm7') // the autosave waits for a pause
    expect(saveButton(w)?.attributes('disabled')).toBeUndefined()
    await saveButton(w)?.trigger('click')
    await nextTick()
    expect(loadChart(ID)?.text).toContain('Dm7')
    expect(saveButton(w)?.attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('keeps a shared chart in My charts', async () => {
    const w = await mount({ sheet: 'changes' })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    await saveButton(w)?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({ path: '/song', query: { mine: expect.any(String) } })
    w.unmount()
  })

  it('is not offered where nothing saves', async () => {
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(saveButton(w)).toBeUndefined()
    w.unmount()
  })
})

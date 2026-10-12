import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { CHART_REPORT_KEY } from '~/utils/chartReport'
import { loadChart, saveChart } from '~/utils/myCharts'
import { decodeShare, parseChart, serializeChart, type ShareView } from '@chord-scale-maker/engine'

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

/** open the editor, then its Source from the banner */
async function showSource(w: Wrapper): Promise<void> {
  await buttonCalled(w, 'Edit')?.trigger('click')
  await nextTick()
  await buttonCalled(w, 'Source')?.trigger('click')
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

  it("previews in concert pitch by default, spelled from the chart's key", async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C', mode: 'from' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('offers the root, the key and every note in one picker', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseMode(w, 'From root')
    expect(sheet(w).props('mode')).toBe('root')
    await chooseMode(w, 'From D♭')
    expect(sheet(w).props()).toMatchObject({ mode: 'from', start: 'Db' })
  })

  it("follows the chart's key, written for the instrument, until a note is picked", async () => {
    const w = await mountSuspended(EditorView, {
      props: { initialText: 'title: T\nkey: Eb\nA | 1 | Cm7\n' },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
      attachTo: document.body,
    })
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props('start')).toBe('Eb')
    await chooseInstrument(w, 'Tenor Sax')
    expect(sheet(w).props()).toMatchObject({ mode: 'from', start: 'F' })
    expect(w.text()).toContain('From key (F)')
    await chooseMode(w, 'From A')
    await chooseInstrument(w, 'Alto Sax')
    expect(sheet(w).props('start')).toBe('A')
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseInstrument(w, 'Tenor Sax')
    await chooseMode(w, 'From E♭')
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

  it("shares a picked note, and the key as no note; old links' notes still open", async () => {
    const w = await mount({ sheet: 'scales', mode: 'from', start: 'Eb' })
    expect(sheet(w).props()).toMatchObject({ mode: 'from', start: 'Eb' })
    expect(await linkOf(w)).toMatchObject({ mode: 'from', start: 'Eb' })
    w.unmount()
    const k = await mount({ sheet: 'scales', mode: 'from' })
    expect(sheet(k).props()).toMatchObject({ mode: 'from', start: 'C' })
    const view = await linkOf(k)
    expect(view).toMatchObject({ mode: 'from' })
    expect(view).not.toHaveProperty('start')
    k.unmount()
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
  const banner = (w: Wrapper) => w.text().includes('Editing the sheet')

  it('puts Edit next to the title, and Done closes the editor', async () => {
    const w = await mount()
    const edit = buttonCalled(w, 'Edit')
    expect(edit?.element.parentElement?.querySelector('h1')?.textContent).toBe('T')
    expect(edit?.attributes('aria-expanded')).toBe('false')
    expect(banner(w)).toBe(false)
    await edit?.trigger('click')
    await nextTick()
    expect(banner(w)).toBe(true)
    const done = buttonCalled(w, 'Done')
    expect(done?.attributes('aria-expanded')).toBe('true')
    await done?.trigger('click')
    await nextTick()
    expect(banner(w)).toBe(false)
    w.unmount()
  })

  it('opens a new chart in the editor, and Done still closes it', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, isNew: true }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(banner(w)).toBe(true)
    await buttonCalled(w, 'Done')?.trigger('click')
    await nextTick()
    expect(banner(w)).toBe(false)
    expect(buttonCalled(w, 'Edit')?.attributes('aria-expanded')).toBe('false')
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
    saveChart({ id: 'eeeeee1', text: TEXT, kind: 'edited', basedOn: 'autumn-leaves' })
    localStorage.setItem('csm-level:autumn-leaves', JSON.stringify({ level: 'basic', seed: 7 }))
    const w = await mountSuspended(EditorView, {
      props: { initialText: TEXT, practiceKey: 'autumn-leaves', saveTarget: { kind: 'library', slug: 'autumn-leaves', libraryText: TEXT, id: 'eeeeee1' } },
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
    expect(JSON.parse(localStorage.getItem('csm-level:autumn-leaves') ?? '{}')).toEqual({ level: 'basic', seed: 7 })
    expect(changesSheet(w).props('view')).toEqual({ level: 'basic', seed: 7 })
  })
})

describe('EditorView Save', () => {
  // the banner's Save; saving a sheet edit at once is tested with the lead-sheet editor
  afterEach(() => {
    localStorage.clear()
    navigate.mockClear()
  })
  const saveButton = (w: Wrapper) => buttonCalled(w, 'Save')

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

describe('EditorView lead-sheet editor', () => {
  afterEach(() => localStorage.clear())

  it('shows the banner with concert pitch for a transposing instrument while the editor is open, from md up', async () => {
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await chooseInstrument(w, 'Tenor')
    expect(w.text()).toContain('Concert pitch while you edit')
    expect(changesSheet(w).props('part').trans).toBe('C')
    expect(changesSheet(w).props('editing')).toBeNull()
    await buttonCalled(w, 'Done')?.trigger('click')
    expect(w.text()).not.toContain('Concert pitch while you edit')
    expect(changesSheet(w).props('part').trans).toBe('Bb')
    expect(changesSheet(w).props('editing')).toBeUndefined()
  })

  it('forces numerals and scales on while editing, without changing the preferences', async () => {
    localStorage.setItem('csm-numerals', 'off')
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    expect(changesSheet(w).props('numerals')).toBe(true)
    expect(localStorage.getItem('csm-numerals')).toBe('off')
    expect(buttonCalled(w, 'Numerals')?.attributes('disabled')).toBeDefined()
  })

  const THREE = 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n' // lines 2, 3, 4
  const mountThree = () => mountSuspended(EditorView, { props: { initialText: THREE }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
  const sheetEmit = async (w: Wrapper, event: string, ...args: unknown[]) => {
    changesSheet(w).vm.$emit(event, ...args)
    await nextTick()
  }

  it('moves the field by bars, carries where the chord is drawn, and asks for focus back where there is nowhere to go', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'edit', { kind: 'chord', line: 3, at: { section: 'A', bar: '2' } })
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 3, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'next')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 4, at: { section: 'A', bar: '3' } })
    await sheetEmit(w, 'done', 'next') // the last chord: nowhere to go
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 4, at: { section: 'A', bar: '3' } })
  })

  it('moves the field by chords (← →): through a bar’s chords, then into the next or previous bar', async () => {
    const TWO = 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 2 | Db7\nA | 3 | CMaj7\n' // lines 2, 3, 4, 5
    const w = await mountSuspended(EditorView, { props: { initialText: TWO }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'edit', { kind: 'chord', line: 3, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'nextChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 4, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'nextChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 5, at: { section: 'A', bar: '3' } })
    await sheetEmit(w, 'done', 'prevChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 4, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'prevChord')
    await sheetEmit(w, 'done', 'prevChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 2, at: { section: 'A', bar: '1' } })
    await sheetEmit(w, 'done', 'prevChord') // the first chord: nowhere to go
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 2, at: { section: 'A', bar: '1' } })
  })

  const docText = (w: Wrapper): string => serializeChart(changesSheet(w).props('doc')).replace(/[ \t]*\|[ \t]*/g, ' | ')
  const barDialog = (w: Wrapper) => w.findComponent({ name: 'BarDialog' })

  it('pastes bars from the toolbar’s dialog, before or after the bar, and says why when they can’t go there', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'dialog', 'paste', 'A', 2)
    expect(barDialog(w).props('kind')).toBe('paste')
    barDialog(w).vm.$emit('submit', { kind: 'paste', bars: [['Fm7'], ['Bb7', 'Eb7']], before: false })
    await nextTick()
    expect(docText(w)).toMatch(/A \| 2 \| G7\nA \| 3 \| Fm7\nA \| 4 \| Bb7\nA \| 4 \| Eb7\nA \| 5 \| CMaj7/)
    expect(barDialog(w).props('kind')).toBeNull()
    await sheetEmit(w, 'dialog', 'paste', 'A', 1)
    barDialog(w).vm.$emit('submit', { kind: 'paste', bars: [[]], before: true })
    await nextTick()
    expect(barDialog(w).props('error')).toMatch(/can’t start with a held bar/)
    expect(docText(w)).toMatch(/A \| 1 \| Dm7/)
  })

  it('repeats a section as a new one after the last, and renames a section everywhere, refusing a name in use', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'repeatSection')
    expect(barDialog(w).props('kind')).toBe('repeat')
    barDialog(w).vm.$emit('submit', { kind: 'repeat', src: 'A', name: 'B' })
    await nextTick()
    expect(docText(w)).toMatch(/@copy A B 4/) // after A's four bars (three written, one rounding out)
    await sheetEmit(w, 'dialog', 'rename', 'A', 1)
    expect(barDialog(w).props('kind')).toBe('rename')
    barDialog(w).vm.$emit('submit', { kind: 'rename', name: 'B' })
    await nextTick()
    expect(barDialog(w).props('error')).toMatch(/no other section has/)
    barDialog(w).vm.$emit('submit', { kind: 'rename', name: 'Verse' })
    await nextTick()
    expect(docText(w)).toMatch(/Verse \| 1 \| Dm7/)
    expect(docText(w)).toMatch(/@copy Verse B 4/)
    expect(barDialog(w).props('kind')).toBeNull()
  })

  it('is the editor: the Chart pane is not rendered from md up; the Source is in the banner', async () => {
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(w.text()).toContain('Editing the sheet')
    expect(w.find('#grid-heading').exists()).toBe(false)
    expect(w.find('button[aria-label="More editing options"]').exists()).toBe(false)
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(false)
    await buttonCalled(w, 'Source')?.trigger('click')
    await nextTick()
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(true)
  })

  it('keeps the Chart heading, with the notice and the Source, on a chart over a size limit', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: 'title: T\n' + 'A | 1 | Cm7\n'.repeat(3000) }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(w.find('#grid-heading').exists()).toBe(true)
    expect(w.text()).toContain('Shorten it in the Source')
  })

  it('saves from the banner: Save rests while nothing is unsaved, and saves a sheet edit at once', async () => {
    saveChart({ id: 'abc123abc123', text: THREE, kind: 'new' })
    const w = await mountSuspended(EditorView, { props: { initialText: THREE, practiceKey: 'mine:abc123abc123', saveTarget: { kind: 'mine', id: 'abc123abc123' } }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    const save = () => buttonCalled(w, 'Save')
    expect(save()?.attributes('disabled')).toBeDefined()
    expect(save()?.element.closest('div')?.textContent).toContain('Editing the sheet')
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Db7\nA | 3 | CMaj7\n').value)
    expect(loadChart('abc123abc123')?.text).not.toContain('Db7') // the autosave waits for a pause
    expect(save()?.attributes('disabled')).toBeUndefined()
    await save()?.trigger('click')
    await nextTick()
    expect(loadChart('abc123abc123')?.text).toContain('Db7')
    expect(save()?.attributes('disabled')).toBeDefined()
  })

  it('from the new chord slot, Tab moves on and Enter gives focus to the bar’s last chord (review: Important 2)', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'edit', { kind: 'chord', line: 2, at: { section: 'A', bar: '1' } })
    await sheetEmit(w, 'done', 'add')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'slot', section: 'A', bar: '1' })
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | A7\nA | 2 | G7\nA | 3 | CMaj7\n').value)
    await sheetEmit(w, 'done', 'next')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 4, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'add')
    await sheetEmit(w, 'done', 'stay') // the slot closed empty
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 4, at: { section: 'A', bar: '2' } })
  })

  it('undoes from the sheet: ⌘Z in the preview and the banner’s Undo (review: Important 4)', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    const before = changesSheet(w).props('doc')
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Db7\nA | 3 | CMaj7\n').value)
    expect(changesSheet(w).props('doc')).not.toBe(before)
    await w.find('[aria-label="Preview"]').trigger('keydown', { key: 'z', metaKey: true })
    await nextTick()
    expect(serializeChart(changesSheet(w).props('doc'))).toMatch(/A \| 2 \| G7/)
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Db7\nA | 3 | CMaj7\n').value)
    await w.find('button[aria-label="Undo the last change"]').trigger('click')
    await nextTick()
    expect(serializeChart(changesSheet(w).props('doc'))).toMatch(/A \| 2 \| G7/)
  })

  it('shows no banner, and no field, on a chart over a size limit (Review Focus 5)', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: 'title: T\n' + 'A | 1 | Cm7\n'.repeat(3000) }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(w.text()).toContain('over a size limit')
    expect(w.text()).not.toContain('Editing the sheet')
  })
})

import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { CHART_REPORT_KEY } from '~/utils/chartReport'
import { loadChart, saveChart } from '~/utils/myCharts'
import { decodeShare, parseChart, practiceSelectionFrom, serializeChart, type ShareView } from '@chord-scale-maker/engine'
import { openPanel } from './railPanels'
import { LIST_PAUSE_MS } from '~/composables/useRhythmPathLists'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const TEXT = 'title: T\n\nsection: A\nbars: 4\n1 | Cm7\n'
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
/** open the rail's More menu and choose an item */
const moreAction = async (w: Wrapper, name: string): Promise<void> => {
  await w.find('button[aria-label="More actions"]').trigger('click')
  await nextTick()
  await buttonCalled(w, name)?.trigger('click')
}
/** the control a toolbar label (Catalyst Field) points at */
const control = (w: Wrapper, label: string) => {
  const id = w.findAll('label').find((l) => l.text() === label)?.attributes('for')
  const el = id ? w.find(`[id="${id}"]`) : undefined
  if (!el?.exists()) throw new Error(`no ${label} control`)
  return el
}
/** set the Pitch listbox to the pitch an instrument (by its visible name) reads in (#417) */
async function choosePitch(w: Wrapper, name: string): Promise<void> {
  const pitch = INSTRUMENT_GROUPS.find((g) => g.instruments.some((n) => instrumentOption(n).startsWith(name)))?.pitch
  await openPanel(w, 'Instrument')
  const button = w.findAll('button').find((b) => b.attributes('aria-label') === 'Pitch')
  if (!pitch || !button) throw new Error(`no pitch for ${name}`)
  if (button.text() === pitch) return
  await button.trigger('click')
  await nextTick()
  await w.findAll('[role=option]').find((o) => o.text() === pitch)?.trigger('click')
  await nextTick()
}
/** open the Instrument listbox and pick an option by its visible name */
async function chooseInstrument(w: Wrapper, name: string): Promise<void> {
  await choosePitch(w, name)
  await w.findAll('button').find((b) => b.attributes('aria-label') === 'Instrument')!.trigger('click')
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
  afterEach(() => localStorage.clear())
  it('mentions sections, copy: and @key', async () => {
    const w = await mount()
    await showSource(w)
    expect(w.html()).toContain('section: A')
    expect(w.html()).toContain('copy: A')
    expect(w.html()).toContain('@key 5 D')
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

  it("previews a Piano part by default, named on the sheet, spelled from the chart's key", async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: 'Piano', start: 'C', mode: 'from' })
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
      props: { initialText: 'title: T\nkey: Eb\n\nsection: A\nbars: 4\n1 | Cm7\n' },
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

  /** the Line control's radios, by visible label */
  const modeOptions = (w: Wrapper) => w.findAll('label').filter((l) => l.find('input[type="radio"][name="line-mode"]').exists())
  const checkedMode = (w: Wrapper) => modeOptions(w).filter((l) => (l.find('input').element as HTMLInputElement).checked).map((l) => l.text())
  async function chooseLine(w: Wrapper, label: string): Promise<void> {
    const option = modeOptions(w).find((l) => l.text() === label)
    if (!option) throw new Error(`no line option ${label}`)
    await option.find('input').setValue(true)
    await flushPromises()
  }
  /** open the Guide tone line listbox and pick From 3rd or From 7th */
  async function chooseGuide(w: Wrapper, label: string): Promise<void> {
    await openPanel(w, 'Line options')
    const btn = w.findAll('button').find((b) => b.attributes('aria-label') === 'Guide tone line')
    if (!btn) throw new Error('no guide tone line control')
    await btn.trigger('click')
    await nextTick()
    const option = w.findAll('[role=option]').find((o) => o.text() === label)
    if (!option) throw new Error(`no guide option ${label}`)
    await option.trigger('click')
    await nextTick()
  }

  it('offers Line: Off, Guide Tones, 7th Chords, off at first', async () => {
    const w = await mount()
    expect(w.findAll('label').some((l) => l.text() === 'Line')).toBe(true)
    expect(modeOptions(w).map((l) => l.text())).toEqual(['Off', 'Guide Tones', '7th Chords'])
    expect(checkedMode(w)).toEqual(['Off'])
    expect(changesSheet(w).props('line')).toBe('off')
    expect(buttonCalled(w, 'From 3rd')).toBeUndefined() // no toggle buttons
    w.unmount()
  })

  it('passes guide tones from the 3rd, then an arpeggio Up · root, and remembers the mode', async () => {
    const w = await mount()
    await chooseLine(w, 'Guide Tones')
    expect(changesSheet(w).props('line')).toBe('third')
    await chooseLine(w, '7th Chords')
    expect(changesSheet(w).props('line')).toBe('up-root')
    expect(localStorage.getItem('csm-line')).toBe('arpeggio')
    w.unmount()
  })

  it('picks the guide tones from the 7th in its listbox, and remembers it', async () => {
    const w = await mount()
    await chooseLine(w, 'Guide Tones')
    await chooseGuide(w, 'From 7th')
    expect(changesSheet(w).props('line')).toBe('seventh')
    expect(localStorage.getItem('csm-guide-line')).toBe('seventh')
    await chooseLine(w, 'Off')
    expect(changesSheet(w).props('line')).toBe('off')
    w.unmount()
  })

  it('starts on the line remembered', async () => {
    localStorage.setItem('csm-line', 'guide')
    localStorage.setItem('csm-guide-line', 'seventh')
    const w = await mount()
    expect(checkedMode(w)).toEqual(['Guide Tones'])
    expect(changesSheet(w).props('line')).toBe('seventh')
    w.unmount()
  })

  it('offers the guide tone line on the Changes sheet only', async () => {
    const w = await mount()
    expect(modeOptions(w)).toHaveLength(3)
    await chooseSheet(w, 'Scales')
    expect(modeOptions(w)).toHaveLength(0)
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
    const w = await mount({ sheet: 'changes', line: 'seventh' })
    expect(changesSheet(w).props('line')).toBe('seventh')
    expect(checkedMode(w)).toEqual(['Guide Tones'])
    expect(localStorage.getItem('csm-guide-line')).toBeNull()
    expect(localStorage.getItem('csm-line')).toBeNull()
    expect(await linkOf(w)).toMatchObject({ sheet: 'changes', line: 'seventh' })
    w.unmount()
  })

  it('shares an arpeggio line, and opens a link with one', async () => {
    const w = await mount({ sheet: 'changes', line: 'down-1st' })
    expect(changesSheet(w).props('line')).toBe('down-1st')
    expect(checkedMode(w)).toEqual(['7th Chords'])
    expect(await linkOf(w)).toMatchObject({ line: 'down-1st' })
    w.unmount()
  })

  it('draws a stored arpeggio line as the Pentatonic line under the Pentatonic overlay, and shares its Leave out and direction (#284)', async () => {
    localStorage.setItem('csm-overlay', 'pentatonic')
    localStorage.setItem('csm-pent-leave', 'b3')
    localStorage.setItem('csm-arp-dir', 'down')
    const w = await mount({ sheet: 'changes', line: 'down-1st' })
    expect(changesSheet(w).props('line')).toEqual({ kind: 'pentatonic', leave: 'b3', dir: 'down', arpeggio: 'down-1st' }) // the link has no Leave out: yours
    expect(checkedMode(w)).toEqual(['Pentatonic'])
    expect(await linkOf(w)).toMatchObject({ line: 'down-1st', pentLeave: 'b3', arpDir: 'down' })
    w.unmount()
    localStorage.clear()
  })

  it('opens a link without a line with the line off, whatever your own, and shares no line with it off', async () => {
    localStorage.setItem('csm-line', 'guide')
    const w = await mount({ sheet: 'changes' })
    expect(changesSheet(w).props('line')).toBe('off')
    expect(await linkOf(w)).not.toHaveProperty('line')
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
    await chooseLine(w, 'Guide Tones')
    await chooseGuide(w, 'From 7th')
    await moreAction(w, 'Report a chart error')
    expect(JSON.parse(sessionStorage.getItem(CHART_REPORT_KEY) ?? '{}')).toMatchObject({ sheet: 'changes', guides: 'from 7th' })
    expect(navigate).toHaveBeenCalledWith('/contact')
    w.unmount()
  })
})

describe('EditorView key signatures', () => {
  const KEYED = 'title: T\nkey: Bb\n\nsection: A\nbars: 4\n1 | Cm7\n2 | F7\n'
  const mountWith = (shared: { sheet: 'scales' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, shared },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
    })
  afterEach(() => localStorage.clear())

  it("gives the scale sheet the chart's key", async () => {
    const scales = await mountWith({ sheet: 'scales' })
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
  })
})

describe('EditorView editing', () => {
  afterEach(() => localStorage.clear())
  const banner = (w: Wrapper) => w.text().includes('Editing the sheet')

  it('puts Edit with the sheet controls, and Done closes the editor', async () => {
    const w = await mount()
    const edit = buttonCalled(w, 'Edit')
    expect(edit?.element.parentElement?.textContent).toContain('Print') // beside Focus and Print, not by a title
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

  // saved before section blocks (#329): the opening migrates it, and the level's owned rows (by line) follow it
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

  it('migrates an old saved chart and blanks the cells a level wrote into it, once, and forgets which rows it owned', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const w = await mountMine()
    expect(cells(changesSheet(w).props('doc'))).toEqual(['', 'F Lydian Dominant', 'Bb Major Pentatonic'])
    expect(loadChart('abc123abc123')?.text).not.toContain('C Minor Pentatonic') // saved
    expect(loadChart('abc123abc123')?.text).toContain('section: A\n') // in section blocks
    expect(localStorage.getItem('csm-premigration:mine:abc123abc123')).toBe(LEVELLED) // the old text kept, in case
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
    await moreAction(w, 'Revert to library version')
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

  it('forces numerals and scales on while editing, without changing the preferences, and hides their toggles', async () => {
    localStorage.setItem('csm-numerals', 'off')
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    expect(changesSheet(w).props('numerals')).toBe(true)
    expect(localStorage.getItem('csm-numerals')).toBe('off')
    expect(buttonCalled(w, 'Numerals')).toBeUndefined()
    expect(buttonCalled(w, 'Scales')).toBeUndefined()
    await buttonCalled(w, 'Done')?.trigger('click')
    expect(buttonCalled(w, 'Numerals')?.attributes('aria-pressed')).toBe('false')
  })

  const THREE = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n' // lines 5, 6, 7
  const mountThree = () => mountSuspended(EditorView, { props: { initialText: THREE }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
  const sheetEmit = async (w: Wrapper, event: string, ...args: unknown[]) => {
    changesSheet(w).vm.$emit(event, ...args)
    await nextTick()
  }

  it('moves the field by bars, carries where the chord is drawn, and asks for focus back where there is nowhere to go', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'edit', { kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'next')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 7, at: { section: 'A', bar: '3' } })
    await sheetEmit(w, 'done', 'next') // the last chord: nowhere to go
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 7, at: { section: 'A', bar: '3' } })
  })

  it('moves the field by chords (← →): through a bar’s chords, then into the next or previous bar', async () => {
    const TWO = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n2 | Db7\n3 | CMaj7\n' // lines 5, 6, 7, 8
    const w = await mountSuspended(EditorView, { props: { initialText: TWO }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'edit', { kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'nextChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 7, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'nextChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 8, at: { section: 'A', bar: '3' } })
    await sheetEmit(w, 'done', 'prevChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 7, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'prevChord')
    await sheetEmit(w, 'done', 'prevChord')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 5, at: { section: 'A', bar: '1' } })
    await sheetEmit(w, 'done', 'prevChord') // the first chord: nowhere to go
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 5, at: { section: 'A', bar: '1' } })
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
    expect(docText(w)).toMatch(/2 \| G7\n3 \| Fm7\n4 \| Bb7\n4 \| Eb7\n5 \| CMaj7/)
    expect(barDialog(w).props('kind')).toBeNull()
    await sheetEmit(w, 'dialog', 'paste', 'A', 1)
    barDialog(w).vm.$emit('submit', { kind: 'paste', bars: [[]], before: true })
    await nextTick()
    expect(barDialog(w).props('error')).toMatch(/can’t start with a held bar/)
    expect(docText(w)).toMatch(/\n1 \| Dm7/)
  })

  it('repeats a section as a new one after the last, and renames a section everywhere, refusing a name in use', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await sheetEmit(w, 'repeatSection')
    expect(barDialog(w).props('kind')).toBe('repeat')
    barDialog(w).vm.$emit('submit', { kind: 'repeat', src: 'A', name: 'B' })
    await nextTick()
    expect(docText(w)).toMatch(/section: B\ncopy: A/) // after A
    await sheetEmit(w, 'dialog', 'rename', 'A', 1)
    expect(barDialog(w).props('kind')).toBe('rename')
    barDialog(w).vm.$emit('submit', { kind: 'rename', name: 'B' })
    await nextTick()
    expect(barDialog(w).props('error')).toMatch(/no other section has/)
    barDialog(w).vm.$emit('submit', { kind: 'rename', name: 'Verse' })
    await nextTick()
    expect(docText(w)).toMatch(/section: Verse\n/)
    expect(docText(w)).toMatch(/section: B\ncopy: Verse/)
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
    expect(w.findAll('h1')).toHaveLength(1) // no sheet: the page keeps a heading (the text isn't parsed: Untitled)
  })

  it('saves from the banner: Save rests while nothing is unsaved, and saves a sheet edit at once', async () => {
    saveChart({ id: 'abc123abc123', text: THREE, kind: 'new' })
    const w = await mountSuspended(EditorView, { props: { initialText: THREE, practiceKey: 'mine:abc123abc123', saveTarget: { kind: 'mine', id: 'abc123abc123' } }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    const save = () => buttonCalled(w, 'Save')
    expect(save()?.attributes('disabled')).toBeDefined()
    expect(save()?.element.closest('div')?.textContent).toContain('Editing the sheet')
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Db7\n3 | CMaj7\n').value)
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
    await sheetEmit(w, 'edit', { kind: 'chord', line: 5, at: { section: 'A', bar: '1' } })
    await sheetEmit(w, 'done', 'add')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'slot', section: 'A', bar: '1' })
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | A7\n2 | G7\n3 | CMaj7\n').value)
    await sheetEmit(w, 'done', 'next')
    expect(changesSheet(w).props('editing')).toEqual({ kind: 'chord', line: 7, at: { section: 'A', bar: '2' } })
    await sheetEmit(w, 'done', 'add')
    await sheetEmit(w, 'done', 'stay') // the slot closed empty
    expect(changesSheet(w).props('editing')).toBeNull()
    expect(changesSheet(w).props('focusAt')).toMatchObject({ line: 7, at: { section: 'A', bar: '2' } })
  })

  it('undoes from the sheet: ⌘Z in the preview and the banner’s Undo (review: Important 4)', async () => {
    const w = await mountThree()
    await buttonCalled(w, 'Edit')?.trigger('click')
    const before = changesSheet(w).props('doc')
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Db7\n3 | CMaj7\n').value)
    expect(changesSheet(w).props('doc')).not.toBe(before)
    await w.find('[aria-label="Preview"]').trigger('keydown', { key: 'z', metaKey: true })
    await nextTick()
    expect(serializeChart(changesSheet(w).props('doc'))).toMatch(/\n2 +\| G7/)
    await sheetEmit(w, 'update:doc', parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Db7\n3 | CMaj7\n').value)
    await w.find('button[aria-label="Undo the last change"]').trigger('click')
    await nextTick()
    expect(serializeChart(changesSheet(w).props('doc'))).toMatch(/\n2 +\| G7/)
  })

  it('shows no banner, and no field, on a chart over a size limit (Review Focus 5)', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: 'title: T\n' + 'A | 1 | Cm7\n'.repeat(3000) }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(w.text()).toContain('over a size limit')
    expect(w.text()).not.toContain('Editing the sheet')
  })
})

describe('EditorView hexatonic practice', () => {
  afterEach(() => localStorage.clear())
  const shared = { sheet: 'scales', practice: { preset: 'hexatonic', pair: 2, grouping: 'tones' } } as const

  it('plays a shared Hexatonic selection', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, shared }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })
    expect(w.find('fieldset button[aria-pressed=true]').text()).toBe('Hexatonic')
    expect(w.findComponent({ name: 'ScaleSheet' }).props('practice')).toEqual(shared.practice)
  })
})

describe('EditorView note choices undo (#315)', () => {
  afterEach(() => localStorage.clear())

  it('undoes and redoes a Practice preset with ⌘Z anywhere on the page, the editor closed', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, shared: { sheet: 'scales' } }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    const panel = () => w.findComponent({ name: 'PracticePanel' })
    panel().vm.$emit('update:selection', { preset: 'guideTones' })
    await nextTick()
    expect(panel().props('selection')).toEqual({ preset: 'guideTones' })
    const press = (shiftKey: boolean) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey, bubbles: true, cancelable: true }))
    press(false)
    await nextTick()
    expect(panel().props('selection')).toBeNull()
    press(true)
    await nextTick()
    expect(panel().props('selection')).toEqual({ preset: 'guideTones' })
  })

  it('undoes and redoes the rhythm path (Groups, Gears, Step) as it does the pentatonic path (#553)', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, practiceKey: 'undo-path' }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    const controls = () => w.findComponent({ name: 'PreviewControls' })
    const path = { groups: [3, 4, 5, 6, 7], gears: ['8', '16'], step: { unit: 'bars', bars: 2 } }
    controls().vm.$emit('update:rhythmPath', path)
    await nextTick()
    expect(controls().props('rhythmPath')).toEqual(path)
    const press = (shiftKey: boolean) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey, bubbles: true, cancelable: true }))
    press(false)
    await nextTick()
    expect(controls().props('rhythmPath')).toEqual({ groups: null, gears: null, step: { unit: 'section', bars: 4 } })
    press(true)
    await nextTick()
    expect(controls().props('rhythmPath')).toEqual(path)
  })

  describe('a typed Your list… (#553)', () => {
    const OFF = { groups: null, gears: null, step: { unit: 'section', bars: 4 } }
    const press = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }))
    const pause = () => new Promise((r) => setTimeout(r, LIST_PAUSE_MS + 100)) // past the typing pause
    const typedList = async () => {
      localStorage.setItem('csm-rhythm', 'unit:8:3:accents')
      const w = await mountSuspended(EditorView, { props: { initialText: TEXT, practiceKey: 'undo-list' }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
      await openPanel(w, 'Line options')
      await w.find('[aria-label="Groups"]').trigger('click')
      await w.findAll('[role=option]').find((o) => o.text() === 'Your list…')!.trigger('click')
      await nextTick()
      const input = () => w.find('input[aria-label="Your groups"]')
      const type = async (text: string) => {
        for (let i = 1; i <= text.length; i++) await input().setValue(text.slice(0, i)) // a keystroke at a time
        await pause()
      }
      return { w, input, type, path: () => w.findComponent({ name: 'PreviewControls' }).props('rhythmPath') }
    }

    it('is one undo step, however many keystrokes it took', async () => {
      const { type, path } = await typedList()
      await type('3 4 5')
      expect(path()).toEqual({ ...OFF, groups: [3, 4, 5] })
      press()
      await nextTick()
      expect(path()).toEqual(OFF)
    })

    it('undoes back to the list typed before, with Your list… still chosen and its text following', async () => {
      const { w, input, type, path } = await typedList()
      await type('3 4')
      await input().setValue('')
      await type('3 4 5')
      expect(path()).toEqual({ ...OFF, groups: [3, 4, 5] })
      press()
      await nextTick()
      await nextTick()
      expect(path()).toEqual({ ...OFF, groups: [3, 4] })
      expect(w.find('[aria-label="Groups"]').text()).toBe('Groups: Your list…')
      expect((input().element as HTMLInputElement).value).toBe('3 4')
    })
  })
})

describe('EditorView overlay', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
    localStorage.clear()
  })
  const overlayOf = async () => changesSheet(await mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })).props('overlay')

  it('hands the Changes sheet the Hexatonic overlay', async () => {
    localStorage.setItem('csm-overlay', 'hexatonic')
    expect(await overlayOf()).toEqual({ kind: 'hexatonic', basis: 'chord', picks: {} })
  })

  it('hands it the stored Hexatonic basis (#432)', async () => {
    localStorage.setItem('csm-overlay', 'hexatonic')
    localStorage.setItem('csm-hex-basis', 'key')
    expect(await overlayOf()).toMatchObject({ kind: 'hexatonic', basis: 'key' })
  })

  it('reads an old Pentatonics row turned on as the Pentatonic overlay', async () => {
    localStorage.setItem('csm-pentatonics', 'on')
    expect(await overlayOf()).toMatchObject({ kind: 'pentatonic' })
  })

  it('below Everything, an overlay in force shows the notice, and Reset turns it off', async () => {
    useInterface().level.value = 'intermediate'
    localStorage.setItem('csm-overlay', 'hexatonic')
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })
    const notice = w.findComponent({ name: 'InterfaceNotice' })
    expect(notice.props('needs')).toBe('everything')
    notice.vm.$emit('reset')
    await nextTick()
    expect(changesSheet(w).props('overlay')).toBeNull()
    expect(localStorage.getItem('csm-overlay')).toBe('off')
  })

  it('at Essentials, a rhythm in force shows the notice, and Reset puts every rhythm setting back (#505)', async () => {
    const features = useRuntimeConfig().public.features as Record<string, unknown>
    const was = { ...features }
    Object.assign(features, { rhythm: true })
    try {
      useInterface().level.value = 'essentials'
      const stored = { 'csm-rhythm': 'unit:8:3:rests', 'csm-targets': 'on', 'csm-rhythm-start': 'pickup-2', 'csm-anticipate': '1', 'csm-guide-restate': 'on' }
      for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, v)
      const w = await mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })
      const notice = w.findComponent({ name: 'InterfaceNotice' })
      expect(notice.props('needs')).toBe('intermediate')
      notice.vm.$emit('reset')
      await nextTick()
      const s = changesSheet(w)
      expect([s.props('rhythm'), s.props('targets'), s.props('rhythmStart'), s.props('anticipate'), s.props('restate')]).toEqual(['off', false, 'beat', 0, false])
    } finally {
      Object.assign(features, was)
    }
  })
})

describe('EditorView pentatonic practice (#266)', () => {
  afterEach(() => localStorage.clear())
  const shared = { sheet: 'scales', practice: { preset: 'pentatonic', degree: 5 } } as const

  it('plays a shared Pentatonic selection', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, shared }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })
    expect(w.find('fieldset button[aria-pressed=true]').text()).toBe('Pentatonic')
    expect(w.find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: 4')
  })

  it('plays an old link’s Pentatonic rank as Auto', async () => {
    const old = { sheet: 'scales', practice: practiceSelectionFrom({ preset: 'pentatonic', rank: 7 })! } as const
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, shared: old }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } } })
    expect(w.find('[aria-label="Pentatonic built on"]').text()).toBe('Built on: Auto')
  })
})

describe('EditorView chord picks (#303)', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
    localStorage.clear()
  })
  const KEYED = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cm7\n2 | Cm7\n'
  const PICK = { 'A:1:0': { pc: 7, for: 'Cm7|C Dorian' } }
  const mountKeyed = (extra: object = {}) =>
    mountSuspended(EditorView, { props: { initialText: KEYED, ...extra }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
  const overlayPicks = (w: Wrapper) => (changesSheet(w).props('overlay') as { picks?: Record<string, unknown> } | null)?.picks
  const linkOf = async (w: Wrapper) => {
    await buttonCalled(w, 'Share')?.trigger('click')
    const link = await vi.waitFor(() => {
      const l = w.findComponent({ name: 'ShareDialog' }).props('link')
      if (typeof l !== 'string') throw new Error('no link yet')
      return l
    })
    return (await decodeShare(link.split('#s=')[1] ?? ''))?.view
  }

  it('keeps the picks through Built on, Path, Step, Rung, Side and Ranked against; a new key still clears them', async () => {
    localStorage.setItem('csm-overlay', 'pentatonic')
    const w = await mountKeyed()
    changesSheet(w).vm.$emit('pick', 'pentatonic', ['A:1:0'], 7)
    await nextTick()
    expect(overlayPicks(w)).toEqual(PICK)
    const controls = w.findComponent({ name: 'PreviewControls' })
    for (const [model, value] of [['pentDegree', 5], ['pentPath', 'fifths'], ['pentStepUnit', 'bars'], ['pentStepBars', 8], ['pentRung', 3], ['pentSide', 'sharp'], ['pentBasis', 'chord']] as const) {
      controls.vm.$emit(`update:${model}`, value)
      await nextTick()
      expect(overlayPicks(w), model).toEqual(PICK)
    }
    changesSheet(w).vm.$emit('update:doc', parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cm7\n2 | F7\n').value) // same key: kept
    await nextTick()
    expect(overlayPicks(w)).toEqual(PICK)
    changesSheet(w).vm.$emit('update:doc', parseChart('title: T\nkey: Bb\n\nsection: A\nbars: 4\n1 | Bbm7\n2 | Eb7\n').value)
    await nextTick()
    expect(overlayPicks(w)).toEqual({})
  })

  it('a Scales staff’s pick reaches the Changes sheet at every position; the hexatonic overlay gets its picks', async () => {
    localStorage.setItem('csm-overlay', 'pentatonic')
    const w = await mountKeyed()
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props()).toMatchObject({ pickable: true, picks: { pentatonic: {}, hexatonic: {} } })
    expect([...(sheet(w).props('positions') as ReadonlyMap<number, string>).values()]).toEqual(['A:1:0', 'A:2:0'])
    sheet(w).vm.$emit('pick', 'pentatonic', ['A:1:0', 'A:2:0'], 7)
    sheet(w).vm.$emit('pick', 'hexatonic', ['A:2:0'], [5, 7])
    await nextTick()
    await chooseSheet(w, 'Changes')
    expect(overlayPicks(w)).toEqual({ ...PICK, 'A:2:0': { pc: 7, for: 'Cm7|C Dorian' } })
    changesSheet(w).vm.$emit('pick', 'pentatonic', ['A:2:0'], null)
    await nextTick()
    expect(overlayPicks(w)).toEqual(PICK)
    w.findComponent({ name: 'PreviewControls' }).vm.$emit('update:overlay', 'hexatonic')
    await nextTick()
    expect(changesSheet(w).props('overlay')).toEqual({ kind: 'hexatonic', basis: 'chord', picks: { 'A:2:0': { roots: [5, 7], for: 'Cm7|C Dorian' } } })
  })

  it('makes the Scales captions pickable only at Everything', async () => {
    useInterface().level.value = 'intermediate'
    const w = await mountKeyed({ shared: { sheet: 'scales' } })
    expect(sheet(w).props('pickable')).toBe(false)
  })

  it('shares the live picks, and none when there are none', async () => {
    const w = await mountKeyed()
    expect(await linkOf(w)).not.toHaveProperty('picks')
    changesSheet(w).vm.$emit('pick', 'pentatonic', ['A:1:0'], 7)
    await nextTick()
    expect((await linkOf(w))?.picks).toEqual({ pentatonic: PICK, hexatonic: {} })
  })

  it('opens a link’s picks for the visit, writing nothing', async () => {
    const w = await mountKeyed({ shared: { sheet: 'scales', picks: { pentatonic: PICK, hexatonic: {} } }, practiceKey: 'mine:x' })
    expect(sheet(w).props('picks')).toEqual({ pentatonic: PICK, hexatonic: {} })
    expect(Object.keys(localStorage).filter((k) => k.startsWith('csm-pent-picks'))).toEqual([])
  })

  it('More → Reset chord picks clears them, offered only while there are live picks', async () => {
    const w = await mountKeyed()
    const items = () => w.findComponent({ name: 'MoreMenu' }).props('items') as readonly string[]
    expect(items()).not.toContain('reset-picks')
    changesSheet(w).vm.$emit('pick', 'pentatonic', ['A:1:0'], 7)
    await nextTick()
    expect(items()).toContain('reset-picks')
    await moreAction(w, 'Reset chord picks')
    await nextTick()
    expect(items()).not.toContain('reset-picks')
    expect(await linkOf(w)).not.toHaveProperty('picks')
    expect(w.find('[aria-live="polite"]').text()).toBe('Chord picks reset')
  })

  it('at Essentials, picks in force show the notice, and its Reset clears them', async () => {
    useInterface().level.value = 'essentials'
    const w = await mountKeyed({ shared: { sheet: 'scales', practice: { preset: 'pentatonic', degree: 'auto' }, picks: { pentatonic: PICK, hexatonic: {} } } })
    const notice = w.findComponent({ name: 'InterfaceNotice' })
    expect(notice.props('needs')).toBe('everything')
    notice.vm.$emit('reset')
    await nextTick()
    expect(sheet(w).props('picks')).toEqual({ pentatonic: {}, hexatonic: {} })
  })
})

describe('EditorView interface levels', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
    localStorage.clear()
  })

  it('Essentials hides the Source, but a chart over a size limit still shows it', async () => {
    useInterface().level.value = 'essentials'
    const w = await mount()
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(buttonCalled(w, 'Source')).toBeUndefined()
    const big = await mountSuspended(EditorView, { props: { initialText: 'title: T\n' + 'A | 1 | Cm7\n'.repeat(3000) }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    expect(big.find('textarea[aria-label="Chart text"]').exists()).toBe(true)
  })
})

describe('EditorView interface notice', () => {
  const notice = (w: Wrapper) => w.findComponent({ name: 'InterfaceNotice' })
  const at = (level: 'essentials' | 'intermediate' | 'everything') => {
    useInterface().level.value = level
  }
  afterEach(() => {
    useInterface().level.value = 'everything'
    localStorage.clear()
  })

  it("a share link's hidden settings show a notice naming the level", async () => {
    at('essentials')
    const w = await mount({ sheet: 'changes', level: 'advanced', seed: 1 })
    expect(notice(w).exists()).toBe(true)
    expect(notice(w).props('needs')).toBe('intermediate')
  })

  it('Show controls raises the level; the notice goes', async () => {
    at('essentials')
    const w = await mount({ sheet: 'changes', level: 'advanced', seed: 1 })
    notice(w).vm.$emit('show')
    await nextTick()
    expect(useInterface().level.value).toBe('intermediate')
    expect(notice(w).exists()).toBe(false)
  })

  it('Reset returns the hidden settings to their defaults', async () => {
    at('essentials')
    const w = await mount({ sheet: 'changes', level: 'advanced', seed: 1, numerals: false })
    notice(w).vm.$emit('reset')
    await nextTick()
    expect(notice(w).exists()).toBe(false)
    expect(useInterface().level.value).toBe('essentials')
    expect(changesSheet(w).props('numerals')).toBe(true)
    expect(localStorage.getItem('csm-numerals')).toBeNull() // a link's settings are for the visit: Reset leaves your own alone
  })

  it('while editing, settings the editor forces on do not count toward the notice (#291)', async () => {
    at('essentials')
    localStorage.setItem('csm-numerals', 'off')
    localStorage.setItem('csm-scale-names', 'off')
    const w = await mount()
    expect(notice(w).exists()).toBe(true)
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(notice(w).exists()).toBe(false)
    await buttonCalled(w, 'Done')?.trigger('click')
    await nextTick()
    expect(notice(w).exists()).toBe(true)
  })

  it('Reset clears this chart’s stored pentatonic path and chord picks, not another chart’s path (#291)', async () => {
    localStorage.setItem('csm-overlay', 'pentatonic')
    localStorage.setItem('csm-pent-path:satin-doll', JSON.stringify({ path: 'side-slip', step: { unit: 'section', bars: 4 }, sections: {} }))
    localStorage.setItem('csm-pent-path:autumn-leaves', JSON.stringify({ path: 'fifths', step: { unit: 'section', bars: 4 }, sections: {} }))
    const w = await mountSuspended(EditorView, { props: { initialText: 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cm7\n', practiceKey: 'satin-doll' }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    changesSheet(w).vm.$emit('pick', 'pentatonic', ['A:1:0'], 7)
    await nextTick()
    expect(localStorage.getItem('csm-pent-picks:satin-doll')).not.toBeNull()
    at('essentials')
    await nextTick()
    notice(w).vm.$emit('reset')
    await flushPromises()
    expect(notice(w).exists()).toBe(false)
    expect(localStorage.getItem('csm-overlay')).toBe('off')
    expect(localStorage.getItem('csm-pent-path:satin-doll')).toBeNull()
    expect(localStorage.getItem('csm-pent-picks:satin-doll')).toBeNull()
    expect(localStorage.getItem('csm-pent-path:autumn-leaves')).not.toBeNull()
    expect(w.findComponent({ name: 'PreviewControls' }).props('pentPath')).toBe('one')
  })

  it('no notice when nothing is hidden', async () => {
    at('essentials')
    expect(notice(await mount({ sheet: 'changes' })).exists()).toBe(false)
  })
})

describe('EditorView interface fixes', () => {
  afterEach(() => {
    useInterface().level.value = 'everything'
    localStorage.clear()
  })

  it('a chart whose text has a problem offers its Source at any level', async () => {
    useInterface().level.value = 'essentials'
    const w = await mountSuspended(EditorView, { props: { initialText: 'title: T\n\nsection: A\nbars: 4\n1 | Cm7\nwhat is this\n' }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(w.text()).toContain('Editing the sheet')
    const show = buttonCalled(w, 'Source')
    expect(show).toBeDefined()
    await show?.trigger('click')
    await nextTick()
    expect(w.find('textarea[aria-label="Chart text"]').exists()).toBe(true)
  })

  it('a chart with alternates is sheet-editable, writing the chart itself, and its Source is not forced on, with the alternates flag off (#469)', async () => {
    useInterface().level.value = 'essentials'
    const text = 'title: T\n\nsection: A\nbars: 2\n1 | Cm7\nalt 1 | Dm7\n2 | G7\n'
    const w = await mountSuspended(EditorView, { props: { initialText: text }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await buttonCalled(w, 'Edit')?.trigger('click')
    await nextTick()
    expect(changesSheet(w).props('editable')).toBe(true)
    expect(changesSheet(w).props('set')).toBe('standard')
    expect(changesSheet(w).props('doc')).toBe(changesSheet(w).props('source')) // the chart, alt rows and all
    expect(w.find('button[aria-label="More editing options"]').exists()).toBe(false)
    w.unmount()
  })

  it('the alt line is typed while the sheet editor plays Standard, shown with Other changes off; not in Alternate (#469)', async () => {
    const text = 'title: T\n\nsection: A\nbars: 2\n1 | Cm7\nalt 1 | Dm7\n2 | G7\n'
    const open = async (main: 'standard' | 'alternate') => {
      localStorage.setItem('csm-changes:k', JSON.stringify({ main, shown: false }))
      const w = await mountSuspended(EditorView, { props: { initialText: text, practiceKey: 'k' }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
      expect(changesSheet(w).props('altEditing')).toBe(false)
      expect(changesSheet(w).props('otherDoc')).toBeNull()
      await buttonCalled(w, 'Edit')?.trigger('click')
      await nextTick()
      return w
    }
    const standard = await open('standard')
    expect(changesSheet(standard).props('altEditing')).toBe(true)
    expect(changesSheet(standard).props('otherDoc')).not.toBeNull()
    standard.unmount()
    const alternate = await open('alternate')
    expect(changesSheet(alternate).props('altEditing')).toBe(false)
    expect(changesSheet(alternate).props('otherDoc')).toBeNull()
    alternate.unmount()
  })

  it('Reset clears the practice selection in force, not another mode’s', async () => {
    useInterface().level.value = 'essentials'
    localStorage.setItem('csm-spell', 'root')
    localStorage.setItem('csm-practice:autumn-leaves:root', JSON.stringify({ preset: 'guideTones' }))
    localStorage.setItem('csm-practice:autumn-leaves:from', JSON.stringify({ preset: 'all' }))
    const w = await mountSuspended(EditorView, { props: { initialText: TEXT, practiceKey: 'autumn-leaves', shared: undefined }, global: { stubs: { ScaleSheet: true, ChangesSheet: true } }, attachTo: document.body })
    await chooseSheet(w, 'Scales')
    w.findComponent({ name: 'InterfaceNotice' }).vm.$emit('reset')
    await nextTick()
    expect(localStorage.getItem('csm-practice:autumn-leaves:root')).toBeNull()
    expect(localStorage.getItem('csm-practice:autumn-leaves:from')).not.toBeNull()
  })
})

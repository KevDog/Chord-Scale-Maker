import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChangesNote from '~/components/ChangesNote.vue'
import { ISSUE_CONTEXT } from '~/utils/issueReport'

const M4_PROPS = { reason: 'ii of the ii–V to C', heardIn: 'C major', keyFrom: 'found' as const, rule: 'm4', fallback: false, chord: 'Dm7', concert: 'Dm7', numeral: 'ii7', scale: 'D Dorian' }
const base = { reason: 'r', heardIn: 'C major', keyFrom: 'found' as const, rule: 'm4', fallback: false, chord: 'Dm7', concert: 'Dm7', numeral: 'ii7', scale: 'D Dorian', at: { section: 'A', bar: '1' } }
const CONTEXT = { title: () => 'T', part: () => ({ name: 'Piano', transposes: false }), library: (): string | null => null, shareUrl: async () => 'https://x/song#s=1' }
const mountNote = (props: Partial<typeof base> & { wrap?: boolean } = {}, context: Partial<typeof CONTEXT> = {}) =>
  mountSuspended(ChangesNote, { props: { ...base, ...props }, slots: { default: () => 'x' }, attachTo: document.body, global: { provide: { [ISSUE_CONTEXT as symbol]: { ...CONTEXT, ...context } } } })
/** a click as the browser gives it: synchronous, nothing awaited after it */
const clickNow = (w: Awaited<ReturnType<typeof mountNote>>, selector: string): void => (w.find(selector).element as HTMLElement).click()

describe('ChangesNote', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens on click and shows the reason, the key, and the rule as a link', async () => {
    const w = await mountNote({ reason: 'ii of the ii–V to C' })
    expect(w.find('[role=dialog]').exists()).toBe(false)
    await w.find('button').trigger('click')
    const panel = w.find('[role=dialog]')
    expect(panel.attributes('aria-label')).toBe('Why: Dm7')
    expect(panel.text()).toContain('ii of the ii–V to C')
    expect(panel.text()).toContain('in C major')
    expect(panel.classes()).toContain('print:hidden')
    expect(panel.find('a[href="/functions#rule-m4"]').text()).toBe('m4')
    w.unmount()
  })

  it('links each part of a compound rule', async () => {
    const w = await mountNote({ rule: 'D1+D4', chord: 'G7b9' })
    await w.find('button').trigger('click')
    expect(w.findAll('[role=dialog] a[href^="/functions#rule-"]').map((a) => a.attributes('href'))).toEqual(['/functions#rule-D1', '/functions#rule-D4'])
    w.unmount()
  })

  it('says when the rules only guessed', async () => {
    const w = await mountNote({ rule: 'm8', fallback: true, chord: 'Abm7' })
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').text()).toContain('rule m8, a guess — an @key or a function would settle it')
    w.unmount()
  })

  it('names no rule when the analysis has none', async () => {
    const w = await mountNote({ rule: '' })
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').text()).not.toContain('rule')
    w.unmount()
  })

  it("stars a key the author set, by an @key or the function's key", async () => {
    const keyLine = async (keyFrom: 'found' | 'area' | 'function'): Promise<string> => {
      const w = await mountNote({ keyFrom, heardIn: 'D major' })
      await w.find('button').trigger('click')
      const t = w.findAll('[role=dialog] > span').at(-1)?.text() ?? ''
      w.unmount()
      return t
    }
    expect(await keyLine('found')).toBe('in D major')
    expect(await keyLine('area')).toBe('* in D major')
    expect(await keyLine('function')).toBe('* in D major')
  })

  it('wraps instead of truncating when asked', async () => {
    const plain = await mountNote()
    expect(plain.find('button').classes()).toContain('truncate')
    plain.unmount()
    const w = await mountNote({ wrap: true })
    expect(w.find('button').classes()).not.toContain('truncate')
    expect(w.find('button').classes()).toContain('whitespace-normal')
    w.unmount()
  })

  it('Report issue puts the report on the clipboard, then offers the contact form and GitHub', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountNote(M4_PROPS)
    await w.find('button').trigger('click')
    await flushPromises()
    await w.find('button[data-copy]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Rule: m4 (ii of the ii–V to C)'))
    expect(w.text()).toContain('Copied.')
    expect(w.find('a[href^="https://github.com/KevDog/Chord-Scale-Maker/issues/new?title="]').exists()).toBe(true)
    expect(w.find('button[data-contact]').text()).toBe('Send it with the contact form')
    w.unmount()
  })

  it('without a clipboard, shows the text to copy by hand', async () => {
    vi.stubGlobal('navigator', {})
    const w = await mountNote(M4_PROPS)
    await w.find('button').trigger('click')
    await flushPromises()
    await w.find('button[data-copy]').trigger('click')
    await flushPromises()
    expect((w.find('textarea[readonly]').element as HTMLTextAreaElement).value).toContain('Rule: m4')
    w.unmount()
  })

  it('a refused clipboard also shows the text', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const w = await mountNote(M4_PROPS)
    await w.find('button').trigger('click')
    await flushPromises()
    await w.find('button[data-copy]').trigger('click')
    await flushPromises()
    expect(w.find('textarea[readonly]').exists()).toBe(true)
    w.unmount()
  })

  it('on a transposing part, names the chord as drawn, and reports which lines are written for the part', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const props = { reason: 'V7 of C: natural tensions', heardIn: 'D major', rule: 'D4', chord: 'A7', concert: 'G7', numeral: 'V7', scale: 'A Mixolydian' }
    const w = await mountNote(props, { part: () => ({ name: 'B♭ Trumpet', transposes: true }) })
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').attributes('aria-label')).toBe('Why: A7')
    await flushPromises()
    clickNow(w, 'button[data-copy]')
    const text = writeText.mock.calls[0]?.[0] as string
    expect(text).toContain('Instrument: B♭ Trumpet\nBar: 1 (section A)\nChord: A7 (concert G7)\n')
    expect(text).toContain('Key area (written for B♭ Trumpet): D major')
    expect(text).toContain('Scale shown (written for B♭ Trumpet): A Mixolydian')
    expect(text).toContain('Rule: D4 (V7 of C: natural tensions), in concert pitch')
    w.unmount()
  })

  it('Copy writes to the clipboard within the click, the report made when the note opened', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountNote(M4_PROPS)
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('button[data-copy]').attributes('data-ready')).toBe('true')
    clickNow(w, 'button[data-copy]')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Link: https://x/song#s=1'))
    await flushPromises()
    expect(w.text()).toContain('Copied.')
    w.unmount()
  })

  it('a click before the link is made shows the text to copy by hand, the link filled in when it comes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    let resolve = (_: string): void => {}
    const w = await mountNote(M4_PROPS, { shareUrl: () => new Promise<string>((r) => (resolve = r)) })
    await w.find('button').trigger('click')
    expect(w.find('button[data-copy]').attributes('data-ready')).toBe('false')
    clickNow(w, 'button[data-copy]')
    await flushPromises()
    expect(writeText).not.toHaveBeenCalled()
    const box = () => (w.find('textarea[readonly]').element as HTMLTextAreaElement).value
    expect(box()).toContain('Rule: m4')
    resolve('https://x/song#s=2')
    await flushPromises()
    expect(box()).toContain('Link: https://x/song#s=2')
    w.unmount()
  })

  it('a share link that fails leaves the text to copy by hand, saying why it has no link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountNote(M4_PROPS, { shareUrl: () => Promise.reject(new Error('no CompressionStream')) })
    await w.find('button').trigger('click')
    await flushPromises()
    clickNow(w, 'button[data-copy]')
    await flushPromises()
    expect(writeText).not.toHaveBeenCalled()
    const box = (w.find('textarea[readonly]').element as HTMLTextAreaElement).value
    expect(box).toContain('Rule: m4')
    expect(box).not.toContain('https://x/')
    expect(box).toContain('Link: (this browser could not make one: paste the chart')
    w.unmount()
  })

  it('a library chart as published: the report names its bar and slug, no share link, ready at once', async () => {
    const shareUrl = vi.fn(async () => 'https://x/song#s=1')
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountNote({ at: { section: 'A', bar: '3' } }, { library: () => 'autumn-leaves', shareUrl })
    await w.find('button').trigger('click')
    clickNow(w, 'button[data-copy]')
    await flushPromises()
    const text = writeText.mock.calls[0]?.[0] as string
    expect(text).toContain('Chart: T (library chart autumn-leaves)')
    expect(text).toContain('Bar: 3 (section A)')
    expect(text).not.toContain('Link:')
    expect(shareUrl).not.toHaveBeenCalled()
    w.unmount()
  })

  it('an edited or new chart keeps its share link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountNote({ at: { section: 'A', bar: '3' } }, { library: () => null })
    await w.find('button').trigger('click')
    await flushPromises()
    clickNow(w, 'button[data-copy]')
    await flushPromises()
    expect(writeText.mock.calls[0]?.[0]).toContain('Link: https://x/song#s=1')
    w.unmount()
  })

  it('opens fresh each time: no "Copied." from before', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const w = await mountNote(M4_PROPS)
    await w.find('button').trigger('click')
    await flushPromises()
    await w.find('button[data-copy]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Copied.')
    await w.find('button').trigger('click')
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role=dialog]').exists()).toBe(true)
    expect(w.text()).not.toContain('Copied.')
    w.unmount()
  })
})

describe('ChangesNote’s links to How it decides', () => {
  it('links a written scale to the levels, a slash chord read on its bass to slash chords, and neither otherwise', async () => {
    const hrefs = async (props: { pinned?: boolean; slash?: boolean }) => {
      const w = await mountNote(props)
      await w.find('button').trigger('click')
      const out = w.findAll('[role=dialog] a[href^="/how-it-decides"]').map((a) => a.attributes('href'))
      w.unmount()
      return out
    }
    expect(await hrefs({})).toEqual([])
    expect(await hrefs({ pinned: true })).toEqual(['/how-it-decides#scale.level'])
    expect(await hrefs({ slash: true })).toEqual(['/how-it-decides#scale.slash'])
  })

  it('names Basic’s Blues scale when the level gives it one', async () => {
    const w = await mountNote({ levelNote: 'Basic: the E Blues scale over the whole blues' } as Partial<typeof base>)
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').text()).toContain('Basic: the E Blues scale over the whole blues')
    w.unmount()
    const v = await mountNote()
    await v.find('button').trigger('click')
    expect(v.find('[role=dialog]').text()).not.toContain('Blues scale')
    v.unmount()
  })
})

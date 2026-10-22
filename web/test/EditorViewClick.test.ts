import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { fakeAudio } from './clickFakes'

const flags = vi.hoisted(() => ({ metronome: true }))
mockNuxtImport('useFeature', () => (name: string) => name === 'metronome' && flags.metronome)
vi.mock('~/utils/clickSounds', async (actual) => ({ ...(await actual<object>()), webAudio: () => fakeAudio() }))

const TEXT = 'title: T\nkey: C\nstyle: Medium up\n\nsection: A\nbars: 4\n1 | Cm7\n'
afterEach(() => {
  document.body.innerHTML = ''
  flags.metronome = true
})

const mount = () =>
  mountSuspended(EditorView, {
    props: { initialText: TEXT },
    global: { stubs: { ScaleSheet: true, ChangesSheet: true, ArpeggioSheet: true } },
    attachTo: document.body,
  })
type Wrapper = Awaited<ReturnType<typeof mount>>
const named = (w: Wrapper, name: string) => w.findAll('button').find((b) => (b.attributes('aria-label') ?? b.text().trim()) === name)
const bar = (w: Wrapper) => w.find('[role=toolbar][aria-label=Click]')

describe('the click (#254)', () => {
  it('shows the docked bar from the rail’s Click, at the style’s tempo', async () => {
    const w = await mount()
    expect(bar(w).exists()).toBe(false)
    await named(w, 'Click')!.trigger('click')
    expect(bar(w).exists()).toBe(true)
    expect(bar(w).find<HTMLInputElement>('input[aria-label=Tempo]').element.value).toBe('160')
  })

  it('Space starts and stops it, but not from a control', async () => {
    const w = await mount()
    await named(w, 'Click')!.trigger('click')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await vi.waitFor(() => expect(named(w, 'Stop')?.attributes('aria-pressed')).toBe('true'))
    named(w, 'Tap the tempo')!.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(named(w, 'Stop')).toBeDefined() // still running: Space on a button is the button's
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(named(w, 'Start')).toBeDefined()
  })

  it('joins the focus bar in focus mode, still running', async () => {
    const w = await mount()
    await named(w, 'Click')!.trigger('click')
    await named(w, 'Start')!.trigger('click')
    await vi.waitFor(() => expect(named(w, 'Stop')).toBeDefined())
    await named(w, 'Focus')!.trigger('click')
    await nextTick()
    const focus = w.find('[aria-label="Focus mode"]')
    expect(focus.find('[role=toolbar][aria-label=Click]').exists()).toBe(true)
    expect(w.findAll('[role=toolbar][aria-label=Click]')).toHaveLength(1)
    expect(named(w, 'Stop')).toBeDefined()
    expect(named(w, 'Hide the click')).toBeUndefined()
  })

  it('offers Click in the focus bar when it wasn’t shown', async () => {
    const w = await mount()
    await named(w, 'Focus')!.trigger('click')
    await nextTick()
    const inFocus = w.find('[aria-label="Focus mode"]').findAll('button').find((b) => b.text().trim() === 'Click')
    expect(inFocus).toBeDefined()
    await inFocus!.trigger('click')
    expect(w.find('[aria-label="Focus mode"] [role=toolbar][aria-label=Click]').exists()).toBe(true)
  })

  it('entering focus still focuses Exit focus, with Click before it', async () => {
    const w = await mount()
    await named(w, 'Focus')!.trigger('click')
    await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Exit focus'))
  })

  it('has no Click without the flag', async () => {
    flags.metronome = false
    const w = await mount()
    expect(named(w, 'Click')).toBeUndefined()
  })
})

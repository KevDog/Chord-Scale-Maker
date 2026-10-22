import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { DOMWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import ClickBar from '~/components/ClickBar.vue'
import { CLICK, type ClickChart, useClick } from '~/composables/useClick'
import { fakeAudio, timers } from './clickFakes'

const chart4: ClickChart = { beats: 4, style: 'Medium up', metreChanges: false }

async function mountBar(chart: ClickChart = chart4, home: 'docked' | 'focus' = 'docked') {
  const click = useClick(ref(chart), ref(undefined), { audio: fakeAudio, ...timers() })
  const w = await mountSuspended(ClickBar, { props: { home, chart }, global: { provide: { [CLICK as symbol]: click } } })
  const button = (name: string): DOMWrapper<HTMLButtonElement> | undefined =>
    w.findAll('button').find((b) => (b.attributes('aria-label') ?? b.text().trim()) === name)
  return { w, click, button }
}

describe('ClickBar', () => {
  beforeEach(() => localStorage.removeItem('csm-click'))

  it('names its controls and lights a beat', async () => {
    const { w, click, button } = await mountBar()
    expect(w.find('[role=toolbar][aria-label=Click]').exists()).toBe(true)
    for (const name of ['Start', 'Slower', 'Faster', 'Tap the tempo', 'Click settings', 'Hide the click']) expect(button(name), name).toBeDefined()
    expect(w.findAll('[data-testid=click-lights] i')).toHaveLength(4)
    click.beat.value = 1
    await nextTick()
    expect(w.findAll('[data-testid=click-lights] i')[1]!.attributes('data-on')).toBeDefined()
    expect(w.text()).toContain('4/4 · Medium up')
  })

  it('steps and clamps the tempo; a bad entry snaps back', async () => {
    const { w, click, button } = await mountBar()
    await button('Faster')!.trigger('click')
    expect(click.tempo.value).toBe(161)
    await button('Slower')!.trigger('click')
    expect(click.tempo.value).toBe(160)
    const field = w.find<HTMLInputElement>('input[aria-label=Tempo]')
    await field.setValue('999')
    await field.trigger('change')
    expect(click.tempo.value).toBe(300)
    await field.setValue('')
    await field.trigger('change')
    expect(click.tempo.value).toBe(300)
    await nextTick()
    expect(field.element.value).toBe('300')
  })

  it('the tempo field’s arrows step it, by 5 with Shift', async () => {
    const { w, click } = await mountBar()
    const field = w.find<HTMLInputElement>('input[aria-label=Tempo]')
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(click.tempo.value).toBe(161)
    await field.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(click.tempo.value).toBe(156)
    await nextTick()
    expect(field.element.value).toBe('156')
  })

  it('starts and stops, pressed while running', async () => {
    const { click, button } = await mountBar()
    await button('Start')!.trigger('click')
    await nextTick()
    expect(click.running.value).toBe(true)
    expect(button('Stop')!.attributes('aria-pressed')).toBe('true')
  })

  it('hides the hat option outside 4/4 and names the subdivision for the feel', async () => {
    const three = await mountBar({ beats: 3, style: 'Jazz waltz', metreChanges: false })
    await three.button('Click settings')!.trigger('click')
    expect(three.w.text()).not.toContain('Hat on 2 & 4')
    expect(three.w.text()).toContain('Skip note')
    three.click.feel.value = 'straight'
    await nextTick()
    expect(three.w.text()).toContain('Eighths')
    const four = await mountBar()
    await four.button('Click settings')!.trigger('click')
    expect(four.w.text()).toContain('Hat on 2 & 4')
  })

  it('docked, the page’s foot clears it until it goes', async () => {
    const { w } = await mountBar()
    expect(document.body.classList.contains('click-docked')).toBe(true)
    w.unmount()
    expect(document.body.classList.contains('click-docked')).toBe(false)
  })

  it('in focus has no ✕ and isn’t fixed to the window', async () => {
    const { w, button } = await mountBar(chart4, 'focus')
    expect(button('Hide the click')).toBeUndefined()
    expect(w.find('[role=toolbar]').classes()).not.toContain('fixed')
  })

  it('notes metre changes and says when sound is unavailable', async () => {
    const { w, click } = await mountBar({ ...chart4, metreChanges: true })
    expect(w.text()).toContain('metre changes play the main metre')
    click.unavailable.value = true
    await nextTick()
    expect(w.text()).toContain('Sound isn’t available in this browser')
  })
})

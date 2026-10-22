import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useClick } from '~/composables/useClick'
import { fakeAudio, timers } from './clickFakes'

const chart = () => ref({ beats: 4 as const, style: 'Medium up', metreChanges: false })

describe('useClick', () => {
  beforeEach(() => localStorage.removeItem('csm-click'))

  it('starts at the style’s tempo and feel, remembers them per chart', () => {
    localStorage.clear()
    const c = useClick(chart(), ref('autumn-leaves'), { audio: fakeAudio })
    expect([c.tempo.value, c.feel.value]).toEqual([160, 'swing'])
    c.tempo.value = 140
    c.feel.value = 'straight'
    const again = useClick(chart(), ref('autumn-leaves'), { audio: fakeAudio })
    expect([again.tempo.value, again.feel.value]).toEqual([140, 'straight'])
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).tempo.value).toBe(160) // a draft: not remembered
  })

  it('books the clicks ahead of the clock, once each', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    await c.start()
    expect(c.running.value).toBe(true)
    t.tick()
    expect(audio.played.map((p) => p.kind)).toEqual(['accent']) // 160 bpm: the next beat is 0.375 s away, past the 0.1 s lookahead
    audio.clock.t = 0.3
    t.tick()
    expect(audio.played).toHaveLength(2)
    await c.start() // idempotent
    t.tick()
    expect(audio.played).toHaveLength(2)
  })

  it('skips what it missed in the background instead of bursting', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    await c.start()
    t.tick()
    audio.clock.t = 30 // the interval didn't run for 30 s
    t.tick()
    expect(audio.played.every((p) => p.time === 0 || p.time >= 30)).toBe(true)
    expect(audio.played.length).toBeLessThanOrEqual(3)
  })

  it('plays the count-in first and lights it', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    c.settings.value = { ...c.settings.value, countIn: 1 }
    await c.start()
    t.tick()
    expect(audio.played[0]?.kind).toBe('count')
    expect(c.counting.value).toBe(true)
    expect(c.beat.value).toBe(0)
  })

  it('stop suspends and clears the beat; dispose closes', async () => {
    const audio = fakeAudio()
    const suspend = vi.spyOn(audio, 'suspend')
    const close = vi.spyOn(audio, 'close')
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...timers() })
    await c.start()
    c.stop()
    expect(suspend).toHaveBeenCalled()
    expect([c.running.value, c.beat.value]).toEqual([false, null])
    c.dispose()
    expect(close).toHaveBeenCalled()
  })

  it('hide stops it; show doesn’t start it', async () => {
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio, ...timers() })
    c.show()
    expect([c.shown.value, c.running.value]).toEqual([true, false])
    await c.start()
    c.hide()
    expect([c.shown.value, c.running.value]).toEqual([false, false])
  })

  it('toggle ignores key repeat; tap sets the tempo', () => {
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio, ...timers() })
    c.toggle(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    expect(c.running.value).toBe(false)
    vi.useFakeTimers()
    for (const ms of [0, 500, 1000]) {
      vi.setSystemTime(ms)
      c.tap()
    }
    vi.useRealTimers()
    expect(c.tempo.value).toBe(120)
  })

  it('is unavailable without WebAudio', async () => {
    const c = useClick(chart(), ref(undefined), { audio: () => null, ...timers() })
    await c.start()
    expect([c.running.value, c.unavailable.value]).toEqual([false, true])
  })

  it('keeps its settings in this browser', () => {
    localStorage.clear()
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio })
    c.settings.value = { subdivision: true, hat: true, countIn: 2, sound: 'beep' }
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value).toEqual({ subdivision: true, hat: true, countIn: 2, sound: 'beep' })
  })
})

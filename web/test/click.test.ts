import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
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
    c.feel.value = 'quarters'
    const again = useClick(chart(), ref('autumn-leaves'), { audio: fakeAudio })
    expect([again.tempo.value, again.feel.value]).toEqual([140, 'quarters'])
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).tempo.value).toBe(160) // a draft: not remembered
  })

  it('books the clicks ahead of the clock, once each', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    c.feel.value = 'quarters'
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
    c.settings.value = { hat: true, countIn: 2, sound: 'beep' }
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value).toEqual({ hat: true, countIn: 2, sound: 'beep' })
  })

  it('back from a hidden tab, books no beat twice', async () => {
    const audio = fakeAudio()
    const t = timers()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    await c.start()
    for (const at of [1, 2, 3.4]) { // the last lookahead ends mid-bar (bars at 0, 1.5, 3, 4.5 s)
      audio.clock.t = at
      t.tick()
    }
    hidden.mockReturnValue(false)
    for (let at = 3.5; at < 5; at += 0.025) {
      audio.clock.t = at // the interval's 25 ms, back in the foreground
      t.tick()
    }
    hidden.mockRestore()
    const times = audio.played.map((p) => p.time)
    expect(times.length).toBe(new Set(times).size)
  })

  it('a chart’s style, edited, moves the tempo it hasn’t been given, and stores nothing', async () => {
    localStorage.removeItem('csm-click:mine:abc')
    const style = ref({ beats: 4 as const, style: 'M', metreChanges: false })
    const c = useClick(style, ref('mine:abc'), { audio: fakeAudio })
    style.value = { ...style.value, style: 'Medium up' }
    await nextTick()
    expect(c.tempo.value).toBe(160)
    expect(localStorage.getItem('csm-click:mine:abc')).toBeNull()
    c.tempo.value = 100
    style.value = { ...style.value, style: 'Ballad' }
    await nextTick()
    expect(c.tempo.value).toBe(100) // the player's tempo stays
  })

  it('a draft keeps the tempo the player set when its style changes', async () => {
    const style = ref({ beats: 4 as const, style: 'Medium', metreChanges: false })
    const c = useClick(style, ref(undefined), { audio: fakeAudio })
    c.tempo.value = 90
    style.value = { ...style.value, style: 'Up' }
    await nextTick()
    expect(c.tempo.value).toBe(90)
  })

  it('a refused resume leaves it stopped and says so', async () => {
    const audio = { ...fakeAudio(), resume: () => Promise.reject(new Error('no')) }
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...timers() })
    await c.start()
    expect([c.running.value, c.unavailable.value]).toEqual([false, true])
  })

  it('Start, Stop and Start again before the audio resumes runs one scheduler', async () => {
    const pending: (() => void)[] = []
    const audio = { ...fakeAudio(), resume: () => new Promise<void>((r) => pending.push(r)) }
    let intervals = 0
    let frames = 0
    const c = useClick(chart(), ref(undefined), { audio: () => audio, setInterval: () => ++intervals, clearInterval: () => {}, raf: () => ++frames })
    const first = c.start()
    c.stop()
    const second = c.start()
    for (const r of pending) r()
    await Promise.all([first, second])
    expect([intervals, frames, c.running.value]).toEqual([1, 1, true])
  })

  it('a swing style plays its skip note from the start; Quarters plays the beats alone', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    await c.start()
    for (const at of [0, 0.2]) {
      audio.clock.t = at
      t.tick()
    }
    expect(audio.played.map((p) => p.kind)).toEqual(['accent', 'sub']) // 160 bpm: the skip note at 0.25 s
    c.feel.value = 'quarters'
    for (const at of [0.4, 0.6, 0.8, 1.0, 1.2, 1.4]) {
      audio.clock.t = at
      t.tick()
    }
    expect(audio.played.slice(2).some((p) => p.kind === 'sub')).toBe(false)
  })
})

import type { InjectionKey, Ref } from 'vue'
import { type Beats, type ClickFeel, type ClickPlan, type ClickState, type TimedClick, clampTempo, defaultFeel, defaultTempo, scheduleClicks, tapTempo } from '@chord-scale-maker/engine'
import { type ClickAudio, type ClickSound, CLICK_SOUNDS, webAudio } from '~/utils/clickSounds'
import { readStored, writeStored } from '~/utils/storage'

/**
 * The click (#254, docs/superpowers/specs/2026-10-21-metronome-design.md): one per song page. The engine says which
 * clicks fall in each lookahead window; this books them on the AudioContext's clock, so a busy page never makes it
 * drift, and lights the beat that is sounding. Tempo and feel are remembered per chart, the rest in this browser.
 */
export type ClickSettings = Readonly<{ subdivision: boolean; hat: boolean; countIn: 0 | 1 | 2; sound: ClickSound }>
export type ClickChart = Readonly<{ beats: Beats; style: string; metreChanges: boolean }>
export type ClickDeps = Readonly<{
  audio?: () => ClickAudio | null
  setInterval?: (fn: () => void, ms: number) => number
  clearInterval?: (id: number) => void
  raf?: (fn: () => void) => number
}>

/** how often the scheduler runs (ms) and how far ahead it books (s): further while the tab is hidden, as browsers slow its timers */
export const LOOKAHEAD = { interval: 25, ahead: 0.1, hiddenAhead: 1.2 } as const

const SETTINGS_KEY = 'csm-click'
const DEFAULT_SETTINGS: ClickSettings = { subdivision: false, hat: false, countIn: 0, sound: 'wood' }

function parseSettings(raw: string | null): ClickSettings {
  try {
    const v = JSON.parse(raw ?? '') as Partial<Record<keyof ClickSettings, unknown>>
    return {
      subdivision: typeof v.subdivision === 'boolean' ? v.subdivision : DEFAULT_SETTINGS.subdivision,
      hat: typeof v.hat === 'boolean' ? v.hat : DEFAULT_SETTINGS.hat,
      countIn: v.countIn === 0 || v.countIn === 1 || v.countIn === 2 ? v.countIn : DEFAULT_SETTINGS.countIn,
      sound: CLICK_SOUNDS.includes(v.sound as ClickSound) ? (v.sound as ClickSound) : DEFAULT_SETTINGS.sound,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** a chart's remembered tempo and feel, if any */
function readChart(key: string | undefined): Readonly<{ tempo?: number; feel?: ClickFeel }> {
  if (!key) return {}
  try {
    const v = JSON.parse(readStored(`${SETTINGS_KEY}:${key}`) ?? '') as Record<string, unknown>
    return {
      tempo: typeof v.tempo === 'number' ? clampTempo(v.tempo) : undefined,
      feel: v.feel === 'swing' || v.feel === 'straight' ? v.feel : undefined,
    }
  } catch {
    return {}
  }
}

export function useClick(chart: Readonly<Ref<ClickChart>>, storageKey: Readonly<Ref<string | undefined>>, deps: ClickDeps = {}) {
  const setTimer = deps.setInterval ?? ((fn, ms) => window.setInterval(fn, ms))
  const clearTimer = deps.clearInterval ?? ((id) => window.clearInterval(id))
  const raf = deps.raf ?? ((fn) => requestAnimationFrame(fn))
  const makeAudio = deps.audio ?? webAudio

  const shown = ref(false)
  const running = ref(false)
  const unavailable = ref(false)
  const beat = ref<number | null>(null)
  const counting = ref(false)
  const settings = ref<ClickSettings>(parseSettings(readStored(SETTINGS_KEY)))
  watch(settings, (s) => writeStored(SETTINGS_KEY, JSON.stringify(s)), { flush: 'sync' })

  const stored = readChart(storageKey.value)
  const tempo = ref(stored.tempo ?? defaultTempo(chart.value.style))
  const feel = ref<ClickFeel>(stored.feel ?? defaultFeel(chart.value.style))
  // a chart's key or style changing (another version, the heading edited): its own, else the style's
  watch([storageKey, () => chart.value.style], ([key, style]) => {
    const s = readChart(key)
    tempo.value = s.tempo ?? defaultTempo(style)
    feel.value = s.feel ?? defaultFeel(style)
  })
  watch(
    [tempo, feel],
    ([t, f]) => {
      if (storageKey.value) writeStored(`${SETTINGS_KEY}:${storageKey.value}`, JSON.stringify({ tempo: t, feel: f }))
    },
    { flush: 'sync' },
  )

  const plan = computed(
    (): ClickPlan => ({
      options: { beats: chart.value.beats, feel: feel.value, subdivision: settings.value.subdivision, hat: settings.value.hat },
      tempo: clampTempo(tempo.value),
      countIn: settings.value.countIn,
    }),
  )

  let audio: ClickAudio | null = null
  let timer: number | null = null
  let state: ClickState = { barStart: 0, bar: 0 }
  let booked = 0 // the audio clock's time booked up to
  let recent: readonly TimedClick[] = [] // booked clicks the lights still need (the beats, not the hat or the subdivision)

  function lights(): void {
    if (!audio || !running.value) return
    const now = audio.now()
    const sounding = recent.filter((e) => e.time <= now).at(-1)
    beat.value = sounding?.beat ?? null
    counting.value = sounding?.kind === 'count'
  }

  function schedule(): void {
    if (!audio) return
    const now = audio.now()
    const hidden = typeof document !== 'undefined' && document.hidden
    const until = now + (hidden ? LOOKAHEAD.hiddenAhead : LOOKAHEAD.ahead)
    const next = scheduleClicks(plan.value, state, Math.max(booked, now), until)
    for (const e of next.events) audio.play(e.kind, e.time, settings.value.sound)
    state = next.state
    booked = until
    const beats = next.events.filter((e) => e.kind !== 'hat' && e.kind !== 'sub')
    recent = [...recent.filter((e) => e.time > now - 2), ...beats]
    lights()
  }

  function frame(): void {
    if (!running.value) return
    lights()
    raf(frame)
  }

  async function start(): Promise<void> {
    if (running.value) return
    audio ??= makeAudio()
    if (!audio) {
      unavailable.value = true
      return
    }
    running.value = true
    await audio.resume()
    if (!running.value) return // stopped while resuming
    state = { barStart: audio.now(), bar: 0 }
    booked = audio.now()
    recent = []
    schedule()
    timer = setTimer(schedule, LOOKAHEAD.interval)
    raf(frame)
  }

  function stop(): void {
    if (timer !== null) clearTimer(timer)
    timer = null
    running.value = false
    beat.value = null
    counting.value = false
    void audio?.suspend()
  }

  /** Start or Stop; a held key's repeats do nothing */
  function toggle(e?: KeyboardEvent): void {
    if (e?.repeat) return
    if (running.value) stop()
    else void start()
  }

  let taps: number[] = []
  function tap(): void {
    taps = [...taps, Date.now()].slice(-8)
    const t = tapTempo(taps)
    if (t !== null) tempo.value = t
  }

  const show = (): void => {
    shown.value = true
  }
  function hide(): void {
    stop()
    shown.value = false
  }
  function dispose(): void {
    stop()
    void audio?.close()
    audio = null
  }

  return { shown, running, unavailable, tempo, feel, settings, beat, counting, start, stop, toggle, tap, show, hide, dispose }
}

export type Click = ReturnType<typeof useClick>

/** the song page's click, for its bars (ClickBar) */
export const CLICK: InjectionKey<Click> = Symbol('click')

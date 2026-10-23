import type { InjectionKey, Ref } from 'vue'
import { type Beats, type ClickFeel, type ClickPattern, type ClickPlan, type ClickState, type Feel, type TimedClick, type VoiceNote, CLICK_PATTERNS, clampTempo, defaultFeel, defaultPattern, defaultTempo, scheduleClicks, scheduleVoice, tapTempo } from '@chord-scale-maker/engine'
import { type ClickAudio, type ClickSound, CLICK_SOUNDS, webAudio } from '~/utils/clickSounds'
import { readStored, writeStored } from '~/utils/storage'

/**
 * The click (#254, docs/superpowers/specs/2026-10-21-metronome-design.md): one per song page. The engine says which
 * clicks fall in each lookahead window; this books them on the AudioContext's clock, so a busy page never makes it
 * drift, and lights the beat that is sounding. Tempo, feel and Click on are remembered per chart, the rest in this browser.
 * With Hear line on, the Changes sheet's Line (setLine) sounds with it, from the same clock (#507).
 */
/** folded: the bar shows only Start/Stop, the tempo and the lights; hear: Hear line, the Line sounds with the click */
export type ClickSettings = Readonly<{ hat: boolean; countIn: 0 | 1 | 2; sound: ClickSound; folded: boolean; hear: boolean }>
/** the Line to hear: its notes and the drawn bars it loops over */
export type ClickLine = Readonly<{ notes: readonly VoiceNote[]; bars: number }>
/** rhythmFeel: the sheet's Feel, which Click on follows until it's set (in 4 when left out) */
export type ClickChart = Readonly<{ beats: Beats; style: string; metreChanges: boolean; rhythmFeel?: Feel }>
export type ClickDeps = Readonly<{
  audio?: () => ClickAudio | null
  setInterval?: (fn: () => void, ms: number) => number
  clearInterval?: (id: number) => void
  raf?: (fn: () => void) => number
}>

/** how often the scheduler runs (ms) and how far ahead it books (s): further while the tab is hidden, as browsers slow its timers */
export const LOOKAHEAD = { interval: 25, ahead: 0.1, hiddenAhead: 1.2 } as const

const SETTINGS_KEY = 'csm-click'
const DEFAULT_SETTINGS: ClickSettings = { hat: false, countIn: 0, sound: 'wood', folded: false, hear: false }

function parseSettings(raw: string | null): ClickSettings {
  try {
    const v = JSON.parse(raw ?? '') as Partial<Record<keyof ClickSettings, unknown>>
    return {
      hat: typeof v.hat === 'boolean' ? v.hat : DEFAULT_SETTINGS.hat,
      countIn: v.countIn === 0 || v.countIn === 1 || v.countIn === 2 ? v.countIn : DEFAULT_SETTINGS.countIn,
      sound: CLICK_SOUNDS.includes(v.sound as ClickSound) ? (v.sound as ClickSound) : DEFAULT_SETTINGS.sound,
      folded: typeof v.folded === 'boolean' ? v.folded : DEFAULT_SETTINGS.folded,
      hear: typeof v.hear === 'boolean' ? v.hear : DEFAULT_SETTINGS.hear,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

type Chosen = Readonly<{ tempo?: number; feel?: ClickFeel; pattern?: ClickPattern }>

/** a chart's remembered tempo, feel and Click on, if any */
function readChart(key: string | undefined): Chosen {
  if (!key) return {}
  try {
    const v = JSON.parse(readStored(`${SETTINGS_KEY}:${key}`) ?? '') as Record<string, unknown>
    return {
      tempo: typeof v.tempo === 'number' ? clampTempo(v.tempo) : undefined,
      feel: v.feel === 'quarters' || v.feel === 'swing' || v.feel === 'straight' ? v.feel : undefined,
      pattern: CLICK_PATTERNS.includes(v.pattern as ClickPattern) ? (v.pattern as ClickPattern) : undefined,
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
  const rhythmFeel = (): Feel => chart.value.rhythmFeel ?? 4
  const pattern = ref<ClickPattern>(stored.pattern ?? defaultPattern(rhythmFeel()))
  // only what the player sets is stored: a tempo and feel still the style's follow the style as it's edited, and a
  // Click on still the Feel's follows the Feel
  let chosen = stored.tempo !== undefined || stored.feel !== undefined
  let patternChosen = stored.pattern !== undefined
  let following = false // the style's or the Feel's own values being applied, not the player's
  function follow(set: () => void): void {
    following = true
    set()
    following = false
  }
  // another chart (its key): its own, else its style's; the style edited: the style's, unless the player chose
  watch([storageKey, () => chart.value.style], ([key, style], [oldKey]) => {
    if (key !== oldKey) {
      const s = readChart(key)
      chosen = s.tempo !== undefined || s.feel !== undefined
      patternChosen = s.pattern !== undefined
      follow(() => {
        tempo.value = s.tempo ?? defaultTempo(style)
        feel.value = s.feel ?? defaultFeel(style)
        pattern.value = s.pattern ?? defaultPattern(rhythmFeel())
      })
    } else if (!chosen)
      follow(() => {
        tempo.value = defaultTempo(style)
        feel.value = defaultFeel(style)
      })
  })
  watch(rhythmFeel, (f) => {
    if (!patternChosen) follow(() => (pattern.value = defaultPattern(f)))
  })
  function store(): void {
    if (!storageKey.value) return
    const v: Chosen = { ...(chosen ? { tempo: tempo.value, feel: feel.value } : {}), ...(patternChosen ? { pattern: pattern.value } : {}) }
    writeStored(`${SETTINGS_KEY}:${storageKey.value}`, JSON.stringify(v))
  }
  watch(
    [tempo, feel],
    () => {
      if (following) return
      chosen = true
      store()
    },
    { flush: 'sync' },
  )
  watch(
    pattern,
    () => {
      if (following) return
      patternChosen = true
      store()
    },
    { flush: 'sync' },
  )

  const plan = computed(
    (): ClickPlan => ({
      options: { beats: chart.value.beats, feel: feel.value, hat: settings.value.hat, pattern: pattern.value },
      tempo: clampTempo(tempo.value),
      countIn: settings.value.countIn,
    }),
  )

  const line = shallowRef<ClickLine | null>(null)
  const hasLine = computed(() => !!line.value?.notes.length)
  /** the Changes sheet's Line, or null with none drawn (another sheet, the Line off) */
  const setLine = (l: ClickLine | null): void => {
    line.value = l
  }

  let audio: ClickAudio | null = null
  let timer: number | null = null
  let state: ClickState = { barStart: 0, bar: 0 }
  let booked = 0 // the audio clock's time booked up to
  let recent: readonly TimedClick[] = [] // booked clicks the lights still need (the beats and ticks, not the hat or the note between them)
  let run = 0 // each start and stop: a start whose resume settles after another start or a stop gives way

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
    const from = Math.max(booked, now)
    const next = scheduleClicks(plan.value, state, from, until)
    for (const e of next.events) if (e.kind !== 'tick') audio.play(e.kind, e.time, settings.value.sound)
    if (settings.value.hear && line.value) for (const n of scheduleVoice(line.value.notes, line.value.bars, plan.value, state, from, until)) audio.note(n.midi, n.time, n.length)
    state = next.state
    booked = Math.max(booked, until) // a shorter lookahead (the tab shown again) mustn't reopen what's booked
    const beats = next.events.filter((e) => e.kind !== 'hat' && e.kind !== 'sub') // a pattern's ticks light the beats it leaves silent
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
    const mine = ++run
    try {
      await audio.resume()
    } catch {
      if (mine !== run) return
      running.value = false // refused (closed under it, or the browser said no): stopped, and said so
      unavailable.value = true
      return
    }
    if (mine !== run) return // stopped, or started again, while resuming
    state = { barStart: audio.now(), bar: 0 }
    booked = audio.now()
    recent = []
    schedule()
    timer = setTimer(schedule, LOOKAHEAD.interval)
    raf(frame)
  }

  function stop(): void {
    run++
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

  return { shown, running, unavailable, tempo, feel, pattern, settings, beat, counting, hasLine, setLine, start, stop, toggle, tap, show, hide, dispose }
}

export type Click = ReturnType<typeof useClick>

/** the song page's click, for its bars (ClickBar) */
export const CLICK: InjectionKey<Click> = Symbol('click')

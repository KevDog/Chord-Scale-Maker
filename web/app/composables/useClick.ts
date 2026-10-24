import type { InjectionKey, Ref } from 'vue'
import { type BassStyle, type Beats, type ClickFeel, type ClickForm, type ClickPattern, type ClickPlan, type ClickState, type Feel, type PhraseNote, type RhythmHit, type TimedClick, type VoiceNote, CLICK_PATTERNS, clampSwing, clampTempo, defaultFeel, defaultPattern, defaultTempo, formBar, SWING, scheduleClicks, scheduleRhythm, scheduleVoice, tapTempo, timePhrase } from '@chord-scale-maker/engine'
import { type ClickAudio, type ClickSound, CLICK_SOUNDS, webAudio } from '~/utils/clickSounds'
import { readStored, writeStored } from '~/utils/storage'

/**
 * The click (#254, docs/superpowers/specs/2026-10-21-metronome-design.md): one per song page. The engine says which
 * clicks fall in each lookahead window; this books them on the AudioContext's clock, so a busy page never makes it
 * drift, and lights the beat that is sounding. Tempo, feel, Click on and the swing dial are remembered per chart, the rest in this browser.
 * With Hear line on, the Changes sheet's Line (setLine) sounds with it, from the same clock (#507), and with Hear
 * rhythm on its rhythm's attacks (setRhythm) on a rim (#521), both following the form as played, each bar in its own
 * meter (setForm, #559); a staff's Play
 * (play) sounds its phrase at the click's tempo and feel, on the click's next bar while it runs, else at once.
 */
/**
 * folded: the bar shows only Start/Stop, the tempo and the lights; hear: Hear line, the Line sounds with the click;
 * hearRhythm: Hear rhythm, its rhythm taps with it; piano, bass: Hear changes (#508), the chart's voicings and its bass
 */
export type ClickSettings = Readonly<{ hat: boolean; countIn: 0 | 1 | 2; sound: ClickSound; folded: boolean; hear: boolean; hearRhythm: boolean; piano: boolean; bass: ClickBass }>
export type ClickBass = 'off' | BassStyle
export const CLICK_BASSES: readonly ClickBass[] = ['off', 'roots', 'two']
/** the changes to hear (#508): the piano's voicings, the bass in roots and in two, and the drawn bars they loop over */
export type ClickHarmony = Readonly<{ piano: readonly VoiceNote[]; roots: readonly VoiceNote[]; two: readonly VoiceNote[]; bars: number }>
/** the Line to hear: its notes and the drawn bars it loops over */
export type ClickLine = Readonly<{ notes: readonly VoiceNote[]; bars: number }>
/** the rhythm to hear: its attacks and the drawn bars it loops over */
export type ClickRhythm = Readonly<{ hits: readonly RhythmHit[]; bars: number }>
/** rhythmFeel: the sheet's Feel, which Click on follows until it's set (in 4 when left out) */
export type ClickChart = Readonly<{ beats: Beats; style: string; metreChanges: boolean; rhythmFeel?: Feel }>
export type ClickDeps = Readonly<{
  audio?: () => ClickAudio | null
  setInterval?: (fn: () => void, ms: number) => number
  clearInterval?: (id: number) => void
  setTimeout?: (fn: () => void, ms: number) => number
  clearTimeout?: (id: number) => void
  raf?: (fn: () => void) => number
}>

/** a Play with the click stopped starts this far ahead (s), so its first note isn't clipped */
const PHRASE_LEAD = 0.05
/** the longest a Play, or a Start with Hear line on, waits for the lead's samples (ms); past it the synthesized lead stands in */
export const LEAD_BOUND = 1000

/** the lead's samples (#538), or the bound, whichever comes first */
const leadReady = (audio: ClickAudio): Promise<unknown> => ready(audio.loadLead())
/** a set's samples, or the bound */
const ready = (load: Promise<boolean>): Promise<unknown> => Promise.race([load, new Promise((r) => setTimeout(r, LEAD_BOUND))])

/** how often the scheduler runs (ms) and how far ahead it books (s): further while the tab is hidden, as browsers slow its timers */
export const LOOKAHEAD = { interval: 25, ahead: 0.1, hiddenAhead: 1.2 } as const

const SETTINGS_KEY = 'csm-click'
const DEFAULT_SETTINGS: ClickSettings = { hat: false, countIn: 0, sound: 'wood', folded: false, hear: false, hearRhythm: true, piano: false, bass: 'off' }

function parseSettings(raw: string | null): ClickSettings {
  try {
    const v = JSON.parse(raw ?? '') as Partial<Record<keyof ClickSettings, unknown>>
    return {
      hat: typeof v.hat === 'boolean' ? v.hat : DEFAULT_SETTINGS.hat,
      countIn: v.countIn === 0 || v.countIn === 1 || v.countIn === 2 ? v.countIn : DEFAULT_SETTINGS.countIn,
      sound: CLICK_SOUNDS.includes(v.sound as ClickSound) ? (v.sound as ClickSound) : DEFAULT_SETTINGS.sound,
      folded: typeof v.folded === 'boolean' ? v.folded : DEFAULT_SETTINGS.folded,
      hear: typeof v.hear === 'boolean' ? v.hear : DEFAULT_SETTINGS.hear,
      hearRhythm: typeof v.hearRhythm === 'boolean' ? v.hearRhythm : DEFAULT_SETTINGS.hearRhythm,
      piano: typeof v.piano === 'boolean' ? v.piano : DEFAULT_SETTINGS.piano,
      bass: CLICK_BASSES.includes(v.bass as ClickBass) ? (v.bass as ClickBass) : DEFAULT_SETTINGS.bass,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

type Chosen = Readonly<{ tempo?: number; feel?: ClickFeel; pattern?: ClickPattern; swing?: number }>

/** a chart's remembered tempo, feel, Click on and swing, if any */
function readChart(key: string | undefined): Chosen {
  if (!key) return {}
  try {
    const v = JSON.parse(readStored(`${SETTINGS_KEY}:${key}`) ?? '') as Record<string, unknown>
    return {
      tempo: typeof v.tempo === 'number' ? clampTempo(v.tempo) : undefined,
      feel: v.feel === 'quarters' || v.feel === 'swing' || v.feel === 'straight' ? v.feel : undefined,
      pattern: CLICK_PATTERNS.includes(v.pattern as ClickPattern) ? (v.pattern as ClickPattern) : undefined,
      swing: typeof v.swing === 'number' ? clampSwing(v.swing) : undefined,
    }
  } catch {
    return {}
  }
}

export function useClick(chart: Readonly<Ref<ClickChart>>, storageKey: Readonly<Ref<string | undefined>>, deps: ClickDeps = {}) {
  const setTimer = deps.setInterval ?? ((fn, ms) => window.setInterval(fn, ms))
  const clearTimer = deps.clearInterval ?? ((id) => window.clearInterval(id))
  const setEnd = deps.setTimeout ?? ((fn, ms) => window.setTimeout(fn, ms))
  const clearEnd = deps.clearTimeout ?? ((id) => window.clearTimeout(id))
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
  const swing = ref(stored.swing ?? SWING.fallback)
  // only what the player sets is stored: a tempo and feel still the style's follow the style as it's edited, and a
  // Click on still the Feel's follows the Feel
  let chosen = stored.tempo !== undefined || stored.feel !== undefined
  let patternChosen = stored.pattern !== undefined
  let swingChosen = stored.swing !== undefined
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
      swingChosen = s.swing !== undefined
      follow(() => {
        tempo.value = s.tempo ?? defaultTempo(style)
        feel.value = s.feel ?? defaultFeel(style)
        pattern.value = s.pattern ?? defaultPattern(rhythmFeel())
        swing.value = s.swing ?? SWING.fallback
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
    const v: Chosen = {
      ...(chosen ? { tempo: tempo.value, feel: feel.value } : {}),
      ...(patternChosen ? { pattern: pattern.value } : {}),
      ...(swingChosen ? { swing: clampSwing(swing.value) } : {}),
    }
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
  watch(
    swing,
    () => {
      if (following) return
      swingChosen = true
      store()
    },
    { flush: 'sync' },
  )

  const form = shallowRef<ClickForm | null>(null)
  const hasForm = computed(() => !!form.value?.order.length)
  /** the Changes sheet's form as played (playOrder), or null with none: every bar the main meter */
  const setForm = (f: ClickForm | null): void => {
    form.value = f
  }

  const plan = computed(
    (): ClickPlan => ({
      options: { beats: chart.value.beats, feel: feel.value, hat: settings.value.hat, pattern: pattern.value, swing: clampSwing(swing.value) },
      tempo: clampTempo(tempo.value),
      countIn: settings.value.countIn,
      ...(form.value ? { form: form.value } : {}),
    }),
  )

  const line = shallowRef<ClickLine | null>(null)
  const hasLine = computed(() => !!line.value?.notes.length)
  /** the Changes sheet's Line, or null with none drawn (another sheet, the Line off) */
  const setLine = (l: ClickLine | null): void => {
    line.value = l
  }
  const rhythm = shallowRef<ClickRhythm | null>(null)
  const hasRhythm = computed(() => !!rhythm.value?.hits.length)
  /** the Changes sheet's rhythm as drawn, or null with none */
  const setRhythm = (r: ClickRhythm | null): void => {
    rhythm.value = r
  }

  const harmony = shallowRef<ClickHarmony | null>(null)
  const hasHarmony = computed(() => !!harmony.value?.piano.length || !!harmony.value?.roots.length)
  /** the Changes sheet's changes, or null with none (another sheet) */
  const setHarmony = (h: ClickHarmony | null): void => {
    harmony.value = h
  }
  const hearsHarmony = (): boolean => settings.value.piano || settings.value.bass !== 'off'

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
    const h = harmony.value
    if (h && settings.value.piano) for (const n of scheduleVoice(h.piano, h.bars, plan.value, state, from, until)) audio.comp(n.midi, n.time, n.length)
    if (h && settings.value.bass !== 'off') for (const n of scheduleVoice(settings.value.bass === 'two' ? h.two : h.roots, h.bars, plan.value, state, from, until)) audio.bass(n.midi, n.time, n.length)
    if (settings.value.hearRhythm && rhythm.value) for (const h of scheduleRhythm(rhythm.value.hits, rhythm.value.bars, plan.value, state, from, until)) audio.hit(h.time, h.accent)
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
    if (settings.value.hear || hearsHarmony()) {
      await Promise.all([settings.value.hear ? leadReady(audio) : null, hearsHarmony() ? ready(audio.loadHarmony()) : null])
      if (mine !== run) return
    }
    state = { barStart: audio.now(), bar: 0 }
    booked = audio.now()
    recent = []
    schedule()
    timer = setTimer(schedule, LOOKAHEAD.interval)
    raf(frame)
  }

  const playing = ref<string | null>(null)
  let phraseStops: readonly (() => void)[] = []
  let phraseEnd: number | null = null
  let phraseRun = 0 // each Play and Stop: a Play whose resume settles after another gives way

  /** silence the phrase sounding, if any */
  function stopPhrase(): void {
    phraseRun++
    for (const s of phraseStops) s()
    phraseStops = []
    if (phraseEnd !== null) clearEnd(phraseEnd)
    phraseEnd = null
    playing.value = null
  }

  /** a staff's Play (#507): its phrase, alone; one at a time */
  async function play(id: string, phrase: readonly PhraseNote[]): Promise<void> {
    stopPhrase()
    audio ??= makeAudio()
    if (!audio) {
      unavailable.value = true
      return
    }
    const mine = phraseRun
    playing.value = id
    if (!running.value) {
      try {
        await audio.resume()
      } catch {
        if (mine !== phraseRun) return
        playing.value = null
        unavailable.value = true
        return
      }
      if (mine !== phraseRun) return
    }
    await leadReady(audio)
    if (mine !== phraseRun) return
    const now = audio.now()
    const bar = (formBar(plan.value, state.bar).beats * 60) / plan.value.tempo
    const next = state.barStart > now ? state.barStart : state.barStart + bar
    const start = running.value ? next : now + PHRASE_LEAD
    const notes = timePhrase(phrase, plan.value.tempo, feel.value, start, plan.value.options.swing)
    const a = audio
    phraseStops = notes.map((n) => a.note(n.midi, n.time, n.length))
    const end = Math.max(...notes.map((n) => n.time + n.length), start)
    phraseEnd = setEnd(() => {
      phraseStops = []
      phraseEnd = null
      playing.value = null
      if (!running.value) void audio?.suspend()
    }, (end - now) * 1000)
  }

  // Hear line turned on with the click running: its lead's samples, for the notes booked once they're in
  watch(
    () => settings.value.hear,
    (hear) => {
      if (hear && running.value && audio) void audio.loadLead()
    },
  )
  watch(
    hearsHarmony,
    (on) => {
      if (on && running.value && audio) void audio.loadHarmony()
    },
    { flush: 'sync' },
  )

  function stop(): void {
    stopPhrase()
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

  return { shown, running, unavailable, tempo, feel, pattern, swing, settings, beat, counting, hasLine, setLine, hasRhythm, setRhythm, hasHarmony, setHarmony, hasForm, setForm, playing, play, stopPhrase, start, stop, toggle, tap, show, hide, dispose }
}

export type Click = ReturnType<typeof useClick>

/** the song page's click, for its bars (ClickBar) */
export const CLICK: InjectionKey<Click> = Symbol('click')

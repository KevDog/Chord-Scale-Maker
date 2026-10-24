import type { ClickKind, DrumKind } from '@chord-scale-maker/engine'
import { loadSample } from '~/utils/sampleLoader'
import { type SampleSet, type Sampler, loadSampler } from '~/utils/sampler'

/**
 * The click's sounds (#254), Wood and Beep synthesized, Stick recorded (#536) and Wood until its one-shots load; Hear
 * rhythm's rim (#521), synthesized; Hear line's lead (#507) a sampled piano (#538),
 * synthesized until its samples load or if they fail. The samples are this site's own files, so no CSP change. With
 * sampler.ts the only files that build audio nodes; useClick books through a ClickAudio, which tests replace with a fake.
 */
export type ClickSound = 'wood' | 'beep' | 'stick'
export const CLICK_SOUNDS: readonly ClickSound[] = ['wood', 'beep', 'stick']

export type ClickAudio = Readonly<{
  /** the audio clock, in seconds */
  now: () => number
  play: (kind: ClickKind, time: number, sound: ClickSound) => void
  /** Hear line's lead: a note at midi (concert pitch), from time for length seconds; call what it returns to stop it */
  note: (midi: number, time: number, length: number) => () => void
  /** Hear rhythm's rim: an attack of the rhythm at time, louder accented */
  hit: (time: number, accent: boolean) => void
  /** a click sound's recordings, fetched once: true once they play (Wood and Beep have none), false if any couldn't load */
  load: (sound: ClickSound) => Promise<boolean>
  /** the lead's samples, fetched once: true once they play, false if they couldn't load (the synthesized lead plays on) */
  loadLead: () => Promise<boolean>
  /** Hear changes' piano and bass (#508): a note at midi (concert pitch), from time for length seconds; call what it returns to stop it */
  comp: (midi: number, time: number, length: number) => () => void
  bass: (midi: number, time: number, length: number) => () => void
  /** the piano's and the bass's samples, as loadLead loads the lead's */
  loadHarmony: () => Promise<boolean>
  /** a pattern set's drum (#540) at time, its velocity 0 to 1 */
  drum: (kind: DrumKind, time: number, velocity: number) => void
  /** the kit's samples, as loadLead loads the lead's (the brushes need none) */
  loadDrums: () => Promise<boolean>
  resume: () => Promise<void>
  suspend: () => Promise<void>
  close: () => Promise<void>
}>

const PITCH: Readonly<Record<Exclude<ClickSound, 'stick'>, Readonly<{ wave: OscillatorType; accent: number; beat: number }>>> = {
  wood: { wave: 'triangle', accent: 1800, beat: 1200 },
  beep: { wave: 'sine', accent: 1320, beat: 880 },
}
const PEAK: Readonly<Record<Exclude<ClickKind, 'hat' | 'tick'>, number>> = { accent: 1, beat: 0.8, count: 0.8, sub: 0.3 }
const DECAY = 0.06 // s
const HAT = { length: 0.03, cutoff: 6000, gain: 0.4 } as const

/** the hat's noise: made once a context, played from its own source each hit */
const noises = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseFor(ctx: BaseAudioContext): AudioBuffer {
  const made = noises.get(ctx)
  if (made) return made
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * HAT.length), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noises.set(ctx, buffer)
  return buffer
}

/** one click at `time` on the context's clock, into `out`; a tick (the lights' silent beat) none */
export function playClick(ctx: AudioContext, out: AudioNode, kind: ClickKind, time: number, sound: Exclude<ClickSound, 'stick'>): void {
  if (kind === 'tick') return
  const env = ctx.createGain()
  env.connect(out)
  if (kind === 'hat') {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseFor(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = HAT.cutoff
    env.gain.setValueAtTime(HAT.gain, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + HAT.length)
    noise.connect(filter).connect(env)
    noise.start(time)
    return
  }
  const p = PITCH[sound]
  const osc = ctx.createOscillator()
  osc.type = p.wave
  osc.frequency.value = kind === 'accent' ? p.accent : p.beat
  env.gain.setValueAtTime(PEAK[kind], time)
  env.gain.exponentialRampToValueAtTime(0.001, time + DECAY)
  osc.connect(env)
  osc.start(time)
  osc.stop(time + DECAY + 0.02)
}

type Hit = Exclude<ClickKind, 'tick'>
/**
 * Stick (#536): VSCO 2 CE's percussion, one-shots for the accent, the beat and the hat (design/sounds/README.md); the
 * count-in and the subdivisions play the beat's, the subdivisions quieter
 */
export const STICK_SET = {
  base: '/sounds/stick/',
  files: { accent: 'accent.wav', beat: 'beat.wav', hat: 'hat.wav' },
  peak: { accent: 1, beat: 0.8, count: 0.8, sub: 0.35, hat: 0.5 } satisfies Record<Hit, number>,
} as const
const STICK_FILE: Readonly<Record<Hit, keyof typeof STICK_SET.files>> = { accent: 'accent', beat: 'beat', count: 'beat', sub: 'beat', hat: 'hat' }
type StickBuffers = Partial<Record<keyof typeof STICK_SET.files, AudioBuffer>>

/** Stick's one-shots for a context: each kept once it loads; a failed one is asked for again on the next load */
function lazyStick(ctx: AudioContext) {
  const buffers: StickBuffers = {}
  let loading: Promise<boolean> | null = null
  const load = async (): Promise<boolean> => {
    const names = Object.keys(STICK_SET.files) as (keyof typeof STICK_SET.files)[]
    const results = await Promise.all(names.map((n) => loadSample(ctx, STICK_SET.base + STICK_SET.files[n])))
    results.forEach((r, i) => {
      if (r.ok) buffers[names[i]!] = r.buffer
    })
    return results.every((r) => r.ok)
  }
  return {
    buffers,
    load: (): Promise<boolean> =>
      (loading ??= load().then((ok) => {
        if (!ok) loading = null
        return ok
      })),
  }
}

/** a Stick hit: its one-shot, or Wood's where that hasn't loaded */
export function playStick(ctx: AudioContext, out: AudioNode, buffers: StickBuffers, kind: ClickKind, time: number): void {
  if (kind === 'tick') return
  const buffer = buffers[STICK_FILE[kind]]
  if (!buffer) return playClick(ctx, out, kind, time, 'wood')
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = STICK_SET.peak[kind]
  source.connect(gain).connect(out)
  source.start(time)
}

const RIM = { length: 0.025, centre: 1800, q: 8, accent: 0.7, beat: 0.45 } as const

/** Hear rhythm's rim (#521): the hat's noise through a narrow band-pass, a short knock unlike either click */
export function playRim(ctx: AudioContext, out: AudioNode, time: number, accent: boolean): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseFor(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = RIM.centre
  filter.Q.value = RIM.q
  const env = ctx.createGain()
  env.gain.setValueAtTime(accent ? RIM.accent : RIM.beat, time)
  env.gain.exponentialRampToValueAtTime(0.001, time + RIM.length)
  noise.connect(filter).connect(env).connect(out)
  noise.start(time)
}

const LEAD = { peak: 0.35, attack: 0.01, release: 0.06, held: 0.9, cutoff: 2400 } as const

/**
 * Hear line's lead (#507): a triangle and a quieter sine an octave up through a low-pass, a short attack and release,
 * held for most of the note so a repeated note is heard again; what it returns fades it out at once (a Stop)
 */
export function playNote(ctx: AudioContext, out: AudioNode, midi: number, time: number, length: number, peak: number = LEAD.peak): () => void {
  const freq = 440 * 2 ** ((midi - 69) / 12)
  const end = time + Math.max(length * LEAD.held, LEAD.attack + 0.02)
  const env = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = LEAD.cutoff
  filter.connect(env).connect(out)
  env.gain.setValueAtTime(0, time)
  env.gain.linearRampToValueAtTime(peak, time + LEAD.attack)
  env.gain.setValueAtTime(peak, end)
  env.gain.linearRampToValueAtTime(0, end + LEAD.release)
  for (const [wave, mult, level] of [['triangle', 1, 1], ['sine', 2, 0.25]] as const) {
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = freq * mult
    const gain = ctx.createGain()
    gain.gain.value = level
    osc.connect(gain).connect(filter)
    osc.start(time)
    osc.stop(end + LEAD.release + 0.02)
  }
  return () => {
    env.gain.cancelScheduledValues(ctx.currentTime)
    env.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
  }
}

/**
 * Hear line's lead (#538): VSCO 2 CE's Upright Piano, its second dynamic, a sample every major third from A1 to F6
 * (design/sounds/README.md); below and above, the outermost shifted
 */
export const LEAD_SET: SampleSet = {
  base: '/sounds/piano/',
  layers: [{ upTo: 1, zones: Array.from({ length: 15 }, (_, i) => 33 + 4 * i).map((midi) => ({ midi, file: `${midi}.wav` })) }],
  release: 0.12,
  voices: 8,
  gain: 0.7,
}

/** Hear changes' piano (#539): the same Upright Piano, its softest dynamic, A2 to A5 every major third, longer for held chords */
export const COMP_SET: SampleSet = {
  base: '/sounds/comp/',
  layers: [{ upTo: 1, zones: Array.from({ length: 10 }, (_, i) => 45 + 4 * i).map((midi) => ({ midi, file: `${midi}.wav` })) }],
  release: 0.2,
  voices: 12,
  gain: 0.35,
}

/** Hear changes' bass (#539): VSCO 2 CE's Solo Contrabass, pizzicato, E1 to E3 */
export const BASS_SET: SampleSet = {
  base: '/sounds/bass/',
  layers: [{ upTo: 1, zones: [28, 30, 31, 34, 36, 38, 40, 42, 44, 45, 49, 52].map((midi) => ({ midi, file: `${midi}.wav` })) }],
  release: 0.08,
  voices: 2,
  gain: 0.9,
}
/** the synthesized stand-ins' peaks: four piano notes at once, and a bass under them */
const STAND_IN = { comp: 0.08, bass: 0.3 } as const

/**
 * the kit (#540): VCSL's recordings (CC0; design/sounds/README.md), a soft ride below half velocity; the brushes
 * synthesized from the hat's noise (VCSL has no brushes). gain: at full velocity
 */
export const DRUM_KIT: Readonly<Record<DrumKind, Readonly<{ file: string | null; soft?: string; gain: number }>>> = {
  ride: { file: 'ride.wav', soft: 'ride-soft.wav', gain: 0.45 },
  bell: { file: 'bell.wav', gain: 0.35 },
  hat: { file: 'hat.wav', gain: 0.4 },
  tip: { file: 'hat-tip.wav', gain: 0.3 },
  open: { file: 'hat-open.wav', gain: 0.3 },
  stick: { file: 'stick.wav', gain: 0.45 },
  kick: { file: 'kick.wav', gain: 0.5 },
  sweep: { file: null, gain: 0.12 },
  brush: { file: null, gain: 0.3 },
}
const DRUM_FILES = [...new Set(Object.values(DRUM_KIT).flatMap((d) => [d.file, d.soft].filter((f): f is string => !!f)))]

/** a brush (#540): the hat's noise through a band-pass, swept (a long swell and fade) or tapped (a short burst) */
function playBrush(ctx: AudioContext, out: AudioNode, time: number, peak: number, swept: boolean): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseFor(ctx)
  noise.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = swept ? 2500 : 3500
  filter.Q.value = swept ? 0.7 : 1.2
  const env = ctx.createGain()
  const length = swept ? 0.45 : 0.08
  env.gain.setValueAtTime(0.0001, time)
  env.gain.exponentialRampToValueAtTime(peak, time + (swept ? 0.2 : 0.004))
  env.gain.exponentialRampToValueAtTime(0.0001, time + length)
  noise.connect(filter).connect(env).connect(out)
  noise.start(time)
  noise.stop(time + length + 0.02)
}

/** a kit voice synthesized, while its sample loads or if it fails: a cymbal or hat as the hat's noise, a stick as the rim, a kick a falling sine */
function playDrumStandIn(ctx: AudioContext, out: AudioNode, kind: DrumKind, time: number, peak: number): void {
  if (kind === 'stick') return playRim(ctx, out, time, peak > 0.3)
  if (kind === 'kick') {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.frequency.setValueAtTime(110, time)
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12)
    env.gain.setValueAtTime(peak, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.25)
    osc.connect(env).connect(out)
    osc.start(time)
    osc.stop(time + 0.3)
    return
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseFor(ctx)
  noise.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = kind === 'hat' ? HAT.cutoff : 8000
  const env = ctx.createGain()
  const length = kind === 'ride' || kind === 'bell' || kind === 'open' ? 0.4 : HAT.length
  env.gain.setValueAtTime(peak, time)
  env.gain.exponentialRampToValueAtTime(0.001, time + length)
  noise.connect(filter).connect(env).connect(out)
  noise.start(time)
  noise.stop(time + length + 0.02)
}

/** a set's sampler, loaded once a context; a failure is forgotten, so the next play tries again */
function lazySampler(ctx: AudioContext, out: AudioNode, set: SampleSet) {
  let sampler: Sampler | null = null
  let loading: Promise<boolean> | null = null
  return {
    get: () => sampler,
    load: (): Promise<boolean> =>
      (loading ??= loadSampler(ctx, out, set).then((s) => {
        sampler = s
        if (!s) loading = null
        return !!s
      })),
  }
}

/** the browser's audio, or null where there is none; create it only inside a user's gesture (autoplay rules) */
export function webAudio(): ClickAudio | null {
  try {
    const ctx = new AudioContext()
    const out = ctx.createGain()
    out.gain.value = 0.8
    out.connect(ctx.destination)
    const lead = lazySampler(ctx, out, LEAD_SET)
    const comp = lazySampler(ctx, out, COMP_SET)
    const bass = lazySampler(ctx, out, BASS_SET)
    const stick = lazyStick(ctx)
    const kit = new Map<string, AudioBuffer>()
    let kitLoading: Promise<boolean> | null = null
    const loadDrums = (): Promise<boolean> =>
      (kitLoading ??= Promise.all(DRUM_FILES.map((f) => loadSample(ctx, `/sounds/drums/${f}`))).then((rs) => {
        rs.forEach((r, i) => r.ok && kit.set(DRUM_FILES[i]!, r.buffer))
        const ok = rs.every((r) => r.ok)
        if (!ok) kitLoading = null // the next Start tries again
        return ok
      }))
    function drum(kind: DrumKind, time: number, velocity: number): void {
      const d = DRUM_KIT[kind]
      const peak = d.gain * Math.min(1, Math.max(0, velocity))
      if (kind === 'sweep' || kind === 'brush') return playBrush(ctx, out, time, peak, kind === 'sweep')
      const buffer = kit.get(d.soft && velocity < 0.5 ? d.soft : (d.file ?? ''))
      if (!buffer) return playDrumStandIn(ctx, out, kind, time, peak)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const env = ctx.createGain()
      env.gain.value = peak
      source.connect(env).connect(out)
      source.start(time)
    }
    return {
      now: () => ctx.currentTime,
      play: (kind, time, sound) => (sound === 'stick' ? playStick(ctx, out, stick.buffers, kind, time) : playClick(ctx, out, kind, time, sound)),
      load: (sound) => (sound === 'stick' ? stick.load() : Promise.resolve(true)),
      note: (midi, time, length) => lead.get()?.note(midi, time, length) ?? playNote(ctx, out, midi, time, length),
      comp: (midi, time, length) => comp.get()?.note(midi, time, length) ?? playNote(ctx, out, midi, time, length, STAND_IN.comp),
      bass: (midi, time, length) => bass.get()?.note(midi, time, length) ?? playNote(ctx, out, midi, time, length, STAND_IN.bass),
      hit: (time, accent) => playRim(ctx, out, time, accent),
      loadLead: lead.load,
      drum,
      loadDrums,
      loadHarmony: async () => (await Promise.all([comp.load(), bass.load()])).every(Boolean),
      resume: () => ctx.resume(),
      suspend: () => ctx.suspend(),
      close: () => ctx.close(),
    }
  } catch {
    return null
  }
}

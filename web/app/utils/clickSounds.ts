import type { ClickKind } from '@chord-scale-maker/engine'
import { type SampleSet, type Sampler, loadSampler } from '~/utils/sampler'

/**
 * The click's sounds (#254) and Hear rhythm's rim (#521), synthesized; Hear line's lead (#507) a sampled piano (#538),
 * synthesized until its samples load or if they fail. The samples are this site's own files, so no CSP change. With
 * sampler.ts the only files that build audio nodes; useClick books through a ClickAudio, which tests replace with a fake.
 */
export type ClickSound = 'wood' | 'beep'
export const CLICK_SOUNDS: readonly ClickSound[] = ['wood', 'beep']

export type ClickAudio = Readonly<{
  /** the audio clock, in seconds */
  now: () => number
  play: (kind: ClickKind, time: number, sound: ClickSound) => void
  /** Hear line's lead: a note at midi (concert pitch), from time for length seconds; call what it returns to stop it */
  note: (midi: number, time: number, length: number) => () => void
  /** Hear rhythm's rim: an attack of the rhythm at time, louder accented */
  hit: (time: number, accent: boolean) => void
  /** the lead's samples, fetched once: true once they play, false if they couldn't load (the synthesized lead plays on) */
  loadLead: () => Promise<boolean>
  resume: () => Promise<void>
  suspend: () => Promise<void>
  close: () => Promise<void>
}>

const PITCH: Readonly<Record<ClickSound, Readonly<{ wave: OscillatorType; accent: number; beat: number }>>> = {
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
export function playClick(ctx: AudioContext, out: AudioNode, kind: ClickKind, time: number, sound: ClickSound): void {
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
export function playNote(ctx: AudioContext, out: AudioNode, midi: number, time: number, length: number): () => void {
  const freq = 440 * 2 ** ((midi - 69) / 12)
  const end = time + Math.max(length * LEAD.held, LEAD.attack + 0.02)
  const env = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = LEAD.cutoff
  filter.connect(env).connect(out)
  env.gain.setValueAtTime(0, time)
  env.gain.linearRampToValueAtTime(LEAD.peak, time + LEAD.attack)
  env.gain.setValueAtTime(LEAD.peak, end)
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

/** the browser's audio, or null where there is none; create it only inside a user's gesture (autoplay rules) */
export function webAudio(): ClickAudio | null {
  try {
    const ctx = new AudioContext()
    const out = ctx.createGain()
    out.gain.value = 0.8
    out.connect(ctx.destination)
    let lead: Sampler | null = null
    let loading: Promise<boolean> | null = null
    const loadLead = (): Promise<boolean> =>
      (loading ??= loadSampler(ctx, out, LEAD_SET).then((s) => {
        lead = s
        if (!s) loading = null // the next Play tries again
        return !!s
      }))
    return {
      now: () => ctx.currentTime,
      play: (kind, time, sound) => playClick(ctx, out, kind, time, sound),
      note: (midi, time, length) => (lead ? lead.note(midi, time, length) : playNote(ctx, out, midi, time, length)),
      hit: (time, accent) => playRim(ctx, out, time, accent),
      loadLead,
      resume: () => ctx.resume(),
      suspend: () => ctx.suspend(),
      close: () => ctx.close(),
    }
  } catch {
    return null
  }
}

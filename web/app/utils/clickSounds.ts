import type { ClickKind } from '@chord-scale-maker/engine'

/**
 * The click's sounds (#254), synthesized: no samples, so nothing to fetch and no CSP change. The only file that builds
 * audio nodes; useClick books through a ClickAudio, which tests replace with a fake.
 */
export type ClickSound = 'wood' | 'beep'
export const CLICK_SOUNDS: readonly ClickSound[] = ['wood', 'beep']

export type ClickAudio = Readonly<{
  /** the audio clock, in seconds */
  now: () => number
  play: (kind: ClickKind, time: number, sound: ClickSound) => void
  resume: () => Promise<void>
  suspend: () => Promise<void>
  close: () => Promise<void>
}>

const PITCH: Readonly<Record<ClickSound, Readonly<{ wave: OscillatorType; accent: number; beat: number }>>> = {
  wood: { wave: 'triangle', accent: 1800, beat: 1200 },
  beep: { wave: 'sine', accent: 1320, beat: 880 },
}
const PEAK: Readonly<Record<Exclude<ClickKind, 'hat'>, number>> = { accent: 1, beat: 0.8, count: 0.8, sub: 0.3 }
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

/** one click at `time` on the context's clock, into `out` */
export function playClick(ctx: AudioContext, out: AudioNode, kind: ClickKind, time: number, sound: ClickSound): void {
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

/** the browser's audio, or null where there is none; create it only inside a user's gesture (autoplay rules) */
export function webAudio(): ClickAudio | null {
  try {
    const ctx = new AudioContext()
    const out = ctx.createGain()
    out.gain.value = 0.8
    out.connect(ctx.destination)
    return {
      now: () => ctx.currentTime,
      play: (kind, time, sound) => playClick(ctx, out, kind, time, sound),
      resume: () => ctx.resume(),
      suspend: () => ctx.suspend(),
      close: () => ctx.close(),
    }
  } catch {
    return null
  }
}

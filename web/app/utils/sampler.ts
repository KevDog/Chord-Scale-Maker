import { loadSample } from '~/utils/sampleLoader'

/**
 * The pitched sampler (#537): a set of recordings, about one a minor third apart, each note played from the nearest
 * one, shifted to its pitch by the playback rate. Velocity picks a layer and a gain; a note is held for its length,
 * then released; past the set's voice limit the oldest sounding note is cut, so a dense line never piles up. A set
 * that doesn't load gives no sampler, and the caller plays its synthesis.
 */
export type SampleZone = Readonly<{ midi: number; file: string }>
/** the zones played up to a velocity (0 to 1) */
export type SampleLayer = Readonly<{ upTo: number; zones: readonly SampleZone[] }>
/** base: the set's folder (/sounds/<set>/); release (s): the fade after a note's length; voices: the most sounding at once */
export type SampleSet = Readonly<{ base: string; layers: readonly SampleLayer[]; release: number; voices: number; gain: number }>
/** a note at midi (concert pitch), from time for length seconds, at velocity (0 to 1); call what it returns to stop it */
export type Sampler = Readonly<{ note: (midi: number, time: number, length: number, velocity?: number) => () => void }>

/** a cut voice fades out this fast (s), so the cut doesn't click */
const CUT = 0.03
const DEFAULT_VELOCITY = 0.7

/** the sample a note plays and its rate: the velocity's layer, its nearest zone (the higher one, shifted down, between two) */
export function pickZone(set: SampleSet, midi: number, velocity: number): Readonly<{ file: string; rate: number }> {
  const layer = set.layers.find((l) => velocity <= l.upTo) ?? set.layers.at(-1)!
  const zone = layer.zones.reduce((best, z) => {
    const d = Math.abs(z.midi - midi)
    const b = Math.abs(best.midi - midi)
    return d < b || (d === b && z.midi > best.midi) ? z : best
  })
  return { file: zone.file, rate: 2 ** ((midi - zone.midi) / 12) }
}

/** a velocity's gain: its square (loudness follows it more nearly than its value), at most the set's */
export const velocityGain = (velocity: number, gain: number): number => gain * Math.min(1, Math.max(0, velocity)) ** 2

/** the voices to cut so a note at time fits the limit: those sounding then, oldest first */
export function toSteal(voices: readonly Readonly<{ start: number; end: number }>[], time: number, limit: number): number[] {
  const sounding = voices.flatMap((v, i) => (v.start <= time && time < v.end ? [i] : []))
  const over = sounding.length - limit + 1
  return over > 0 ? [...sounding].sort((a, b) => voices[a]!.start - voices[b]!.start).slice(0, over) : []
}

type Voice = { start: number; end: number; cut: (time: number) => void }

/** the set's sampler, playing into out, once every file is decoded; null if any fails */
export async function loadSampler(ctx: BaseAudioContext, out: AudioNode, set: SampleSet, fetcher?: (url: string) => Promise<Response>): Promise<Sampler | null> {
  const files = [...new Set(set.layers.flatMap((l) => l.zones.map((z) => z.file)))]
  const results = await Promise.all(files.map((f) => loadSample(ctx, `${set.base}${f}`, fetcher)))
  const buffers = new Map<string, AudioBuffer>()
  for (const [i, r] of results.entries()) {
    if (!r.ok) return null
    buffers.set(files[i]!, r.buffer)
  }
  let voices: Voice[] = []

  function note(midi: number, time: number, length: number, velocity = DEFAULT_VELOCITY): () => void {
    voices = voices.filter((v) => v.end > ctx.currentTime)
    for (const i of toSteal(voices, time, set.voices)) voices[i]!.cut(time)
    const { file, rate } = pickZone(set, midi, velocity)
    const gain = velocityGain(velocity, set.gain)
    const held = time + Math.max(length, 0)
    const end = held + set.release
    const env = ctx.createGain()
    env.connect(out)
    env.gain.setValueAtTime(gain, time)
    env.gain.setValueAtTime(gain, held)
    env.gain.linearRampToValueAtTime(0, end)
    const source = ctx.createBufferSource()
    source.buffer = buffers.get(file)!
    source.playbackRate.value = rate
    source.connect(env)
    source.start(time)
    source.stop(end + 0.02)
    const voice: Voice = {
      start: time,
      end,
      cut: (t) => {
        env.gain.cancelScheduledValues(t)
        env.gain.setValueAtTime(gain, t)
        env.gain.linearRampToValueAtTime(0, t + CUT)
        source.stop(t + CUT + 0.02)
        voice.end = t + CUT
      },
    }
    voices.push(voice)
    return () => {
      env.gain.cancelScheduledValues(ctx.currentTime)
      env.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
    }
  }

  return { note }
}

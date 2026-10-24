import { describe, expect, it } from 'vitest'
import { type SampleSet, loadSampler, pickZone, toSteal, velocityGain } from '~/utils/sampler'

/** zones a minor third apart, C3 to C5, in a soft and a loud layer */
const SET: SampleSet = {
  base: '/sounds/test/',
  layers: [
    { upTo: 0.6, zones: [48, 51, 54, 57, 60, 63, 66, 69, 72].map((midi) => ({ midi, file: `soft-${midi}.wav` })) },
    { upTo: 1, zones: [48, 60, 72].map((midi) => ({ midi, file: `loud-${midi}.wav` })) },
  ],
  release: 0.3,
  voices: 2,
  gain: 1,
}

describe('pickZone', () => {
  it('a sampled pitch plays at its own rate', () => {
    expect(pickZone(SET, 60, 0.5)).toEqual({ file: 'soft-60.wav', rate: 1 })
  })

  it('another plays the nearest sample, shifted by its interval', () => {
    const z = pickZone(SET, 61, 0.5)
    expect(z.file).toBe('soft-60.wav')
    expect(z.rate).toBeCloseTo(2 ** (1 / 12))
  })

  it('halfway between two, the higher one shifted down', () => {
    expect(pickZone(SET, 62, 0.5).file).toBe('soft-63.wav')
  })

  it('beyond the zones, the outermost', () => {
    const z = pickZone(SET, 40, 0.5)
    expect(z.file).toBe('soft-48.wav')
    expect(z.rate).toBeCloseTo(2 ** (-8 / 12))
  })

  it('the velocity picks the layer', () => {
    expect(pickZone(SET, 60, 0.9).file).toBe('loud-60.wav')
    expect(pickZone(SET, 60, 0.6).file).toBe('soft-60.wav')
  })
})

describe('velocityGain', () => {
  it('rises with the velocity, silent at none, the set’s gain at full', () => {
    expect(velocityGain(0, 0.8)).toBe(0)
    expect(velocityGain(1, 0.8)).toBe(0.8)
    expect(velocityGain(0.5, 1)).toBeGreaterThan(0)
    expect(velocityGain(0.5, 1)).toBeLessThan(0.5)
  })
})

describe('toSteal', () => {
  it('under the limit, nothing', () => {
    expect(toSteal([{ start: 0, end: 1 }], 0.5, 2)).toEqual([])
  })

  it('at the limit, the oldest still sounding', () => {
    expect(toSteal([{ start: 0.2, end: 2 }, { start: 0.1, end: 2 }], 0.5, 2)).toEqual([1])
  })

  it('a voice already ended, or not yet started, doesn’t count', () => {
    expect(toSteal([{ start: 0, end: 0.4 }, { start: 0.1, end: 2 }, { start: 1, end: 2 }], 0.5, 2)).toEqual([])
  })

  it('enough to make room for the new one', () => {
    expect(toSteal([{ start: 0, end: 2 }, { start: 0.1, end: 2 }, { start: 0.2, end: 2 }], 0.5, 2)).toEqual([0, 1])
  })
})

/** just enough of an AudioContext for the sampler: every buffer source it starts, and every gain it fades */
function stubContext() {
  const sources: { file: string; rate: number; start: number; stop: number }[] = []
  const gains: { ramps: [string, number, number][] }[] = []
  const ctx = {
    currentTime: 0,
    decodeAudioData: async (data: ArrayBuffer) => ({ name: new TextDecoder().decode(data) }) as unknown as AudioBuffer,
    createGain: () => {
      const g = { ramps: [] as [string, number, number][] }
      gains.push(g)
      const at = (kind: string) => (v: number, t: number) => g.ramps.push([kind, v, t])
      return { connect: (n: unknown) => n, gain: { value: 1, setValueAtTime: at('set'), linearRampToValueAtTime: at('ramp'), cancelScheduledValues: at('cancel'), setTargetAtTime: at('target') } }
    },
    createBufferSource: () => {
      const s = { file: '', rate: 1, start: -1, stop: -1 }
      const node = {
        set buffer(b: { name: string }) {
          s.file = b.name
        },
        playbackRate: {
          set value(v: number) {
            s.rate = v
          },
        },
        connect: (n: unknown) => n,
        start: (t: number) => {
          s.start = t
          sources.push(s)
        },
        stop: (t: number) => (s.stop = t),
      }
      return node
    },
  }
  return { ctx: ctx as unknown as BaseAudioContext, sources, gains }
}

const serve = (missing?: string) => async (url: string) => (url === missing ? new Response(null, { status: 404 }) : new Response(url.split('/').at(-1)))

describe('loadSampler', () => {
  it('a note plays its zone’s sample from its time, at its rate, released after its length', async () => {
    const { ctx, sources, gains } = stubContext()
    const sampler = (await loadSampler(ctx, {} as AudioNode, SET, serve()))!
    sampler.note(61, 1, 0.5, 0.5)
    expect(sources).toHaveLength(1)
    expect(sources[0]!.file).toBe('soft-60.wav')
    expect(sources[0]!.rate).toBeCloseTo(2 ** (1 / 12))
    expect(sources[0]!.start).toBe(1)
    expect(sources[0]!.stop).toBeGreaterThanOrEqual(1.5 + SET.release)
    expect(gains.at(-1)!.ramps.at(-1)).toEqual(['ramp', 0, 1.5 + SET.release])
  })

  it('fetches every zone of every layer, once', async () => {
    const { ctx } = stubContext()
    const asked: string[] = []
    await loadSampler(ctx, {} as AudioNode, SET, async (url) => {
      asked.push(url)
      return new Response('x')
    })
    expect(asked.sort()).toEqual([...new Set(SET.layers.flatMap((l) => l.zones.map((z) => `${SET.base}${z.file}`)))].sort())
  })

  it('a missing file: no sampler, so the caller plays its synthesis', async () => {
    const { ctx } = stubContext()
    expect(await loadSampler(ctx, {} as AudioNode, SET, serve('/sounds/test/soft-66.wav'))).toBeNull()
  })

  it('past the voice limit, the oldest voice is cut where the new one starts', async () => {
    const { ctx, gains } = stubContext()
    const sampler = (await loadSampler(ctx, {} as AudioNode, SET, serve()))!
    for (const t of [0, 0.1, 0.2]) sampler.note(60, t, 2, 0.5)
    const first = gains.find((g) => g.ramps[0]?.[2] === 0)!
    expect(first.ramps.some(([kind, from]) => kind === 'cancel' && from === 0.2)).toBe(true) // cancelScheduledValues(t) takes only its time
    expect(first.ramps.at(-1)).toEqual(['ramp', 0, expect.closeTo(0.2 + 0.03, 5)])
  })

  it('what a note returns fades it at once (a Stop)', async () => {
    const { ctx, gains } = stubContext()
    const sampler = (await loadSampler(ctx, {} as AudioNode, SET, serve()))!
    sampler.note(60, 0, 2, 0.5)()
    expect(gains.at(-1)!.ramps.some(([kind]) => kind === 'target')).toBe(true)
  })
})

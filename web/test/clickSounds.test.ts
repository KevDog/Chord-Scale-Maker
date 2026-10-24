import { afterEach, describe, expect, it, vi } from 'vitest'
import { BASS_SET, CLICK_SOUNDS, COMP_SET, LEAD_SET, STICK_SET, webAudio } from '~/utils/clickSounds'

/** just enough of an AudioContext to build the click's nodes, counting the buffers it makes */
function stubContext() {
  const made = { buffers: 0, oscillators: 0, faded: 0, sources: 0 }
  const param = () => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => made.faded++ })
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), Q: param(), playbackRate: param(), type: '', buffer: null, start: () => {}, stop: () => {} })
  class Ctx {
    sampleRate = 48000
    currentTime = 0
    destination = node()
    createGain = node
    createOscillator = () => {
      made.oscillators++
      return node()
    }
    createBiquadFilter = node
    createBufferSource = () => {
      made.sources++
      return node()
    }
    decodeAudioData = async () => ({}) as AudioBuffer
    createBuffer = (_: number, length: number) => {
      made.buffers++
      return { getChannelData: () => new Float32Array(length) }
    }
  }
  vi.stubGlobal('AudioContext', Ctx)
  return made
}

describe('clickSounds', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('makes the hat’s noise once, not on every hit', () => {
    const made = stubContext()
    const audio = webAudio()!
    for (const t of [0, 0.5, 1]) audio.play('hat', t, 'wood')
    expect(made.buffers).toBe(1)
  })

  it('a tick, the lights’ silent beat, makes no sound', () => {
    const made = stubContext()
    const audio = webAudio()!
    audio.play('tick', 0, 'wood')
    expect(made.oscillators).toBe(0)
    audio.play('beat', 0, 'wood')
    expect(made.oscillators).toBe(1)
  })

  it('Hear line’s lead is two oscillators a note', () => {
    const made = stubContext()
    webAudio()!.note(65, 0, 1)
    expect(made.oscillators).toBe(2)
  })

  it('a note’s stop fades it out (a staff’s Stop)', () => {
    const made = stubContext()
    webAudio()!.note(65, 0, 1)()
    expect(made.faded).toBe(1)
  })

  it('Hear rhythm’s rim is the hat’s noise, no pitch', () => {
    const made = stubContext()
    const audio = webAudio()!
    audio.play('hat', 0, 'wood')
    for (const t of [0, 0.5]) audio.hit(t, t === 0)
    expect([made.buffers, made.oscillators]).toEqual([1, 0])
  })

  describe('the lead’s samples (#538)', () => {
    const files = () => [...new Set(LEAD_SET.layers.flatMap((l) => l.zones.map((z) => `${LEAD_SET.base}${z.file}`)))]

    it('are the piano set, same-origin, under /sounds/', () => {
      expect(files().every((f) => f.startsWith('/sounds/piano/'))).toBe(true)
    })

    it('loaded, a note plays a sample, not the oscillators', async () => {
      const made = stubContext()
      const asked: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        asked.push(url)
        return new Response('x')
      })
      const audio = webAudio()!
      expect(await audio.loadLead()).toBe(true)
      expect(await audio.loadLead()).toBe(true)
      expect(asked.sort()).toEqual(files().sort())
      const before = made.sources
      audio.note(65, 0, 1)
      expect([made.sources - before, made.oscillators]).toEqual([1, 0])
    })

    it('not loaded, or failed, a note is synthesized', async () => {
      const made = stubContext()
      vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }))
      const audio = webAudio()!
      audio.note(65, 0, 1)
      expect(made.oscillators).toBe(2)
      expect(await audio.loadLead()).toBe(false)
      audio.note(65, 0, 1)
      expect(made.oscillators).toBe(4)
    })
  })

  describe('the changes’ piano and bass (#508, #539)', () => {
    const files = (set: typeof COMP_SET) => set.layers.flatMap((l) => l.zones.map((z) => `${set.base}${z.file}`))

    it('loaded, the piano and the bass play samples', async () => {
      const made = stubContext()
      const asked: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        asked.push(url)
        return new Response('x')
      })
      const audio = webAudio()!
      expect(await audio.loadHarmony()).toBe(true)
      expect(asked.sort()).toEqual([...files(COMP_SET), ...files(BASS_SET)].sort())
      expect(asked.every((u) => u.startsWith('/sounds/comp/') || u.startsWith('/sounds/bass/'))).toBe(true)
      const before = made.sources
      audio.comp(60, 0, 1)
      audio.bass(36, 0, 1)
      expect([made.sources - before, made.oscillators]).toEqual([2, 0])
    })

    it('not loaded, or failed, they’re synthesized', async () => {
      const made = stubContext()
      vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }))
      const audio = webAudio()!
      expect(await audio.loadHarmony()).toBe(false)
      audio.comp(60, 0, 1)
      audio.bass(36, 0, 1)
      expect(made.oscillators).toBe(4)
    })
  })

  describe('the Stick click (#536)', () => {
    const files = () => Object.values(STICK_SET.files).map((f) => `${STICK_SET.base}${f}`)

    it('is a click sound, its one-shots same-origin under /sounds/stick/', () => {
      expect(CLICK_SOUNDS).toContain('stick')
      expect(files().every((f) => f.startsWith('/sounds/stick/'))).toBe(true)
    })

    it('loaded, every hit plays its one-shot, not an oscillator', async () => {
      const made = stubContext()
      const asked: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        asked.push(url)
        return new Response('x')
      })
      const audio = webAudio()!
      expect(await audio.load('stick')).toBe(true)
      expect(await audio.load('stick')).toBe(true)
      expect(asked.sort()).toEqual([...new Set(files())].sort())
      const before = made.sources
      for (const kind of ['accent', 'beat', 'count', 'sub', 'hat'] as const) audio.play(kind, 0, 'stick')
      audio.play('tick', 0, 'stick')
      expect([made.sources - before, made.oscillators]).toEqual([5, 0])
    })

    it('not loaded, or failed, a hit plays Wood', async () => {
      const made = stubContext()
      vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }))
      const audio = webAudio()!
      audio.play('beat', 0, 'stick')
      expect(made.oscillators).toBe(1)
      expect(await audio.load('stick')).toBe(false)
      audio.play('accent', 0, 'stick')
      expect(made.oscillators).toBe(2)
    })

    it('a hit whose one-shot alone failed plays Wood; the others play theirs', async () => {
      const made = stubContext()
      vi.stubGlobal('fetch', async (url: string) => (url.endsWith(STICK_SET.files.hat) ? new Response(null, { status: 404 }) : new Response('x')))
      const audio = webAudio()!
      expect(await audio.load('stick')).toBe(false)
      const before = made.sources
      audio.play('beat', 0, 'stick')
      expect([made.sources - before, made.oscillators]).toEqual([1, 0])
      audio.play('hat', 0, 'stick')
      expect(made.buffers).toBe(1) // Wood's hat: synthesized noise
    })

    it('Wood and Beep load nothing', async () => {
      stubContext()
      const fetcher = vi.fn()
      vi.stubGlobal('fetch', fetcher)
      const audio = webAudio()!
      expect(await audio.load('wood')).toBe(true)
      expect(await audio.load('beep')).toBe(true)
      expect(fetcher).not.toHaveBeenCalled()
    })
  })
})

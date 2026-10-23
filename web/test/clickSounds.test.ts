import { afterEach, describe, expect, it, vi } from 'vitest'
import { webAudio } from '~/utils/clickSounds'

/** just enough of an AudioContext to build the click's nodes, counting the buffers it makes */
function stubContext() {
  const made = { buffers: 0, oscillators: 0, faded: 0 }
  const param = () => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => made.faded++ })
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), Q: param(), type: '', buffer: null, start: () => {}, stop: () => {} })
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
    createBufferSource = node
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
})

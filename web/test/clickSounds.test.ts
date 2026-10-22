import { afterEach, describe, expect, it, vi } from 'vitest'
import { webAudio } from '~/utils/clickSounds'

/** just enough of an AudioContext to build the click's nodes, counting the buffers it makes */
function stubContext() {
  const made = { buffers: 0 }
  const param = () => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} })
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), type: '', buffer: null, start: () => {}, stop: () => {} })
  class Ctx {
    sampleRate = 48000
    currentTime = 0
    destination = node()
    createGain = node
    createOscillator = node
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
})

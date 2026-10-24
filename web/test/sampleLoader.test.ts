import { describe, expect, it } from 'vitest'
import { loadSample } from '~/utils/sampleLoader'

/** a context that decodes any bytes to a buffer naming them, or refuses the ones marked bad */
function stubContext() {
  const decoded: string[] = []
  return {
    decoded,
    ctx: {
      decodeAudioData: async (data: ArrayBuffer) => {
        const text = new TextDecoder().decode(data)
        decoded.push(text)
        if (text === 'bad') throw new Error('EncodingError')
        return { duration: 1, text } as unknown as AudioBuffer
      },
    } as unknown as BaseAudioContext,
  }
}

/** a fetch that answers each url with its body, counting the requests */
function stubFetch(bodies: Record<string, string | number>) {
  const asked: string[] = []
  const fetcher = async (url: string) => {
    asked.push(url)
    const body = bodies[url]
    if (typeof body === 'number') return new Response(null, { status: body })
    if (body === undefined) throw new TypeError('Failed to fetch')
    return new Response(body)
  }
  return { asked, fetcher }
}

describe('loadSample', () => {
  it('fetches and decodes a file', async () => {
    const { ctx } = stubContext()
    const { fetcher } = stubFetch({ '/sounds/a.wav': 'a' })
    const r = await loadSample(ctx, '/sounds/a.wav', fetcher)
    expect(r.ok && (r.buffer as unknown as { text: string }).text).toBe('a')
  })

  it('shares one request between callers, and keeps the buffer for the context', async () => {
    const { ctx, decoded } = stubContext()
    const { asked, fetcher } = stubFetch({ '/sounds/a.wav': 'a' })
    const [x, y] = await Promise.all([loadSample(ctx, '/sounds/a.wav', fetcher), loadSample(ctx, '/sounds/a.wav', fetcher)])
    await loadSample(ctx, '/sounds/a.wav', fetcher)
    expect(asked).toEqual(['/sounds/a.wav'])
    expect(decoded).toEqual(['a'])
    expect(x).toBe(y)
  })

  it('another context decodes its own', async () => {
    const { fetcher, asked } = stubFetch({ '/sounds/a.wav': 'a' })
    await loadSample(stubContext().ctx, '/sounds/a.wav', fetcher)
    await loadSample(stubContext().ctx, '/sounds/a.wav', fetcher)
    expect(asked).toHaveLength(2)
  })

  it('says why it failed, without throwing: no network, a bad status, bytes that don’t decode', async () => {
    const { ctx } = stubContext()
    const { fetcher } = stubFetch({ '/sounds/missing.wav': 404, '/sounds/bad.wav': 'bad' })
    expect(await loadSample(ctx, '/sounds/offline.wav', fetcher)).toEqual({ ok: false, url: '/sounds/offline.wav', reason: 'fetch' })
    expect(await loadSample(ctx, '/sounds/missing.wav', fetcher)).toEqual({ ok: false, url: '/sounds/missing.wav', reason: 'fetch' })
    expect(await loadSample(ctx, '/sounds/bad.wav', fetcher)).toEqual({ ok: false, url: '/sounds/bad.wav', reason: 'decode' })
  })

  it('a failure isn’t kept: the next play tries again', async () => {
    const { ctx } = stubContext()
    const bodies: Record<string, string> = {}
    const { asked, fetcher } = stubFetch(bodies)
    expect((await loadSample(ctx, '/sounds/a.wav', fetcher)).ok).toBe(false)
    bodies['/sounds/a.wav'] = 'a'
    expect((await loadSample(ctx, '/sounds/a.wav', fetcher)).ok).toBe(true)
    expect(asked).toHaveLength(2)
  })
})

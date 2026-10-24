/**
 * The sampled sounds' loader (#535): a same-origin file under /sounds/, fetched and decoded once per AudioContext,
 * one request shared by every caller asking while it's in flight. A failure is an answer, not a throw, and isn't kept,
 * so the caller falls back to its synthesis and the next play tries again.
 */
export type SampleResult = Readonly<{ ok: true; buffer: AudioBuffer }> | Readonly<{ ok: false; url: string; reason: 'fetch' | 'decode' }>
type Fetcher = (url: string) => Promise<Response>

const loaded = new WeakMap<BaseAudioContext, Map<string, Promise<SampleResult>>>()

async function fetchAndDecode(ctx: BaseAudioContext, url: string, fetcher: Fetcher): Promise<SampleResult> {
  let data: ArrayBuffer
  try {
    const response = await fetcher(url)
    if (!response.ok) return { ok: false, url, reason: 'fetch' }
    data = await response.arrayBuffer()
  } catch {
    return { ok: false, url, reason: 'fetch' }
  }
  try {
    return { ok: true, buffer: await ctx.decodeAudioData(data) }
  } catch {
    return { ok: false, url, reason: 'decode' }
  }
}

/** the decoded file at url, for ctx */
export function loadSample(ctx: BaseAudioContext, url: string, fetcher: Fetcher = (u) => fetch(u)): Promise<SampleResult> {
  const byUrl = loaded.get(ctx) ?? new Map<string, Promise<SampleResult>>()
  loaded.set(ctx, byUrl)
  const known = byUrl.get(url)
  if (known) return known
  const pending = fetchAndDecode(ctx, url, fetcher).then((r) => {
    if (!r.ok) byUrl.delete(url)
    return r
  })
  byUrl.set(url, pending)
  return pending
}

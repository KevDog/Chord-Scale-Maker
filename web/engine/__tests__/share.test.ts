import { describe, expect, it } from 'vitest'
import { LIMITS } from '../limits'
import { decodeShare, encodeShare, SHARE_LIMITS, shareViewFrom } from '../share'

const CHART = 'title: Blue Bossa\n# section | bar | chord | scale\nA | 1 | Cm7 | C Dorian\nA | 3 | Fm7 | F Dorian\n'
const b64url = (s: string): string => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** a link payload made by hand: raw JSON, deflated the same way */
async function packed(value: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  return b64url(String.fromCharCode(...bytes))
}

describe('share links', () => {
  it('round-trip a chart and its view, in URL-safe characters', async () => {
    const view = { instrument: 'tenor-sax', mode: 'from', start: 'Eb', intervals: false, sheet: 'changes', practice: { keys: ['b3', '3'] } } as const
    const encoded = await encodeShare({ chart: CHART, view })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decodeShare(encoded)).toEqual({ chart: CHART, view })
    expect(await decodeShare(await encodeShare({ chart: CHART }))).toEqual({ chart: CHART })
  })

  it('stay short for an ordinary chart', async () => {
    expect((await encodeShare({ chart: CHART.repeat(4) })).length).toBeLessThan(300)
  })

  it('open nothing from a damaged, foreign or oversized link', async () => {
    const good = await encodeShare({ chart: CHART })
    for (const bad of ['', 'not base64!', good.slice(0, -6), 'AAAA', 'x'.repeat(SHARE_LIMITS.encoded + 1)]) expect(await decodeShare(bad)).toBeNull()
    expect(await decodeShare(await packed({ v: 2, chart: CHART }))).toBeNull() // a newer version
    expect(await decodeShare(await packed({ v: 1, chart: 42 }))).toBeNull()
    expect(await decodeShare(await packed({ v: 1, chart: 'x'.repeat(LIMITS.maxChars + 1) }))).toBeNull()
    expect(await decodeShare(await packed([1, 2]))).toBeNull()
  })

  it('refuse a small link that would inflate past the limit', async () => {
    const bomb = await packed({ v: 1, chart: ' '.repeat(SHARE_LIMITS.inflated) })
    expect(bomb.length).toBeLessThan(2_000)
    expect(await decodeShare(bomb)).toBeNull()
  })

  it('keep only the view fields they know, with valid values', async () => {
    expect(shareViewFrom({ instrument: 'kazoo', mode: 'both', start: 'H', intervals: 'yes', sheet: 'x', practice: { preset: 'everything' } })).toBeUndefined()
    expect(shareViewFrom({ instrument: 'alto-sax', start: 'F#', extra: 1, practice: { keys: ['b3', '<script>'] } })).toEqual({
      instrument: 'alto-sax',
      start: 'F#',
      practice: { keys: ['b3'] },
    })
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { mode: 'root', bogus: true } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it("carry the Changes sheet's guide tone lines, from the 3rd and from the 7th, booleans only", async () => {
    const view = { sheet: 'changes', numerals: true, fromThird: true, fromSeventh: false } as const
    expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    expect(shareViewFrom({ fromThird: 'on', fromSeventh: 1 })).toBeUndefined()
    expect(shareViewFrom({ fromThird: false, fromSeventh: 'yes' })).toEqual({ fromThird: false })
  })

  it('read the older guideThird/guideSeventh toggles as the lines from the 3rd and the 7th', async () => {
    expect(shareViewFrom({ guideThird: true, guideSeventh: false })).toEqual({ fromThird: true, fromSeventh: false })
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { sheet: 'changes', guideSeventh: true } }))).toEqual({
      chart: CHART,
      view: { sheet: 'changes', fromSeventh: true },
    })
    expect(shareViewFrom({ guideThird: 'on' })).toBeUndefined()
    expect(shareViewFrom({ guideThird: true, fromThird: false })).toEqual({ fromThird: false }) // the new name wins
  })

  it('drop the retired Guide tones sheet from an old link, keeping the rest of its view', async () => {
    expect(shareViewFrom({ sheet: 'guideTones', numerals: true })).toEqual({ numerals: true })
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { sheet: 'guideTones', mode: 'root' } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it('carry function cells and @key lines unchanged', async () => {
    const chart = 'title: T\nA | 1 | D7 |  | V7/V\n@key A 1 D\n'
    expect((await decodeShare(await encodeShare({ chart })))?.chart).toBe(chart)
  })
})

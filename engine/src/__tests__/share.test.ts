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

  it("carry the Changes sheet's line: a guide tone line or an arpeggio pattern", async () => {
    for (const line of ['third', 'seventh', 'up-root', 'voice-led'] as const) {
      const view = { sheet: 'changes', numerals: true, line } as const
      expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    }
  })

  it('keeps the Arpeggios sheet and its choices, dropping bad ones', () => {
    expect(shareViewFrom({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })).toEqual({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })
    expect(shareViewFrom({ sheet: 'arps', arpNotes: 'ninth', arpDir: 'sideways' })).toBeUndefined()
  })

  it('read any other line as none (absent), and the old guideLine not at all', async () => {
    for (const line of ['off', 'both', 'Up · root', true, 3, null]) expect(shareViewFrom({ sheet: 'changes', line })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ sheet: 'changes', guideLine: 'third' })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ fromThird: true, fromSeventh: true, guideThird: true, guideSeventh: true })).toBeUndefined()
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { sheet: 'changes', fromSeventh: true } }))).toEqual({ chart: CHART, view: { sheet: 'changes' } })
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

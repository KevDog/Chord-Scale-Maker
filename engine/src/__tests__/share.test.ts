import { describe, expect, it } from 'vitest'
import { LIMITS } from '../limits'
import { cellsLineOf, cellsShareLine, decodeShare, encodeShare, SHARE_LIMITS, shareViewFrom } from '../share'

const CHART = 'title: Blue Bossa\n# bar | chord | scale\n\nsection: A\nbars: 4\n1 | Cm7 | C Dorian\n3 | Fm7 | F Dorian\n'
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

  it('carry a Pentatonic practice selection', async () => {
    const view = { instrument: 'tenor-sax', mode: 'root', start: 'C', intervals: false, sheet: 'scales', practice: { preset: 'pentatonic', degree: 4 } } as const
    expect((await decodeShare(await encodeShare({ chart: CHART, view })))?.view?.practice).toEqual({ preset: 'pentatonic', degree: 4 })
    const auto = { ...view, practice: { preset: 'pentatonic', degree: 'auto' } } as const
    expect((await decodeShare(await encodeShare({ chart: CHART, view: auto })))?.view?.practice).toEqual({ preset: 'pentatonic', degree: 'auto' })
  })

  it('refuse a version-1 link: its chart is in the retired row format (#329)', async () => {
    expect(await decodeShare(await packed({ v: 1, chart: 'title: T\nA | 1 | C\n' }))).toBeNull()
  })

  it('read an old link’s Pentatonic rank as Auto', async () => {
    const old = await packed({ v: 2, chart: CHART, view: { sheet: 'scales', practice: { preset: 'pentatonic', rank: 4 } } })
    expect((await decodeShare(old))?.view?.practice).toEqual({ preset: 'pentatonic', degree: 'auto' })
  })

  it('carry a Hexatonic practice selection', async () => {
    const view = { instrument: 'tenor-sax', mode: 'root', start: 'C', intervals: false, sheet: 'scales', practice: { preset: 'hexatonic', pair: 5, grouping: 'tones' } } as const
    expect((await decodeShare(await encodeShare({ chart: CHART, view })))?.view?.practice).toEqual({ preset: 'hexatonic', pair: 5, grouping: 'tones' })
  })

  it('carry chord picks, keyed by position', async () => {
    const picks = { pentatonic: { 'A:6:0': { pc: 1, for: 'G7#5#9|G Altered' } }, hexatonic: { 'B:14:0': { roots: [1, 3] as const, for: 'G7#5#9|G Altered' } } }
    expect((await decodeShare(await encodeShare({ chart: CHART, view: { picks } })))?.view?.picks).toEqual(picks)
  })

  it('leave the picks out where they would make a link too big to open, keeping the chart and the rest of the view', async () => {
    const f = 'C#m7b5|C# Locrian Natural 2 and more text here' // a long for, as real scales can be
    const pentatonic = Object.fromEntries(Array.from({ length: 800 }, (_, i) => [`A:${i + 1}:0`, { pc: 3, for: f }]))
    const hexatonic = Object.fromEntries(Array.from({ length: 800 }, (_, i) => [`A:${i + 1}:0`, { roots: [0, 2] as const, for: f }]))
    const view = { sheet: 'changes', picks: { pentatonic, hexatonic } } as const
    expect(new TextEncoder().encode(JSON.stringify({ v: 2, chart: CHART, view })).length).toBeGreaterThan(SHARE_LIMITS.inflated)
    const back = await decodeShare(await encodeShare({ chart: CHART, view }))
    expect(back).toEqual({ chart: CHART, view: { sheet: 'changes' } })
    const small = { pentatonic: { 'A:1:0': { pc: 3, for: f } }, hexatonic: {} }
    expect((await decodeShare(await encodeShare({ chart: CHART, view: { picks: small } })))?.view?.picks).toEqual(small)
  })

  it('open an old link with no picks', async () => {
    expect((await decodeShare(await encodeShare({ chart: CHART, view: { sheet: 'changes' } })))?.view?.picks).toBeUndefined()
  })

  it('drop damaged picks, and the field when none survive', () => {
    expect(shareViewFrom({ picks: { pentatonic: { 'A:1:0': 99 } } })).toBeUndefined()
    expect(shareViewFrom({ picks: { pentatonic: { 'A:1:0': 3, nope: 2 } } })?.picks).toEqual({ pentatonic: { 'A:1:0': { pc: 3 } }, hexatonic: {} })
    expect(shareViewFrom({ sheet: 'changes', picks: JSON.parse('{"__proto__":{"pentatonic":{"A:1:0":{"pc":1}}},"hexatonic":{"A:1:0":{"roots":[2,2]}}}') })).toEqual({ sheet: 'changes' })
  })

  it('carry the main changes set and a hidden alternate, and open an old link as standard, shown', async () => {
    const view = { changes: 'alternate', altHidden: true } as const
    expect((await decodeShare(await encodeShare({ chart: CHART, view })))?.view).toEqual(view)
    const old = (await decodeShare(await encodeShare({ chart: CHART, view: { sheet: 'changes' } })))?.view
    expect([old?.changes, old?.altHidden]).toEqual([undefined, undefined])
  })

  it('drop bad changes values and the defaults', () => {
    expect(shareViewFrom({ changes: 'nope', altHidden: 'yes' })).toBeUndefined()
    expect(shareViewFrom({ changes: 'standard', altHidden: false })).toBeUndefined()
    expect(shareViewFrom({ changes: 'alternate', altHidden: true })).toEqual({ changes: 'alternate', altHidden: true })
  })

  it('stay short for an ordinary chart', async () => {
    expect((await encodeShare({ chart: CHART.repeat(4) })).length).toBeLessThan(300)
  })

  it('open nothing from a damaged, foreign or oversized link', async () => {
    const good = await encodeShare({ chart: CHART })
    for (const bad of ['', 'not base64!', good.slice(0, -6), 'AAAA', 'x'.repeat(SHARE_LIMITS.encoded + 1)]) expect(await decodeShare(bad)).toBeNull()
    expect(await decodeShare(await packed({ v: 3, chart: CHART }))).toBeNull() // a newer version
    expect(await decodeShare(await packed({ v: 2, chart: 42 }))).toBeNull()
    expect(await decodeShare(await packed({ v: 2, chart: 'x'.repeat(LIMITS.maxChars + 1) }))).toBeNull()
    expect(await decodeShare(await packed([1, 2]))).toBeNull()
  })

  it('refuse a small link that would inflate past the limit', async () => {
    const bomb = await packed({ v: 2, chart: ' '.repeat(SHARE_LIMITS.inflated) })
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
    expect(await decodeShare(await packed({ v: 2, chart: CHART, view: { mode: 'root', bogus: true } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it("read an old link's concert instrument as piano (#332)", () => {
    expect(shareViewFrom({ instrument: 'concert', mode: 'root' })).toEqual({ instrument: 'piano', mode: 'root' })
  })

  it("carry the Changes sheet's line: a guide tone line or an arpeggio pattern", async () => {
    for (const line of ['third', 'seventh', 'up-root', 'voice-led'] as const) {
      const view = { sheet: 'changes', numerals: true, line } as const
      expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    }
  })

  it("carries the Changes sheet's Cells line as cells:<id>, dropping an unknown id", async () => {
    for (const line of ['cells:1-2-3-5', 'cells:3rd-3rd'] as const) {
      const view = { sheet: 'changes', line } as const
      expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    }
    for (const line of ['cells:x', 'cells:', 'cells:1-2-3-4', 'cells']) expect(shareViewFrom({ sheet: 'changes', line })).toEqual({ sheet: 'changes' })
  })

  it("carries a Cells line's Order and Phrase off as ~<order> and ~free (#376), dropping an unknown suffix", async () => {
    for (const line of ['cells:3rd-3rd~reversed~free', 'cells:1-2-3-5~swapped', 'cells:3rd-3rd~free', 'cells:3rd-3rd', 'cells:b9-1-3-5~reversed', 'cells:ii-v-chromatic'] as const) {
      const view = { sheet: 'changes', line } as const
      expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    }
    expect(shareViewFrom({ line: 'cells:3rd-3rd~bogus' })).toEqual({ line: 'cells:3rd-3rd' })
    expect(shareViewFrom({ line: 'cells:3rd-3rd~as-written~rotated' })).toEqual({ line: 'cells:3rd-3rd~rotated' })
    expect(shareViewFrom({ line: 'cells:x~reversed' })).toBeUndefined()
  })

  it('reads a cells line one way for the link and the toolbar (#462): the first Order but As written, and free', () => {
    expect(cellsLineOf('cells:3rd-3rd~as-written~rotated~free')).toEqual({ id: '3rd-3rd', order: 'rotated', phrase: false })
    expect(cellsLineOf('cells:1-2-3-5')).toEqual({ id: '1-2-3-5', order: 'as-written', phrase: true })
    expect(cellsLineOf('cells:x~reversed')).toBeUndefined()
    expect(cellsLineOf('third')).toBeUndefined()
  })

  it('writes ~free only for a system, the only cells Phrase aims (#462)', () => {
    expect(cellsShareLine('3rd-3rd', 'rotated', false)).toBe('cells:3rd-3rd~rotated~free')
    expect(cellsShareLine('1-2-3-5', 'reversed', false)).toBe('cells:1-2-3-5~reversed')
    expect(cellsShareLine('ii-v-chromatic', 'as-written', false)).toBe('cells:ii-v-chromatic')
    expect(shareViewFrom({ line: 'cells:1-2-3-5~free' })).toEqual({ line: 'cells:1-2-3-5' })
  })

  it("carries the Changes sheet's Approach (#298), dropping an unknown one", async () => {
    for (const approach of ['enclosure', 'chromatic-below', 'none'] as const) {
      const view = { sheet: 'changes', line: 'third', approach } as const
      expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    }
    for (const approach of ['x', '', 3, null, true]) expect(shareViewFrom({ sheet: 'changes', approach })).toEqual({ sheet: 'changes' })
  })

  it('keeps the Patterns sheet and its choices in canonical form, dropping bad ones', () => {
    expect(shareViewFrom({ sheet: 'patterns', pattern: '+2 -1', patternNotes: 'chord', patternDir: 'up-down' })).toEqual({ sheet: 'patterns', pattern: '+2 −1', patternNotes: 'chord', patternDir: 'up-down' })
    expect(shareViewFrom({ sheet: 'patterns', pattern: '+0', patternNotes: 'x', patternDir: 'sideways' })).toEqual({ sheet: 'patterns' })
  })

  it('keeps the Arpeggios sheet and its choices, dropping bad ones', () => {
    expect(shareViewFrom({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })).toEqual({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })
    expect(shareViewFrom({ sheet: 'arpeggios', arpNotes: 'pairs', arpShape: 'block' })).toEqual({ sheet: 'arpeggios', arpNotes: 'pairs', arpShape: 'block' }) // #436
    expect(shareViewFrom({ sheet: 'arpeggios', arpShape: 'stacked' })).toEqual({ sheet: 'arpeggios' })
    expect(shareViewFrom({ sheet: 'arps', arpNotes: 'ninth', arpDir: 'sideways' })).toBeUndefined()
  })

  it("carries the Pentatonic line's Leave out and direction with an arpeggio line (#284); a bad one, or an old link's none, is absent", async () => {
    const view = { sheet: 'changes', line: 'up-root', arpDir: 'down', pentLeave: 'b3' } as const
    expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    for (const pentLeave of ['3', '♭3', 1, null]) expect(shareViewFrom({ sheet: 'changes', pentLeave })).toEqual({ sheet: 'changes' })
  })

  it("carries the Triad pair line's shape with an arpeggio line (#432); a bad one, or an old link's none, is absent", async () => {
    const view = { sheet: 'changes', line: 'up-root', arpDir: 'up', pairLine: 'climb' } as const
    expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    for (const pairLine of ['Climb', 'block', 1, null]) expect(shareViewFrom({ sheet: 'changes', pairLine })).toEqual({ sheet: 'changes' })
  })

  it('read any other line as none (absent), and the old guideLine not at all', async () => {
    for (const line of ['off', 'both', 'Up · root', true, 3, null]) expect(shareViewFrom({ sheet: 'changes', line })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ sheet: 'changes', guideLine: 'third' })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ fromThird: true, fromSeventh: true, guideThird: true, guideSeventh: true })).toBeUndefined()
    expect(await decodeShare(await packed({ v: 2, chart: CHART, view: { sheet: 'changes', fromSeventh: true } }))).toEqual({ chart: CHART, view: { sheet: 'changes' } })
  })

  it('drop the retired Guide tones sheet from an old link, keeping the rest of its view', async () => {
    expect(shareViewFrom({ sheet: 'guideTones', numerals: true })).toEqual({ numerals: true })
    expect(await decodeShare(await packed({ v: 2, chart: CHART, view: { sheet: 'guideTones', mode: 'root' } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it('carry function cells and @key lines unchanged', async () => {
    const chart = 'title: T\n\nsection: A\nkey: D\nbars: 4\n1 | D7 |  | V7/V\n'
    expect((await decodeShare(await encodeShare({ chart })))?.chart).toBe(chart)
  })
})

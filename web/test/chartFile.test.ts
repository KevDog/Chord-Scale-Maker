import { describe, expect, it } from 'vitest'
import { readChartFile } from '~/utils/chartFile'

const file = (body: string, name = 'tune.txt', type = 'text/plain'): File => new File([body], name, { type })

describe('chart files', () => {
  it('read a .txt chart, without a byte-order mark', async () => {
    expect(await readChartFile(file('title: Tune\n\nsection: A\nbars: 4\n1 | Cm7 | C Dorian\n'))).toEqual({ ok: true, text: 'title: Tune\n\nsection: A\nbars: 4\n1 | Cm7 | C Dorian\n', kind: 'chart' })
    expect((await readChartFile(file('title: T\n', 'TUNE.TXT', ''))).ok).toBe(true)
  })

  it('turn away other files, empty ones and oversized ones', async () => {
    expect(await readChartFile(file('x', 'photo.png', 'image/png'))).toMatchObject({ ok: false, error: /\.txt/ })
    expect(await readChartFile(file('   \n'))).toMatchObject({ ok: false, error: /empty/ })
    expect(await readChartFile(file('x'.repeat(20_001)))).toMatchObject({ ok: false, error: /too big/ })
    expect(await readChartFile(file('a\u0000b'))).toMatchObject({ ok: false, error: /plain text/ })
  })

  it('an .html file is an iReal export when iReal is on, and turned away when it’s off', async () => {
    const html = '<a href="irealb://T%3DC%3D%3DS%3DC%3D%3D1r34LbKcu7%5BC7%20Z%3D%3D0%3D0">T</a>'
    expect(await readChartFile(file(html, 'Tune.html', 'text/html'), { ireal: true })).toEqual({ ok: true, text: html, kind: 'ireal' })
    expect(await readChartFile(file(html, 'Tune.html', 'text/html'))).toMatchObject({ ok: false, error: /\.txt/ })
    expect(await readChartFile(file('title: T\n'), { ireal: true })).toMatchObject({ ok: true, kind: 'chart' })
  })

  it('an iReal export over 4 MB is too big, and says so in its own terms', async () => {
    const big = new File(['x'.repeat(4_000_001)], 'Set.html', { type: 'text/html' })
    expect(await readChartFile(big, { ireal: true })).toEqual({ ok: false, error: 'That file is too big for an iReal Pro export (over 4 MB).' })
  })

  it('.htm is an export too', async () => {
    expect(await readChartFile(file('<html>', 'x.htm', 'text/html'), { ireal: true })).toMatchObject({ ok: true, kind: 'ireal' })
  })
})

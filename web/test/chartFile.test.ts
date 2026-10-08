import { describe, expect, it } from 'vitest'
import { readChartFile } from '~/utils/chartFile'

const file = (body: string, name = 'tune.txt', type = 'text/plain'): File => new File([body], name, { type })

describe('chart files', () => {
  it('read a .txt chart, without a byte-order mark', async () => {
    expect(await readChartFile(file('﻿title: Tune\nA | 1 | Cm7 | C Dorian\n'))).toEqual({ ok: true, text: 'title: Tune\nA | 1 | Cm7 | C Dorian\n' })
    expect((await readChartFile(file('title: T\n', 'TUNE.TXT', ''))).ok).toBe(true)
  })

  it('turn away other files, empty ones and oversized ones', async () => {
    expect(await readChartFile(file('x', 'photo.png', 'image/png'))).toMatchObject({ ok: false, error: /\.txt/ })
    expect(await readChartFile(file('   \n'))).toMatchObject({ ok: false, error: /empty/ })
    expect(await readChartFile(file('x'.repeat(20_001)))).toMatchObject({ ok: false, error: /too big/ })
    expect(await readChartFile(file('a\u0000b'))).toMatchObject({ ok: false, error: /plain text/ })
  })
})

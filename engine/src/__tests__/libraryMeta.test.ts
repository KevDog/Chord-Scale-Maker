import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { tuneGaps } from '../tune'
import { isSyncCopy } from '../util'

/** every library chart has what its tune page needs (title, key, style, form; a tune's composer): the fix is in the message */
describe('library charts', () => {
  it('leave no tune-page gaps', () => {
    const gaps = readdirSync('charts')
      .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
      .flatMap((f) => tuneGaps(parseChart(readFileSync(`charts/${f}`, 'utf8')).value).map((g) => `${f}: ${g}`))
    expect(gaps).toEqual([])
  })
})

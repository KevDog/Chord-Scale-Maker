import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chartsPlugin } from './charts'

const load = (dir: string, id: string): unknown => (chartsPlugin(dir).load as (id: string) => unknown)(id)

describe('chartsPlugin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'charts-'))
  writeFileSync(join(dir, 'a.txt'), 'title: A\nsource: Some Book, p. 12\n\nA | 1 | C\n')

  it('loads a raw chart without its source: line', () => {
    expect(load(dir, join(dir, 'a.txt') + '?raw')).toBe(`export default ${JSON.stringify('title: A\n\nA | 1 | C\n')}`)
  })

  it('leaves every other import to Vite', () => {
    expect(load(dir, join(dir, 'a.txt'))).toBeUndefined()
    expect(load(join(dir, 'other'), join(dir, 'a.txt') + '?raw')).toBeUndefined()
  })
})

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

describe('public/analytics-before-send.js', () => {
  it('queues a beforeSend that drops the part after "#" and keeps the rest', () => {
    const window: { vaq?: [string, (e: { type: string; url: string }) => unknown][] } = {}
    runInNewContext(readFileSync(new URL('../public/analytics-before-send.js', import.meta.url), 'utf8'), { window, URL, Object })
    const [name, hook] = window.vaq?.[0] ?? []
    expect(name).toBe('beforeSend')
    expect(hook?.({ type: 'pageview', url: 'https://www.chordscalemaker.com/song?x=1#s=SECRETCHART' })).toEqual({
      type: 'pageview',
      url: 'https://www.chordscalemaker.com/song?x=1',
    })
  })
})

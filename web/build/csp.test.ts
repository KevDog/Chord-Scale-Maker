import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { addCspMeta, contentSecurityPolicy, inlineScriptHashes } from './csp'

const sha = (s: string): string => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`
const PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<script type="importmap">{"imports":{"#entry":"/_nuxt/a.js"}}</script>
<script src="/theme-init.js"></script>
<script>window.__NUXT__={};window.__NUXT__.config={public:{}}</script>
<script type="application/json" id="__NUXT_DATA__">[{}]</script>
</head><body><div id="__nuxt"></div></body></html>`

describe('csp', () => {
  it('hashes executable inline scripts, including import maps, but not data blocks or external scripts', () => {
    expect(inlineScriptHashes(PAGE)).toEqual([
      sha('{"imports":{"#entry":"/_nuxt/a.js"}}'),
      sha('window.__NUXT__={};window.__NUXT__.config={public:{}}'),
    ])
  })

  it('builds a strict policy around those hashes', () => {
    const policy = contentSecurityPolicy(["'sha256-x'"])
    expect(policy).toContain("script-src 'self' 'sha256-x'")
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("font-src 'self' data:") // VexFlow's embedded Bravura font
    expect(policy).not.toMatch(/script-src[^;]*unsafe/)
  })

  it('puts the policy first in <head>, before any script it governs', () => {
    const out = addCspMeta(PAGE)
    const meta = out.indexOf('http-equiv="Content-Security-Policy"')
    expect(meta).toBeGreaterThan(out.indexOf('<head>'))
    expect(meta).toBeLessThan(out.indexOf('<script'))
    expect(out).toContain(sha('window.__NUXT__={};window.__NUXT__.config={public:{}}'))
    expect(addCspMeta(out)).toBe(out) // idempotent
  })

  it('leaves non-HTML untouched', () => {
    expect(addCspMeta('{"a":1}')).toBe('{"a":1}')
  })
})

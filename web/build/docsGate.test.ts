import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docsGate } from './docsGate'

const COMPONENT = 'web/app/components/X.vue'

describe('docsGate', () => {
  it('passes a charts-only PR', () => {
    expect(docsGate(['engine/charts/x.txt', 'engine/fixtures/golden.json'], null)).toEqual({ ok: true, why: 'no user-facing change' })
  })

  it('passes engine tests alone', () => {
    expect(docsGate(['engine/src/__tests__/a.test.ts'], null).ok).toBe(true)
  })

  it('passes a behaviour change with Help changed', () => {
    expect(docsGate([COMPONENT, 'web/app/pages/help.vue'], null)).toEqual({ ok: true, why: 'docs changed' })
  })

  it('passes a decisions.ts change alone', () => {
    expect(docsGate(['engine/src/decisions.ts'], null)).toEqual({ ok: true, why: 'docs changed' })
  })

  it('fails a user-facing change with no docs, naming what triggered it', () => {
    const r = docsGate([COMPONENT, 'engine/chord_scales.json', 'web/app/composables/useX.ts', 'web/app/pages/song/[slug].vue', 'engine/src/scales.ts', 'README.md'], '')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.triggers).toEqual([COMPONENT, 'engine/chord_scales.json', 'web/app/composables/useX.ts', 'web/app/pages/song/[slug].vue', 'engine/src/scales.ts'])
    expect(r.message).toContain(COMPONENT)
    expect(r.message).toContain('Docs: none — ')
  })

  it('passes with the escape line: two hyphens, not first, CRLF', () => {
    expect(docsGate([COMPONENT], 'Fixes #1\r\n\r\nDocs: none -- internal refactor\r\n')).toEqual({ ok: true, why: 'Docs: none — internal refactor' })
  })

  it('passes with the escape line: an em dash', () => {
    expect(docsGate([COMPONENT], 'Docs: none — tooling only').ok).toBe(true)
  })

  it('fails an empty reason', () => {
    expect(docsGate([COMPONENT], 'Docs: none — ').ok).toBe(false)
    expect(docsGate([COMPONENT], 'Docs: none —   \nnext').ok).toBe(false)
  })

  it('fails the PR template left as it is: a comment is no reason', () => {
    const template = readFileSync(new URL('../../.github/pull_request_template.md', import.meta.url), 'utf8')
    expect(docsGate([COMPONENT], template).ok).toBe(false)
    expect(docsGate([COMPONENT], template.replace('Docs: none — <!--', 'Docs: none — tests only <!--')).ok).toBe(true)
  })

  it('fails a null body', () => {
    expect(docsGate([COMPONENT], null).ok).toBe(false)
  })

  it('fails the line indented or lower-case', () => {
    expect(docsGate([COMPONENT], 'docs: none — x').ok).toBe(false)
    expect(docsGate([COMPONENT], '  Docs: none — x').ok).toBe(false)
  })

  it('lists at most ten triggering files in the message', () => {
    const files = Array.from({ length: 12 }, (_, i) => `web/app/components/C${i}.vue`)
    const r = docsGate(files, null)
    if (r.ok) throw new Error('expected a failure')
    expect(r.triggers).toHaveLength(12)
    expect(r.message).not.toContain('C10.vue')
    expect(r.message).toContain('and 2 more')
  })
})

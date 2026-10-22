import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docsGate, RELEASE_NOTES_FILE } from './docsGate'

const COMPONENT = 'web/app/components/X.vue'
const HELP = 'web/app/pages/help.vue'
const NOTE = 'Release notes: none — internal only'

describe('docsGate', () => {
  it('passes a charts-only PR', () => {
    expect(docsGate(['engine/charts/x.txt', 'engine/fixtures/golden.json'], null)).toEqual({ ok: true, why: 'no user-facing change' })
  })

  it('passes engine tests alone', () => {
    expect(docsGate(['engine/src/__tests__/a.test.ts'], null).ok).toBe(true)
  })

  it('passes a behavior change with Help and the release notes changed', () => {
    expect(docsGate([COMPONENT, HELP, RELEASE_NOTES_FILE], null)).toEqual({ ok: true, why: 'docs changed; release notes changed' })
  })

  it('passes a decisions.ts change alone', () => {
    expect(docsGate(['engine/src/decisions.ts'], null)).toEqual({ ok: true, why: 'docs changed' })
  })

  it('fails a user-facing change with no docs, naming what triggered it', () => {
    const r = docsGate([COMPONENT, 'engine/chord_scales.json', 'web/app/composables/useX.ts', 'web/app/pages/song/[slug].vue', 'engine/src/scales.ts', 'README.md', RELEASE_NOTES_FILE], '')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.triggers).toEqual([COMPONENT, 'engine/chord_scales.json', 'web/app/composables/useX.ts', 'web/app/pages/song/[slug].vue', 'engine/src/scales.ts'])
    expect(r.message).toContain(COMPONENT)
    expect(r.message).toContain('Docs: none — ')
    expect(r.message).not.toContain('Release notes: none — ')
  })

  it('passes with the escape line: two hyphens, not first, CRLF', () => {
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], 'Fixes #1\r\n\r\nDocs: none -- internal refactor\r\n')).toEqual({ ok: true, why: 'Docs: none — internal refactor; release notes changed' })
  })

  it('passes with the escape line: an em dash', () => {
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], 'Docs: none — tooling only').ok).toBe(true)
  })

  it('passes with the escape line: an en dash, or no space around the dash (#407)', () => {
    for (const line of ['Docs: none – tests only', 'Docs: none —tests only', 'Docs: none—tests only', 'Docs: none --tests only']) {
      expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], line), line).toEqual({ ok: true, why: 'Docs: none — tests only; release notes changed' })
    }
    expect(docsGate([COMPONENT, HELP], 'Release notes: none – internal').ok).toBe(true)
  })

  it('fails an empty reason', () => {
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], 'Docs: none — ').ok).toBe(false)
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], 'Docs: none —   \nnext').ok).toBe(false)
  })

  it('fails the PR template left as it is: a comment is no reason', () => {
    const template = readFileSync(new URL('../../.github/pull_request_template.md', import.meta.url), 'utf8')
    expect(docsGate([COMPONENT], template).ok).toBe(false)
    const filled = template.replace('Docs: none — <!--', 'Docs: none — tests only <!--')
    expect(docsGate([COMPONENT], filled).ok).toBe(false)
    expect(docsGate([COMPONENT], filled.replace('Release notes: none — <!--', 'Release notes: none — tests only <!--')).ok).toBe(true)
  })

  it('fails a null body', () => {
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], null).ok).toBe(false)
  })

  it('fails the line indented or lower-case', () => {
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], 'docs: none — x').ok).toBe(false)
    expect(docsGate([COMPONENT, RELEASE_NOTES_FILE], '  Docs: none — x').ok).toBe(false)
  })

  it('lists at most ten triggering files in the message', () => {
    const files = Array.from({ length: 12 }, (_, i) => `web/app/components/C${i}.vue`)
    const r = docsGate(files, null)
    if (r.ok) throw new Error('expected a failure')
    expect(r.triggers).toHaveLength(12)
    expect(r.message).not.toContain('C10.vue')
    expect(r.message).toContain('and 2 more')
  })

  describe('the release notes', () => {
    it('fails a user-facing change with docs but no note, saying how to add one', () => {
      const r = docsGate([COMPONENT, HELP], null)
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.message).toContain(RELEASE_NOTES_FILE)
      expect(r.message).toContain('Release notes: none — ')
      expect(r.message).not.toContain('Docs: none — ')
    })

    it('passes with the note’s escape line: an em dash, two hyphens, CRLF', () => {
      expect(docsGate([COMPONENT, HELP], NOTE)).toEqual({ ok: true, why: 'docs changed; Release notes: none — internal only' })
      expect(docsGate([COMPONENT, HELP], 'x\r\nRelease notes: none -- refactor\r\n').ok).toBe(true)
    })

    it('needs both escapes when neither docs nor a note changed', () => {
      expect(docsGate([COMPONENT], 'Docs: none — refactor').ok).toBe(false)
      expect(docsGate([COMPONENT], 'Docs: none — refactor\nRelease notes: none — refactor').ok).toBe(true)
    })

    it('fails the note’s escape with an empty reason', () => {
      expect(docsGate([COMPONENT, HELP], 'Release notes: none — ').ok).toBe(false)
    })

    it('names both requirements when both are missing', () => {
      const r = docsGate([COMPONENT], null)
      if (r.ok) throw new Error('expected a failure')
      expect(r.message).toContain('Docs: none — ')
      expect(r.message).toContain('Release notes: none — ')
    })
  })
})

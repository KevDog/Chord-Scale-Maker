import { describe, expect, it } from 'vitest'
import { chartSubmissionFrom, submissionAction, submissionMessage } from '~/utils/chartSubmission'

const lib = { kind: 'library', slug: 'autumn-leaves', libraryText: 'section: A\n1 | Cm7\n' } as const

describe('submissionAction', () => {
  it('reports a library chart as published, and suggests changes once it is edited', () => {
    expect(submissionAction(lib, lib.libraryText, true)).toEqual({ send: false, suggest: false, report: true })
    expect(submissionAction(lib, 'section: A\n1 | Cm9\n', true)).toEqual({ send: false, suggest: true, report: false })
  })

  it('sends your own, new and shared charts, beside the report', () => {
    for (const t of [{ kind: 'mine', id: 'x' } as const, { kind: 'new', id: 'y', savedKind: 'new' } as const, undefined])
      expect(submissionAction(t, 'section: A\n1 | C\n', true)).toEqual({ send: true, suggest: false, report: true })
  })

  it('only reports with the flag off', () => {
    expect(submissionAction(lib, 'section: A\n1 | Cm9\n', false)).toEqual({ send: false, suggest: false, report: true })
    expect(submissionAction({ kind: 'mine', id: 'x' }, 'section: A\n1 | C\n', false)).toEqual({ send: false, suggest: false, report: true })
  })
})

describe('the handoff', () => {
  it('pre-fills the first line', () => {
    expect(submissionMessage({ text: '', title: 'T', mode: 'new' })).toBe('A chart for the library: T\n\n')
    expect(submissionMessage({ text: '', title: 'T', slug: 't', mode: 'suggest' })).toBe('Suggested changes to T\n\n')
  })

  it('reads only a well-formed submission', () => {
    expect(chartSubmissionFrom(JSON.stringify({ text: 'section: A\n1 | C\n', title: 'T', mode: 'new' }))).toEqual({ text: 'section: A\n1 | C\n', title: 'T', mode: 'new' })
    expect(chartSubmissionFrom(JSON.stringify({ text: 'x', title: 'T', slug: 't', mode: 'suggest' }))).toEqual({ text: 'x', title: 'T', slug: 't', mode: 'suggest' })
    for (const raw of [null, '{', 'null', '{"text":1}', JSON.stringify({ text: 'x', title: 'T', mode: 'other' })]) expect(chartSubmissionFrom(raw)).toBeNull()
  })
})

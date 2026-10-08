import { describe, expect, it } from 'vitest'
import { buildVersion, type Git } from './version'

const now = new Date('2026-10-07T12:00:00Z')
const git = (answers: Record<string, string | null>): Git => (args) => answers[args[0] ?? ''] ?? null

describe('buildVersion', () => {
  it('is the commit date and short commit', () => {
    expect(buildVersion({}, git({ 'rev-parse': '1e2bea5', log: '2026-10-06T23:59:00+00:00' }), now)).toBe('2026.10.06 · 1e2bea5')
  })

  it("takes Vercel's commit, and the build date when the checkout has no history", () => {
    expect(buildVersion({ VERCEL_GIT_COMMIT_SHA: '1e2bea5f00d' }, git({}), now)).toBe('2026.10.07 · 1e2bea5')
  })

  it('says dev when there is no commit at all', () => {
    expect(buildVersion({}, git({}), new Date('2027-01-05T00:00:00Z'))).toBe('2027.01.05 · dev')
  })
})

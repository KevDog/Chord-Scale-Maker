import { execFileSync } from 'node:child_process'

/**
 * The site's version: the date of the commit it was built from, then that commit, e.g. "2026.10.07 · 1e2bea5".
 * Nothing to bump: every merge to main deploys, so the commit is the release. Vercel gives the commit in
 * VERCEL_GIT_COMMIT_SHA; the date comes from git when the checkout has history, else the build's own date (a
 * deploy follows its merge within minutes), both in UTC. Named milestones are git tags (v1-launch).
 */
export type Git = (args: readonly string[]) => string | null

/** run git in this repo, or null if it isn't there (no git, no history) */
export const runGit: Git = (args) => {
  try {
    return execFileSync('git', [...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    return null
  }
}

const dotted = (d: Date): string =>
  [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()].map((n, i) => (i ? String(n).padStart(2, '0') : String(n))).join('.')

export function buildVersion(env: Readonly<Record<string, string | undefined>>, git: Git = runGit, now: Date = new Date()): string {
  const commit = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || git(['rev-parse', '--short=7', 'HEAD']) || 'dev'
  const committed = git(['log', '-1', '--format=%cI', commit === 'dev' ? 'HEAD' : commit])
  const date = committed && !Number.isNaN(Date.parse(committed)) ? new Date(committed) : now
  return `${dotted(date)} · ${commit}`
}

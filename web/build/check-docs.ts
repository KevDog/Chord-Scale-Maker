/**
 * The docs gate (docsGate.ts) on one PR: its changed files on stdin, one a line, its description in PR_BODY.
 * Run: git diff --name-only origin/main...HEAD | PR_BODY="…" node web/build/check-docs.ts   (exits 1 on failure)
 * Imports nothing outside this folder, so CI runs it without npm ci.
 */
import { readFileSync } from 'node:fs'
import { docsGate } from './docsGate.ts'

const files = readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
const result = docsGate(files, process.env.PR_BODY ?? null)

if (!result.ok) {
  console.error(result.message)
  process.exit(1)
}
console.log(`docs: ok (${result.why})`)

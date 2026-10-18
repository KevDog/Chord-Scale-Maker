/**
 * Check every internal link and #fragment on the prerendered site resolves (links.ts), after `nuxt build`.
 * Run: node build/check-links.ts   (exits 1 on failure)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { brokenLinks } from './links.ts'

const OUTPUT = '.output/public'

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

const files = walk(OUTPUT).map((f) => relative(OUTPUT, f))
const pages = new Map(files.filter((f) => f.endsWith('.html')).map((f) => [f, readFileSync(join(OUTPUT, f), 'utf8')]))
const problems = brokenLinks(pages, new Set(files))

if (problems.length) {
  console.error(`${problems.length} broken link(s):\n${problems.join('\n')}`)
  process.exit(1)
}
console.log(`links: ${pages.size} pages, ok`)

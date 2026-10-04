/**
 * Check a Vercel build (NITRO_PRESET=vercel-static nuxt generate) ships the security headers on
 * pages and assets, and the CSP meta on every page. `nuxt preview` ignores routeRules, so the
 * E2E tests can't see headers; this checks what Vercel will actually serve.
 * Run: node build/check-headers.ts   (exits 1 on failure)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SECURITY_HEADERS } from './headers.ts'

type Route = { src?: string; headers?: Record<string, string> }

const OUTPUT = '.vercel/output'
const routes = (JSON.parse(readFileSync(join(OUTPUT, 'config.json'), 'utf8')) as { routes: Route[] }).routes
const problems: string[] = []

for (const src of ['/(.*)', '/_nuxt/(.*)']) {
  const headers = Object.fromEntries(
    Object.entries(routes.find((r) => r.src === src)?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  )
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    if (headers[name.toLowerCase()] !== value) problems.push(`${src}: ${name} is ${headers[name.toLowerCase()] ?? 'missing'}`)
}

const pages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  )
for (const page of pages(join(OUTPUT, 'static')))
  if (!readFileSync(page, 'utf8').includes('http-equiv="Content-Security-Policy"')) problems.push(`${page}: no CSP meta`)

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('security headers and CSP meta: ok')

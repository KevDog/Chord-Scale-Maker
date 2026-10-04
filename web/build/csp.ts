import { createHash } from 'node:crypto'

/**
 * Content-Security-Policy for the static site, added to each prerendered page as a <meta> tag.
 * Nuxt's HTML has two small inline scripts (an import map and the runtime config) whose contents
 * change per build, so they are allowed by hash, computed at build time, never 'unsafe-inline'.
 * frame-ancestors can't be set from <meta>; it is sent as a header (see nuxt.config.ts routeRules).
 */

/** script types the browser executes (CSP script-src applies); data blocks like application/json don't */
const EXECUTABLE = new Set(['', 'module', 'text/javascript', 'application/javascript', 'importmap'])

/** browsers hash the script text after normalising line endings to LF */
const sha256 = (text: string): string =>
  `'sha256-${createHash('sha256').update(text.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1] ?? ''
    if (/(?:^|\s)src\s*=/i.test(attrs)) continue // not data-src
    const type = (/(?:^|\s)type\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] ?? '').toLowerCase()
    if (EXECUTABLE.has(type)) hashes.push(sha256(m[2] ?? ''))
  }
  return hashes
}

export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", // Vue and VexFlow set style attributes
    "img-src 'self' data:",
    "font-src 'self' data:", // VexFlow's Bravura font is embedded as a data: URL
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * add the CSP <meta> to <head>, after <meta charset> (which must stay in the first 1024 bytes)
 * and so before every script; non-HTML and pages that already have one are unchanged
 */
export function addCspMeta(html: string): string {
  if (!/<head[^>]*>/i.test(html) || html.includes('http-equiv="Content-Security-Policy"')) return html
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScriptHashes(html))}">`
  if (/<meta charset[^>]*>/i.test(html)) return html.replace(/(<meta charset[^>]*>)/i, `$1${meta}`)
  return html.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
}

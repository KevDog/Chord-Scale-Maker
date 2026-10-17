import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The offline service worker (#324): public/sw.js is written after the build, from build/service-worker.js and the
 * list of files to precache. A same-origin file, registered by plugins/serviceWorker.client.ts, so the CSP needs no
 * change (worker-src falls back to script-src 'self'). The song pages aren't precached: the worker caches each one
 * when it's visited, and an unvisited one opens from Nuxt's client-only shell, /200.html (its chart is in the chunks).
 */

/** top-level files a page loads (icons, manifest, theme script) and the app shell (200.html, the offline fallback);
 *  not og-image.png, robots.txt or the sitemap */
const PAGE_FILE = /^(?:200\.html|favicon\.\w+|icon-[\w-]+\.png|apple-touch-icon\.png|site\.webmanifest|theme-init\.js|analytics-before-send\.js)$/

/** the URL a built file is served at, if it is precached: app chunks, page shells and their payloads but no song's */
function precacheUrl(file: string): string | undefined {
  const path = file.replace(/\\/g, '/')
  if (path.startsWith('_nuxt/')) return `/${path}`
  if (PAGE_FILE.test(path)) return `/${path}`
  const page = /^(?:(.+)\/)?(index\.html|_payload\.json)$/.exec(path)
  if (!page || page[1]?.startsWith('song/')) return undefined
  const dir = page[1] ? `/${page[1]}` : ''
  return page[2] === 'index.html' ? dir || '/' : `${dir}/_payload.json`
}

/** the URLs to precache, sorted, from the built site's files (paths relative to its public folder) */
export function precacheUrls(files: readonly string[]): string[] {
  return files.flatMap((f) => precacheUrl(f) ?? []).sort()
}

/** the worker's source: its version and precache list, then the worker itself */
export function serviceWorkerSource(version: string, urls: readonly string[], worker: string): string {
  return `const VERSION = ${JSON.stringify(version)}\nconst PRECACHE = ${JSON.stringify(urls)}\n${worker.trimEnd()}\n`
}

/** write sw.js into the built site; its version hashes the precached files, so a new build replaces the cache */
export function writeServiceWorker(publicDir: string): void {
  const files = (readdirSync(publicDir, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name).slice(publicDir.length + 1))
  const urls = precacheUrls(files)
  const hash = createHash('sha256')
  for (const url of urls) hash.update(url).update(readFileSync(join(publicDir, fileOf(url))))
  const worker = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
  writeFileSync(join(publicDir, 'sw.js'), serviceWorkerSource(hash.digest('hex').slice(0, 12), urls, worker))
}

/** a precached URL's file in the built site */
const fileOf = (url: string): string => (/\.\w+$/.test(url) ? url.slice(1) : join(url.slice(1), 'index.html'))

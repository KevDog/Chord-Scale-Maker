/**
 * Every internal link on the prerendered site resolves: its page (or asset) is in the output and its #fragment is an
 * id on that page. Only <a href>; external links, mailto/tel and the server's /api/ are skipped (no network).
 * Run over .output/public by check-links.ts.
 */

const SKIP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/api\/)/i
const ANCHOR = /<a\b[^>]*?\shref="([^"]*)"/g
const ID = /\sid="([^"]*)"/g

const unescape = (s: string): string => s.replaceAll('&amp;', '&')
const decode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** the output file a path is served from: the file itself, its index.html, or name.html */
const resolve = (path: string, files: ReadonlySet<string>): string | undefined => {
  const p = path.replace(/^\/+|\/+$/g, '')
  return [p, p ? `${p}/index.html` : 'index.html', `${p}.html`].find((f) => f && files.has(f))
}

/**
 * pages: each .html file's output-relative path → its HTML; files: every output-relative file path.
 * Gives "<page>: <href> (missing page|missing #fragment)", sorted.
 */
export const brokenLinks = (pages: ReadonlyMap<string, string>, files: ReadonlySet<string>): string[] => {
  const ids = new Map<string, ReadonlySet<string>>()
  const idsOf = (page: string): ReadonlySet<string> => {
    if (!ids.has(page)) ids.set(page, new Set([...(pages.get(page) ?? '').matchAll(ID)].map((m) => unescape(m[1]!))))
    return ids.get(page)!
  }
  const problems: string[] = []
  for (const [page, html] of pages) {
    for (const [, raw] of html.matchAll(ANCHOR)) {
      const href = unescape(raw!)
      if (!href || SKIP.test(href)) continue
      const [beforeHash, fragment] = href.split('#', 2) as [string, string | undefined]
      const path = beforeHash.split('?')[0]!
      const target = path ? resolve(path, files) : page
      if (!target) {
        problems.push(`${page}: ${href} (missing page)`)
        continue
      }
      if (fragment && pages.has(target) && !idsOf(target).has(decode(fragment))) problems.push(`${page}: ${href} (missing #${fragment})`)
    }
  }
  return problems.sort()
}

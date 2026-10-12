import { canonicalUrl } from './site'

const escapeXml = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** sitemap.xml for search engines: each page once, at its canonical URL (no lastmod: Vercel's shallow clone has no history) */
export const sitemapXml = (paths: readonly string[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...new Set(paths)].map((p) => `  <url><loc>${escapeXml(canonicalUrl(p))}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')

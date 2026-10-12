import { isSyncCopy } from '@chord-scale-maker/engine'
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

/** every chart file's name, from a listing of the engine's charts/ (the config can't load the library's #charts glob) */
export const chartSlugsOf = (files: readonly string[]): string[] =>
  files.filter((f) => f.endsWith('.txt') && !isSyncCopy(f)).map((f) => f.replace(/\.txt$/, ''))

/** the pages search engines should find, prerendered too: the site's, then each library song; never a bare /song (noindex) or /ui */
export const sitemapPaths = (songPaths: readonly string[]): string[] => ['/', '/help', '/functions', '/about', '/contact', '/privacy', ...songPaths]

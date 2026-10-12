import { isSyncCopy } from '@chord-scale-maker/engine'
import { canonicalUrl, tunePath } from './site'

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

/** every chart file's tune page */
export const tunePathsOf = (files: readonly string[]): string[] => chartSlugsOf(files).map(tunePath)

/** the pages search engines should find, prerendered too; never /song (noindex) or /ui */
export const sitemapPaths = (tunePaths: readonly string[]): string[] => ['/', '/help', '/functions', '/about', '/contact', '/privacy', ...tunePaths]

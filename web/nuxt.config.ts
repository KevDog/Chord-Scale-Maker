import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { analyticsScripts } from './build/analytics'
import { chartsPlugin } from './build/charts'
import { addCspMeta } from './build/csp'
import { quotesPlugin } from './build/quotes'
import { SECURITY_HEADERS } from './build/headers'
import { buildVersion } from './build/version'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, songPath } from './app/utils/site'
import { chartSlugsOf, sitemapPaths } from './app/utils/sitemap'

/** the engine package's folder (engine/ in the workspace): its charts/ is the library */
const ENGINE_DIR = dirname(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))

/** the pages search engines should find (server/routes/sitemap.xml.ts): the site's, then every library song */
// (the library's charts, by file name: the config can't load the #charts glob)
const CHART_SLUGS = chartSlugsOf(readdirSync(join(ENGINE_DIR, 'charts')))
const SITEMAP_PATHS = sitemapPaths(CHART_SLUGS.map((s) => songPath(s)))

/** dev: the engine's charts/ and chord_scales.json sit outside Vite's root, so it doesn't watch them by itself
 *  (quotes.json is watched by its own plugin) */
const watchRepoData = (): Plugin => ({
  name: 'watch-repo-data',
  configureServer(server) {
    server.watcher.add([join(ENGINE_DIR, 'charts'), join(ENGINE_DIR, 'chord_scales.json')])
  },
})

// Fully static site (nuxt generate). Engine + rendering run in the browser; see docs/design.md.
export default defineNuxtConfig({
  // copies a sync tool (iCloud, Finder) makes beside changed files, "arrivalHash.client 2.ts": never load them as
  // plugins, components or pages (that one ran on the server and broke every page in `make dev`)
  ignore: ['**/* [0-9].*'],
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  // the library's charts, from the engine package (app/utils/library.ts)
  alias: { '#charts': join(ENGINE_DIR, 'charts') },
  // the engine is TypeScript source in a workspace package: compile it into the server bundle too (prerendering)
  build: { transpile: ['@chord-scale-maker/engine'] },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: SITE_NAME,
      meta: [
        { name: 'description', content: SITE_DESCRIPTION }, // a fallback: pages set their own (utils/site.ts)
        { name: 'theme-color', content: '#123e85' },
        // the link preview on Facebook, Slack, iMessage and the like (Open Graph); the image is drawn by
        // scripts/icons.mjs. Pages set og:title and og:description; app.vue sets og:url to the canonical URL.
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Chord Scale Maker: practice sheets for jazz improvisation' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      // the icons are drawn by scripts/icons.mjs (npm run icons)
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      // sets the dark class before first paint. A file, not inline, so it needs no CSP hash
      // (Nuxt's own inline scripts still do: see docs/design.md §9)
      // + Vercel Web Analytics in production builds (build/analytics.ts): same-origin files, so no CSP change
      script: [{ src: '/theme-init.js' }, ...analyticsScripts(process.env)],
    },
  },
  runtimeConfig: {
    // the contact form (server/api/contact.post.ts): NUXT_CONTACT_RESEND_API_KEY, NUXT_CONTACT_TO, NUXT_CONTACT_FROM;
    // NUXT_CONTACT_DRY_RUN=true validates without sending (local builds, e2e). Server-only: never sent to the page.
    contact: { resendApiKey: '', to: '', from: '', dryRun: false },
    public: {
      version: buildVersion(process.env), // "2026.10.07 · 1e2bea5": the commit's date and the commit (build/version.ts)
      // feature flags (useFeature): new ones start off; NUXT_PUBLIC_FEATURES_<NAME>=true|false overrides one
      features: {
        myCharts: true, // My charts: edits and new charts saved in this browser, files, share links (docs/plan-saving.md); on since sign-off
        practice: true, // highlight a chosen subset of each scale's notes (docs/plan-practice.md); on since sign-off
        changes: true, // the Changes sheet: the chart as a study lead sheet, numerals and scales under the chords (docs/plan-changes.md); on since sign-off
        keySignatures: true, // the clef and key signature once, at the start of each sheet (docs/superpowers/specs/2026-10-10-key-signatures-design.md); on since sign-off
        arpeggios: true, // 7th chord arpeggios: the Changes sheet's 7th Chords line and the Arpeggios sheet (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md, 2026-10-12-arpeggios-sheet-design.md); on since sign-off
        compactRail: true, // phones: the rail holds Work on, Instrument, Controls (a dialog of the rest), Print and More (docs/superpowers/specs/2026-10-12-interface-review-design.md §A); on since sign-off
        functions: true, // author functions, @key areas and live analysis notes (docs/superpowers/specs/2026-10-09-chart-functions-design.md); on since sign-off
        pentatonics: false, // pentatonic tension ladders: the Changes sheet's Pentatonics row (docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md)
      },
    },
  },
  // '/_nuxt/**' too: Nitro emits a separate cache-header route for assets that ends Vercel's routing
  hooks: {
    // the /ui component showcase is for development only
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') pages.splice(0, pages.length, ...pages.filter((p) => p.path !== '/ui'))
    },
  },
  routeRules: {
    '/**': { headers: SECURITY_HEADERS },
    '/_nuxt/**': { headers: SECURITY_HEADERS },
    '/tunes/**': { redirect: { to: '/song/**', statusCode: 301 } },
  },
  nitro: {
    // every page is prerendered and served as a static file; only /api/contact (and unknown URLs) run on the server
    // the library songs are in the sitemap
    prerender: { routes: [...SITEMAP_PATHS, '/song', '/sitemap.xml'] },
    virtual: { '#sitemap-paths': `export default ${JSON.stringify(SITEMAP_PATHS)}` },
    hooks: {
      // hash each page's inline scripts into a CSP <meta> (build/csp.ts)
      'prerender:generate'(route) {
        if (route.fileName?.endsWith('.html') && typeof route.contents === 'string') route.contents = addCspMeta(route.contents)
      },
    },
  },
  vite: {
    plugins: [tailwindcss(), watchRepoData(), chartsPlugin(join(ENGINE_DIR, 'charts')), quotesPlugin(fileURLToPath(new URL('../data/quotes.json', import.meta.url)))],
    // the engine package (engine/, beside web/: its source, chord_scales.json, charts) and the navbar quotes (../data)
    server: { fs: { allow: ['..'] } },
  },
})

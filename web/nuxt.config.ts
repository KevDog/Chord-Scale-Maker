import { readdirSync, readFileSync } from 'node:fs'
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
import { writeServiceWorker } from './build/sw'
import { buildVersion } from './build/version'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, songPath } from './app/utils/site'
import { chartSlugsOf, sitemapPaths, songSlugs } from './app/utils/sitemap'
import { composerIndex } from '@chord-scale-maker/engine'

/** the link preview image's alt text (the image is scripts/icons.mjs's) */
const OG_IMAGE_ALT = `${SITE_NAME}: ${SITE_TAGLINE.toLowerCase()}`

/** the engine package's folder (engine/ in the workspace): its charts/ is the library */
const ENGINE_DIR = dirname(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))

/** the pages search engines should find (server/routes/sitemap.xml.ts): the site's, the scales, the composers, then every library song */
// (the library's charts, by file name: the config can't load the #charts glob)
const CHARTS = chartSlugsOf(readdirSync(join(ENGINE_DIR, 'charts'))).map((slug) => ({ slug, text: readFileSync(join(ENGINE_DIR, 'charts', `${slug}.txt`), 'utf8') }))
// a tune's other versions are prerendered but not listed: their canonical is the main chart's (#411)
const SONGS = songSlugs(CHARTS)
const COMPOSER_SLUGS = composerIndex(CHARTS.filter((c) => SONGS.main.includes(c.slug))).map((c) => c.slug)
const SITEMAP_PATHS = sitemapPaths(SONGS.main.map((s) => songPath(s)), COMPOSER_SLUGS)

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
        { name: 'application-name', content: SITE_NAME },
        { name: 'apple-mobile-web-app-title', content: SITE_NAME },
        // the link preview on Facebook, Slack, iMessage and the like (Open Graph); the image is drawn by
        // scripts/icons.mjs; a library song's own is drawn by scripts/og.ts (utils/songHead.ts). Pages set og:title and
        // og:description; app.vue sets og:url to the canonical URL.
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: OG_IMAGE_ALT },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
        { name: 'twitter:image:alt', content: OG_IMAGE_ALT },
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
      // feature flags (useFeature). A new one starts off here; NUXT_PUBLIC_FEATURES_<NAME>=true|false
      // overrides one, and the e2e script (package.json) builds with each on
      features: {
        offline: true, // the offline service worker and the Help page's install line (#324; build/sw.ts)
        // six anonymous Web Analytics events (#149; docs/superpowers/specs/2026-10-12-analytics-routes-events-design.md): Pro only
        analyticsEvents: false,
        cells: true, // the Changes sheet's Cells line (#298)
        approaches: true, // the guide tone line's Approach (#298)
        patterns: true, // the Patterns sheet (#298; docs/superpowers/specs/2026-10-17-practice-patterns-design.md)
        recordings: true, // a library song's notable recording (docs/superpowers/specs/2026-10-17-notable-recordings.md)
        playerRange: true, // the player's range by the Instrument (#359)
        chartSubmissions: false, // send a chart to the library from the editor (#153; docs/superpowers/specs/2026-10-12-chart-submissions-design.md)
        versions: true, // a song's version picker (#411; docs/superpowers/specs/2026-10-18-tune-versions-design.md)
        ireal: true, // iReal Pro import: Library's Open chart… and Import iReal link…, Paste bars (#261; docs/superpowers/specs/2026-10-17-ireal-import-design.md)
      },
    },
  },
  // '/_nuxt/**' too: Nitro emits a separate cache-header route for assets that ends Vercel's routing
  hooks: {
    // the offline worker's sw.js (build/sw.ts), once the pages are prerendered and the chunks copied beside them, before
    // the server lists its static files
    'nitro:build:public-assets'(nitro) {
      writeServiceWorker(nitro.options.output.publicDir)
    },
    // the /ui component showcase is for development only
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') pages.splice(0, pages.length, ...pages.filter((p) => p.path !== '/ui'))
    },
  },
  routeRules: {
    '/**': { headers: SECURITY_HEADERS },
    '/_nuxt/**': { headers: SECURITY_HEADERS },
    '/tunes/**': { redirect: { to: '/song/**', statusCode: 301 } },
    // a retitled song keeps its old link (#372)
    '/song/yes-and-no': { redirect: { to: '/song/yes-or-no', statusCode: 301 } },
  },
  nitro: {
    // every page is prerendered and served as a static file; only /api/contact (and unknown URLs) run on the server
    // the library songs are in the sitemap
    // + /200.html, Nuxt's client-only app shell: the offline worker's fallback for a page not yet visited (build/sw.ts)
    prerender: { routes: [...SITEMAP_PATHS, ...SONGS.versions.map((s) => songPath(s)), '/song', '/200.html', '/sitemap.xml'] },
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

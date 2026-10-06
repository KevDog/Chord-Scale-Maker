import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { analyticsScripts } from './build/analytics'
import { addCspMeta } from './build/csp'
import { quotesPlugin } from './build/quotes'
import { SECURITY_HEADERS } from './build/headers'

/** dev: charts/ and chord_scales.json sit outside Vite's root, so it doesn't watch them by itself (quotes.json is
 *  watched by its own plugin) */
const watchRepoData = (): Plugin => ({
  name: 'watch-repo-data',
  configureServer(server) {
    server.watcher.add([fileURLToPath(new URL('../charts', import.meta.url)), fileURLToPath(new URL('../chord_scales.json', import.meta.url))])
  },
})

// Fully static site (nuxt generate). Engine + rendering run in the browser; see docs/design.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Chord Scale Maker',
      meta: [
        { name: 'description', content: 'Chord-scale practice sheets from a chord chart.' },
        { name: 'theme-color', content: '#123e85' },
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
      siteUrl: '', // NUXT_PUBLIC_SITE_URL, e.g. https://www.chordscalemaker.com
      issuesUrl: 'https://github.com/KevDog/Chord-Scale-Maker/issues/new',
      // feature flags (useFeature): new ones start off; NUXT_PUBLIC_FEATURES_<NAME>=true|false overrides one
      features: {
        newChart: false, // blank charts and this browser's draft; library charts stay editable
        guideTones: true, // the Guide tones sheet in the preview (docs/plan-guide-tones.md); on since sign-off
        practice: true, // highlight a chosen subset of each scale's notes (docs/plan-practice.md); on since sign-off
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
  routeRules: { '/**': { headers: SECURITY_HEADERS }, '/_nuxt/**': { headers: SECURITY_HEADERS } },
  nitro: {
    // every page is prerendered and served as a static file; only /api/contact (and unknown URLs) run on the server
    prerender: { routes: ['/', '/editor', '/about', '/contact', '/privacy'] },
    hooks: {
      // hash each page's inline scripts into a CSP <meta> (build/csp.ts)
      'prerender:generate'(route) {
        if (route.fileName?.endsWith('.html') && typeof route.contents === 'string') route.contents = addCspMeta(route.contents)
      },
    },
  },
  vite: {
    plugins: [tailwindcss(), watchRepoData(), quotesPlugin(fileURLToPath(new URL('../data/quotes.json', import.meta.url)))],
    // the engine imports ../chord_scales.json, the library reads ../charts, the navbar quotes ../data
    server: { fs: { allow: ['..'] } },
  },
})

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { addCspMeta } from './build/csp'
import { SECURITY_HEADERS } from './build/headers'

/** dev: charts/ and chord_scales.json sit outside Vite's root, so it doesn't watch them by itself */
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
      meta: [{ name: 'description', content: 'Chord-scale practice sheets from a chord chart.' }],
      // sets the dark class before first paint. A file, not inline, so it needs no CSP hash
      // (Nuxt's own inline scripts still do: see docs/design.md §9)
      script: [{ src: '/theme-init.js' }],
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: '', // NUXT_PUBLIC_SITE_URL, e.g. https://www.chordscalemaker.com
      issuesUrl: 'https://github.com/KevDog/Chord-Scale-Maker/issues/new',
      // feature flags (useFeature): off by default; NUXT_PUBLIC_FEATURES_<NAME>=true turns one on
      features: {
        newChart: false, // blank charts and this browser's draft; library charts stay editable
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
    prerender: { routes: ['/', '/editor'] },
    hooks: {
      // hash each page's inline scripts into a CSP <meta> (build/csp.ts)
      'prerender:generate'(route) {
        if (route.fileName?.endsWith('.html') && typeof route.contents === 'string') route.contents = addCspMeta(route.contents)
      },
    },
  },
  vite: {
    plugins: [tailwindcss(), watchRepoData()],
    // the engine imports ../chord_scales.json and the library reads ../charts
    server: { fs: { allow: ['..'] } },
  },
})

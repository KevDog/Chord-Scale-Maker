import tailwindcss from '@tailwindcss/vite'
import { addCspMeta } from './build/csp'

/** sent with every response (Nitro writes these into Vercel's build output); the CSP itself is a <meta> per page */
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'", // not allowed in <meta>
}

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
    },
  },
  routeRules: { '/**': { headers: SECURITY_HEADERS } },
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
    plugins: [tailwindcss()],
    // the engine imports ../chord_scales.json and the library reads ../charts
    server: { fs: { allow: ['..'] } },
  },
})

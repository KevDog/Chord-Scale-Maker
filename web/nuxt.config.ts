import tailwindcss from '@tailwindcss/vite'

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
      // sets the dark class before first paint; a file (not inline) so the CSP can stay script-src 'self'
      script: [{ src: '/theme-init.js' }],
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: '', // NUXT_PUBLIC_SITE_URL, e.g. https://www.chordscalemaker.com
      issuesUrl: 'https://github.com/KevDog/Chord-Scale-Maker/issues/new',
    },
  },
  nitro: { prerender: { routes: ['/', '/editor'] } },
  vite: {
    plugins: [tailwindcss()],
    // the engine imports ../chord_scales.json and the library reads ../charts
    server: { fs: { allow: ['..'] } },
  },
})

import { describe, expect, it } from 'vitest'
import { precacheUrls, serviceWorkerSource } from './sw'

const FILES = [
  'index.html',
  '200.html',
  '_payload.json',
  'library/index.html',
  'library/_payload.json',
  'help/index.html',
  'song/index.html',
  'song/_payload.json',
  'song/f-blues/index.html',
  'song/f-blues/_payload.json',
  '_nuxt/a1B2.js',
  '_nuxt/entry.css',
  '_nuxt/builds/latest.json',
  '_nuxt/builds/meta/abc.json',
  'favicon.ico',
  'favicon.svg',
  'icon-192.png',
  'apple-touch-icon.png',
  'site.webmanifest',
  'theme-init.js',
  'og-image.png',
  'og/autumn-leaves.png',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
]

describe('precacheUrls', () => {
  it('takes the app chunks, the app shell, the pages and their payloads, and the icons', () => {
    expect(precacheUrls(FILES)).toEqual([
      '/',
      '/200.html',
      '/_nuxt/a1B2.js',
      '/_nuxt/builds/latest.json',
      '/_nuxt/builds/meta/abc.json',
      '/_nuxt/entry.css',
      '/_payload.json',
      '/apple-touch-icon.png',
      '/favicon.ico',
      '/favicon.svg',
      '/help',
      '/icon-192.png',
      '/library',
      '/library/_payload.json',
      '/site.webmanifest',
      '/song',
      '/song/_payload.json',
      '/theme-init.js',
    ])
  })

  it('leaves out the song pages (cached when visited) and what a page never loads', () => {
    const urls = precacheUrls(FILES)
    for (const url of ['/song/f-blues', '/song/f-blues/_payload.json', '/og-image.png', '/og/autumn-leaves.png', '/robots.txt', '/sitemap.xml', '/sw.js'])
      expect(urls).not.toContain(url)
    expect(precacheUrls(['sounds/piano/33.wav'])).toEqual([]) // the sampled sounds are cached on first play, not precached
  })

  it('precaches the Stick click’s small set, so it plays offline from the start (#536)', () => {
    expect(precacheUrls(['sounds/stick/beat.wav', 'sounds/comp/45.wav'])).toEqual(['/sounds/stick/beat.wav'])
  })

  it('reads Windows paths too', () => {
    expect(precacheUrls(['library\\index.html', '_nuxt\\x.js'])).toEqual(['/_nuxt/x.js', '/library'])
  })
})

describe('serviceWorkerSource', () => {
  const worker = 'self.addEventListener("fetch", () => {})'

  it('puts the version and the precache list ahead of the worker', () => {
    const src = serviceWorkerSource('v1', ['/', '/_nuxt/a.js'], worker)
    expect(src).toContain('const VERSION = "v1"')
    expect(src).toContain('const PRECACHE = ["/","/_nuxt/a.js"]')
    expect(src.endsWith(`${worker}\n`)).toBe(true)
  })

  it('changes when the version does, so browsers install the new build', () => {
    expect(serviceWorkerSource('v1', ['/'], worker)).not.toEqual(serviceWorkerSource('v2', ['/'], worker))
  })
})

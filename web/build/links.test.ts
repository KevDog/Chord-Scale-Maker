import { describe, expect, it } from 'vitest'
import { brokenLinks } from './links'

/** a site from { path: html }; every page is also a file */
const site = (pages: Record<string, string>, assets: readonly string[] = []) =>
  brokenLinks(new Map(Object.entries(pages)), new Set([...Object.keys(pages), ...assets]))
const a = (href: string): string => `<a class="x" href="${href}">link</a>`

describe('brokenLinks', () => {
  it('passes a link to a page and an id on it', () => {
    expect(site({ 'index.html': a('/help#guide-lines'), 'help/index.html': '<h2 id="guide-lines">x</h2>' })).toEqual([])
  })

  it('passes /, /help/ and a query', () => {
    expect(site({ 'index.html': a('/') + a('/help/') + a('/song/x?key=Bb'), 'help/index.html': '', 'song/x/index.html': '' })).toEqual([])
  })

  it('passes a page written as name.html', () => {
    expect(site({ 'index.html': a('/200'), '200.html': '' })).toEqual([])
  })

  it('passes a same-page fragment', () => {
    expect(site({ 'help/index.html': a('#quick') + '<h2 id="quick">x</h2>' })).toEqual([])
  })

  it('passes a dotted id and an encoded fragment', () => {
    expect(site({ 'index.html': a('/how-it-decides#guide.move') + a('/how-it-decides#a%20b'), 'how-it-decides/index.html': '<h2 id="guide.move"></h2><h2 id="a b"></h2>' })).toEqual([])
  })

  it('passes an asset', () => {
    expect(site({ 'index.html': a('/og/x.png') }, ['og/x.png'])).toEqual([])
  })

  it('skips external links and the server’s /api/', () => {
    expect(site({ 'index.html': ['https://x.org/a', 'http://x.org', '//x.org', 'mailto:a@b.c', 'tel:1', '/api/contact'].map(a).join('') })).toEqual([])
  })

  it('reads the fragment from the first #: a second # is part of it (#407)', () => {
    expect(site({ 'index.html': a('/help#a#b'), 'help/index.html': '<h2 id="a"></h2>' })).toEqual(['index.html: /help#a#b (missing #a#b)'])
    expect(site({ 'index.html': a('/help#a#b'), 'help/index.html': '<h2 id="a#b"></h2>' })).toEqual([])
  })

  it('passes a bare #top, the top of the page with or without the id (#407)', () => {
    expect(site({ 'index.html': a('#top') + a('/help#top'), 'help/index.html': '' })).toEqual([])
  })

  it('decodes &amp;', () => {
    expect(site({ 'index.html': a('/library?a=1&amp;b=2#top'), 'library/index.html': '<div id="top"></div>' })).toEqual([])
  })

  it('reads only anchors, not <link href>', () => {
    expect(site({ 'index.html': '<link rel="preload" href="/_nuxt/gone.js">' })).toEqual([])
  })

  it('reports a missing page', () => {
    expect(site({ 'index.html': a('/nope') })).toEqual(['index.html: /nope (missing page)'])
  })

  it('reports a missing fragment, sorted by page', () => {
    expect(site({ 'z/index.html': a('/help#gone'), 'index.html': a('#here'), 'help/index.html': '' })).toEqual([
      'index.html: #here (missing #here)',
      'z/index.html: /help#gone (missing #gone)',
    ])
  })
})

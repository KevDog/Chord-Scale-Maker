import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shownQuotes } from './quotes'

describe('shownQuotes', () => {
  it('keeps cited quotes, trimmed to quote, author and topic', () => {
    const raw = {
      quotes: [
        { id: 1, author: 'Miles Davis', topic: 'improvisation', quote: "I'll play it and tell you what it is later.", source: 'Szwed', source_status: 'cited', url: 'x' },
        { id: 2, author: 'Someone', topic: 'life', quote: 'Maybe misattributed.', source_status: 'unverified' },
        { id: 3, author: '', topic: 'x', quote: 'No author', source_status: 'cited' },
        { id: 4, author: ' Bill Evans ', topic: 'practice', quote: ' Spaced. ', source_status: 'cited' },
      ],
    }
    expect(shownQuotes(raw)).toEqual([
      { quote: "I'll play it and tell you what it is later.", author: 'Miles Davis', topic: 'improvisation' },
      { quote: 'Spaced.', author: 'Bill Evans', topic: 'practice' },
    ])
  })

  it('tolerates a malformed file', () => {
    expect(shownQuotes(null)).toEqual([])
    expect(shownQuotes({ quotes: 'nope' })).toEqual([])
  })

  it('reads the real file', () => {
    const quotes = shownQuotes(JSON.parse(readFileSync('../data/quotes.json', 'utf8')))
    expect(quotes.length).toBeGreaterThan(400)
    expect(quotes.every((q) => q.quote.length <= 200 && q.author && !/[<>]/.test(q.quote))).toBe(true)
  })
})

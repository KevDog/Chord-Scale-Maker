import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Quotes for the navbar (data/quotes.json), reduced at build time to what's shown: the quote and its author. Only entries with a recorded source ("cited") are used: the file marks the rest "unverified" and notes
 * some may be misattributed. The list is served as its own chunk (`virtual:quotes`), loaded after the page, so it
 * adds nothing to first load.
 */
export type Quote = Readonly<{ quote: string; author: string }>

type RawQuote = { quote?: unknown; author?: unknown; source_status?: unknown }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function shownQuotes(raw: unknown): Quote[] {
  const list = (raw as { quotes?: unknown } | null)?.quotes
  if (!Array.isArray(list)) return []
  return (list as RawQuote[])
    .filter((q) => q.source_status === 'cited')
    .map((q) => ({ quote: text(q.quote), author: text(q.author) }))
    .filter((q) => q.quote && q.author)
}

const ID = 'virtual:quotes'

/** `import('virtual:quotes')` gives the shown quotes; the source file is watched in dev */
export function quotesPlugin(file: string): Plugin {
  return {
    name: 'quotes',
    resolveId: (id) => (id === ID ? `\0${ID}` : undefined),
    load(id) {
      if (id !== `\0${ID}`) return undefined
      this.addWatchFile(file)
      return `export default ${JSON.stringify(shownQuotes(JSON.parse(readFileSync(file, 'utf8'))))}`
    },
  }
}

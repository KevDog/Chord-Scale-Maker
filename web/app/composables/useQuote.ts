import type { Quote } from '../../build/quotes'

/**
 * one quote for this visit: picked at random on first load and kept while navigating (shared state). The list is
 * a separate chunk, fetched after mount, so prerendered pages stay the same for everyone and first load stays light.
 */
export function useQuote() {
  const quote = useState<Quote | null>('quote', () => null)
  onMounted(async () => {
    if (quote.value) return
    try {
      const { default: quotes } = await import('virtual:quotes')
      quote.value = quotes[Math.floor(Math.random() * quotes.length)] ?? null
    } catch {
      // the chunk failed to load: no quote this visit
    }
  })
  return readonly(quote)
}

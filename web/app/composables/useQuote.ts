import type { Ref } from 'vue'
import type { Quote } from '../../build/quotes'

/**
 * one quote per slot for this visit: picked at random on first load and kept while navigating (shared state). The
 * navbar uses the default slot; another slot (the error page's) can avoid repeating a quote already shown. The list
 * is a separate chunk, fetched after mount, so prerendered pages stay the same for everyone and first load stays light.
 */
export function useQuote(slot = 'quote', avoid?: Readonly<Ref<Quote | null>>) {
  const quote = useState<Quote | null>(slot, () => null)
  let quotes: readonly Quote[] = []

  const pick = (): void => {
    const others = quotes.filter((q) => q.quote !== avoid?.value?.quote)
    quote.value = others[Math.floor(Math.random() * others.length)] ?? null
  }

  onMounted(async () => {
    if (quote.value) return
    try {
      quotes = (await import('virtual:quotes')).default
      pick()
    } catch {
      // the chunk failed to load: no quote this visit
    }
  })
  // the other quote can arrive second; pick again on the rare clash
  if (avoid) watch(avoid, (a) => a && quotes.length && a.quote === quote.value?.quote && pick())

  return readonly(quote)
}

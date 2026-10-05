// build/quotes.ts serves this module: the navbar's quotes, reduced to what's shown
declare module 'virtual:quotes' {
  const quotes: readonly Readonly<{ quote: string; author: string }>[]
  export default quotes
}

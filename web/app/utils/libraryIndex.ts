/** the library's Details column: style · key · form from the chart's headers, so every row reads the same */
export const libraryDetails = (s: Readonly<{ style: string; keyLabel: string; form: string }>): string => [s.style, s.keyLabel, s.form].filter(Boolean).join(' · ')

/** a title as it files: without leading punctuation ('Round Midnight under R) */
export const filingTitle = (title: string): string => title.replace(/^[^\p{L}\p{N}]+/u, '')

/** the letter a title files under: A–Z (accents dropped), or # for a digit or anything else */
export function letterOf(title: string): string {
  const first = filingTitle(title).normalize('NFD').charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : '#'
}

/** the A–Z bar: each letter with tunes, linked to its first tune, in the library's order (# first: digits sort first) */
export function letterIndex(charts: readonly Readonly<{ slug: string; title: string }>[]): readonly { letter: string; slug: string }[] {
  const seen = new Map<string, string>()
  for (const c of charts) {
    const letter = letterOf(c.title)
    if (!seen.has(letter)) seen.set(letter, c.slug)
  }
  return [...seen].map(([letter, slug]) => ({ letter, slug }))
}

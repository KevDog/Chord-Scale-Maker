import { chartKind, metaValue, parseChart } from './chart'

/** surname: the last word, with any particles before it ("de Paul", "Van Heusen"); sortKey: how it files, surname
 * first, lowercased (a lowercase particle files under the name after it: "Gene de Paul" under P) */
export type Composer = Readonly<{ name: string; slug: string; surname: string; sortKey: string }>
export type ComposerEntry = Composer & Readonly<{ tunes: readonly string[] }>

const PARTICLES = new Set(['de', 'del', 'van', 'von', 'da', 'dos'])
/** letters NFD leaves whole */
const FOLD: Readonly<Record<string, string>> = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE' }
const ascii = (s: string): string => s.replace(/[łŁøØđĐßæÆœŒ]/g, (c) => FOLD[c] ?? c).normalize('NFD').replace(/\p{Diacritic}/gu, '')
const plain = (s: string): string => s.replace(/["“”]/g, '')

export const composerSlug = (name: string): string =>
  ascii(plain(name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function composer(name: string): Composer {
  const words = plain(name).split(/\s+/)
  let at = words.length - 1
  while (at > 0 && PARTICLES.has(words[at - 1]!.toLowerCase())) at--
  const surname = words.slice(at).join(' ')
  const filed = words.slice(at).filter((w, i, all) => i === all.length - 1 || w !== w.toLowerCase()) // a lowercase particle doesn't file
  return { name, slug: composerSlug(name), surname, sortKey: ascii([...filed, ...words.slice(0, at)].join(' ')).toLowerCase() }
}

/** a `composer:` credit's composers, split on `, ` and ` & `; a traditional tune has none */
export const composersOf = (credit: string): readonly Composer[] =>
  /^trad/i.test(credit.trim()) ? [] : credit.split(/,\s*|\s+&\s+/).map((s) => s.trim()).filter(Boolean).map(composer)

/** every composer of the tunes (forms and exercises have none), each with its tunes in the order given, by sortKey */
export function composerIndex(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly ComposerEntry[] {
  const bySlug = new Map<string, { c: Composer; tunes: string[] }>()
  for (const { slug, text } of charts) {
    const doc = parseChart(text).value
    if (chartKind(doc) !== 'tune') continue
    for (const c of composersOf(metaValue(doc, 'composer'))) {
      const entry = bySlug.get(c.slug) ?? { c, tunes: [] }
      bySlug.set(c.slug, entry)
      if (!entry.tunes.includes(slug)) entry.tunes.push(slug)
    }
  }
  return [...bySlug.values()].map(({ c, tunes }) => ({ ...c, tunes })).sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'en') || a.slug.localeCompare(b.slug, 'en'))
}

/** composers who share a surname: maybe one person spelled two ways, for the owner to check (analyse --all) */
export function nearDuplicateComposers(index: readonly Composer[]): readonly (readonly string[])[] {
  const bySurname = new Map<string, Composer[]>()
  for (const c of index) {
    const key = ascii(c.surname).toLowerCase()
    bySurname.set(key, [...(bySurname.get(key) ?? []), c])
  }
  return [...bySurname.values()].filter((g) => g.length > 1).map((g) => g.map((c) => c.slug))
}

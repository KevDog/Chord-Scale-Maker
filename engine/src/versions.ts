import { chartAka, metaValue, parseChart } from './chart'

/** a tune's title as compared across charts (#411): no case, accents, apostrophes or punctuation */
export const tuneKey = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** a chart of a tune: label '' for its main chart */
export type TuneVersion = Readonly<{ slug: string; label: string }>
export type TuneGroup = Readonly<{ key: string; main: string; versions: readonly TuneVersion[] }>
type Source = Readonly<{ slug: string; text: string }>
type Read = Readonly<{ slug: string; title: string; label: string; key: string; aka: readonly string[] }>

const read = (c: Source): Read => {
  const doc = parseChart(c.text).value
  const title = metaValue(doc, 'title', 'Untitled')
  return { slug: c.slug, title, label: metaValue(doc, 'version'), key: tuneKey(title), aka: chartAka(doc).map(tuneKey) }
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * charts gathered into tunes: an aka: means the same tune, so a chart's title and every aka: that is another chart's
 * title join one group (a chain or a pair naming each other included), whatever order the charts come in. Each group:
 * its main charts first, then its versions by label; groups by key, the main's title (else the first version's)
 */
function grouped(charts: readonly Source[]): readonly (readonly [string, readonly Read[]])[] {
  const all = charts.map(read).sort((a, b) => byText(a.slug, b.slug))
  const parent = new Map(all.map((c) => [c.key, c.key]))
  const root = (k: string): string => {
    while (parent.get(k) !== k) k = parent.get(k)!
    return k
  }
  for (const c of all) for (const k of c.aka) if (parent.has(k)) parent.set(root(k), root(c.key))
  const groups = new Map<string, Read[]>()
  for (const c of all) groups.set(root(c.key), [...(groups.get(root(c.key)) ?? []), c])
  const order = (a: Read, b: Read): number => Number(!!a.label) - Number(!!b.label) || byText(a.label, b.label) || byText(a.slug, b.slug)
  return [...groups.values()].map((cs) => [...cs].sort(order)).map((cs) => [cs[0]!.key, cs] as const).sort(([a], [b]) => byText(a, b))
}

export function tuneGroups(charts: readonly Source[]): readonly TuneGroup[] {
  return grouped(charts).map(([key, cs]) => ({ key, main: cs[0]!.slug, versions: cs.map((c) => ({ slug: c.slug, label: c.label })) }))
}

/** what breaks the library's versions: two mains, a repeated label, a version titled unlike its main (libraryMeta.test.ts fails on any) */
export function versionProblems(charts: readonly Source[]): readonly string[] {
  return grouped(charts).flatMap(([, cs]) => {
    const out: string[] = []
    const mains = cs.filter((c) => !c.label)
    if (mains.length > 1) out.push(`${mains.map((c) => c.slug).join(', ')}: two charts of "${mains[0]!.title}" without version: (give all but one a version:)`)
    const byLabel = new Map<string, Read[]>()
    for (const c of cs) if (c.label) byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), c])
    for (const [label, same] of byLabel) if (same.length > 1) out.push(`${same.map((c) => c.slug).join(', ')}: two versions of "${cs[0]!.title}" labeled "${label}"`)
    const head = mains[0]
    // an aka:-joined chart may be titled otherwise; one that shares the main's key should spell it the same
    if (head) for (const c of cs) if (c.label && c.key === head.key && c.title !== head.title) out.push(`${c.slug}: title "${c.title}" differs from its main chart's "${head.title}"`)
    return out
  })
}

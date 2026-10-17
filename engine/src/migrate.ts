import { formPart, META_KEYS } from './chart'
import { LIMITS } from './limits'

/**
 * The one-way migration from the retired row format (`SECTION | BAR | CHORD …` with absolute bars, `@copy SRC DST
 * OFFSET`, directives naming a section) to section blocks (docs/design.md §4, issue #329). Text in, text out; it reads
 * the old lines itself. Lengths, keys and contexts come out as the old engine played them: a section started at its
 * first row, ran to the next section's first row (the last of a part to the old engine's rounded end), and an @key
 * held, in play order, until the next.
 */
export type Migration = Readonly<{
  text: string
  /** each old line's index in the new text; -1 for a line folded away (a body blank, @copy, an @key that became key:) */
  lineMap: readonly number[]
  /** comment lines that name a bar in prose, left as written, for a person to fix ("line 12: # …") */
  prose: readonly string[]
  /** what it couldn't carry over exactly */
  problems: readonly string[]
}>

const INT = /^[+-]?\d{1,6}$/
type Item =
  // bar: NaN where the old row's bar wasn't a whole number (barText keeps it as written)
  | { t: 'row'; section: string; bar: number; barText?: string; cells: string[]; comment?: string; line: number }
  | { t: 'copy'; src: string; dst: string; offset: number; line: number }
  | { t: 'key' | 'context'; section: string; bar: number; value: string; line: number }
  | { t: 'ending'; section: string; n: string; from: number; to: number; line: number }
  | { t: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number; line: number }
  | { t: 'nav'; section: string; bar: number; text: string; line: number }
  | { t: 'comment' | 'other'; text: string; line: number }
  | { t: 'meta' | 'blank'; text: string; line: number }

function read(text: string, line: number): Item {
  const t = text.trim()
  if (!t) return { t: 'blank', text: t, line }
  if (t.startsWith('#')) return { t: 'comment', text: t, line }
  const low = t.toLowerCase()
  if (META_KEYS.some((k) => low.startsWith(`${k}:`))) return { t: 'meta', text: t, line }
  const words = t.split(/\s+/)
  if (low.startsWith('@copy') && words.length === 4 && INT.test(words[3] ?? ''))
    return { t: 'copy', src: words[1] ?? '', dst: words[2] ?? '', offset: Number(words[3]), line }
  const kc = /^@(key|context)\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(t)
  if (kc && INT.test(kc[3] ?? '')) return { t: kc[1]?.toLowerCase() === 'key' ? 'key' : 'context', section: kc[2] ?? '', bar: Number(kc[3]), value: (kc[4] ?? '').trim(), line }
  if (low.startsWith('@ending')) {
    const [, n = '', section = '', from = '', to = from] = words
    if (INT.test(from) && INT.test(to)) return { t: 'ending', section, n, from: Number(from), to: Number(to), line }
  }
  if ((low.startsWith('@segno') || low.startsWith('@coda')) && words.length === 3 && INT.test(words[2] ?? ''))
    return { t: 'mark', mark: low.startsWith('@coda') ? 'coda' : 'segno', section: words[1] ?? '', bar: Number(words[2]), line }
  const nav = /^@nav\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(t)
  if (nav && INT.test(nav[2] ?? '')) return { t: 'nav', section: nav[1] ?? '', bar: Number(nav[2]), text: (nav[3] ?? '').trim(), line }
  const hash = /\s#(?=\s|$)/.exec(t)
  const body = hash ? t.slice(0, hash.index) : t
  const cells = body.split('|').map((c) => c.trim())
  if (cells.length >= 3 && cells.length <= 5) {
    // a section name loses its spaces ("Tag 2" → "Tag2"); an empty one is named later
    const bar = cells[1] ?? ''
    const whole = INT.test(bar)
    return { t: 'row', section: (cells[0] ?? '').replace(/\s+/g, ''), bar: whole ? Number(bar) : NaN, ...(whole ? {} : { barText: bar }), cells: cells.slice(2), ...(hash ? { comment: t.slice(hash.index + 2).trim() } : {}), line }
  }
  return { t: 'other', text: t, line }
}

type Played = { section: string; bar: string; chord: string; scale: string; fn: string; copied: boolean }
const WHOLE = /^[+-]?\d{1,6}$/
const shapeStart = (rows: readonly Played[], section: string): number => Math.min(...rows.filter((r) => r.section === section).map((r) => Number(r.bar)))
const shape = (rows: readonly Played[], section: string): string => {
  const start = shapeStart(rows, section)
  return rows.filter((r) => r.section === section).map((r) => `${Number(r.bar) - start}|${r.chord}|${r.scale}`).join(';')
}
/** the old engine's length for a part's last row (guideToneTimeline's finalBars before #329), verbatim */
function legacyFinalBars(rows: readonly Played[]): number {
  const last = rows.at(-1)
  if (!last || !rows.every((r) => WHOLE.test(r.bar))) return 1
  const first = Number(rows[0]?.bar)
  const order = [...new Set(rows.map((r) => r.section))]
  let end = Number(last.bar) + 1
  const twin = order.slice(0, -1).find((s) => s !== last.section && shape(rows, s) === shape(rows, last.section))
  const twinNext = twin === undefined ? undefined : order[order.indexOf(twin) + 1]
  if (twin !== undefined && twinNext !== undefined) end = shapeStart(rows, last.section) + shapeStart(rows, twinNext) - shapeStart(rows, twin)
  const length = Math.ceil((end - first) / 4) * 4
  return Math.max(1, first + length - Number(last.bar))
}

type Plan = { key: string | null; changes: { bar: number; value: string }[] }
const samePlan = (a: Plan, b: Plan): boolean => a.key === b.key && JSON.stringify(a.changes) === JSON.stringify(b.changes)

export function migrateChart(text: string): Migration {
  // a chart over the size limit is left for the parser to refuse
  if (text.length > LIMITS.maxChars) return { text, lineMap: [], prose: [], problems: [] }
  const raw = text.split(/\r?\n/)
  if (raw.at(-1) === '') raw.pop()
  const read0 = raw.map(read)
  const identity = (): Migration => ({ text, lineMap: raw.map((_, i) => i), prose: [], problems: [] })
  if (raw.some((l) => /^section:/i.test(l.trim())) || !read0.some((x) => x.t === 'row')) return identity()

  const problems: string[] = []
  // names a block can take: an unnamed section named, and a section that comes back after another a name of its own
  // (A, B, A plays A, B, A2); a directive names the latest occurrence of its section
  const used = new Set(read0.flatMap((x) => (x.t === 'row' ? [x.section] : x.t === 'copy' ? [x.dst] : [])))
  const fresh = (base: string): string => {
    let n = 2
    while (used.has(`${base}${n}`)) n++
    used.add(`${base}${n}`)
    return `${base}${n}`
  }
  const unnamed = !used.has('') ? '' : used.has('A') ? fresh('A') : 'A'
  const alias = new Map<string, string>()
  const aliasOf = (name: string): string => alias.get(name) ?? (name === '' ? unnamed : name)
  let lastName: string | null = null
  const items: Item[] = read0.map((x): Item => {
    if (x.t === 'row' || x.t === 'copy') {
      const name = x.t === 'row' ? x.section : x.dst
      if (name !== lastName) {
        if (alias.has(name) || (name === '' && alias.has(''))) {
          const next = fresh(aliasOf(name).replace(/\d+$/, '') || 'A')
          problems.push(`section ${name || '(unnamed)'} comes back after another section: written as ${next} (line ${x.line + 1})`)
          alias.set(name, next)
        } else alias.set(name, name === '' ? unnamed : name)
        lastName = name
      }
      return x.t === 'row' ? { ...x, section: aliasOf(name) } : { ...x, src: aliasOf(x.src), dst: aliasOf(name) }
    }
    if (x.t === 'key' || x.t === 'context' || x.t === 'ending' || x.t === 'mark' || x.t === 'nav') return { ...x, section: aliasOf(x.section) }
    return x
  })
  // sections in order, from rows and @copy destinations
  const order: string[] = []
  const copyOf = new Map<string, Extract<Item, { t: 'copy' }>>()
  for (const x of items) {
    const name = x.t === 'row' ? x.section : x.t === 'copy' ? x.dst : null
    if (name === null) continue
    if (x.t === 'copy') copyOf.set(x.dst, x)
    if (!order.includes(name)) order.push(name)
  }
  // the rows as the old engine played them, @copy expanded
  const played: Played[] = []
  for (const x of items) {
    if (x.t === 'row') played.push({ section: x.section, bar: x.barText ?? String(x.bar), chord: x.cells[0] ?? '', scale: x.cells[1] ?? '', fn: x.cells[2] ?? '', copied: false })
    if (x.t === 'copy') played.push(...played.filter((r) => r.section === x.src).map((r) => ({ ...r, section: x.dst, bar: String(Number(r.bar) + x.offset), copied: true })))
  }
  const whole = (r: Played): boolean => WHOLE.test(r.bar)
  const start = new Map(order.map((s) => [s, Number(played.find((r) => r.section === s && whole(r))?.bar ?? 1)]))
  const lastBar = (s: string): number => Math.max(start.get(s) ?? 1, ...played.filter((r) => r.section === s && whole(r)).map((r) => Number(r.bar)))
  const length = new Map<string, number>()
  order.forEach((s, k) => {
    const next = order[k + 1]
    const from = start.get(s) ?? 1
    let end: number
    if (next !== undefined && formPart(next) === formPart(s)) end = start.get(next) ?? from + 1
    else {
      const part = played.filter((r) => formPart(r.section) === formPart(s))
      const lastWhole = part.filter(whole).at(-1)
      end = Number(lastWhole?.bar ?? from) + legacyFinalBars(part)
    }
    const min = lastBar(s) - from + 1
    if (end - from < min) problems.push(`section ${s} is shorter than its rows (bars out of order?)`)
    length.set(s, Math.max(end - from, min))
  })
  const rel = (s: string, bar: number): number => bar - (start.get(s) ?? 1) + 1
  const known = new Set(order)

  // key and context plans, replaying the old rule: a change holds, in play order, until the next
  const planOf = (kind: 'key' | 'context'): Map<string, Plan> => {
    const changes = items
      .filter((x): x is Extract<Item, { t: 'key' | 'context' }> => x.t === kind && known.has(x.section))
      .map((x) => ({ k: order.indexOf(x.section), bar: x.bar, value: x.value }))
      .sort((a, b) => a.k - b.k || a.bar - b.bar)
    const plans = new Map<string, Plan>()
    let running: string | null = null
    order.forEach((s, k) => {
      const own = changes.filter((c) => c.k === k)
      const atStart = own.filter((c) => rel(s, c.bar) <= 1).at(-1)
      const plan: Plan = { key: atStart?.value ?? running, changes: own.filter((c) => rel(s, c.bar) > 1).map((c) => ({ bar: rel(s, c.bar), value: c.value })) }
      plans.set(s, plan)
      running = plan.changes.at(-1)?.value ?? plan.key
    })
    return plans
  }
  const keys = planOf('key')
  const contexts = planOf('context')
  // a copy: carries its source's plan unless it writes its own key:; write the repeat out where that can't match
  const sourcePlan = (plans: Map<string, Plan>, s: string): Plan => plans.get(s) ?? { key: null, changes: [] }
  const writtenOut = new Set<string>()
  for (const [dst, c] of copyOf) {
    // a repeat whose section also had rows of its own is written out, its own rows after the repeated ones
    if (items.some((x) => x.t === 'row' && x.section === dst)) writtenOut.add(dst)
    for (const plans of [keys, contexts]) {
      const want = sourcePlan(plans, dst)
      const carried = sourcePlan(plans, c.src)
      if (want.changes.length || (want.key === null && !samePlan(carried, { key: null, changes: [] }))) writtenOut.add(dst)
    }
  }

  // which block each line goes in; comments and stray lines go with the next body line, an # alt: with the bar it names
  const isBody = (x: Item): boolean => !['comment', 'other', 'meta', 'blank'].includes(x.t)
  const firstBody = items.findIndex(isBody)
  const sectionOfItem = (x: Item): string | null =>
    x.t === 'row' || x.t === 'key' || x.t === 'context' || x.t === 'ending' || x.t === 'mark' || x.t === 'nav' ? x.section : x.t === 'copy' ? x.dst : null
  const blockLines = new Map<string, Item[]>(order.map((s) => [s, []]))
  const header: Item[] = []
  const lateMeta: Item[] = [] // a header field written among the rows goes up to the header
  const prose: string[] = []
  let pending: Item[] = []
  let prev: string | null = null
  const contains = (s: string | null, bar: number): boolean => s !== null && rel(s, bar) >= 1 && rel(s, bar) <= (length.get(s) ?? 0)
  items.forEach((x, i) => {
    if (i < firstBody) {
      if (x.t === 'comment' && /^#\s*area:/.test(x.text)) pending.push(x)
      else header.push(x)
      return
    }
    if (x.t === 'blank') return
    if (x.t === 'meta') return void lateMeta.push(x)
    if (x.t === 'comment' && /^#\s*alt:\s*bars?\s+\d/.test(x.text)) {
      const n = Number(/(\d+)/.exec(x.text.replace(/^#\s*alt:\s*bars?\s+/, ''))?.[1])
      if (contains(prev, n) && prev !== null) return void blockLines.get(prev)?.push(x)
      pending.push(x)
      return
    }
    if (x.t === 'comment' || x.t === 'other') {
      if (x.t === 'comment' && !/^#\s*area:/.test(x.text) && /\bbars?\s+\d/i.test(x.text)) prose.push(`line ${i + 1}: ${x.text}`)
      if (x.t === 'other') problems.push(`can't read line ${i + 1}: ${x.text}`)
      pending.push(x)
      return
    }
    const s = sectionOfItem(x)
    if (s === null || !known.has(s)) {
      problems.push(`@${x.t === 'mark' ? x.mark : x.t} names no section ${s ?? ''} (line ${i + 1})`)
      return
    }
    blockLines.get(s)?.push(...pending, x)
    pending = []
    prev = s
  })
  if (pending.length) blockLines.get(order.at(-1) ?? '')?.push(...pending)

  // write it out
  const out: { text: string; line?: number }[] = []
  let headerEnd = header.length
  while (headerEnd > 0 && header[headerEnd - 1]?.t === 'blank') headerEnd--
  for (const x of [...header.slice(0, headerEnd), ...lateMeta]) {
    const t = x.t === 'comment' ? x.text.replace(/^#\s*section\s*\|\s*/i, '# ') : 'text' in x ? x.text : ''
    out.push({ text: t, line: x.line })
  }
  const rowText = (bar: number | string, cells: readonly string[], comment?: string): string =>
    `${bar} | ${cells.join(' | ')}${comment !== undefined ? `  #${comment ? ` ${comment}` : ''}` : ''}`
  const altText = (s: string, t: string): string =>
    t.replace(/^(#\s*alt:\s*bars?\s+)(\d+)(?:–(\d+))?/, (_m, p: string, a: string, b?: string) => `${p}${rel(s, Number(a))}${b ? `–${rel(s, Number(b))}` : ''}`)
  for (const s of order) {
    const copy = copyOf.get(s)
    const out1 = writtenOut.has(s)
    const k = keys.get(s)
    const c = contexts.get(s)
    if (out.length) out.push({ text: '' }) // no blank line above the first section when there is no header
    out.push({ text: `section: ${s}` })
    const own = !copy || out1
    const srcLength = copy ? (length.get(copy.src) ?? 0) : 0
    if (k?.key && (own || k.key !== keys.get(copy?.src ?? '')?.key || keys.get(copy?.src ?? '')?.changes.length)) out.push({ text: `key: ${k.key}` })
    if (c?.key && (own || c.key !== contexts.get(copy?.src ?? '')?.key || contexts.get(copy?.src ?? '')?.changes.length)) out.push({ text: `context: ${c.key}` })
    const len = length.get(s) ?? 1
    const written = own ? lastBar(s) - (start.get(s) ?? 1) + 1 : srcLength
    if (len !== written) out.push({ text: `bars: ${len}` })
    if (copy && !out1) out.push({ text: `copy: ${copy.src}`, line: copy.line })
    if (copy && out1) {
      for (const r of played.filter((p) => p.section === s && p.copied))
        out.push({ text: rowText(whole(r) ? rel(s, Number(r.bar)) : r.bar, r.fn ? [r.chord, r.scale, r.fn] : r.scale ? [r.chord, r.scale] : [r.chord]) })
    }
    // a written-out repeat states its changes after its rows; a written section keeps each where it stood
    if (copy && out1) for (const ch of k?.changes ?? []) out.push({ text: `@key ${ch.bar} ${ch.value}` })
    if (copy && out1) for (const ch of c?.changes ?? []) out.push({ text: `@context ${ch.bar} ${ch.value}` })
    for (const x of blockLines.get(s) ?? []) {
      if (x.t === 'row') out.push({ text: rowText(x.barText ?? rel(s, x.bar), x.cells, x.comment), line: x.line })
      else if (x.t === 'ending') out.push({ text: `@ending ${x.n} ${rel(s, x.from)}${x.to !== x.from ? ` ${rel(s, x.to)}` : ''}`, line: x.line })
      else if (x.t === 'mark') out.push({ text: `@${x.mark} ${rel(s, x.bar)}`, line: x.line })
      else if (x.t === 'nav') out.push({ text: `@nav ${rel(s, x.bar)} ${x.text}`, line: x.line })
      else if (x.t === 'comment') out.push({ text: altText(s, x.text), line: x.line })
      else if (x.t === 'other') out.push({ text: x.text, line: x.line })
      else if ((x.t === 'key' || x.t === 'context') && !copy && rel(s, x.bar) > 1) out.push({ text: `@${x.t} ${rel(s, x.bar)} ${x.value}`, line: x.line })
      // a change on a section's first bar became its key: or context: field; a copy's own changes were written out above
    }
  }
  const lineMap = raw.map(() => -1)
  out.forEach((o, i) => {
    if (o.line !== undefined) lineMap[o.line] = i
  })
  return { text: `${out.map((o) => o.text).join('\n')}\n`, lineMap, prose, problems }
}

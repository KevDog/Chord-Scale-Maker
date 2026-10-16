/**
 * One-off (issue #329): the golden fixture before and after the section-blocks migration must agree in everything
 * but bar numbering and chart text.  npm run compare-golden -w engine -- OLD.json NEW.json
 */
import { readFileSync } from 'node:fs'

type Chart = { rows: (string | null)[][]; timing: unknown[][]; areas: unknown[][]; title: string; subtitle: string; key: string }
const [oldPath, newPath] = process.argv.slice(2)
const load = (p: string | undefined): Record<string, unknown> & { charts: Record<string, Chart> } => JSON.parse(readFileSync(p ?? '', 'utf8'))
const before = load(oldPath)
const after = load(newPath)
let bad = 0
const fail = (msg: string): void => {
  bad++
  console.log(msg)
}
for (const k of Object.keys(before)) if (k !== 'charts' && JSON.stringify(before[k]) !== JSON.stringify(after[k])) fail(`${k} differs`)
for (const [name, o] of Object.entries(before.charts)) {
  const n = after.charts[name]
  if (!n) {
    fail(`${name}: missing`)
    continue
  }
  if (o.title !== n.title || o.subtitle !== n.subtitle || o.key !== n.key) fail(`${name}: heading differs`)
  if (o.rows.length !== n.rows.length) {
    fail(`${name}: ${o.rows.length} rows before, ${n.rows.length} after`)
    continue
  }
  // each old (section, bar) must map to one new bar; everything else equal
  const map = new Map<string, string>()
  o.rows.forEach((r, i) => {
    const m = n.rows[i] ?? []
    const key = `${r[0]}|${r[1]}`
    if (r[0] !== m[0] || r[2] !== m[2] || r[3] !== m[3]) fail(`${name} row ${i}: ${JSON.stringify(r)} → ${JSON.stringify(m)}`)
    if (map.has(key) && map.get(key) !== m[1]) fail(`${name} row ${i}: bar ${key} maps to two bars`)
    map.set(key, String(m[1]))
    if (JSON.stringify(o.timing[i]) !== JSON.stringify(n.timing[i])) fail(`${name} row ${i}: timing ${JSON.stringify(o.timing[i])} → ${JSON.stringify(n.timing[i])}`)
  })
  const areaKey = (a: unknown[]): string => `${a[0]}|${a[1]}|${map.get(`${a[1]}|${a[2]}`) ?? `?${a[2]}`}|${a[4]}`
  const newArea = (a: unknown[]): string => `${a[0]}|${a[1]}|${a[2]}|${a[4]}`
  if (o.areas.map(areaKey).join(';') !== n.areas.map(newArea).join(';')) fail(`${name}: areas ${o.areas.map(areaKey).join(';')} → ${n.areas.map(newArea).join(';')}`)
}
console.log(bad ? `${bad} differences` : 'golden agrees modulo bar numbering')
process.exitCode = bad ? 1 : 0

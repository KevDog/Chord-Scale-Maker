import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { CATALOGUE_KEYS, functionsTable } from '../analysis/catalogue'
import { parseKey } from '../analysis/keys'
import { ruleParts, RULES } from '../analysis/rules'
import { parseChart } from '../chart'
import { isSyncCopy } from '../util'

const table = (k: string) => functionsTable(parseKey(k) ?? (() => { throw new Error(k) })())
const row = (k: string, fn: string) => table(k).find((r) => r.fn === fn)

describe('functionsTable', () => {
  it('every row is reached by a rule (none is "?")', () => {
    for (const k of CATALOGUE_KEYS) expect(table(k).filter((r) => r.rule === '?').map((r) => r.fn), k).toEqual([])
  })

  it('C major has the textbook rows', () => {
    expect(row('C', 'V7')).toMatchObject({ chord: 'G7', scale: 'G Mixolydian' })
    expect(row('C', 'ii7')).toMatchObject({ chord: 'Dm7', scale: 'D Dorian' })
    expect(row('C', 'V7/ii')).toMatchObject({ chord: 'A7', scale: 'A Mixolydian b6' })
    expect(row('C', 'subV7')).toMatchObject({ chord: 'Db7', scale: 'Db Lydian Dominant' })
    expect(row('C', '♭VII7')).toMatchObject({ chord: 'Bb7', scale: 'Bb Lydian Dominant' })
    expect(row('C', 'viiø7')).toMatchObject({ chord: 'Bm7b5', scale: 'B Locrian' })
    expect(row('C', 'iiø7/vi')).toMatchObject({ chord: 'Bm7b5', scale: 'B Locrian' })
  })

  it('groups the rows: diatonic, secondary, substitutes and borrowings, chromatic', () => {
    const groups = [...new Set(table('C').map((r) => r.group))]
    expect(groups).toEqual(['diatonic', 'secondary', 'substitutes', 'chromatic'])
  })

  it('marks the guesses (fallback rows) and shows at least one per guessing family', () => {
    const guesses = table('C').filter((r) => r.fallback)
    expect(guesses.map((r) => ruleParts(r.rule).at(-1))).toEqual(expect.arrayContaining(['m8', 'h2', 'd1']))
  })

  it('every major key lists the same functions as C, and every minor key the same as A minor', () => {
    const fns = (k: string) => table(k).map((r) => r.fn)
    expect(CATALOGUE_KEYS).toHaveLength(30)
    for (const k of CATALOGUE_KEYS) expect(fns(k), k).toEqual(fns(parseKey(k)?.minor ? 'Am' : 'C'))
  })

  it('each chord is spelled from its function in the key (V7/V in Eb is F7, subV7/IV in C is Gb7)', () => {
    expect(row('Eb', 'V7/V')?.chord).toBe('F7')
    expect(row('C', 'subV7/IV')?.chord).toBe('Gb7')
  })

  it('reasons read as the sheet gives them, without the stated-function star', () => {
    for (const r of table('C')) expect(r.reason.startsWith('* ')).toBe(false)
  })
})

// tier-1 symbol rules need a chord symbol, not a function: one-row charts for the ids nothing else reaches
const SYMBOL_EXAMPLES: readonly Readonly<{ chord: string; rule: string }>[] = [{ chord: 'Am7b13', rule: 'm3' }]

describe('RULES against what the engine produces', () => {
  it('every rule in RULES is reached by the library or by the catalogue in some key', () => {
    const seen = new Set<string>()
    const LIBRARY = new URL('../../charts/', import.meta.url)
    for (const f of readdirSync(LIBRARY).filter((f) => f.endsWith('.txt') && !isSyncCopy(f)))
      for (const r of analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows) ruleParts(r.rule).forEach((id) => seen.add(id))
    for (const k of CATALOGUE_KEYS) for (const r of table(k)) ruleParts(r.rule).forEach((id) => seen.add(id))
    for (const { chord, rule } of SYMBOL_EXAMPLES) {
      const got = analyse(parseChart(`key: A\nbars: 1\nsection: A\n1 | ${chord} | |\n`).value).rows[0]?.rule ?? '?'
      expect(ruleParts(got)).toContain(rule)
      ruleParts(got).forEach((id) => seen.add(id))
    }
    expect(RULES.map((r) => r.id).filter((id) => !seen.has(id))).toEqual([])
  })
})

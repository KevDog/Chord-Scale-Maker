import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { FUNCTION_ERRORS, parseFunction, spellings } from '../analysis/functions'
import { dominantScaleTable, ruleParts, RULES, TIERS } from '../analysis/rules'
import { parseChart } from '../chart'
import { isSyncCopy } from '../util'

const LIBRARY = new URL('../../../charts/', import.meta.url)
const libraryRuleIds = (): Set<string> => {
  const ids = new Set<string>()
  for (const f of readdirSync(LIBRARY).filter((f) => f.endsWith('.txt') && !isSyncCopy(f))) {
    for (const r of analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows) for (const id of ruleParts(r.rule)) ids.add(id)
  }
  return ids
}

describe('RULES', () => {
  it('has one entry per id, each with a tier, a scale, what it looks at and a summary', () => {
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RULES) {
      expect(r.id).toMatch(/^[DMmhds]\d$/)
      expect(Object.keys(TIERS)).toContain(String(r.tier))
      expect(r.scale && r.looksAt && r.summary).toBeTruthy()
    }
  })

  it('knows every rule the library produces (a compound id like D1+D4 by its parts)', () => {
    const known = new Set(RULES.map((r) => r.id))
    expect([...libraryRuleIds()].filter((id) => id !== '?' && !known.has(id))).toEqual([])
  })

  it('splits a compound id into the rules that made it', () => {
    expect(ruleParts('D1+D4')).toEqual(['D1', 'D4'])
    expect(ruleParts('m4')).toEqual(['m4'])
  })

  it('has no h1: a ø7 in a modal chart goes through h2 (R6)', () => {
    expect(RULES.map((r) => r.id)).not.toContain('h1')
    expect(RULES.filter((r) => r.family === 'halfdim').map((r) => r.id)).toEqual(['h2'])
  })

  it('has no primed ids', () => {
    expect(RULES.map((r) => r.id).filter((id) => id.includes("'"))).toEqual([])
  })
})

describe('the dominant slot table', () => {
  it('covers every combination of 9, 11 and 13 once, and names §7.1’s scales', () => {
    const t = dominantScaleTable()
    expect(t).toHaveLength(12)
    const at = (n9: string, n11: string, n13: string) => t.find((r) => r.n9 === n9 && r.n11 === n11 && r.n13 === n13)?.scale
    expect(at('9', '11', '13')).toBe('Mixolydian')
    expect(at('9', '#11', '13')).toBe('Lydian Dominant')
    expect(at('b9', '11', 'b13')).toBe('Phrygian Dominant')
    expect(at('b9#9', '#11', 'b13')).toBe('Altered')
  })
})

describe('function spellings and errors', () => {
  it('groups the accepted quality spellings by family and by how the sheet writes them', () => {
    const find = (family: string, written: string) => spellings().find((s) => s.family === family && s.written === written)?.spellings
    expect(find('major', 'maj7')).toEqual(['maj7', 'Maj7', 'M7', 'maj'])
    expect(find('dominant', '7')).toEqual(['7'])
    expect(find('minor', '7')).toEqual(['7', 'm7', '-7'])
    expect(find('minor', '(maj7)')).toEqual(['(maj7)', 'mMaj7', '-(maj7)', '-Maj7'])
    expect(find('halfdim', 'ø7')).toEqual(['ø7', 'ø', 'm7b5', 'm7(b5)', '-7b5', '-7(b5)'])
    expect(find('dim', '°7')).toEqual(['o7', 'o', 'dim7'])
    expect(find('sus', '7sus4')).toEqual(['7sus4', '7(sus4)', '7sus', 'sus4', 'sus'])
    expect(spellings().some((s) => s.family === 'major' && s.spellings.includes('m'))).toBe(false)
  })

  it('the four error messages are the ones parseFunction gives', () => {
    expect(parseFunction('H: V7')).toBe(FUNCTION_ERRORS.notAKey('H'))
    expect(parseFunction('V7/x')).toBe(FUNCTION_ERRORS.notAFunction('V7/x'))
    expect(parseFunction('subii7')).toBe(FUNCTION_ERRORS.subNotDominant())
    expect(parseFunction('iimaj7')).toBe(FUNCTION_ERRORS.majorOnLowerCase('iimaj7'))
  })
})

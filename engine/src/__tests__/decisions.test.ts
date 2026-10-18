import { describe, expect, it } from 'vitest'
import { RULES } from '../analysis'
import { DECISIONS, decisionHref, decisionOf } from '../decisions'

describe('the decision registry', () => {
  it('has unique namespaced ids, none shadowing a rule', () => {
    const ids = DECISIONS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-z]+(-[a-z]+)*$/)
  })

  it('holds the spec’s set and the rulings’ additions', () => {
    const ids = DECISIONS.map((d) => d.id)
    for (const id of [
      'scale.level', 'scale.unknown', 'scale.slash', 'key.area',
      'guide.tones', 'guide.start', 'guide.move', 'guide.range', 'guide.meet', 'guide.rest',
      'arp.line', 'pent.auto', 'pent.inside', 'pent.line', 'hex.auto', 'hex.group', 'hex.line', 'pick.order',
      'spell.root', 'spell.transpose', 'spell.chord', 'range.instrument',
      'cells.line', 'cells.system', 'approach.figures', 'approach.place', 'arp.sheet', 'patterns.run',
    ])
      expect(ids, id).toContain(id)
  })

  it('gives each a title and a one-sentence summary', () => {
    for (const d of DECISIONS) {
      expect(d.title, d.id).not.toBe('')
      expect(d.summary, d.id).toMatch(/^[A-Z][^]*\.$/)
    }
  })

  it('links a decision to its page and anchor', () => {
    expect(decisionHref('guide.move')).toBe('/how-it-decides#guide.move')
    expect(decisionHref('key.area')).toBe('/how-it-decides#key.area')
  })

  it('links an analysis rule to its row on Functions', () => {
    expect(decisionHref('rule-M3')).toBe('/functions#rule-M3')
    expect(decisionOf('rule-M3')).toEqual({ href: '/functions#rule-M3', title: 'Rule M3', summary: RULES.find((r) => r.id === 'M3')!.summary })
  })

  it('refuses an unknown rule', () => {
    expect(() => decisionHref('rule-Z9')).toThrow('unknown decision: rule-Z9')
  })
})

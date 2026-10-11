import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Functions from '~/pages/functions.vue'
import { FUNCTION_ERRORS, functionsTable, parseKey, proseGlyphs, RULES } from '@chord-scale-maker/engine'
import { FUNCTIONS_KEYS } from '~/utils/functionsKey'

describe('the functions page', () => {
  it('shows the parser’s own error messages', async () => {
    const w = await mountSuspended(Functions)
    expect(w.findAll('[data-error]').map((c) => c.text())).toEqual([
      FUNCTION_ERRORS.notAKey('H'),
      FUNCTION_ERRORS.notAFunction('V7/x'),
      FUNCTION_ERRORS.subNotDominant(),
      FUNCTION_ERRORS.majorOnLowerCase('iimaj7'),
    ])
  })

  it('writes the whole pattern: parentheses for a deceptive resolution, and the Berklee spellings', async () => {
    const w = await mountSuspended(Functions)
    const writing = w.find('section[aria-labelledby="writing"]')
    expect(writing.find('pre').text()).toBe('[Key:] [(] [sub] [♭|♯] NUMERAL [quality] [/ [♭|♯] NUMERAL] [)]')
    expect(writing.text()).toContain('(V7/ii): a dominant that doesn’t resolve as expected; the scale is the same')
    for (const s of ['II-7', 'VII-7(♭5)', 'V7(sus4)', 'SubV7/ii', 'I∆7', 'B♭: V7/ii']) expect(writing.text(), s).toContain(s)
  })

  it('has one anchor per rule, and one per section and group', async () => {
    const w = await mountSuspended(Functions)
    for (const r of RULES) expect(w.findAll(`[id="rule-${r.id}"]`), r.id).toHaveLength(1)
    for (const id of ['writing', 'table', 'rules', 'report', 'group-diatonic', 'group-secondary', 'group-substitutes', 'group-chromatic']) expect(w.findAll(`#${id}`), id).toHaveLength(1)
  })

  it('links every rule in the table to its row', async () => {
    const w = await mountSuspended(Functions)
    const targets = new Set(w.findAll('a[href^="#rule-"]').map((a) => a.attributes('href')))
    for (const t of targets) expect(w.findAll(`[id="${String(t).slice(1)}"]`), t).toHaveLength(1)
    expect(w.text()).toContain('A Mixolydian ♭6')
  })

  it('writes a flat only on a note, a degree or a numeral, in every key', () => {
    const texts = [...FUNCTIONS_KEYS.flatMap((k) => functionsTable(parseKey(k)!).map((r) => r.reason)), ...RULES.flatMap((r) => [r.scale, r.looksAt, r.summary, r.guess ?? ''])]
    const stray = texts.map(proseGlyphs).filter((t) => /(?<![A-G0-9])♭(?![\dIV])/.test(t))
    expect(stray).toEqual([])
  })
})

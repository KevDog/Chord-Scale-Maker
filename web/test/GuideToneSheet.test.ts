import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import GuideToneSheet from '~/components/GuideToneSheet.vue'
import { CONCERT, expandRows, parseChart, rowKeys } from '~~/engine'

const rows = (text: string) => expandRows(parseChart(text).value).value
const mount = (text: string) =>
  mountSuspended(GuideToneSheet, { props: { rows: rows(text), title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '' } })

describe('GuideToneSheet', () => {
  it('pages systems of bars with chord symbols and two labelled lines each', async () => {
    const w = await mount('A | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 4 | CMaj7\nA | 5 | Dm7\n')
    expect(w.find('h2').text()).toBe('T')
    expect(w.find('header p').text()).toBe('S (Guide Tone Lines)')
    expect(w.text()).toContain('Line 1')
    expect(w.text()).toContain('from the 7th')
    expect(w.findAll('[role=separator]')).toHaveLength(0) // one page: no dividers
  })

  it('lists what it could not voice', async () => {
    const w = await mount('A | 1 | Cm7#5#9x\n')
    expect(w.find('ul').text()).toContain('no guide tones for Cm7#5#9x')
  })

  it("carries the rows' keys to every bar it draws, and none without", async () => {
    const text = 'key: Eb\nA | 1 | Fm7\nA | 2 | Bb7\n'
    const props = { rows: rows(text), title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '' }
    const barsOf = async (extra: object) =>
      ((await mountSuspended(GuideToneSheet, { props: { ...props, ...extra }, global: { stubs: { GuideToneSystem: true } } })).findComponent({ name: 'GuideToneSystem' }).props('system') as { bars: { keySig: string | null }[] }).bars
    expect((await barsOf({ keys: rowKeys(parseChart(text).value) })).map((b) => b.keySig)).toEqual(['Eb', 'Eb'])
    expect((await barsOf({})).every((b) => b.keySig === null)).toBe(true)
  })
})

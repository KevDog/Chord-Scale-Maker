import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesSheet from '~/components/ChangesSheet.vue'
import { parseChart } from '~~/engine'

const doc = parseChart('title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n').value
const systemOf = async (signatures: boolean) =>
  (
    await mountSuspended(ChangesSheet, {
      props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, signatures },
      global: { stubs: { ChangesSystem: true } },
    })
  ).findComponent({ name: 'ChangesSystem' })

describe('ChangesSheet', () => {
  it("with signatures, gives each line its keys and the part's clef", async () => {
    const line = await systemOf(true)
    expect(line.props('clef')).toBe('bass')
    expect(line.props('line').bars[0].keySig).toBe('Bb')
  })

  it('without, neither (drawn as before)', async () => {
    const line = await systemOf(false)
    expect(line.props('clef')).toBeUndefined()
    expect(line.props('line').bars[0].keySig).toBeNull()
  })
})

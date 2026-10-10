import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesNote from '~/components/ChangesNote.vue'

describe('ChangesNote', () => {
  it('is a button described by a tooltip with the reason and the key', async () => {
    const w = await mountSuspended(ChangesNote, { props: { reason: 'V7/V in C: natural tensions (stated)', heardIn: 'C major', keyFrom: 'found' as const }, slots: { default: () => 'V7/V' } })
    const button = w.find('button')
    expect(button.text()).toBe('V7/V')
    const tip = w.find(`#${button.attributes('aria-describedby')}`)
    expect(tip.attributes('role')).toBe('tooltip')
    expect(tip.text()).toContain('V7/V in C: natural tensions (stated)')
    expect(tip.findAll('span').at(-1)?.text()).toBe('in C major')
    expect(tip.text()).not.toContain('function stated in the chart')
    expect(tip.classes()).toContain('print:hidden')
  })

  it("stars a key the author set, by an @key or the function's key", async () => {
    const keyLine = async (keyFrom: 'found' | 'area' | 'function'): Promise<string> =>
      (await mountSuspended(ChangesNote, { props: { reason: 'r', heardIn: 'D major', keyFrom }, slots: { default: () => 'x' } })).findAll('[role="tooltip"] > span').at(-1)?.text() ?? ''
    expect(await keyLine('found')).toBe('in D major')
    expect(await keyLine('area')).toBe('* in D major')
    expect(await keyLine('function')).toBe('* in D major')
  })

  it('wraps instead of truncating when asked', async () => {
    const props = { reason: 'r', heardIn: 'C major', keyFrom: 'found' as const }
    const plain = await mountSuspended(ChangesNote, { props, slots: { default: () => 'x' } })
    expect(plain.find('button').classes()).toContain('truncate')
    const w = await mountSuspended(ChangesNote, { props: { ...props, wrap: true }, slots: { default: () => 'x' } })
    expect(w.find('button').classes()).not.toContain('truncate')
    expect(w.find('button').classes()).toContain('whitespace-normal')
  })
})

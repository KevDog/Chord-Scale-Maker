import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PracticePanel from '~/components/PracticePanel.vue'

const boxes = [
  { key: '1', label: '1' },
  { key: 'b3', label: '♭3' },
  { key: '3', label: '3' },
  { key: 'b7', label: '♭7' },
]
const mount = (props: Record<string, unknown>) =>
  mountSuspended(PracticePanel, { props: { mode: 'root', startText: 'C', boxes, selection: null, lit: [], ...props } })

describe('PracticePanel', () => {
  it('offers per-chord presets from the root, All from a start note', async () => {
    expect((await mount({})).findAll('button').map((b) => b.text())).toEqual(['Chord tones', 'Guide tones', 'Tensions', 'Clear'])
    const from = await mount({ mode: 'from', startText: 'Eb' })
    expect(from.findAll('button').map((b) => b.text())).toEqual(['All', 'Clear'])
    expect(from.text()).toContain('pitches spelled from E♭')
  })

  it('shows what a preset lights, and editing a box starts a custom selection from it', async () => {
    const w = await mount({ selection: { preset: 'guideTones' }, lit: ['b3', '3', 'b7'] })
    const boxesEl = w.findAll('input[type=checkbox]')
    expect(boxesEl.map((b) => (b.element as HTMLInputElement).checked)).toEqual([false, true, true, true])
    expect(w.find('button[aria-pressed=true]').text()).toBe('Guide tones')
    await boxesEl[2]?.trigger('change')
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['b3', 'b7'] }]])
  })

  it('toggles a preset off, and clears', async () => {
    const w = await mount({ selection: { preset: 'chordTones' }, lit: ['1', '3'] })
    await w.findAll('button')[0]?.trigger('click') // the active preset
    await w.findAll('button').at(-1)?.trigger('click') // Clear
    expect(w.emitted('update:selection')).toEqual([[null], [null]])
    const off = await mount({})
    expect(off.findAll('button').at(-1)?.attributes('disabled')).toBeDefined()
    await off.findAll('input[type=checkbox]')[1]?.trigger('change')
    expect(off.emitted('update:selection')).toEqual([[{ keys: ['b3'] }]])
  })
})

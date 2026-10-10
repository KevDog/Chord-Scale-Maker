import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesNote from '~/components/ChangesNote.vue'

const base = { reason: 'r', heardIn: 'C major', keyFrom: 'found' as const, rule: 'm4', fallback: false, chord: 'Dm7', numeral: 'ii7', scale: 'D Dorian' }
const mountNote = (props: Partial<typeof base> & { wrap?: boolean } = {}) => mountSuspended(ChangesNote, { props: { ...base, ...props }, slots: { default: () => 'x' }, attachTo: document.body })

describe('ChangesNote', () => {
  it('opens on click and shows the reason, the key, and the rule as a link', async () => {
    const w = await mountNote({ reason: 'ii of the ii–V to C' })
    expect(w.find('[role=dialog]').exists()).toBe(false)
    await w.find('button').trigger('click')
    const panel = w.find('[role=dialog]')
    expect(panel.attributes('aria-label')).toBe('Why: Dm7')
    expect(panel.text()).toContain('ii of the ii–V to C')
    expect(panel.text()).toContain('in C major')
    expect(panel.classes()).toContain('print:hidden')
    expect(panel.find('a[href="/functions#rule-m4"]').text()).toBe('m4')
    w.unmount()
  })

  it('links each part of a compound rule', async () => {
    const w = await mountNote({ rule: 'D1+D4', chord: 'G7b9' })
    await w.find('button').trigger('click')
    expect(w.findAll('[role=dialog] a[href^="/functions#rule-"]').map((a) => a.attributes('href'))).toEqual(['/functions#rule-D1', '/functions#rule-D4'])
    w.unmount()
  })

  it('says when the rules only guessed', async () => {
    const w = await mountNote({ rule: 'm8', fallback: true, chord: 'Abm7' })
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').text()).toContain('rule m8, a guess — an @key or a function would settle it')
    w.unmount()
  })

  it('names no rule when the analysis has none', async () => {
    const w = await mountNote({ rule: '' })
    await w.find('button').trigger('click')
    expect(w.find('[role=dialog]').text()).not.toContain('rule')
    w.unmount()
  })

  it("stars a key the author set, by an @key or the function's key", async () => {
    const keyLine = async (keyFrom: 'found' | 'area' | 'function'): Promise<string> => {
      const w = await mountNote({ keyFrom, heardIn: 'D major' })
      await w.find('button').trigger('click')
      const t = w.findAll('[role=dialog] > span').at(-1)?.text() ?? ''
      w.unmount()
      return t
    }
    expect(await keyLine('found')).toBe('in D major')
    expect(await keyLine('area')).toBe('* in D major')
    expect(await keyLine('function')).toBe('* in D major')
  })

  it('wraps instead of truncating when asked', async () => {
    const plain = await mountNote()
    expect(plain.find('button').classes()).toContain('truncate')
    plain.unmount()
    const w = await mountNote({ wrap: true })
    expect(w.find('button').classes()).not.toContain('truncate')
    expect(w.find('button').classes()).toContain('whitespace-normal')
    w.unmount()
  })
})

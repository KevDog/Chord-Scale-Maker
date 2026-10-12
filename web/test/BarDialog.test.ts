import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import BarDialog from '~/components/BarDialog.vue'

describe('BarDialog', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('the nav kind offers the jumps with None, starting on the bar’s own, and submits the choice', async () => {
    const w = await mountSuspended(BarDialog, { props: { kind: 'nav', sections: ['A'], section: 'A', bar: 4, beats: 4, error: '', nav: 'To Coda' }, attachTo: document.body })
    await nextTick()
    const dialog = document.querySelector('[role=dialog]')
    expect(dialog?.textContent).toContain('Jump at the end of the bar')
    const select = dialog?.querySelector('select') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['None', 'D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine'])
    expect(select.value).toBe('To Coda')
    select.value = 'Fine'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    ;[...dialog!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Set')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[0]).toEqual([{ kind: 'nav', text: 'Fine' }])
  })

  const open = async (kind: string, over: Partial<{ section: string; sections: string[] }> = {}) => {
    const w = await mountSuspended(BarDialog, { props: { kind, sections: ['A', 'B'], section: 'A', bar: 2, beats: 4, error: '', ...over }, attachTo: document.body })
    await nextTick()
    const dialog = document.querySelector('[role=dialog]') as HTMLElement
    const button = (name: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
    return { w, dialog, button }
  }
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    el.value = value
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('the paste kind reads a line of bars, counts them, and inserts before or after the bar', async () => {
    const { w, dialog, button } = await open('paste')
    expect(dialog.textContent).toContain('Paste bars')
    expect(button('Insert before bar 2')?.disabled).toBe(true)
    expect(button('Insert after bar 2')?.disabled).toBe(true)
    await type(dialog.querySelector('textarea')!, '| Cm7 | F7 | Bm7 E7 |')
    expect(dialog.textContent).toContain('3 bars')
    expect(button('Insert after bar 2')?.disabled).toBe(false)
    button('Insert before bar 2')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[0]).toEqual([{ kind: 'paste', bars: [['Cm7'], ['F7'], ['Bm7', 'E7']], before: true }])
    button('Insert after bar 2')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[1]).toEqual([{ kind: 'paste', bars: [['Cm7'], ['F7'], ['Bm7', 'E7']], before: false }])
  })

  it('the paste kind lists what it can’t read, and inserts nothing meanwhile', async () => {
    const { w, dialog, button } = await open('paste')
    await type(dialog.querySelector('textarea')!, '| Cm7 | F7 Bb7 Eb7 Ab7 Db7 |')
    expect(dialog.querySelector('[role=alert]')?.textContent).toMatch(/Line 1: more than 4 chords in bar 2/)
    expect(dialog.textContent).not.toContain('2 bars')
    expect(button('Insert after bar 2')?.disabled).toBe(true)
    button('Insert after bar 2')?.click()
    await nextTick()
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('the repeat kind offers the sections, starting on the one it was opened from, and names the repeat', async () => {
    const { w, dialog, button } = await open('repeat', { section: 'B' })
    expect(dialog.textContent).toContain('Repeat a section')
    const select = dialog.querySelector('select') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['A', 'B'])
    expect(select.value).toBe('B')
    await type(dialog.querySelector('input')!, 'C')
    button('Repeat')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[0]).toEqual([{ kind: 'repeat', src: 'B', name: 'C' }])
  })

  it('the rename kind starts on the section’s name and submits the new one', async () => {
    const { w, dialog, button } = await open('rename', { section: 'A' })
    expect(dialog.textContent).toContain('Rename section')
    const input = dialog.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('A')
    await type(input, 'Verse')
    button('Rename')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[0]).toEqual([{ kind: 'rename', name: 'Verse' }])
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import IRealImportDialog from '~/components/IRealImportDialog.vue'

const song = (title: string) => ({ title, composer: '', style: '', key: 'C', music: '' })
const base = { open: true, songs: [], playlist: '', report: [], error: '', busy: false }
const mount = async (props: Partial<typeof base> & Record<string, unknown>) => {
  const w = await mountSuspended(IRealImportDialog, { props: { ...base, ...props }, attachTo: document.body })
  await nextTick()
  const dialog = document.querySelector('[role=dialog]') as HTMLElement
  const button = (name: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
  return { w, dialog, button }
}

describe('IRealImportDialog', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('takes a pasted link', async () => {
    const { w, dialog, button } = await mount({})
    expect(dialog.textContent).toContain('Import from iReal Pro')
    const field = dialog.querySelector('textarea') as HTMLTextAreaElement
    field.value = 'irealb://abc'
    field.dispatchEvent(new Event('input'))
    await nextTick()
    button('Import')?.click()
    await nextTick()
    expect(w.emitted('link')?.[0]).toEqual(['irealb://abc'])
  })

  it('a playlist: pick a song by title', async () => {
    const { w, dialog, button } = await mount({ songs: [song('One'), song('Two')], playlist: 'Set' })
    expect(dialog.textContent).toContain('Set')
    const select = dialog.querySelector('select') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['One', 'Two'])
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    button('Open')?.click()
    await nextTick()
    expect(w.emitted('choose')?.[0]).toEqual([1])
  })

  it('the report lists what was left out, with Open anyway', async () => {
    const { w, dialog, button } = await mount({ report: [{ line: 1, message: 'A bar 1: the alternate chord Db7 is left out' }] })
    expect(dialog.textContent).toContain('the alternate chord Db7 is left out')
    button('Open anyway')?.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    button('Cancel')?.click()
    expect(w.emitted('close')).toHaveLength(1)
  })
})

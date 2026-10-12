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
})

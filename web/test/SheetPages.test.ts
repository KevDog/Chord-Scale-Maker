import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import SheetPages from '~/components/SheetPages.vue'

const pages = [{ subtitle: 'C (Changes)' }, { subtitle: 'C (Changes)' }]

describe('SheetPages', () => {
  it('prints a heading on every page, shown on screen where the subtitle changes', async () => {
    const w = await mountSuspended(SheetPages, { props: { title: 'T', composer: 'X', pages }, slots: { default: () => h('p', 'music') } })
    const headers = w.findAll('header')
    expect(headers).toHaveLength(2)
    expect(headers[0]?.classes()).not.toContain('hidden')
    expect(headers[1]?.classes()).toContain('hidden')
    expect(headers[0]?.find('h2').text()).toBe('T')
  })

  it('with a heading slot, shows it in place of the first page’s heading on screen, and keeps the printed one for print', async () => {
    const w = await mountSuspended(SheetPages, { props: { title: 'T', pages }, slots: { default: () => h('p', 'music'), heading: () => h('input', { 'aria-label': 'Title' }) } })
    const first = w.findAll('header')[0]
    expect(first?.find('input[aria-label=Title]').exists()).toBe(true)
    const printed = first?.find('h2')
    expect(printed?.text()).toBe('T')
    expect(printed?.element.closest('.print\\:block')?.classList.contains('hidden')).toBe(true)
    expect(w.findAll('header')[1]?.find('input').exists()).toBe(false)
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import MoreMenu from '~/components/MoreMenu.vue'

const open = async () => {
  const w = await mountSuspended(MoreMenu, { props: { items: ['report'] }, attachTo: document.body })
  await w.find('button[aria-label="More actions"]').trigger('click')
  await nextTick()
  return w
}
const levels = () => [...document.querySelectorAll<HTMLElement>('[role=menuitem][data-level]')]

describe('MoreMenu Interface', () => {
  beforeEach(() => (document.body.innerHTML = ''))
  afterEach(() => {
    useRuntimeConfig().public.features.interfaceLevels = false
    useInterface().level.value = 'everything'
  })

  it('offers the three levels, the current one marked, and picks one', async () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    useInterface().level.value = 'essentials'
    await open()
    expect(document.body.textContent).toContain('Interface')
    expect(levels().map((r) => r.textContent?.trim())).toEqual(['Essentials (current)', 'Intermediate', 'Everything'])
    levels()[1]?.click()
    await nextTick()
    expect(useInterface().level.value).toBe('intermediate')
  })

  it('has no Interface with the flag off', async () => {
    await open()
    expect(levels()).toHaveLength(0)
    expect(document.body.textContent).toContain('Report a chart error')
  })
})

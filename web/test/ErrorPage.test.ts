import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ErrorPage from '~/error.vue'

/** the page's own buttons (the navbar's icon buttons have no text) */
const actions = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('main button').map((b) => b.text())
const mount = (statusCode: number) => mountSuspended(ErrorPage, { props: { error: { statusCode } as never } })

describe('error page', () => {
  it('explains a missing page and offers the way back', async () => {
    const w = await mount(404)
    expect(w.text()).toContain('Error 404')
    expect(w.find('h1').text()).toBe('Page not found')
    expect(actions(w)).toEqual(['Go to the chart library'])
  })

  it('offers a retry and a contact link for other errors', async () => {
    const w = await mount(500)
    expect(w.text()).toContain('Error 500')
    expect(w.find('h1').text()).toBe('Something went wrong')
    expect(actions(w)).toEqual(['Go to the chart library', 'Try again'])
    expect(w.find('a[href="/contact"]').exists()).toBe(true)
  })
})

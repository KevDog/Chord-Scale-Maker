import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import InterfaceNotice from '~/components/InterfaceNotice.vue'

describe('InterfaceNotice', () => {
  it('names the level the sheet needs, and offers Show controls and Reset', async () => {
    const w = await mountSuspended(InterfaceNotice, { props: { needs: 'intermediate' } })
    expect(w.find('[role=status]').text()).toContain('This sheet uses Intermediate settings')
    const button = (name: string) => w.findAll('button').find((b) => b.text() === name)
    await button('Show controls')?.trigger('click')
    await button('Reset')?.trigger('click')
    expect(w.emitted('show')).toHaveLength(1)
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

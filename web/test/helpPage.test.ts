import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Help from '~/pages/help.vue'
import { PENT_INSIDE_HELP } from '~/utils/pentatonics'

describe('the help page', () => {
  it('explains the Pentatonic preset’s Built on, with the usual inside choices (#286)', async () => {
    const text = (await mountSuspended(Help)).text()
    expect(text).toContain('Built on')
    expect(text).toContain(PENT_INSIDE_HELP)
  })
})

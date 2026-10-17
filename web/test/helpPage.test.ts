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

  it('explains the Pentatonic line and its Leave out (#284)', async () => {
    const text = (await mountSuspended(Help)).text().replace(/\s+/g, ' ')
    expect(text).toContain('7th Chords becomes Pentatonic')
    expect(text).toContain('Leave out picks the note each cell drops')
  })
})

describe('the help page, offline flag off', () => {
  it('says nothing about installing it (#324)', async () => {
    expect((await mountSuspended(Help)).text()).not.toContain('Add to Home Screen')
  })
})

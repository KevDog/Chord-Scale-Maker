import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Index from '~/pages/index.vue'

describe('library page', () => {
  it('requests a chart as a GitHub issue labelled Add Chart', async () => {
    const w = await mountSuspended(Index)
    const link = w.findAll('a').find((a) => a.text() === 'Request a chart')
    expect(link?.attributes('href')).toBe('https://github.com/KevDog/Chord-Scale-Maker/issues/new?labels=Add+Chart')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { scaleAtLevel } from '@chord-scale-maker/engine'
import HowItDecides from '~/pages/how-it-decides.vue'

describe('How it decides', () => {
  it('shows G7 at each level from the engine', async () => {
    const page = await mountSuspended(HowItDecides)
    const row = page.find('[data-decision="scale.level"] tbody tr').findAll('td').map((td) => td.text())
    expect(row).toEqual(['G7', scaleAtLevel('G7', 'basic'), scaleAtLevel('G7', 'standard'), scaleAtLevel('G7', 'advanced')])
    expect(row[2]).toBe('G Mixolydian')
  })
})

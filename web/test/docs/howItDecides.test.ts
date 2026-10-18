import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, noteName, scaleAtLevel } from '@chord-scale-maker/engine'
import { instrumentOption } from '~/utils/instrumentChoices'
import HowItDecides from '~/pages/how-it-decides.vue'

describe('How it decides', () => {
  it('shows G7 at each level from the engine', async () => {
    const page = await mountSuspended(HowItDecides)
    const row = page.find('[data-decision="scale.level"] tbody tr').findAll('td').map((td) => td.text())
    expect(row).toEqual(['G7', scaleAtLevel('G7', 'basic'), scaleAtLevel('G7', 'standard'), scaleAtLevel('G7', 'advanced')])
    expect(row[2]).toBe('G Mixolydian')
  })

  it('keeps the gated sections’ anchors with their flags off', async () => {
    const features = useRuntimeConfig().public.features as Record<string, unknown>
    const was = { ...features }
    Object.assign(features, { cells: false, approaches: false, patterns: false })
    try {
      const page = await mountSuspended(HowItDecides)
      for (const id of ['cells.line', 'cells.system', 'approach.figures', 'approach.place', 'patterns.run']) expect(page.findAll(`[id="${id}"]`), id).toHaveLength(1)
      expect(page.find('[data-decision="cells.line"]').text()).not.toContain('Randy Vincent')
    } finally {
      Object.assign(features, was)
    }
  })

  it('lists every instrument’s written range', async () => {
    const page = await mountSuspended(HowItDecides)
    const rows = page.findAll('[data-decision="range.instrument"] tbody tr')
    expect(rows).toHaveLength(Object.keys(INSTRUMENTS).length)
    expect(rows[0]!.findAll('td').map((td) => td.text())).toEqual([instrumentOption('piano'), `${noteName(INSTRUMENTS.piano.range.lo)}–${noteName(INSTRUMENTS.piano.range.hi)}`])
  })
})

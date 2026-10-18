import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CONCERT, hexatonicChoices, INSTRUMENTS, noteName, pentatonicChoices, scaleAtLevel } from '@chord-scale-maker/engine'
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

  it('ranks the pentatonics and triad pairs over Cmaj7 from the engine', async () => {
    const page = await mountSuspended(HowItDecides)
    const pent = page.findAll('[data-decision="pent.auto"] tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(pent).toEqual(pentatonicChoices('Cmaj7', 'C Ionian', CONCERT).slice(0, 3).map((c) => [c.name, String(c.shared)]))
    expect(page.find('[data-decision="hex.auto"]').text()).toContain(hexatonicChoices('Cmaj7', 'C Ionian', CONCERT)[0]!.name)
  })

  describe('says only what the sheets do (review)', () => {
    const section = async (id: string) => (await mountSuspended(HowItDecides)).find(`[data-decision="${id}"]`).text().replace(/\s+/g, ' ')

    it('says Auto is per chord, and the Changes ranks by key area until Ranked against is Chord', async () => {
      const page = await mountSuspended(HowItDecides)
      expect(page.find('[aria-labelledby="superimposing"]').text()).not.toContain('the same way')
      expect(await section('pent.auto')).toContain('Ranked against Key')
    })
    it('avoids B♯, E♯, C♭ and F♭ where it can, not always', async () => expect(await section('spell.root')).toContain('as few'))
    it('names the augmented triad’s 5th', async () => expect(await section('guide.tones')).toMatch(/augmented triad its 5th.*3, 7, 6, 4, 5 or 1/))
    it('spells an enclosure’s step from the chord before', async () => expect(await section('approach.figures')).not.toContain("in the chord's scale"))
    it('says the Arpeggios sheet runs past the range', async () => expect(await section('range.instrument')).toContain('Arpeggios sheet'))
    it('says Random deals each chord its own scale', async () => expect(await section('scale.level')).toContain('its own inside scale'))
  })

  it('lists every instrument’s written range', async () => {
    const page = await mountSuspended(HowItDecides)
    const rows = page.findAll('[data-decision="range.instrument"] tbody tr')
    expect(rows).toHaveLength(Object.keys(INSTRUMENTS).length)
    expect(rows[0]!.findAll('td').map((td) => td.text())).toEqual([instrumentOption('piano'), `${noteName(INSTRUMENTS.piano.range.lo)}–${noteName(INSTRUMENTS.piano.range.hi)}`])
  })
})

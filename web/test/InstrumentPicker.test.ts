import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { InstrumentName } from '@chord-scale-maker/engine'
import InstrumentPicker from '~/components/InstrumentPicker.vue'

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>
const mount = (instrument: InstrumentName, props: Record<string, unknown> = {}) =>
  mountSuspended(InstrumentPicker, { props: { modelValue: instrument, ...props } })
const button = (w: Wrapper, name: string) => w.findAll('button').find((b) => b.attributes('aria-label') === name)!
const open = async (w: Wrapper, name: string) => {
  await button(w, name).trigger('click')
  await nextTick()
  return w.findAll('[role=option]')
}

describe('InstrumentPicker (#417)', () => {
  it('shows the pitch, then the instrument', async () => {
    const w = await mount('tenor-sax')
    expect(button(w, 'Pitch').text()).toBe('B♭')
    expect(button(w, 'Instrument').text()).toBe('Tenor Sax')
  })

  it('stacks the pitch above the instrument when told to', async () => {
    expect((await mount('tenor-sax')).find('div').classes()).toContain('items-center')
    expect((await mount('tenor-sax', { stacked: true })).find('div').classes()).toContain('flex-col')
  })

  it('offers the five pitches, Concert first', async () => {
    const options = await open(await mount('tenor-sax'), 'Pitch')
    expect(options.map((o) => o.text())).toEqual(['Concert', 'B♭', 'E♭', 'F', 'Bass'])
  })

  it('lists only the instruments of its pitch, with their ranges', async () => {
    const options = await open(await mount('tenor-sax'), 'Instrument')
    expect(options.map((o) => o.text().split(':')[0])).toEqual(['Trumpet', 'Flugelhorn', 'Clarinet', 'Soprano Sax', 'Tenor Sax'])
    expect(options[4]?.text()).toContain('B♭3–F♯6')
  })

  it('leaves the ranges out when told to', async () => {
    const options = await open(await mount('tenor-sax', { describe: false }), 'Instrument')
    expect(options.map((o) => o.text())).toEqual(['Trumpet', 'Flugelhorn', 'Clarinet', 'Soprano Sax', 'Tenor Sax'])
  })

  it('a new pitch picks its first instrument; an instrument is picked as it is', async () => {
    const w = await mount('tenor-sax')
    await (await open(w, 'Pitch'))[2]?.trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['alto-sax'])
    await w.setProps({ modelValue: 'alto-sax' })
    await (await open(w, 'Instrument'))[1]?.trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['bari-sax'])
  })

  it('says an instrument was chosen only when it is picked from the instruments, not as a pitch’s first', async () => {
    const w = await mount('tenor-sax')
    await (await open(w, 'Pitch'))[2]?.trigger('click')
    expect(w.emitted('chosen')).toBeUndefined()
    await w.setProps({ modelValue: 'alto-sax' })
    await (await open(w, 'Instrument'))[1]?.trigger('click')
    expect(w.emitted('chosen')).toEqual([['bari-sax']])
  })

  it('choosing its own pitch again keeps the instrument', async () => {
    const w = await mount('tenor-sax')
    await (await open(w, 'Pitch'))[1]?.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

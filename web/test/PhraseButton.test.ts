import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { buildArpeggioSheet, buildSheet, CONCERT, partFor, type Row } from '@chord-scale-maker/engine'
import ArpeggioStaff from '~/components/ArpeggioStaff.vue'
import ScaleStaff from '~/components/ScaleStaff.vue'
import { CLICK, useClick } from '~/composables/useClick'
import { fakeAudio, timers } from './clickFakes'

vi.mock('~/utils/vexflow', async (importOriginal) => ({ ...(await importOriginal<object>()), drawStaff: () => [], drawArpeggioStaff: () => [] }))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const row = (chord: string): Row => ({ section: 'A', bar: '1', chord, scale: '' })
const dorian = (part = CONCERT) => buildSheet([row('Dm7')], part, 'root', 'C', 12)[0]!.pages.flat()[0]!

describe('a staff’s Play (#507)', () => {
  const features = () => useRuntimeConfig().public.features as Record<string, unknown>
  let was: Record<string, unknown>
  beforeEach(() => {
    was = { ...features() }
    Object.assign(features(), { hearLine: true })
  })
  afterEach(() => Object.assign(features(), was))

  function clicked() {
    const audio = fakeAudio()
    const click = useClick(ref({ beats: 4 as const, style: 'Medium', metreChanges: false }), ref(undefined), { audio: () => audio, ...timers() })
    return { audio, click, global: { provide: { [CLICK as symbol]: click } } }
  }

  it('sounds a Scales staff up and down at concert pitch, then Stop silences it', async () => {
    const { audio, click, global } = clicked()
    const trumpet = partFor('trumpet')
    const w = await mountSuspended(ScaleStaff, { props: { staff: dorian(trumpet), clef: 'treble', part: trumpet }, global })
    const play = w.find('[data-slot="phrase-play"]')
    expect(play.attributes('aria-label')).toBe('Play E Dorian')
    await play.trigger('click')
    await flushPromises()
    const concert = scaleMidis(dorian())
    expect(audio.notes.map((n) => n.midi)).toEqual([...concert, ...concert.slice(0, -1).reverse()])
    expect(click.playing.value).toBe(dorian(trumpet).id)
    expect(w.find('[data-slot="phrase-play"]').attributes('aria-label')).toBe('Stop E Dorian')
    await w.find('[data-slot="phrase-play"]').trigger('click')
    expect(click.playing.value).toBe(null)
    expect(audio.notes.every((n) => n.stopped)).toBe(true)
  })

  it('sounds an Arpeggio staff’s notes as drawn', async () => {
    const { audio, global } = clicked()
    const staff = buildArpeggioSheet([row('Dm7')], CONCERT, 12, 'seventh', 'up').pages.flat()[0]!
    const w = await mountSuspended(ArpeggioStaff, { props: { staff, clef: 'treble', part: CONCERT }, global })
    await w.find('[data-slot="phrase-play"]').trigger('click')
    await flushPromises()
    expect(audio.notes.map((n) => n.midi)).toEqual(staff.notes.map((n) => n.midi))
  })

  it('shows only with a click (the song page) and the flag on', async () => {
    expect((await mountSuspended(ScaleStaff, { props: { staff: dorian(), clef: 'treble', part: CONCERT } })).find('[data-slot="phrase-play"]').exists()).toBe(false)
    Object.assign(features(), { hearLine: false })
    const { global } = clicked()
    expect((await mountSuspended(ScaleStaff, { props: { staff: dorian(), clef: 'treble', part: CONCERT }, global })).find('[data-slot="phrase-play"]').exists()).toBe(false)
  })
})

const scaleMidis = (s: ReturnType<typeof dorian>) => s.notes.map((n) => n.midi)

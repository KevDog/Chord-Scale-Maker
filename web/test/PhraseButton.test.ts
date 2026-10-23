import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { buildArpeggioSheet, buildChanges, buildSheet, CONCERT, parseChart, parseRoot, partFor, type PentatonicPlan, pentatonicPhrase, type Row, showPentatonics } from '@chord-scale-maker/engine'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import ArpeggioStaff from '~/components/ArpeggioStaff.vue'
import ScaleStaff from '~/components/ScaleStaff.vue'
import { CLICK, useClick } from '~/composables/useClick'
import { fakeAudio, timers } from './clickFakes'

vi.mock('~/utils/vexflow', async (importOriginal) => ({ ...(await importOriginal<object>()), drawStaff: () => [], drawArpeggioStaff: () => [] }))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const row = (chord: string): Row => ({ section: 'A', bar: '1', chord, scale: '' })
const PENT: PentatonicPlan = { kind: 'pentatonic', bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false }
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

  it('sounds a ladder rung’s pentatonic, without picking it (part 3)', async () => {
    const { audio, global } = clicked()
    const p = showPentatonics(buildChanges(parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Cmaj7').value, CONCERT, 4, false, 'off', undefined, PENT).lines)[0]!.bars[0]!.chords[0]!.pentatonic!
    const w = await mountSuspended(PentatonicLadder, { props: { p, header: 'H', footer: 'F', part: CONCERT }, global, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-slot="phrase-play"]')).toHaveLength(12)
    const play = w.findAll('[data-slot="phrase-play"]').find((b) => b.attributes('aria-label') === 'Play F♯ minor pentatonic')!
    await play.trigger('click')
    await flushPromises()
    expect(audio.notes.map((n) => n.midi)).toEqual(pentatonicPhrase(parseRoot('F#'), CONCERT).map((n) => n.midi))
    expect(w.emitted('pick')).toBeUndefined()
    w.unmount()
  })

  it('shows only with a click (the song page) and the flag on', async () => {
    expect((await mountSuspended(ScaleStaff, { props: { staff: dorian(), clef: 'treble', part: CONCERT } })).find('[data-slot="phrase-play"]').exists()).toBe(false)
    Object.assign(features(), { hearLine: false })
    const { global } = clicked()
    expect((await mountSuspended(ScaleStaff, { props: { staff: dorian(), clef: 'treble', part: CONCERT }, global })).find('[data-slot="phrase-play"]').exists()).toBe(false)
  })
})

const scaleMidis = (s: ReturnType<typeof dorian>) => s.notes.map((n) => n.midi)

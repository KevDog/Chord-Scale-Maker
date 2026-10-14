import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref, type Ref } from 'vue'
import { type ChangesSection, PENTATONIC_HOME, type PentatonicView } from '@chord-scale-maker/engine'
import { usePentatonicPath } from '~/composables/usePentatonicPath'

const AABA: ChangesSection[] = ['A1', 'A2', 'B', 'A3'].map((key) => ({ key, marker: key, part: 'form' }))
const make = (key: string | undefined, sections = AABA, fallback: PentatonicView = { rung: 2, side: 'flat' }) => {
  const s = effectScope().run(() => usePentatonicPath(key, ref(sections), ref(fallback)))
  if (!s) throw new Error('no path')
  return s
}

const live = (sections: ChangesSection[]) => {
  const list: Ref<ChangesSection[]> = ref(sections)
  const s = effectScope().run(() => usePentatonicPath('live', list, ref({ rung: 2, side: 'flat' } as PentatonicView)))
  if (!s) throw new Error('no path')
  return { s, list }
}

describe('usePentatonicPath', () => {
  afterEach(() => localStorage.clear())

  it('treats a section named after an Object built-in as an ordinary one', () => {
    const p = make(undefined, ['constructor', 'toString', 'B'].map((key) => ({ key, marker: key, part: 'form' as const })))
    p.setPath('fifths')
    expect(p.plan.value.bySection.constructor).toEqual(expect.objectContaining({ rung: expect.any(Number), side: expect.any(String) }))
    expect(Object.values(p.plan.value.bySection).every((v) => typeof v === 'object' && 'rung' in v)).toBe(true)
  })

  it('carries a stored path to another chart key, and leaves One rung unwritten', async () => {
    const p = make('satin-doll')
    p.carryTo('mine:1')
    expect(localStorage.getItem('csm-pent-path:mine:1')).toBeNull()
    p.setPath('fifths')
    await nextTick()
    p.carryTo('mine:2')
    expect(make('mine:2').path.value).toBe('fifths')
  })

  it('starts at One rung: the sheet’s rung everywhere, no counts', () => {
    const p = make('satin-doll')
    expect(p.path.value).toBe('one')
    expect(p.plan.value).toEqual({ bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false })
  })

  it('fills the sections from a preset, with counts, and remembers it per chart', async () => {
    const p = make('satin-doll')
    p.setPath('side-slip')
    expect(p.plan.value.bySection.B).toEqual({ rung: 5, side: 'flat' })
    expect(p.plan.value.counts).toBe(true)
    await nextTick()
    expect(make('satin-doll').path.value).toBe('side-slip')
    expect(make('autumn-leaves').path.value).toBe('one')
  })

  it('stores a preset without its sections, so it follows the chart when the sections change', async () => {
    const { s, list } = live(['A1', 'B', 'A3'].map((key) => ({ key, marker: key, part: 'form' as const })))
    s.setPath('side-slip')
    await nextTick()
    expect(JSON.parse(localStorage.getItem('csm-pent-path:live') ?? '{}').sections).toEqual({})
    list.value = AABA
    expect(s.plan.value.bySection).toEqual({ A1: PENTATONIC_HOME, A2: PENTATONIC_HOME, B: { rung: 5, side: 'flat' }, A3: PENTATONIC_HOME })
  })

  it('ignores stale sections and plays a new one Home under Custom', async () => {
    localStorage.setItem('csm-pent-path:x', JSON.stringify({ path: 'custom', sections: { Gone: { rung: 4, side: 'flat' }, A1: { rung: 1, side: 'sharp' } } }))
    const p = make('x')
    expect(p.plan.value.bySection.A1).toEqual({ rung: 1, side: 'sharp' })
    expect('Gone' in p.plan.value.bySection).toBe(false)
    expect('B' in p.plan.value.bySection).toBe(false)
    expect(p.plan.value.fallback).toEqual(PENTATONIC_HOME)
  })

  it('reloads a stored Custom path', () => {
    localStorage.setItem('csm-pent-path:satin-doll', JSON.stringify({ path: 'custom', sections: { A2: { rung: 3, side: 'sharp' } } }))
    const again = make('satin-doll')
    expect(again.path.value).toBe('custom')
    expect(again.plan.value.bySection.A2).toEqual({ rung: 3, side: 'sharp' })
  })

  it('switching from a preset to Custom keeps what the preset played', async () => {
    const p = make('satin-doll')
    p.setPath('side-slip')
    const played = { ...p.plan.value.bySection }
    p.setPath('custom')
    expect(p.path.value).toBe('custom')
    expect(p.plan.value.bySection).toEqual(played)
  })

  it('ignores junk', () => {
    for (const junk of ['{', '{"path":"thirds"}', '{"path":"custom","sections":{"A1":{"rung":9,"side":"flat"}}}']) {
      localStorage.setItem('csm-pent-path:j', junk)
      const p = make('j')
      expect(p.plan.value.bySection.A1).toBeUndefined()
    }
    localStorage.setItem('csm-pent-path:j', '{"path":"thirds"}')
    expect(make('j').path.value).toBe('one')
  })

  it('stores nothing for One rung, even after another path', async () => {
    const p = make('satin-doll')
    p.setPath('fifths')
    await nextTick()
    p.setPath('one')
    await nextTick()
    expect(localStorage.getItem('csm-pent-path:satin-doll')).toBeNull()
  })

  it('keeps the path for the visit only with no chart key', async () => {
    const p = make(undefined)
    p.setPath('fifths')
    await nextTick()
    expect(localStorage.length).toBe(0)
    expect(p.path.value).toBe('fifths')
  })
})

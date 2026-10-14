import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { ChangesSection, PentatonicView } from '@chord-scale-maker/engine'
import { usePentatonicPath } from '~/composables/usePentatonicPath'

const AABA: ChangesSection[] = ['A1', 'A2', 'B', 'A3'].map((key) => ({ key, marker: key, part: 'form' }))
const make = (key: string | undefined, sections = AABA, fallback: PentatonicView = { rung: 2, side: 'flat' }) => {
  const s = effectScope().run(() => usePentatonicPath(key, ref(sections), ref(fallback)))
  if (!s) throw new Error('no path')
  return s
}

describe('usePentatonicPath', () => {
  afterEach(() => localStorage.clear())

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

  it('edits one section into Custom, seeding the rest with what they played', async () => {
    const p = make('satin-doll')
    p.setSection('A2', { rung: 3, side: 'sharp' })
    expect(p.path.value).toBe('custom')
    expect(p.plan.value.bySection).toEqual({ A1: { rung: 2, side: 'flat' }, A2: { rung: 3, side: 'sharp' }, B: { rung: 2, side: 'flat' }, A3: { rung: 2, side: 'flat' } })
    p.setPath('one')
    await nextTick()
    expect(localStorage.getItem('csm-pent-path:satin-doll')).toBeNull()
  })

  it('ignores stale sections and plays a new one Home under Custom', async () => {
    localStorage.setItem('csm-pent-path:x', JSON.stringify({ path: 'custom', sections: { Gone: { rung: 4, side: 'flat' }, A1: { rung: 1, side: 'sharp' } } }))
    const p = make('x')
    expect(p.plan.value.bySection.A1).toEqual({ rung: 1, side: 'sharp' })
    expect(p.plan.value.bySection.B ?? p.plan.value.fallback).toEqual({ rung: 0, side: 'flat' })
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

  it('keeps the path for the visit only with no chart key', async () => {
    const p = make(undefined)
    p.setPath('fifths')
    await nextTick()
    expect(localStorage.length).toBe(0)
    expect(p.path.value).toBe('fifths')
  })
})

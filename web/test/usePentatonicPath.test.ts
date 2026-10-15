import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { type ChangesSection, PENTATONIC_HOME, type PentatonicView } from '@chord-scale-maker/engine'
import { usePentatonicPath } from '~/composables/usePentatonicPath'

const AABA: ChangesSection[] = ['A1', 'A2', 'B', 'A3'].map((key) => ({ key, marker: key, part: 'form' }))
const make = (key: string | undefined, sections = AABA, fallback: PentatonicView = { rung: 2, side: 'flat' }) => {
  const s = effectScope().run(() => usePentatonicPath(key, ref(sections), ref(fallback)))
  if (!s) throw new Error('no path')
  return s
}

describe('usePentatonicPath', () => {
  afterEach(() => localStorage.clear())

  it('treats a Custom section named after an Object built-in as an ordinary one', () => {
    localStorage.setItem('csm-pent-path:b', JSON.stringify({ path: 'custom', sections: { constructor: { rung: 2, side: 'flat' } } }))
    const p = make('b', ['constructor', 'toString', 'B'].map((key) => ({ key, marker: key, part: 'form' as const })))
    expect(p.plan.value.bySection.constructor).toEqual({ rung: 2, side: 'flat' })
    expect(Object.hasOwn(p.plan.value.bySection, 'toString')).toBe(false)
  })

  it('hands a preset to the engine with its step, with counts, and remembers both per chart', async () => {
    const p = make('satin-doll')
    p.setPath('side-slip')
    expect(p.plan.value).toEqual({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: true, path: 'side-slip', step: { unit: 'section', bars: 4 } })
    p.setStep({ unit: 'bars', bars: 8 })
    expect(p.plan.value.step).toEqual({ unit: 'bars', bars: 8 })
    await nextTick()
    expect(JSON.parse(localStorage.getItem('csm-pent-path:satin-doll') ?? '{}')).toEqual({ path: 'side-slip', step: { unit: 'bars', bars: 8 }, sections: {} })
    const again = make('satin-doll')
    expect([again.path.value, again.step.value]).toEqual(['side-slip', { unit: 'bars', bars: 8 }])
    expect(make('autumn-leaves').path.value).toBe('one')
  })

  it('keeps the step when the path changes, and carries it to another chart', async () => {
    const p = make('satin-doll')
    p.setStep({ unit: 'key-area', bars: 4 })
    p.setPath('fifths')
    expect(p.step.value).toEqual({ unit: 'key-area', bars: 4 })
    await nextTick()
    p.carryTo('mine:3')
    expect(make('mine:3').step.value).toEqual({ unit: 'key-area', bars: 4 })
  })

  it('reads an old stored path as Section, every 4 bars', () => {
    for (const raw of [{ path: 'fifths', sections: {} }, { path: 'fifths', step: { unit: 'chord', bars: 4 }, sections: {} }, { path: 'fifths', step: { unit: 'bars', bars: 5 } }]) {
      localStorage.setItem('csm-pent-path:old', JSON.stringify(raw))
      expect(make('old').step.value).toEqual({ unit: 'section', bars: 4 })
    }
  })

  it('starts Custom empty from a preset', () => {
    const p = make('satin-doll')
    p.setPath('fifths')
    p.setPath('custom')
    expect(p.plan.value).toEqual({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: true })
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
    expect(p.plan.value).toEqual({ kind: 'pentatonic', bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false })
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

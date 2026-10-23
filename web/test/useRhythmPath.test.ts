import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { buildChanges, parseChart, partFor, RHYTHM_PATH_OFF, type RhythmPath } from '@chord-scale-maker/engine'
import { useRhythmPath } from '~/composables/useRhythmPath'

const flags = vi.hoisted(() => ({ gears: true }))
mockNuxtImport('useFeature', () => (name: string) => name !== 'rhythmGears' || flags.gears)

const make = (key: string | undefined, initial?: RhythmPath) => {
  const s = effectScope().run(() => useRhythmPath(key, initial))
  if (!s) throw new Error('no path')
  return s
}
const stored = (key: string): unknown => JSON.parse(localStorage.getItem(`csm-rhythm-path:${key}`) ?? 'null')

describe('useRhythmPath (Phase 4 spec §3, §7)', () => {
  afterEach(() => {
    localStorage.clear()
    flags.gears = true
  })

  it('starts off, and remembers a path and its step per chart', async () => {
    const p = make('satin-doll')
    expect(p.path.value).toEqual(RHYTHM_PATH_OFF)
    p.setGroups([3, 4, 5, 6, 7])
    p.setStep({ unit: 'bars', bars: 2 })
    await nextTick()
    expect(stored('satin-doll')).toEqual({ groups: [3, 4, 5, 6, 7], gears: null, step: { unit: 'bars', bars: 2 } })
    expect(make('satin-doll').path.value).toEqual({ groups: [3, 4, 5, 6, 7], gears: null, step: { unit: 'bars', bars: 2 } })
    expect(make('autumn-leaves').path.value).toEqual(RHYTHM_PATH_OFF)
    p.setGears(['8', '8t'])
    expect(p.path.value.gears).toEqual(['8', '8t'])
  })

  it('removes the stored path when both lists are One, and on reset', async () => {
    const p = make('satin-doll')
    p.setGroups([3, 4])
    await nextTick()
    p.setGroups(null)
    await nextTick()
    expect(localStorage.getItem('csm-rhythm-path:satin-doll')).toBeNull()
    p.setGears(['16'])
    await nextTick()
    expect(stored('satin-doll')).not.toBeNull()
    p.reset()
    await nextTick()
    expect(p.path.value).toEqual(RHYTHM_PATH_OFF)
    expect(localStorage.getItem('csm-rhythm-path:satin-doll')).toBeNull()
  })

  it('reads a stored path that is not one as off', () => {
    for (const raw of ['{', '"up"', JSON.stringify({ groups: [9], gears: null, step: { unit: 'section', bars: 4 } }), JSON.stringify({ groups: [3], gears: null })]) {
      localStorage.setItem('csm-rhythm-path:old', raw)
      expect(make('old').path.value).toEqual(RHYTHM_PATH_OFF)
    }
  })

  it('reads off with the rhythmGears flag off, keeping the stored path (D8)', () => {
    const path = { groups: [3, 4], gears: null, step: { unit: 'section', bars: 4 } }
    localStorage.setItem('csm-rhythm-path:satin-doll', JSON.stringify(path))
    flags.gears = false
    expect(make('satin-doll').path.value).toEqual(RHYTHM_PATH_OFF)
    expect(stored('satin-doll')).toEqual(path)
    flags.gears = true
    expect(make('satin-doll').path.value).toEqual(path)
  })

  it('without a key, lasts for the visit from a link’s path', async () => {
    const p = make(undefined, { groups: [3, 4], gears: null, step: { unit: 'bars', bars: 4 } })
    expect(p.path.value.groups).toEqual([3, 4])
    p.setGroups([5])
    await nextTick()
    expect(localStorage.length).toBe(0)
  })

  it('carries a path on to another chart', async () => {
    const p = make('satin-doll')
    p.carryTo('mine:1')
    expect(localStorage.getItem('csm-rhythm-path:mine:1')).toBeNull()
    p.setGroups([3, 4])
    p.carryTo('mine:2')
    expect(make('mine:2').path.value.groups).toEqual([3, 4])
  })

  it('takes a whole path back, for an undo (#553)', async () => {
    const p = make('autumn')
    const before = p.path.value
    p.setGroups([3, 4])
    p.setGears(['8t'])
    p.setStep({ unit: 'bars', bars: 8 })
    await nextTick()
    p.setPath(before)
    expect(p.path.value).toEqual(RHYTHM_PATH_OFF)
    await nextTick()
    expect(localStorage.getItem('csm-rhythm-path:autumn')).toBeNull()
  })

  it('keeps its groups and its steps when the chart’s sections are renamed (it stores no section names)', async () => {
    make('aaba').setGroups([3, 4, 5, 6, 7])
    await nextTick()
    const chart = (names: readonly string[]) => ['key: C', ...names.flatMap((n) => ['', `section: ${n}`, 'bars: 8', '1 | CMaj7', '3 | Am7', '5 | Dm7', '7 | G7'])].join('\n') + '\n'
    const marks = (names: readonly string[]) =>
      buildChanges(parseChart(chart(names)).value, partFor('piano'), 4, true, 'off', undefined, null, 'none', { rhythm: 'unit:8:3:accents', rhythmPath: make('aaba').path.value })
        .lines.flatMap((l) => l.bars.map((b) => b.step?.group ?? null))
        .filter((g) => g !== null)
    expect(marks(['A1', 'A2', 'B', 'A3'])).toEqual([3, 4, 5, 6])
    expect(marks(['Verse', 'Chorus', 'Bridge', 'Out'])).toEqual([3, 4, 5, 6])
  })
})

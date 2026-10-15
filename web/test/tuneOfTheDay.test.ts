import { describe, expect, it } from 'vitest'
import { toLibrary } from '~/utils/library'
import { anotherTune, tuneOfTheDay } from '~/utils/tuneOfTheDay'

const lib = toLibrary(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`t${i}.txt`, `title: Tune ${i}\ncomposer: C ${i}`])))

describe('tune of the day', () => {
  it('is the same tune all day', () => {
    expect(tuneOfTheDay(lib, new Date(2026, 9, 12, 0, 1))).toBe(tuneOfTheDay(lib, new Date(2026, 9, 12, 23, 59)))
  })

  it('changes from day to day', () => {
    const week = Array.from({ length: 7 }, (_, d) => tuneOfTheDay(lib, new Date(2026, 9, 12 + d))?.slug)
    expect(new Set(week).size).toBeGreaterThan(4)
  })

  it('is a tune, not a form or an exercise (a chart with no composer)', () => {
    const mixed = toLibrary({ 'f.txt': 'title: F Blues\nkind: form', 'e.txt': 'title: Modes\nkind: exercise', 't.txt': 'title: Tune\ncomposer: Someone' })
    for (let d = 0; d < 10; d++) expect(tuneOfTheDay(mixed, new Date(2026, 0, 1 + d))?.slug).toBe('t')
  })

  it('is nothing when the library has no tunes', () => {
    expect(tuneOfTheDay(toLibrary({ 'f.txt': 'title: F Blues\nkind: form' }), new Date(2026, 0, 1))).toBeNull()
  })
})

describe('another tune', () => {
  it('is a different tune', () => {
    const today = lib[3]!
    for (const r of [0, 0.5, 0.999]) {
      const next = anotherTune(lib, today, r)
      expect(next?.slug).not.toBe(today.slug)
      expect(next?.composer).not.toBe('')
    }
  })

  it('skips the forms', () => {
    const mixed = toLibrary({ 'a.txt': 'title: A\ncomposer: X', 'f.txt': 'title: F Blues\nkind: form', 'b.txt': 'title: B\ncomposer: Y' })
    for (const r of [0, 0.5, 0.999]) expect(anotherTune(mixed, mixed.find((c) => c.slug === 'a')!, r)?.slug).toBe('b')
  })
})

describe('library entries', () => {
  it('keep the style and form for the card', () => {
    const [chart] = toLibrary({ 'a.txt': 'title: A\ncomposer: X\nstyle: Latin\nkey: Cm\nform: AB' })
    expect([chart?.style, chart?.form]).toEqual(['Latin', 'AB'])
  })
})

import { describe, expect, it } from 'vitest'
import { addRecent, openedWhen, parseRecent, RECENT_MAX, type Recent } from '~/utils/recentCharts'

const lib = (id: string, at: number): Recent => ({ kind: 'library', id, at })

describe('recent charts', () => {
  it('puts the latest first, once', () => {
    const list = addRecent(addRecent([], lib('a', 1)), lib('b', 2))
    expect(addRecent(list, lib('a', 3))).toEqual([lib('a', 3), lib('b', 2)])
  })

  it('keeps a library tune and one of my charts with the same id apart', () => {
    const mine: Recent = { kind: 'mine', id: 'a', at: 2 }
    expect(addRecent([lib('a', 1)], mine)).toEqual([mine, lib('a', 1)])
  })

  it(`keeps only the last ${RECENT_MAX}`, () => {
    const list = Array.from({ length: RECENT_MAX + 2 }, (_, i) => lib(`t${i}`, i)).reduce(addRecent, [] as Recent[])
    expect(list.map((r) => r.id)).toEqual(['t6', 't5', 't4', 't3', 't2'])
  })

  it('reads back what it stored, skipping anything else', () => {
    const list = [lib('a', 2), { kind: 'mine', id: 'x1', at: 1 } as const]
    expect(parseRecent(JSON.stringify(list))).toEqual(list)
    expect(parseRecent(JSON.stringify([{ kind: 'other', id: 'a', at: 1 }, 'x', lib('b', 1)]))).toEqual([lib('b', 1)])
    expect(parseRecent('{nope')).toEqual([])
    expect(parseRecent(null)).toEqual([])
  })
})

describe('openedWhen', () => {
  const now = new Date(2026, 9, 12, 21, 0).getTime()
  const at = (day: number, hour = 9): number => new Date(2026, 9, day, hour).getTime()

  it('says today, yesterday, or how many days ago in the last week', () => {
    expect([at(12, 1), at(11, 23), at(10), at(6)].map((t) => openedWhen(t, now))).toEqual(['Today', 'Yesterday', '2 days ago', '6 days ago'])
  })

  it('gives the date after a week', () => {
    expect(openedWhen(at(1), now)).not.toMatch(/ago|day/)
  })
})

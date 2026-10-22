import { describe, expect, it } from 'vitest'
import { applyChoices, backupFileName, backupFrom, type ImportStep, isPreferenceKey, parseBackup, planImport, savedMetaFrom, serializeBackup } from '../backup'
import { LIMITS } from '../limits'

type Store = Readonly<Record<string, string>>
const HEADER = { exportedAt: '2026-10-21T12:00:00.000Z', version: '2026-10-21 abc1234' }

const chart = (title: string, body = '1 | Cm7'): string => `title: ${title}\nsection: A\n${body}\n`
const meta = (id: string, title: string, kind = 'new', basedOn?: string, updatedAt = 100) => ({
  id,
  title,
  kind,
  ...(basedOn ? { basedOn } : {}),
  createdAt: 1,
  updatedAt,
})
const PRACTICE = JSON.stringify({ preset: 'guideTones' })
const LEVEL = JSON.stringify({ level: 'advanced', seed: 7 })
const PICKS = JSON.stringify({ pentatonic: { 'A:1:0': { pc: 3 } }, hexatonic: {} })

/** a browser with two charts of its own, one an edited library chart, plus library state and preferences */
const LOCAL: Store = {
  'csm-charts': JSON.stringify([meta('aaaaaa1', 'Mine'), meta('bbbbbb2', 'Blue Bossa', 'edited', 'blue-bossa')]),
  'csm-chart:aaaaaa1': chart('Mine'),
  'csm-chart:bbbbbb2': chart('Blue Bossa', '1 | Cm7\n3 | Fm7'),
  'csm-practice:mine:aaaaaa1:root': PRACTICE,
  'csm-level:mine:aaaaaa1': LEVEL,
  'csm-practice:blue-bossa:from': PRACTICE,
  'csm-pent-picks:blue-bossa': PICKS,
  'csm-instrument': 'tenor-sax',
  'csm-range-tenor-sax': '{"low":"Ab3"}',
  'csm-theme': 'dark',
  'csm-undo:mine:aaaaaa1': '[]',
  'csm-recent': '[]',
  'csm-premigration:x': 'old',
}

/** apply the steps to a store, as the app does to localStorage */
function run(store: Store, steps: readonly ImportStep[]): Store {
  const out = new Map(Object.entries(store))
  for (const s of steps) {
    for (const k of s.removes) out.delete(k)
    for (const [k, v] of s.writes) out.set(k, v)
  }
  return Object.fromEntries(out)
}
const ids = (...list: string[]) => {
  const queue = [...list]
  return () => queue.shift() ?? 'zzzzzz9'
}
const roundTrip = (store: Store) => {
  const parsed = parseBackup(serializeBackup(backupFrom(store, HEADER)))
  if (!parsed) throw new Error('not a backup')
  return parsed.backup
}
const index = (store: Store) => JSON.parse(store['csm-charts'] ?? '[]') as { id: string; title: string; kind: string; basedOn?: string }[]

describe('backupFrom', () => {
  it('holds every chart with its text and its own state, keyed without its id', () => {
    const b = backupFrom(LOCAL, HEADER)
    expect(b).toMatchObject({ format: 'csm-backup', v: 1, ...HEADER })
    expect(b.charts).toEqual([
      { meta: meta('aaaaaa1', 'Mine'), text: chart('Mine'), state: { 'csm-practice:root': PRACTICE, 'csm-level': LEVEL } },
      { meta: meta('bbbbbb2', 'Blue Bossa', 'edited', 'blue-bossa'), text: LOCAL['csm-chart:bbbbbb2'], state: {} },
    ])
  })

  it('holds library state per slug, and the preferences', () => {
    const b = backupFrom(LOCAL, HEADER)
    expect(b.library).toEqual({ 'blue-bossa': { 'csm-practice:from': PRACTICE, 'csm-pent-picks': PICKS } })
    expect(b.preferences).toEqual({ 'csm-instrument': 'tenor-sax', 'csm-range-tenor-sax': '{"low":"Ab3"}', 'csm-theme': 'dark' })
  })

  it('leaves out undo history, recently opened and pre-migration copies', () => {
    expect(serializeBackup(backupFrom(LOCAL, HEADER))).not.toMatch(/csm-undo|csm-recent|premigration/)
  })

  it('skips a chart whose text is missing', () => {
    const { 'csm-chart:aaaaaa1': _, ...store } = LOCAL
    expect(backupFrom(store, HEADER).charts.map((c) => c.meta.id)).toEqual(['bbbbbb2'])
  })
})

describe('isPreferenceKey', () => {
  it('is a global view preference, not a chart, per-chart state or a kept list', () => {
    for (const k of ['csm-instrument', 'csm-range-alto-sax', 'csm-theme', 'csm-interface', 'csm-pent-rung']) expect(isPreferenceKey(k)).toBe(true)
    for (const k of ['csm-charts', 'csm-chart:abc123', 'csm-recent', 'csm-draft', 'csm-undo:x', 'csm-practice:mine:abcdef:root', 'csm-premigration:x', 'other'])
      expect(isPreferenceKey(k)).toBe(false)
  })
})

describe('parseBackup', () => {
  it('is null for anything that is not a backup', () => {
    for (const t of ['', 'title: X', '{"format":"other"}', '[]', '{"format":"csm-backup","v":2}', 'null']) expect(parseBackup(t)).toBeNull()
  })

  it('reads its own output back', () => {
    expect(parseBackup(serializeBackup(backupFrom(LOCAL, HEADER)))).toEqual({ backup: backupFrom(LOCAL, HEADER), dropped: 0 })
  })

  it('drops and counts bad entries', () => {
    const good = backupFrom(LOCAL, HEADER)
    const text = JSON.stringify({
      ...good,
      charts: [
        ...good.charts,
        { meta: meta('bad id!', 'X'), text: 'x', state: {} },
        { meta: meta('cccccc3', 'Long'), text: 'x'.repeat(LIMITS.maxChars + 1), state: {} },
        { meta: meta('dddddd4', 'NoText'), state: {} },
        'junk',
      ],
      library: { 'blue-bossa': { 'csm-practice:from': '{"preset":"nope"}', 'csm-level': LEVEL, 'csm-weird': '1' }, 'Bad Slug': {} },
      preferences: { 'csm-theme': 'dark', 'csm-charts': '[]', 'csm-instrument': 5 },
    })
    const parsed = parseBackup(text)
    expect(parsed?.backup.charts.map((c) => c.meta.id)).toEqual(['aaaaaa1', 'bbbbbb2'])
    expect(parsed?.backup.library).toEqual({ 'blue-bossa': { 'csm-level': LEVEL } })
    expect(parsed?.backup.preferences).toEqual({ 'csm-theme': 'dark' })
    expect(parsed?.dropped).toBe(9)
  })

  it('normalizes practice selections and chord picks through their validators', () => {
    const b = backupFrom(LOCAL, HEADER)
    const text = JSON.stringify({ ...b, library: { 'blue-bossa': { 'csm-practice:from': '{"keys":["b3","zz"]}' } } })
    expect(parseBackup(text)?.backup.library['blue-bossa']).toEqual({ 'csm-practice:from': '{"keys":["b3"]}' })
  })

  it('keeps one edited chart per library chart, the newest', () => {
    const b = backupFrom(LOCAL, HEADER)
    const older = { meta: meta('eeeeee5', 'Old', 'edited', 'blue-bossa', 50), text: chart('Old'), state: {} }
    const parsed = parseBackup(JSON.stringify({ ...b, charts: [...b.charts, older] }))
    expect(parsed?.backup.charts.map((c) => c.meta.id)).toEqual(['aaaaaa1', 'bbbbbb2'])
    expect(parsed?.dropped).toBe(1)
  })

  it('renames legacy library slugs', () => {
    const b = backupFrom(LOCAL, HEADER)
    const text = JSON.stringify({
      ...b,
      charts: [{ meta: meta('ffffff6', 'RM', 'edited', 'round_midnight'), text: chart('RM'), state: {} }],
      library: { round_midnight: { 'csm-level': LEVEL } },
    })
    const parsed = parseBackup(text)
    expect(parsed?.backup.charts[0]?.meta.basedOn).toBe('round-midnight')
    expect(parsed?.backup.library).toEqual({ 'round-midnight': { 'csm-level': LEVEL } })
  })
})

describe('savedMetaFrom', () => {
  it('reads an index entry, or null', () => {
    expect(savedMetaFrom(meta('aaaaaa1', 'Mine'))).toEqual(meta('aaaaaa1', 'Mine'))
    expect(savedMetaFrom({ ...meta('aaaaaa1', 'x'), kind: 'other' })).toBeNull()
    expect(savedMetaFrom({ ...meta('aaaaaa1', 'x'), title: 3 })).toMatchObject({ title: 'Untitled' })
  })
})

describe('round trip', () => {
  it('export, then import into an empty browser: the same data back', () => {
    const plan = planImport({}, roundTrip(LOCAL))
    const restored = run({}, applyChoices(plan, {}, ids()).steps)
    const { 'csm-undo:mine:aaaaaa1': _u, 'csm-recent': _r, 'csm-premigration:x': _p, ...kept } = LOCAL
    expect(restored).toEqual(kept)
  })

  it('import into the same browser: everything identical, nothing written', () => {
    const plan = planImport(LOCAL, roundTrip(LOCAL))
    expect(plan.charts.map((c) => c.status)).toEqual(['identical', 'identical'])
    expect(plan.library.map((l) => l.status)).toEqual(['identical'])
    expect(plan.preferences.status).toBe('identical')
    expect(applyChoices(plan, {}, ids()).steps).toEqual([])
  })
})

describe('planImport: charts', () => {
  const OTHER: Store = {
    'csm-charts': JSON.stringify([meta('aaaaaa1', 'Theirs', 'new', undefined, 200), meta('gggggg7', 'Fresh'), meta('hhhhhh8', 'Their Bossa', 'edited', 'blue-bossa', 300)]),
    'csm-chart:aaaaaa1': chart('Theirs'),
    'csm-chart:gggggg7': chart('Fresh'),
    'csm-chart:hhhhhh8': chart('Their Bossa'),
    'csm-level:mine:aaaaaa1': JSON.stringify({ level: 'basic', seed: 1 }),
  }
  const plan = planImport(LOCAL, roundTrip(OTHER))
  const item = (id: string) => plan.charts.find((c) => c.incoming.meta.id === id)

  it('a new id is new; a chart with the same id but other text or state is a conflict', () => {
    expect(item('gggggg7')?.status).toBe('new')
    expect(item('aaaaaa1')).toMatchObject({ status: 'conflict', local: { meta: { id: 'aaaaaa1', title: 'Mine' } } })
  })

  it('same id, same text, other state: a conflict', () => {
    const store = { ...LOCAL, 'csm-level:mine:aaaaaa1': JSON.stringify({ level: 'basic', seed: 1 }) }
    expect(planImport(LOCAL, roundTrip(store)).charts[0]?.status).toBe('conflict')
  })

  it('an edited version of a library chart you have edited too: a conflict, whatever its id', () => {
    expect(item('hhhhhh8')).toMatchObject({ status: 'conflict', local: { meta: { id: 'bbbbbb2' } } })
  })

  it('an edited version with the same text as yours: identical', () => {
    const store = { 'csm-charts': JSON.stringify([meta('hhhhhh8', 'B', 'edited', 'blue-bossa')]), 'csm-chart:hhhhhh8': LOCAL['csm-chart:bbbbbb2']! }
    expect(planImport(LOCAL, roundTrip(store)).charts[0]?.status).toBe('identical')
  })

  it('Keep both is the default: a new id, "(imported)" on the title, its state under the new id', () => {
    const after = run(LOCAL, applyChoices(plan, {}, ids('kkkkkk1', 'kkkkkk2')).steps)
    expect(after['csm-chart:aaaaaa1']).toBe(LOCAL['csm-chart:aaaaaa1'])
    expect(after['csm-chart:kkkkkk1']).toContain('title: Theirs (imported)')
    expect(after['csm-level:mine:kkkkkk1']).toBe(JSON.stringify({ level: 'basic', seed: 1 }))
    expect(index(after).find((m) => m.id === 'kkkkkk1')).toMatchObject({ title: 'Theirs (imported)', kind: 'new' })
  })

  it('Keep both on an edited version: a copy of the same library chart, so it shows in the version picker', () => {
    const after = run(LOCAL, applyChoices(plan, {}, ids('kkkkkk1', 'kkkkkk2')).steps)
    expect(index(after).find((m) => m.id === 'kkkkkk2')).toMatchObject({ kind: 'copy', basedOn: 'blue-bossa', title: 'Their Bossa (imported)' })
    expect(index(after).filter((m) => m.kind === 'edited')).toHaveLength(1)
  })

  it('Keep mine writes nothing for it', () => {
    const after = run(LOCAL, applyChoices(plan, { charts: { aaaaaa1: 'mine', hhhhhh8: 'mine' } }, ids()).steps)
    expect(index(after).map((m) => m.id)).toEqual(['aaaaaa1', 'bbbbbb2', 'gggggg7'])
    expect(after['csm-chart:aaaaaa1']).toBe(LOCAL['csm-chart:aaaaaa1'])
  })

  it('Use imported replaces text and state together and clears its undo history', () => {
    const after = run(LOCAL, applyChoices(plan, { charts: { aaaaaa1: 'imported' } }, ids('kkkkkk2')).steps)
    expect(after['csm-chart:aaaaaa1']).toBe(chart('Theirs'))
    expect(after['csm-level:mine:aaaaaa1']).toBe(JSON.stringify({ level: 'basic', seed: 1 }))
    expect(after['csm-practice:mine:aaaaaa1:root']).toBeUndefined()
    expect(after['csm-undo:mine:aaaaaa1']).toBeUndefined()
    expect(index(after).find((m) => m.id === 'aaaaaa1')).toMatchObject({ title: 'Theirs', updatedAt: 200 })
  })

  it('Use imported on an edited version replaces yours in place, and clears the library chart’s undo history', () => {
    const store = { ...LOCAL, 'csm-undo:blue-bossa': '[]' }
    const after = run(store, applyChoices(planImport(store, roundTrip(OTHER)), { charts: { hhhhhh8: 'imported' } }, ids('kkkkkk1')).steps)
    expect(after['csm-chart:bbbbbb2']).toBe(chart('Their Bossa'))
    expect(after['csm-chart:hhhhhh8']).toBeUndefined()
    expect(after['csm-undo:blue-bossa']).toBeUndefined()
    expect(index(after).filter((m) => m.basedOn === 'blue-bossa')).toEqual([expect.objectContaining({ id: 'bbbbbb2', kind: 'edited', title: 'Their Bossa' })])
  })

  it('each chart is one step that writes its text before the index, labeled with its title', () => {
    const { steps, charts } = applyChoices(plan, {}, ids('kkkkkk1', 'kkkkkk2'))
    expect(steps.map((s) => [s.kind, s.label])).toEqual([
      ['chart', 'Theirs (imported)'],
      ['chart', 'Fresh'],
      ['chart', 'Their Bossa (imported)'],
    ])
    for (const s of steps) expect(s.writes.at(-1)?.[0]).toBe('csm-charts')
    expect(charts).toBe(5)
  })
})

describe('planImport: library state', () => {
  const theirs = (state: Record<string, string>) => roundTrip(Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v])))

  it('a slug you have no state for is new; the same state is identical; other state is a conflict', () => {
    const plan = planImport(LOCAL, theirs({ 'csm-level:autumn-leaves': LEVEL, 'csm-practice:blue-bossa:from': PRACTICE, 'csm-pent-picks:blue-bossa': PICKS }))
    expect(plan.library.map((l) => [l.slug, l.status])).toEqual([
      ['autumn-leaves', 'new'],
      ['blue-bossa', 'identical'],
    ])
    expect(planImport(LOCAL, theirs({ 'csm-level:blue-bossa': LEVEL })).library[0]?.status).toBe('conflict')
  })

  it('Keep mine is the default; Use imported replaces the slug’s state', () => {
    const plan = planImport(LOCAL, theirs({ 'csm-level:blue-bossa': LEVEL }))
    expect(applyChoices(plan, {}, ids()).steps).toEqual([])
    const after = run(LOCAL, applyChoices(plan, { library: { 'blue-bossa': 'imported' } }, ids()).steps)
    expect(Object.keys(after).filter((k) => k.endsWith(':blue-bossa') || k.includes(':blue-bossa:'))).toEqual(['csm-level:blue-bossa'])
  })
})

describe('planImport: preferences', () => {
  const theirs = roundTrip({ 'csm-instrument': 'alto-sax', 'csm-theme': 'dark' })

  it('apply by default in a fresh browser', () => {
    const plan = planImport({}, theirs)
    expect(plan.preferences).toMatchObject({ status: 'new', apply: true })
    expect(run({}, applyChoices(plan, {}, ids()).steps)).toEqual({ 'csm-instrument': 'alto-sax', 'csm-theme': 'dark' })
  })

  it('the Interface level the app sets on arrival doesn’t count as use', () => {
    expect(planImport({ 'csm-interface': 'essentials' }, theirs).preferences).toMatchObject({ status: 'conflict', apply: true })
  })

  it('a browser that has been used is not fresh, even with no preferences of its own', () => {
    expect(planImport({ 'csm-recent': '[]' }, theirs).preferences).toMatchObject({ status: 'new', apply: false })
  })

  it('otherwise left alone unless chosen', () => {
    const plan = planImport(LOCAL, theirs)
    expect(plan.preferences).toMatchObject({ status: 'conflict', apply: false })
    expect(applyChoices(plan, {}, ids()).steps).toEqual([])
    const after = run(LOCAL, applyChoices(plan, { preferences: true }, ids()).steps)
    expect([after['csm-instrument'], after['csm-theme'], after['csm-range-tenor-sax']]).toEqual(['alto-sax', 'dark', '{"low":"Ab3"}'])
  })

  it('none in the file: nothing to choose', () => {
    expect(planImport(LOCAL, roundTrip({})).preferences.status).toBe('none')
  })
})

describe('alternate changes state (#215)', () => {
  const CHANGES = JSON.stringify({ main: 'alternate', shown: false })
  const STORE: Store = {
    'csm-charts': JSON.stringify([meta('aaaaaa1', 'Mine')]),
    'csm-chart:aaaaaa1': chart('Mine'),
    'csm-changes:mine:aaaaaa1': CHANGES,
    'csm-pent-picks:mine:aaaaaa1~alt': PICKS,
    'csm-practice:mine:aaaaaa1~alt:root': PRACTICE,
    'csm-practice:mine:aaaaaa1~alt:from': PRACTICE,
    'csm-changes:blue-bossa': CHANGES,
    'csm-pent-picks:blue-bossa~alt': PICKS,
    'csm-practice:blue-bossa~alt:from': PRACTICE,
  }

  it('is exported under the chart, named without it', () => {
    const b = backupFrom(STORE, HEADER)
    expect(b.charts[0]!.state).toEqual({
      'csm-changes': CHANGES,
      'csm-pent-picks~alt': PICKS,
      'csm-practice~alt:root': PRACTICE,
      'csm-practice~alt:from': PRACTICE,
    })
    expect(b.library).toEqual({ 'blue-bossa': { 'csm-changes': CHANGES, 'csm-pent-picks~alt': PICKS, 'csm-practice~alt:from': PRACTICE } })
  })

  it('round-trips and restores to the same keys', () => {
    const b = roundTrip(STORE)
    expect(b).toEqual(backupFrom(STORE, HEADER))
    const out = run({}, applyChoices(planImport({}, b), {}, ids()).steps)
    for (const [k, v] of Object.entries(STORE)) expect(out[k]).toBe(v)
  })

  it('drops bad values and an ~alt on state that has none', () => {
    const b = backupFrom(STORE, HEADER)
    const bad = JSON.stringify({
      ...b,
      charts: [{ ...b.charts[0], state: { 'csm-changes': '[1]', 'csm-changes~alt': CHANGES, 'csm-level~alt': LEVEL, 'csm-pent-picks~alt': 'nope', 'csm-practice~alt:root': 'junk', 'csm-practice~alt:from': PRACTICE } }],
      library: { 'blue-bossa': { 'csm-changes': 'junk', 'csm-pent-picks~alt': PICKS } },
    })
    const r = parseBackup(bad)!
    expect(r.backup.charts[0]!.state).toEqual({ 'csm-practice~alt:from': PRACTICE })
    expect(r.backup.library).toEqual({ 'blue-bossa': { 'csm-pent-picks~alt': PICKS } })
    expect(r.dropped).toBe(6)
  })

  it('reads a backup made before it existed', () => {
    expect(parseBackup(serializeBackup(backupFrom(LOCAL, HEADER)))?.dropped).toBe(0)
  })
})

describe('backupFileName', () => {
  it('is dated', () => {
    expect(backupFileName(new Date(2026, 9, 1))).toBe('chord-scale-maker-backup-2026-10-01.json')
  })
})

import { describe, expect, it } from 'vitest'
import { add, type Effects } from '../add'
import type { AddArgs } from '../args'
import { irealLink } from '../../../engine/src/ireal/__tests__/link'

const music = '[*AT44C^7 A-7 |D-7 G7 |C^7 |x Z'
const link = irealLink([{ title: 'Tune', composer: 'Hall Jim', music }])
const two = irealLink([{ title: 'Tune', music }, { title: 'Other', music }], 'List')
const args = (over: Partial<AddArgs> = {}): AddArgs => ({ input: link, list: false, force: false, print: false, overrides: {}, ...over })

function fake(over: Partial<Effects> = {}, files: Record<string, string> = {}) {
  const log = { out: [] as string[], err: [] as string[], written: {} as Record<string, string>, ran: [] as string[] }
  const fx: Effects = {
    read: (p) => {
      if (!(p in files)) throw new Error('ENOENT')
      return files[p]!
    },
    exists: (p) => p in files || p in log.written,
    write: (p, t) => void (log.written[p] = t),
    run: (t) => (log.ran.push(t), 0),
    out: (l) => void log.out.push(l),
    err: (l) => void log.err.push(l),
    chartsDir: '/repo/engine/charts/',
    date: '2026-10-18',
    library: () => [{ slug: 'tune', text: 'title: Tune\n\nsection: A\nbars: 4\n1 | C\n' }],
    ...over,
  }
  return { fx, log }
}

describe('csm add', () => {
  it('a complete chart: writes it, runs golden then og, prints the advice and the next step', () => {
    const { fx, log } = fake()
    expect(add(args(), fx)).toBe(0)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune.txt'])
    expect(log.written['/repo/engine/charts/tune.txt']).toMatch(/^# analysis: 2026-10-18/m)
    expect(log.ran).toEqual(['golden', 'og'])
    expect(log.out.join('\n')).toMatch(/no recording:/)
    expect(log.out.join('\n')).toMatch(/git diff engine\/fixtures web\/public\/og/)
  })

  it('gaps: writes the chart, names the flag that fixes each, exits 1, runs nothing', () => {
    const { fx, log } = fake()
    expect(add(args({ input: irealLink([{ title: 'Tune', composer: '', music: '[*AC^7 |C^7 Z' }]) }), fx)).toBe(1)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune.txt'])
    expect(log.ran).toEqual([])
    expect(log.err.join('\n')).toMatch(/no composer:.*--composer/)
    expect(log.err.at(-1)).toMatch(/rerun with --force/)
  })

  it('header flags fill the gaps', () => {
    const { fx, log } = fake()
    expect(add(args({ input: irealLink([{ title: 'Tune', composer: '', music: '[*AC^7 |C^7 Z' }]), overrides: { composer: 'Jim Hall' } }), fx)).toBe(0)
    expect(log.written['/repo/engine/charts/tune.txt']).toContain('composer: Jim Hall\n')
  })

  it('--version: writes version: and names the file after it', () => {
    const { fx, log } = fake()
    expect(add(args({ overrides: { version: 'Jazz Lab Accelerator' } }), fx)).toBe(0)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune-jazz-lab-accelerator.txt'])
    expect(log.written['/repo/engine/charts/tune-jazz-lab-accelerator.txt']).toContain('version: Jazz Lab Accelerator\n')
  })

  it('--version of a tune the library lacks: warns that it stands alone', () => {
    const { fx, log } = fake({ library: () => [] })
    expect(add(args({ overrides: { version: 'Jazz Lab Accelerator' } }), fx)).toBe(0)
    expect(log.err.join('\n')).toMatch(/no library chart of "Tune"/)
    const known = fake()
    expect(add(args({ overrides: { version: 'Jazz Lab Accelerator' } }), known.fx)).toBe(0)
    expect(known.log.err.join('\n')).not.toMatch(/no library chart/)
  })

  it('an empty --version is not given', () => {
    const { fx, log } = fake()
    expect(add(args({ overrides: { version: '' } }), fx)).toBe(0)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune.txt'])
    expect(log.written['/repo/engine/charts/tune.txt']).not.toMatch(/^version:/m)
  })

  it('--print: prints the chart and the report, writes and runs nothing', () => {
    const { fx, log } = fake()
    expect(add(args({ print: true }), fx)).toBe(0)
    expect(log.written).toEqual({})
    expect(log.ran).toEqual([])
    expect(log.out.join('\n')).toContain('title: Tune')
  })

  it('refuses an existing chart without --force, before writing', () => {
    const { fx, log } = fake({}, { '/repo/engine/charts/tune.txt': 'old' })
    expect(add(args(), fx)).toBe(1)
    expect(log.written).toEqual({})
    expect(log.err.join('\n')).toMatch(/charts\/tune\.txt exists: --force/)
    expect(add(args({ force: true }), fx)).toBe(0)
  })

  it('--list lists the songs; several songs need --song', () => {
    const { fx, log } = fake()
    expect(add(args({ input: two, list: true }), fx)).toBe(0)
    expect(log.out).toEqual(['List', '1. Tune (Composer Unknown)', '2. Other (Composer Unknown)'])
    expect(add(args({ input: two }), fx)).toBe(1)
    expect(log.err.join('\n')).toMatch(/--song/)
  })

  it('reads a file input; an unreadable one exits 1 and writes nothing', () => {
    const { fx, log } = fake({}, { 'export.html': link })
    expect(add(args({ input: 'export.html', print: true }), fx)).toBe(0)
    expect(add(args({ input: 'missing.html' }), fx)).toBe(1)
    expect(log.err.join('\n')).toMatch(/can't read missing\.html/)
    expect(log.written).toEqual({})
  })

  it('a title with no file name exits 1 and writes nothing', () => {
    const { fx, log } = fake()
    expect(add(args({ input: irealLink([{ title: '東京', composer: 'Hall Jim', music }]) }), fx)).toBe(1)
    expect(log.err.join('\n')).toMatch(/no file name/)
    expect(log.written).toEqual({})
  })

  it('a failed step exits with its code and stops', () => {
    const golden = fake({ run: (t) => (t === 'golden' ? 2 : 0) })
    expect(add(args(), golden.fx)).toBe(2)
    const og = fake({ run: (t) => (t === 'og' ? 3 : 0) })
    expect(add(args(), og.fx)).toBe(3)
    expect(og.log.out.join('\n')).not.toMatch(/git diff/)
  })
})

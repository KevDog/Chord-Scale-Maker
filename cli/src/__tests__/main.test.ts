import { expect, it } from 'vitest'
import { main } from '../main'
import type { Effects } from '../add'
import { irealLink } from '../../../engine/src/ireal/__tests__/link'

const fx = (out: string[], err: string[]): Effects => ({
  read: () => {
    throw new Error('ENOENT')
  },
  exists: () => false,
  write: () => {
    throw new Error('no writes in this test')
  },
  run: () => {
    throw new Error('no make in this test')
  },
  out: (l) => void out.push(l),
  err: (l) => void err.push(l),
  chartsDir: '/repo/engine/charts/',
  date: '2026-10-18',
})

it('dispatches add, and prints the usage for anything else with exit 2', () => {
  const out: string[] = []
  const err: string[] = []
  expect(main(['add', irealLink([{ title: 'Tune', composer: 'Hall Jim', music: '[*AC^7 |C^7 Z' }]), '--print'], fx(out, err))).toBe(0)
  expect(out[0]).toMatch(/^title: Tune/)
  expect(main([], fx(out, err))).toBe(2)
  expect(main(['nope'], fx(out, err))).toBe(2)
  expect(err.join('\n')).toMatch(/usage: csm add/)
  expect(main(['add'], fx(out, err))).toBe(2)
})

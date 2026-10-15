import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart } from '@chord-scale-maker/engine'
import ChordChoices from '~/components/ChordChoices.vue'

// lines: 0 title, 1 key, 2 A1 CMaj7, 3 A2 D7 (II7 in C, not resolving: ruling D5, a guess), 4 A3 Dm7, 5 A4 G7, 6 A5 CMaj7
const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | CMaj7\n').value
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (line: number, over: Partial<{ fallbackNote: string }> = {}) =>
  mountSuspended(ChordChoices, { props: { doc, line, part: 'function', ...over }, attachTo: document.body })
type W = Awaited<ReturnType<typeof mount>>
const lastDoc = (w: W): ChartDoc | undefined => (w.emitted('update:doc')?.at(-1) as [ChartDoc] | undefined)?.[0]
const fnOf = (w: W): string | undefined => {
  const l = lastDoc(w)?.lines[3]
  return l?.kind === 'row' ? l.function : undefined
}
const checked = (w: W): string => w.find('[role=radio][aria-checked=true]').text()
const field = (w: W) => w.find<HTMLInputElement>('input[aria-label="Other function"]')
async function type(w: W, value: string) {
  await field(w).setValue(value)
  await settle()
}
async function enter(w: W) {
  await field(w).trigger('keydown', { key: 'Enter' })
  await settle()
}

describe('ChordChoices: the function', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  describe('Accept guess', () => {
    it('offers to accept a function the rules only guessed, and states it', async () => {
      const w = await mount(3, { fallbackNote: 'The rules could only guess here; stating the function settles it.' })
      const accept = w.findAll('button').find((b) => b.text() === 'Accept guess')
      expect(accept).toBeDefined()
      await accept?.trigger('click')
      await settle()
      expect(fnOf(w)).toBe('II7')
      expect(w.emitted('said')?.[0]?.[0]).toContain('II7')
    })

    it('leaves the scale cell blank: the function decides, the scale follows', async () => {
      const w = await mount(3, { fallbackNote: 'guess' })
      await w.findAll('button').find((b) => b.text() === 'Accept guess')?.trigger('click')
      const l = lastDoc(w)?.lines[3]
      expect(l).toMatchObject({ kind: 'row', function: 'II7', scale: '' })
    })

    it('is not offered where the rules decided', async () => {
      const w = await mount(5)
      expect(w.findAll('button').some((b) => b.text() === 'Accept guess')).toBe(false)
    })
  })

  describe('Other function', () => {
    it('writes a typed function on Enter, with the glyphs the sheet prints, and the list checks it', async () => {
      const w = await mount(3)
      await type(w, 'subV7/bii')
      await enter(w)
      expect(fnOf(w)).toBe('subV7/♭ii')
      expect(field(w).element.value).toBe('')
      const next = await mountSuspended(ChordChoices, { props: { doc: lastDoc(w) as ChartDoc, line: 3, part: 'function' }, attachTo: document.body })
      expect(checked(next)).toContain('subV7/♭ii (to Dbm)')
    })

    it('shows a function none of the listed ones match as its own checked option', async () => {
      const w = await mount(3)
      await type(w, 'IV7')
      await enter(w)
      expect(fnOf(w)).toBe('IV7')
      const next = await mountSuspended(ChordChoices, { props: { doc: lastDoc(w) as ChartDoc, line: 3, part: 'function' }, attachTo: document.body })
      expect(checked(next)).toBe('IV7')
    })

    it('keeps a key prefix as typed', async () => {
      const w = await mount(3)
      await type(w, 'Eb: V7/ii')
      await enter(w)
      expect(fnOf(w)).toBe('Eb: V7/ii')
    })

    it("refuses what isn't a function, says why, and writes nothing", async () => {
      const w = await mount(3)
      await type(w, 'banana')
      expect(w.text()).toContain('"banana" isn\'t a function')
      await enter(w)
      expect(w.emitted('update:doc')).toBeUndefined()
      expect(field(w).element.value).toBe('banana')
    })

    it("refuses a bad key and a cell that can't go in a chart", async () => {
      const w = await mount(3)
      await type(w, 'Zz: V7')
      expect(w.text()).toContain('"Zz" isn\'t a key')
      await type(w, 'V7 | x')
      expect(w.text()).toContain('may not contain |')
      await enter(w)
      expect(w.emitted('update:doc')).toBeUndefined()
    })

    it('previews the scale the draft would give while it parses', async () => {
      const w = await mount(3)
      await type(w, 'subV7/bII')
      expect(w.find('output').text()).toBe('→ D Lydian Dominant')
      await type(w, 'nonsense')
      expect(w.find('output').exists()).toBe(false)
    })

    it('clears the draft when the line changes', async () => {
      const w = await mount(3)
      await type(w, 'V7/V')
      await w.setProps({ line: 5 })
      await settle()
      expect(field(w).element.value).toBe('')
    })
  })
})

describe('ChordChoices interface levels', () => {
  const all = (line: number) => mountSuspended(ChordChoices, { props: { doc, line, part: 'all' }, attachTo: document.body })
  const headings = (w: W) => w.findAll('h3').map((h) => h.text())
  const at = (level: 'essentials' | 'intermediate' | 'everything') => {
    useRuntimeConfig().public.features.interfaceLevels = true
    useInterface().level.value = level
  }
  beforeEach(() => (document.body.innerHTML = ''))
  afterEach(() => {
    useRuntimeConfig().public.features.interfaceLevels = false
    useInterface().level.value = 'everything'
  })

  it('shows the Function, Scale and why by level', async () => {
    at('everything')
    const every = headings(await all(3))
    expect(every).toContain('Function')
    expect(every).toContain('Scale')
    at('intermediate')
    const mid = headings(await all(3))
    expect(mid).not.toContain('Function')
    expect(mid).toContain('Scale')
    at('essentials')
    expect(headings(await all(3))).toEqual([])
  })
})

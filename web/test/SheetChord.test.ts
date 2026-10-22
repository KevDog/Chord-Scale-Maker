import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { changesFor, type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetChord from '~/components/SheetChord.vue'
import type { SheetEdit } from '~/utils/sheetChordEdit'

// lines: 5 A1 Dm7, 6 A2 G7, 7 A3 CMaj7
const doc = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n').value
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^\d+ +\|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (editing: SheetEdit | null, over: Partial<{ line: number; section: string; bar: string; text: string; adding: boolean }> = {}) =>
  mountSuspended(SheetChord, {
    props: { doc, line: 6, section: 'A', bar: '2', text: 'G7', tokens: null, label: 'Edit G7, A bar 2', editing, selected: false, ...over },
    attachTo: document.body,
  })
type W = Awaited<ReturnType<typeof mount>>
const field = (w: W) => w.find<HTMLInputElement>('input')
async function type(w: W, value: string) {
  await field(w).setValue(value)
  await settle()
}
const lastDoc = (w: W): ChartDoc | undefined => (w.emitted('update:doc')?.at(-1) as [ChartDoc] | undefined)?.[0]

/** a refusal is said, and the field is marked invalid and described by why (#143) */
async function expectRefusal(w: W, why: string) {
  expect((w.emitted('said')?.at(-1) as [string] | undefined)?.[0]).toContain(why)
  const input = field(w)
  expect(input.attributes('aria-invalid')).toBe('true')
  const described = input.attributes('aria-describedby')
  expect(described && document.getElementById(described)?.textContent).toContain(why)
}

describe('SheetChord', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('is a labeled button when not editing, and asks to edit on click', async () => {
    const w = await mount(null)
    const b = w.find('button')
    expect(b.attributes('aria-label')).toBe('Edit G7, A bar 2')
    await b.trigger('click')
    expect(w.emitted('edit')?.[0]).toEqual([{ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } }])
  })

  it('prints the chord as it is while its field is open: the field is screen-only (#143)', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'Db7')
    expect(field(w).element.closest('.print\\:hidden')).not.toBeNull()
    const printed = w.find('[data-print]')
    expect(printed.text()).toBe('G7')
    expect(printed.element.closest('.print\\:hidden')).toBeNull()
  })

  it('opens only where the edit says the chord is drawn: a written-out repeat draws the same line twice (review: Critical 1)', async () => {
    const drawnInRepeat = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } }, { section: 'C', bar: '2' })
    expect(drawnInRepeat.find('input').exists()).toBe(false)
    expect(drawnInRepeat.find('button').exists()).toBe(true)
    document.body.innerHTML = ''
    const drawnHere = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    expect(drawnHere.find('input').exists()).toBe(true)
  })

  it('closed for another chord, it neither takes focus back nor blanks the preview (review: Important 1)', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await settle()
    await type(w, 'G7b9')
    const previews = w.emitted('preview')?.length ?? 0
    await field(w).trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(w.emitted('done')?.[0]).toEqual(['prev'])
    const afterKey = w.emitted('preview')?.length ?? 0
    expect(afterKey).toBe(previews + 1) // the one null that goes with done
    await w.setProps({ editing: { kind: 'chord', line: 5, at: { section: 'A', bar: '1' } } })
    await settle()
    expect(w.emitted('preview')?.length).toBe(afterKey) // nothing more
    expect(document.activeElement).not.toBe(w.find('button').element)
  })

  it('is a field with the chord selected when editing', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await settle()
    const el = field(w)
    expect(el.attributes('aria-label')).toBe('Chord, A bar 2')
    expect(el.element.value).toBe('G7')
    expect(document.activeElement).toBe(el.element)
    expect(el.element.selectionStart).toBe(0)
    expect(el.element.selectionEnd).toBe(2)
  })

  it('lists completions with each one’s reading in this bar, the typed text first', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'G7b')
    const options = w.findAll('[role=option]').map((o) => o.text().replace(/\s+/g, ' '))
    expect(options[0]).toMatch(/^G7b/)
    expect(options[1]).toMatch(/^G7\(♭9\).*→ G /) // the sheet's own spelling of G7b9
    expect(w.find('[role=listbox]').attributes('aria-label')).toBe('Completions')
  })

  it('reports the draft’s reading as it changes, and nothing once done', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'G7b9')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ numeral: 'V7', readable: true })
    await type(w, 'Gxyz')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ readable: false })
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('preview')?.at(-1)?.[0]).toBeNull()
  })

  it('commits on Enter once, and says so', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['1 | Dm7', '2 | Db7', '3 | CMaj7'])
    expect(w.emitted('update:doc')).toHaveLength(1)
    expect(w.emitted('said')?.[0]).toEqual(['A, bar 2: Db7'])
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('takes the active completion on Enter', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'G7b')
    await field(w).trigger('keydown', { key: 'ArrowDown' })
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('2 | G7b9')
  })

  it('commits and moves on Tab and ⇧Tab, commits and adds on Space', async () => {
    for (const [key, shift, then] of [['Tab', false, 'next'], ['Tab', true, 'prev'], [' ', false, 'add']] as const) {
      document.body.innerHTML = ''
      const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
      await type(w, 'G13')
      await field(w).trigger('keydown', { key, shiftKey: shift })
      await settle()
      expect(rows(lastDoc(w))[1], key).toBe('2 | G13')
      expect(w.emitted('done')?.[0], key).toEqual([then])
    }
  })

  it('a chord taken out says where it was, as its line no longer names it (#143)', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, '')
    await field(w).trigger('keydown', { key: 'Tab' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['1 | Dm7', '3 | CMaj7'])
    expect(w.emitted('done')?.[0]).toEqual(['next', { section: 'A', bar: 2, chord: 0 }])
  })

  it('→ at the end of the text, or ← at its start, commits and asks for the next or previous chord', async () => {
    for (const [key, at, then] of [['ArrowRight', 3, 'nextChord'], ['ArrowLeft', 0, 'prevChord']] as const) {
      document.body.innerHTML = ''
      const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
      await type(w, 'G13')
      field(w).element.setSelectionRange(at, at)
      await field(w).trigger('keydown', { key })
      await settle()
      expect(rows(lastDoc(w))[1], key).toBe('2 | G13')
      expect(w.emitted('done')?.[0], key).toEqual([then])
    }
  })

  it('→ and ← with the text selected (as the field opens) move to the next and previous chord', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await settle()
    await field(w).trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('done')?.[0]).toEqual(['prevChord'])
    expect(w.emitted('update:doc')).toBeUndefined() // nothing changed
  })

  it('→ and ← with the caret inside the text are the browser’s own: the field stays', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'G13')
    field(w).element.setSelectionRange(1, 1)
    await field(w).trigger('keydown', { key: 'ArrowRight' })
    await field(w).trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('done')).toBeUndefined()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.text()).toMatch(/← →\s*chord.*Tab\s*bar/)
  })

  it('gives focus to its button when the editor asks (Review Focus 2: Tab with nowhere to go)', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await settle()
    await field(w).trigger('keydown', { key: 'Tab' })
    await w.setProps({ editing: null, focusAt: { line: 6, at: { section: 'A', bar: '2' }, n: 1 } })
    await settle()
    expect(document.activeElement).toBe(w.find('button').element)
    await w.setProps({ focusAt: { line: 6, at: { section: 'C', bar: '2' }, n: 2 } }) // drawn elsewhere: not this one
    await settle()
    expect(document.activeElement).toBe(w.find('button').element) // unchanged, not re-taken from another instance
  })

  it('cancels on Escape without writing', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')?.[0]).toEqual(['cancel'])
  })

  it('refuses a draft the chart can’t hold, and keeps the field open with why (Review Focus 4)', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, 'G7 | x')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')).toBeUndefined()
    expect(w.text()).toContain('can’t go in a chart')
    await expectRefusal(w, '“G7 | x” can’t go in a chart')
  })

  it('refuses taking out a section’s first chord', async () => {
    const w = await mount({ kind: 'chord', line: 5, at: { section: 'A', bar: '1' } }, { line: 5, bar: '1', text: 'Dm7' })
    await type(w, '')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.text()).toContain('first bar needs a chord')
    await expectRefusal(w, 'A section’s first bar needs a chord.')
  })

  it('% is the bar before', async () => {
    const w = await mount({ kind: 'chord', line: 6, at: { section: 'A', bar: '2' } })
    await type(w, '%')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('2 | Dm7')
  })

  it('a slot: opens empty, commits as the bar’s added chord, adds nothing on an empty commit', async () => {
    const w = await mount({ kind: 'slot', section: 'A', bar: '2' }, { adding: true, text: '' })
    await settle()
    expect(field(w).element.value).toBe('')
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['1 | Dm7', '2 | G7', '2 | Db7', '3 | CMaj7'])
    document.body.innerHTML = ''
    const w2 = await mount({ kind: 'slot', section: 'A', bar: '2' }, { adding: true, text: '' })
    await field(w2).trigger('keydown', { key: 'Enter' })
    expect(w2.emitted('update:doc')).toBeUndefined()
    expect(w2.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('refuses a fifth chord in a 4/4 bar on Space (Review Focus 1)', async () => {
    const full = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n1 | Em7\n1 | A7\n2 | CMaj7\n').value
    const w = await mountSuspended(SheetChord, { props: { doc: full, line: 8, section: 'A', bar: '1', text: 'A7', tokens: null, label: 'Edit A7, A bar 1', editing: { kind: 'chord', line: 8, at: { section: 'A', bar: '1' } }, selected: false }, attachTo: document.body })
    await settle()
    await field(w).trigger('keydown', { key: ' ' })
    await settle()
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
    expect(w.emitted('said')?.at(-1)).toEqual(['A bar holds at most 4 chords.'])
  })
})

describe('SheetChord on a set of a chart with alternates (#469)', () => {
  // lines: 5 A1 Dm7, 6 A2 G7, 7 alt A2 Db7, 8 A3 CMaj7
  const real = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\nalt 2 | Db7\n3 | CMaj7\n').value
  beforeEach(() => (document.body.innerHTML = ''))

  it('refuses blanking a shared bar in Alternate, saying an alternate can’t be held', async () => {
    const w = await mountSuspended(SheetChord, {
      props: { doc: changesFor(real, 'alternate'), source: real, set: 'alternate', line: 8, section: 'A', bar: '3', text: 'CMaj7', tokens: null, label: 'Edit CMaj7, A bar 3', editing: { kind: 'chord', line: 8, at: { section: 'A', bar: '3' } }, selected: false },
      attachTo: document.body,
    })
    await type(w, '')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    await expectRefusal(w, 'An alternate can’t be held: type its chords, or switch to Standard to edit the bar.')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetAltChord from '~/components/SheetAltChord.vue'

const plain = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n').value
const withAlt = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\nalt 3 | Em7\n').value
const altRows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^alt /.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (over: Partial<{ source: ChartDoc; bar: number; text: string; open: boolean }> = {}) =>
  mountSuspended(SheetAltChord, {
    props: { source: plain, section: 'A', bar: 3, text: '', open: true, ...over },
    attachTo: document.body,
  })
type W = Awaited<ReturnType<typeof mount>>
const field = (w: W) => w.find<HTMLInputElement>('input')
async function type(w: W, value: string) {
  await field(w).setValue(value)
  await settle()
}
const key = (w: W, k: string, shiftKey = false) => field(w).trigger('keydown', { key: k, shiftKey })
const lastDoc = (w: W): ChartDoc | undefined => (w.emitted('update:doc')?.at(-1) as [ChartDoc] | undefined)?.[0]

describe('SheetAltChord (#469)', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('is a button named for its bar, a faint + alt with no alternate, and asks to edit on click', async () => {
    const w = await mount({ open: false })
    const b = w.find('button')
    expect(b.attributes('aria-label')).toBe('Alternate for A bar 3')
    expect(b.text()).toBe('+ alt')
    await b.trigger('click')
    expect(w.emitted('edit')).toHaveLength(1)
  })

  it('shows the bar’s alternate chords, and names them', async () => {
    const w = await mount({ open: false, source: withAlt, text: 'Em7' })
    expect(w.find('button').text()).toBe('Em7')
    expect(w.find('button').attributes('aria-label')).toBe('Alternate for A bar 3: Em7')
  })

  it('opens on the bar’s alt rows, as typed', async () => {
    const w = await mount({ source: withAlt, text: 'Em7' })
    await settle()
    expect(field(w).element.value).toBe('Em7')
    expect(field(w).attributes('aria-label')).toBe('Alternate for A bar 3')
  })

  it('Enter writes the chords typed as the bar’s alt rows', async () => {
    const w = await mount()
    await type(w, 'Ebm7 Ab7')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w))).toEqual(['alt 3 | Ebm7', 'alt 3 | Ab7'])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Tab commits and asks for the next bar; Shift+Tab, the previous', async () => {
    const w = await mount()
    await type(w, 'Em7')
    await key(w, 'Tab')
    expect(altRows(lastDoc(w))).toEqual(['alt 3 | Em7'])
    expect(w.emitted('next')).toHaveLength(1)
    document.body.innerHTML = ''
    const back = await mount()
    await type(back, 'Em7')
    await key(back, 'Tab', true)
    expect(back.emitted('prev')).toHaveLength(1)
  })

  it('an empty commit removes the bar’s alt rows', async () => {
    const w = await mount({ source: withAlt, text: 'Em7' })
    await type(w, '')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w))).toEqual([])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('an empty commit on a bar with no alternate just closes', async () => {
    const w = await mount()
    await type(w, '')
    await key(w, 'Enter')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('refused')).toBeUndefined()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('the standard chords typed make no alt rows', async () => {
    const w = await mount()
    await type(w, 'CMaj7')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w) ?? plain)).toEqual([])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('the standard chords typed over an alternate remove it', async () => {
    const w = await mount({ source: withAlt, text: 'Em7' })
    await type(w, 'CMaj7')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w))).toEqual([])
  })

  it('% is the Alternate set’s bar before', async () => {
    const source = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\nalt 3 | Em7\n4 | A7\n').value
    const w = await mount({ source, bar: 4 })
    await type(w, '%')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w))).toEqual(['alt 3 | Em7', 'alt 4 | Em7'])
  })

  it('% on a bar already holding the alternate keeps no row (#491)', async () => {
    const w = await mount({ source: withAlt, bar: 4 })
    await type(w, '%')
    await key(w, 'Enter')
    expect(altRows(lastDoc(w) ?? withAlt)).toEqual(['alt 3 | Em7'])
  })

  it('Esc closes and writes nothing', async () => {
    const w = await mount()
    await type(w, 'Em7')
    await key(w, 'Escape')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.emitted('update:doc')).toBeUndefined()
  })

  it('refuses a chord the chart can’t take: the field stays, marked invalid, and says why', async () => {
    const w = await mount()
    await type(w, 'Em7 #x')
    await key(w, 'Enter')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
    expect((w.emitted('refused')?.at(-1) as [string] | undefined)?.[0]).toContain('“#x” can’t go in a chart')
    expect(field(w).attributes('aria-invalid')).toBe('true')
  })

  it('refuses more chords than the bar has beats', async () => {
    const w = await mount()
    await type(w, 'C D E F G')
    await key(w, 'Enter')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect((w.emitted('refused')?.at(-1) as [string] | undefined)?.[0]).toBe('A bar holds at most 4 chords.')
  })

  it('← and → stay in the field (one field a bar)', async () => {
    const w = await mount()
    await type(w, 'Em7')
    await key(w, 'ArrowRight')
    await key(w, 'ArrowLeft')
    expect(w.emitted('next')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
    expect(field(w).exists()).toBe(true)
  })

  it('completes the last chord typed', async () => {
    const w = await mount()
    await type(w, 'Em7 A')
    const options = w.findAll('[role="option"]').map((o) => o.text())
    expect(options[0]).toContain('A')
    expect(options.some((o) => o.startsWith('A7'))).toBe(true)
    await w.findAll('[role="option"]')[1]!.trigger('mousedown')
    expect(field(w).element.value).toMatch(/^Em7 A\S+$/)
  })
})

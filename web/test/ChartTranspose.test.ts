import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ChartTranspose from '~/components/ChartTranspose.vue'
import { parseChart, serializeChart } from '@chord-scale-maker/engine'

const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const select = (label: string) => {
  const id = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent === label)?.getAttribute('for')
  return document.getElementById(id ?? '') as HTMLSelectElement
}
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.includes(name))
/** opens the dialog, picks the To key and transposes */
const transposeTo = async (w: { find: (s: string) => { trigger: (e: string) => Promise<void> } }, key: string) => {
  await w.find('button').trigger('click')
  await settle()
  const to = select('To key')
  to.value = key
  to.dispatchEvent(new Event('change'))
  await settle()
  button('Transpose')?.click()
  await settle()
}

describe('ChartTranspose', () => {
  it("starts from the chart's key and emits the chart in the new key", async () => {
    const doc = parseChart('title: F Blues\nkey: F\n\nsection: A\nbars: 4\n1 | F7\n2 | Bb7 | Bb Mixolydian\n3 | ???\n').value
    const w = await mountSuspended(ChartTranspose, { props: { current: () => doc }, attachTo: document.body })
    await w.find('button').trigger('click')
    await settle()
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('From key') // From is read-only, from the chart's key
    expect(button('Transpose')?.disabled).toBe(true) // same key
    const to = select('To key')
    to.value = 'Bb'
    to.dispatchEvent(new Event('change'))
    await settle()
    button('Transpose')?.click()
    await settle()
    const [[out]] = w.emitted('update:doc') as [[typeof doc]]
    expect(serializeChart(out)).toBe(serializeChart(parseChart('title: F Blues\nkey: Bb\n\nsection: A\nbars: 4\n1 | Bb7\n2 | Eb7 | Eb Mixolydian\n3 | ???\n').value))
    expect(w.emitted('transposed')).toEqual([['Transposed from F to B♭; 1 row could not be read and stayed as typed.']])
    w.unmount()
  })

  it('offers a minor-key chart the minor keys, starting at its own, and keeps it minor', async () => {
    const doc = parseChart('title: Minor\nkey: Gm\n\nsection: A\nbars: 4\n1 | Gm7 | G Dorian\n2 | D7\n').value
    const w = await mountSuspended(ChartTranspose, { props: { current: () => doc }, attachTo: document.body })
    await w.find('button').trigger('click')
    await settle()
    const to = select('To key')
    expect([...to.options].map((o) => o.text).slice(0, 3)).toEqual(['C minor', 'C♯ minor', 'D minor'])
    expect(to.selectedOptions[0]?.text).toBe('G minor')
    expect(button('Transpose')?.disabled).toBe(true) // same key
    to.value = 'Bbm'
    to.dispatchEvent(new Event('change'))
    await settle()
    button('Transpose')?.click()
    await settle()
    const [[out]] = w.emitted('update:doc') as [[typeof doc]]
    expect(serializeChart(out)).toBe(serializeChart(parseChart('title: Minor\nkey: Bbm\n\nsection: A\nbars: 4\n1 | Bbm7 | Bb Dorian\n2 | F7\n').value))
    expect(w.emitted('transposed')).toEqual([['Transposed from G minor to B♭ minor.']])
    w.unmount()
  })

  it('rewrites a saved analysis for the new key', async () => {
    const doc = parseChart('title: T\nkey: Eb\n# analysis: 2026-01-02, rules v1; Eb\n\nsection: A\nbars: 4\n1 | Fm7  # ii of Bb7\n2 | Bb7\n3 | EbMaj7\n').value
    const w = await mountSuspended(ChartTranspose, { props: { current: () => doc }, attachTo: document.body })
    await w.find('button').trigger('click')
    await settle()
    const to = select('To key')
    to.value = 'C'
    to.dispatchEvent(new Event('change'))
    await settle()
    button('Transpose')?.click()
    await settle()
    const [[out]] = w.emitted('update:doc') as [[typeof doc]]
    const text = serializeChart(out)
    expect(text).toContain('# analysis: 2026-01-02, rules v1; C\n\nsection: A\nbars: 4\n1 | Dm7    # ii of the ii–V to C\n')
    expect(text).not.toMatch(/Eb|Bb7/)
    w.unmount()
  })
  it("names the chart's original key across transposes, and clears the message back in it", async () => {
    let doc = parseChart('title: F Blues\nkey: F\n\nsection: A\nbars: 4\n1 | F7\n').value
    const w = await mountSuspended(ChartTranspose, {
      props: { current: () => doc, 'onUpdate:doc': (d: typeof doc) => void (doc = d) },
      attachTo: document.body,
    })
    await transposeTo(w, 'Bb')
    await transposeTo(w, 'G')
    await transposeTo(w, 'F')
    expect(w.emitted('transposed')).toEqual([['Transposed from F to B♭.'], ['Transposed from F to G.'], ['']])
    w.unmount()
  })

  it('starts afresh when the key was changed some other way', async () => {
    let doc = parseChart('title: F Blues\nkey: F\n\nsection: A\nbars: 4\n1 | F7\n').value
    const w = await mountSuspended(ChartTranspose, {
      props: { current: () => doc, 'onUpdate:doc': (d: typeof doc) => void (doc = d) },
      attachTo: document.body,
    })
    await transposeTo(w, 'Bb')
    doc = parseChart('title: Other\nkey: D\n\nsection: A\nbars: 4\n1 | D7\n').value
    await transposeTo(w, 'F')
    expect(w.emitted('transposed')).toEqual([['Transposed from F to B♭.'], ['Transposed from D to F.']])
    w.unmount()
  })
})

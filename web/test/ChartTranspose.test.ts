import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ChartTranspose from '~/components/ChartTranspose.vue'
import { parseChart, serializeChart } from '~~/engine'

const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const select = (label: string) => {
  const id = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent === label)?.getAttribute('for')
  return document.getElementById(id ?? '') as HTMLSelectElement
}
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.includes(name))

describe('ChartTranspose', () => {
  it("starts from the chart's key and emits the chart in the new key", async () => {
    const doc = parseChart('title: F Blues\nA | 1 | F7\nA | 2 | Bb7 | Bb Mixolydian\nA | 3 | ???\n').value
    const w = await mountSuspended(ChartTranspose, { props: { current: () => doc }, attachTo: document.body })
    await w.find('button').trigger('click')
    await settle()
    expect(select('From key').value).toBe('F')
    expect(button('Transpose')?.disabled).toBe(true) // same key
    const to = select('To key')
    to.value = 'Bb'
    to.dispatchEvent(new Event('change'))
    await settle()
    button('Transpose')?.click()
    await settle()
    const [[out]] = w.emitted('update:doc') as [[typeof doc]]
    expect(serializeChart(out)).toBe(serializeChart(parseChart('title: F Blues\nA | 1 | Bb7\nA | 2 | Eb7 | Eb Mixolydian\nA | 3 | ???\n').value))
    expect(w.emitted('transposed')).toEqual([['Transposed from F to B♭; 1 row could not be read and stayed as typed.']])
    w.unmount()
  })
})

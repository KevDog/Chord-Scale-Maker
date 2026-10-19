import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

/**
 * the rail keeps each group one control tall: the instrument's pitch, instrument and range in its panel (the
 * "Instrument: …" button), the line's detail in Line options. Open one, if it's closed.
 */
export async function openPanel(w: Pick<VueWrapper, 'findAll'>, panel: 'Instrument' | 'Line options'): Promise<void> {
  const button = w.findAll('button').find((b) => (panel === 'Instrument' ? b.attributes('aria-label')?.startsWith('Instrument: ') : b.attributes('aria-label') === panel))
  if (!button) throw new Error(`no ${panel} button`)
  if (button.attributes('aria-expanded') === 'true') return
  await button.trigger('click')
  await nextTick()
}

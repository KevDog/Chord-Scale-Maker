import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import UiListbox from '~/components/ui/Listbox.vue'
import UiListboxDescription from '~/components/ui/ListboxDescription.vue'
import UiListboxHeader from '~/components/ui/ListboxHeader.vue'
import UiListboxLabel from '~/components/ui/ListboxLabel.vue'
import UiListboxOption from '~/components/ui/ListboxOption.vue'

const Picker = defineComponent({
  components: { UiListbox, UiListboxOption, UiListboxLabel, UiListboxDescription, UiListboxHeader },
  setup: () => ({ value: ref('trumpet') }),
  template: `<UiListbox v-model="value" aria-label="Instrument">
      <template #selected="{ value }"><UiListboxLabel>{{ value }}</UiListboxLabel></template>
      <UiListboxHeader>B♭ instruments</UiListboxHeader>
      <UiListboxOption value="trumpet"><UiListboxLabel>Trumpet</UiListboxLabel></UiListboxOption>
      <UiListboxOption value="tenor-sax"><UiListboxLabel>Tenor sax</UiListboxLabel><UiListboxDescription>octave lower</UiListboxDescription></UiListboxOption>
    </UiListbox>`,
})

describe('UiListbox', () => {
  it('shows the selected value and opens a list of options', async () => {
    const w = await mountSuspended(Picker, { attachTo: document.body })
    const button = w.find('button')
    expect(button.attributes('aria-label')).toBe('Instrument')
    expect(button.text()).toBe('trumpet')
    await button.trigger('click')
    await nextTick()
    const options = w.findAll('[role=option]')
    expect(options.map((o) => o.text())).toEqual(['Trumpet', 'Tenor saxoctave lower'])
    expect(options[0]?.attributes('data-selected')).toBe('')
    w.unmount()
  })

  it('selects an option by click', async () => {
    const w = await mountSuspended(Picker, { attachTo: document.body })
    await w.find('button').trigger('click')
    await nextTick()
    await w.findAll('[role=option]')[1]?.trigger('click')
    await nextTick()
    expect(w.find('button').text()).toBe('tenor-sax')
    expect(w.find('[role=option]').exists()).toBe(false) // closed
    w.unmount()
  })

  it('selects with the keyboard, skipping group headings', async () => {
    const w = await mountSuspended(Picker, { attachTo: document.body })
    const button = w.find('button')
    await button.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const list = w.find('[role=listbox]')
    await list.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(w.findAll('[role=option]')[1]?.attributes('data-focus')).toBe('')
    await list.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(button.text()).toBe('tenor-sax')
    w.unmount()
  })
})

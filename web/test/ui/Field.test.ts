import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import UiDescription from '~/components/ui/Description.vue'
import UiErrorMessage from '~/components/ui/ErrorMessage.vue'
import UiFieldset from '~/components/ui/Fieldset.vue'
import UiLegend from '~/components/ui/Legend.vue'
import UiListbox from '~/components/ui/Listbox.vue'
import UiListboxOption from '~/components/ui/ListboxOption.vue'
import UiField from '~/components/ui/Field.vue'
import UiInput from '~/components/ui/Input.vue'
import UiLabel from '~/components/ui/Label.vue'
import UiSelect from '~/components/ui/Select.vue'
import UiTextarea from '~/components/ui/Textarea.vue'

const Form = defineComponent({
  components: { UiField, UiLabel, UiDescription, UiErrorMessage, UiInput },
  props: { disabled: Boolean, invalid: Boolean },
  setup: () => ({ value: ref('C') }),
  template: `<UiField :disabled="disabled"><UiLabel>Chord</UiLabel><UiDescription>Concert pitch</UiDescription>
    <UiInput v-model="value" :invalid="invalid" placeholder="Cm7" /><UiErrorMessage v-if="invalid">Bad</UiErrorMessage></UiField>`,
})

describe('UiField and controls', () => {
  it('wires the label and description to the control', async () => {
    const w = await mountSuspended(Form)
    const input = w.find('input')
    expect(w.find('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-describedby')).toBe(w.find('[data-slot=description]').attributes('id'))
    expect(input.attributes('placeholder')).toBe('Cm7') // attributes reach the <input>
  })

  it('marks invalid controls and adds the error to aria-describedby', async () => {
    const w = await mountSuspended(Form, { props: { invalid: true } })
    const input = w.find('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('data-invalid')).toBe('')
    expect(input.attributes('aria-describedby')?.split(' ')).toContain(w.find('[data-slot=error]').attributes('id'))
  })

  it('disables the control from the field', async () => {
    const w = await mountSuspended(Form, { props: { disabled: true } })
    expect(w.find('input').attributes('disabled')).toBeDefined()
    expect(w.find('label').attributes('data-disabled')).toBe('')
  })

  it('binds v-model on input, textarea and select', async () => {
    const input = await mountSuspended(UiInput, { props: { modelValue: 'a' } })
    await input.find('input').setValue('b')
    expect(input.emitted('update:modelValue')).toEqual([['b']])
    const area = await mountSuspended(UiTextarea, { props: { modelValue: 'x', resizable: false } })
    expect(area.find('textarea').classes()).toContain('resize-none')
    await area.find('textarea').setValue('y')
    expect(area.emitted('update:modelValue')).toEqual([['y']])
    const select = await mountSuspended(UiSelect, {
      props: { modelValue: 'C' },
      slots: { default: '<option value="C">C</option><option value="Eb">Eb</option>' },
    })
    await select.find('select').setValue('Eb')
    expect(select.emitted('update:modelValue')).toEqual([['Eb']])
  })
})

describe('Field wiring for Listbox, Fieldset and spacing', () => {
  it('labels a Listbox from its Field and keeps Catalyst spacing', async () => {
    const F = defineComponent({
      components: { UiField, UiLabel, UiListbox, UiListboxOption },
      setup: () => ({ v: ref('a') }),
      template: `<UiField><UiLabel>Instrument</UiLabel><UiListbox v-model="v"><template #selected="{ value }">{{ value }}</template>
        <UiListboxOption value="a">A</UiListboxOption></UiListbox></UiField>`,
    })
    const w = await mountSuspended(F)
    const button = w.find('button')
    expect(w.find('label').attributes('for')).toBe(button.attributes('id'))
    expect(button.element.previousElementSibling).toBeNull() // the control slot is the Listbox wrapper…
    expect(button.element.parentElement?.getAttribute('data-slot')).toBe('control') // …so label + control spacing applies
  })

  it('a disabled Fieldset disables its fields, labels and legend', async () => {
    const F = defineComponent({
      components: { UiFieldset, UiLegend, UiField, UiLabel, UiInput },
      template: `<UiFieldset disabled><UiLegend>Preview</UiLegend><UiField><UiLabel>Title</UiLabel><UiInput /></UiField></UiFieldset>`,
    })
    const w = await mountSuspended(F)
    expect(w.find('legend').attributes('data-disabled')).toBe('')
    expect(w.find('label').attributes('data-disabled')).toBe('')
    expect(w.find('input').attributes('data-disabled')).toBe('')
  })

  it('puts class on the Catalyst wrapper and other attributes on the control', async () => {
    const w = await mountSuspended(UiInput, { attrs: { class: 'w-24', 'aria-label': 'Bar', id: 'mine' } })
    expect(w.classes()).toContain('w-24')
    expect(w.find('input').classes()).not.toContain('w-24')
    expect(w.find('input').attributes('aria-label')).toBe('Bar')
    expect(w.find('input').attributes('id')).toBe('mine') // outside a Field, an explicit id is kept
  })
})

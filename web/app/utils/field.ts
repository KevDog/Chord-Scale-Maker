import type { InjectionKey, Ref } from 'vue'

/**
 * Catalyst's Field (Headless UI React) wires a label, description and error to their control.
 * UiField provides these ids; UiLabel, UiDescription, UiErrorMessage and the controls inject them.
 */
export type FieldContext = Readonly<{
  controlId: string
  descriptionId: string
  errorId: string
  descriptions: Ref<number> // mounted UiDescription count
  errors: Ref<number> // mounted UiErrorMessage count
  disabled: Ref<boolean>
}>

export const FIELD: InjectionKey<FieldContext> = Symbol('field')

/** aria-describedby for a control inside a field: its description and error, if present */
export function describedBy(field: FieldContext | undefined, own?: unknown): string | undefined {
  const ids = [
    field && field.descriptions.value > 0 && field.descriptionId,
    field && field.errors.value > 0 && field.errorId,
    typeof own === 'string' && own,
  ].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

/** a disabled UiFieldset disables every field inside it (Headless UI React does the same) */
export const FIELDSET_DISABLED: InjectionKey<Ref<boolean>> = Symbol('fieldset-disabled')

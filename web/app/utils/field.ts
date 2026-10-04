import type { InjectionKey, Ref } from 'vue'

/**
 * Catalyst's Field (Headless UI React) wires a label, description and error to their control.
 * UiField provides these ids; UiLabel, UiDescription, UiErrorMessage and the controls inject them.
 */
export type FieldContext = Readonly<{
  controlId: string
  descriptionId: string
  errorId: string
  hasDescription: Ref<boolean>
  hasError: Ref<boolean>
  disabled: Ref<boolean>
}>

export const FIELD: InjectionKey<FieldContext> = Symbol('field')

/** aria-describedby for a control inside a field: its description and error, if present */
export function describedBy(field: FieldContext | undefined): string | undefined {
  if (!field) return undefined
  const ids = [field.hasDescription.value && field.descriptionId, field.hasError.value && field.errorId].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

/** Catalyst Table options, provided by UiTable to its rows and cells */
export type TableContext = Readonly<{ bleed: boolean; dense: boolean; grid: boolean; striped: boolean }>
export const TABLE: InjectionKey<Ref<TableContext>> = Symbol('table')

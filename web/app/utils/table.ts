import type { InjectionKey, Ref } from 'vue'

/** Catalyst Table options, provided by UiTable to its rows and cells */
export type TableContext = Readonly<{ bleed: boolean; dense: boolean; grid: boolean; striped: boolean }>
export const TABLE: InjectionKey<Ref<TableContext>> = Symbol('table')

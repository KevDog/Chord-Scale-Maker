import { type InstrumentName, sameChart } from '@chord-scale-maker/engine'
import type { SaveTarget } from '~/composables/useSavedChart'
import { LIBRARY } from '~/utils/library'
import type { SheetKind } from '~/utils/sheets'

/** Vercel Web Analytics custom events (docs/superpowers/specs/2026-10-12-analytics-routes-events-design.md): closed values, ≤ 2 properties (Pro) */
export type AnalyticsEvent =
  | { name: 'Share created'; data: { song: string } }
  | { name: 'Shared link opened'; data: { song: string } }
  | { name: 'Sheet chosen'; data: { sheet: SheetKind } }
  | { name: 'Instrument chosen'; data: { instrument: InstrumentName } }
  | { name: 'Printed'; data: { sheet: SheetKind; song: string } }
  | { name: 'Transposed'; data: { song: string; to: string } }

type Va = { va?: (...a: unknown[]) => void }

/** send one event when events are on and the analytics script is there (production builds); never throws */
export function sendEvent(e: AnalyticsEvent, on: boolean, w: Va = window as Va): void {
  if (!on || !w.va) return
  const data = Object.fromEntries(Object.entries(e.data).slice(0, 2).map(([k, v]) => [k, String(v).slice(0, 255)]))
  try {
    w.va('event', { name: e.name, data })
  } catch {
    /* analytics is never worth an error */
  }
}

/** the chart as analytics may name it: a library slug when it's that chart as published, else own */
export function songOf(target: SaveTarget | undefined, text: string, shared = false): string {
  if (target?.kind === 'library') return sameChart(text, target.libraryText) ? target.slug : 'own'
  return shared ? (LIBRARY.find((c) => c.text === text)?.slug ?? 'own') : 'own'
}

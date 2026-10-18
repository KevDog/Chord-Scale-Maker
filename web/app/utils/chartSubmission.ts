import type { SaveTarget } from '~/composables/useSavedChart'

/**
 * A chart handed from the editor to the contact form (sessionStorage), to send for the library: a new chart, or the
 * changes to a library chart (docs/superpowers/specs/2026-10-12-chart-submissions-design.md). Pure.
 */
export const CHART_SUBMISSION_KEY = 'csm-chart-submission'
export type ChartSubmission = Readonly<{ text: string; title: string; slug?: string; mode: 'new' | 'suggest' }>
/** which of the editor's chart actions show: Send to the library, Suggest these changes, Report a chart error */
export type ChartActions = Readonly<{ send: boolean; suggest: boolean; report: boolean }>

const REPORT_ONLY: ChartActions = { send: false, suggest: false, report: true }

/** a library chart as published is reported; edited, its changes are suggested instead; any other chart is sent, beside the report */
export function submissionAction(target: SaveTarget | undefined, text: string, on: boolean): ChartActions {
  if (!on) return REPORT_ONLY
  if (target?.kind === 'library') return text === target.libraryText ? REPORT_ONLY : { send: false, suggest: true, report: false }
  return { send: true, suggest: false, report: true }
}

/** the contact message's first line, then a blank line for the sender's note */
export const submissionMessage = (s: ChartSubmission): string => `${s.mode === 'suggest' ? 'Suggested changes to' : 'A chart for the library:'} ${s.title}\n\n`

/** the handoff read back from sessionStorage (untrusted): a well-formed submission, else null */
export function chartSubmissionFrom(raw: string | null): ChartSubmission | null {
  try {
    const o: unknown = JSON.parse(raw ?? '')
    if (!o || typeof o !== 'object') return null
    const r = o as Record<string, unknown>
    if (typeof r.text !== 'string' || typeof r.title !== 'string' || (r.mode !== 'new' && r.mode !== 'suggest')) return null
    return { text: r.text, title: r.title, mode: r.mode, ...(typeof r.slug === 'string' ? { slug: r.slug } : {}) }
  } catch {
    return null
  }
}

import type { ChartActions } from './chartSubmission'

export type MoreAction = 'copy' | 'download' | 'revert' | 'reset-picks' | 'send' | 'suggest' | 'report'

/**
 * what the chart is now: kept in this browser (saved), a library chart changed (edited), over a size limit, with live
 * chord picks (#303); chart: which of Send to the library, Suggest these changes and the report show (submissionAction;
 * without it, the report alone)
 */
export type MoreMenuState = Readonly<{ saved: boolean; edited: boolean; fatal: boolean; picks: boolean; chart?: ChartActions }>

/** the song page's More menu, in order: the actions that aren't on the rail */
export function moreMenuItems(s: MoreMenuState): readonly MoreAction[] {
  const chart = s.chart ?? { send: false, suggest: false, report: true }
  return [
    ...(s.saved && !s.fatal ? (['copy'] as const) : []),
    'download',
    ...(s.edited ? (['revert'] as const) : []),
    ...(s.picks ? (['reset-picks'] as const) : []),
    ...(chart.send ? (['send'] as const) : []),
    ...(chart.suggest ? (['suggest'] as const) : []),
    ...(chart.report ? (['report'] as const) : []),
  ]
}

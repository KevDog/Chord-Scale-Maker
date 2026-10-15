export type MoreAction = 'copy' | 'download' | 'revert' | 'reset-picks' | 'report'

/** what the chart is now: kept in this browser (saved), a library chart changed (edited), over a size limit, with live chord picks (#303) */
export type MoreMenuState = Readonly<{ saved: boolean; edited: boolean; fatal: boolean; picks: boolean }>

/** the song page's More menu, in order: the actions that aren't on the rail */
export function moreMenuItems(s: MoreMenuState): readonly MoreAction[] {
  return [
    ...(s.saved && !s.fatal ? (['copy'] as const) : []),
    'download',
    ...(s.edited ? (['revert'] as const) : []),
    ...(s.picks ? (['reset-picks'] as const) : []),
    'report',
  ]
}

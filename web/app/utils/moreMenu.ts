export type MoreAction = 'copy' | 'download' | 'revert' | 'report'

/** what the chart is now: kept in this browser (saved), a library chart changed (edited), opened from a link, over a size limit */
export type MoreMenuState = Readonly<{ saved: boolean; edited: boolean; shared: boolean; fatal: boolean }>

/** the song page's More menu, in order: the actions that aren't on the rail */
export function moreMenuItems(s: MoreMenuState): readonly MoreAction[] {
  return [
    ...(s.saved && !s.fatal ? (['copy'] as const) : []),
    'download',
    ...(s.edited ? (['revert'] as const) : []),
    'report',
  ]
}

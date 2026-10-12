export type MoreAction = 'copy' | 'download' | 'revert' | 'report'

/** what the chart is now: kept in this browser (saved), a library chart changed (edited), over a size limit; files: My charts is on (it brings downloads) */
export type MoreMenuState = Readonly<{ saved: boolean; edited: boolean; fatal: boolean; files: boolean }>

/** the song page's More menu, in order: the actions that aren't on the rail */
export function moreMenuItems(s: MoreMenuState): readonly MoreAction[] {
  return [
    ...(s.saved && !s.fatal ? (['copy'] as const) : []),
    ...(s.files ? (['download'] as const) : []),
    ...(s.edited ? (['revert'] as const) : []),
    'report',
  ]
}

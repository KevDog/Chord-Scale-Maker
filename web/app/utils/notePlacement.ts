/**
 * How far to move a panel that opens at its trigger's left edge so it stays inside the viewport with a gutter on
 * each side: 0 when it fits, negative to move it left, positive when the trigger sits left of the gutter. A panel
 * wider than the room keeps its left gutter.
 */
export function panelShift(triggerLeft: number, panelWidth: number, viewportWidth: number, gutter = 16): number {
  const left = Math.max(gutter, Math.min(triggerLeft, viewportWidth - panelWidth - gutter))
  return left - triggerLeft
}

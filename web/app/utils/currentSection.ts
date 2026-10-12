/**
 * the section being read: the last whose top has reached the reading line (offset px from the viewport's top), else
 * the first. At the page's end (short last sections never reach the line): the one the address names (a link just
 * followed) while its top is on screen, else the last.
 */
export function currentSection(tops: readonly Readonly<{ id: string; top: number }>[], offset: number, end?: Readonly<{ height: number; hash: string }>): string {
  if (end) {
    const named = tops.find((t) => t.id === end.hash && t.top >= 0 && t.top < end.height)
    return named?.id ?? tops.at(-1)?.id ?? ''
  }
  return tops.filter((t) => t.top <= offset).at(-1)?.id ?? tops[0]?.id ?? ''
}

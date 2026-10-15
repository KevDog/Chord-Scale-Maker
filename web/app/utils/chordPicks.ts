/** the chord pick popover's wording (#303): bar lists, header, footer, and its choices' ids */
export const barList = (bars: readonly string[]): string => (bars.length < 2 ? (bars[0] ?? '') : `${bars.slice(0, -1).join(', ')} and ${bars.at(-1)}`)
const barsOf = (b: readonly string[], list: string): string => `${b.length === 1 ? 'bar' : 'bars'} ${list}`
export const pickHeader = (heading: string, b: readonly string[]): string => (b.length ? `${heading} · ${barsOf(b, b.join(', '))}` : heading)
export const pickFooter = (sheet: 'changes' | 'scales', b: readonly string[], varies: boolean): string =>
  sheet === 'changes'
    ? `Sets ${barsOf(b, barList(b))}.`
    : varies
      ? `Replaces the different picks in ${barsOf(b, barList(b))}.`
      : `Sets ${barsOf(b, barList(b))} on the Changes sheet too.`
export const choiceId = {
  pent: (pc: number): string => `p${pc}`,
  hex: (r: readonly [number, number]): string => `h${r[0]}-${r[1]}`,
}

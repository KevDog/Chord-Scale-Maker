/** the chord pick popover's wording (#303): bar lists, header, footer, and its choices' ids; bars come named as pickBars names them ("A1 bar 6") */
export const barList = (bars: readonly string[]): string => (bars.length < 2 ? (bars[0] ?? '') : `${bars.slice(0, -1).join(', ')} and ${bars.at(-1)}`)
export const pickHeader = (heading: string, b: readonly string[]): string => (b.length ? `${heading} · ${b.join(', ')}` : heading)
export const pickFooter = (sheet: 'changes' | 'scales', b: readonly string[], varies: boolean): string =>
  sheet === 'changes'
    ? `Sets ${barList(b)}.`
    : varies
      ? `Replaces the different picks in ${barList(b)}.`
      : `Sets ${barList(b)} on the Changes sheet too.`
export const choiceId = {
  pent: (pc: number): string => `p${pc}`,
  hex: (r: readonly [number, number]): string => `h${r[0]}-${r[1]}`,
  quart: (pc: number): string => `q${pc}`,
}

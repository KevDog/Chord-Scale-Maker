/** the Changes sheet's row under the chords (Analysis' Overlay): Off, each key area's or chord's minor pentatonic, or each chord's hexatonic pair */
export type Overlay = 'off' | 'pentatonic' | 'hexatonic'
export const OVERLAYS: readonly Overlay[] = ['off', 'pentatonic', 'hexatonic']
export const isOverlay = (s: string): s is Overlay => (OVERLAYS as readonly string[]).includes(s)
const LABELS: Readonly<Record<Overlay, string>> = { off: 'Off', pentatonic: 'Pentatonic', hexatonic: 'Hexatonic' }
export const overlayLabel = (o: Overlay): string => LABELS[o]

/** the feature flags the overlays need */
export type OverlayFlags = Readonly<{ pentatonics: boolean; hexatonics: boolean }>

/** an overlay plays only with its flag: a stored one whose flag is off reads as Off */
export const overlayInForce = (o: Overlay, flags: OverlayFlags): Overlay =>
  (o === 'pentatonic' && !flags.pentatonics) || (o === 'hexatonic' && !flags.hexatonics) ? 'off' : o

/** the Overlay listbox's options: Off, and each overlay whose flag is on */
export const overlayChoices = (flags: OverlayFlags): readonly { value: Overlay; label: string }[] =>
  OVERLAYS.filter((o) => overlayInForce(o, flags) === o).map((value) => ({ value, label: LABELS[value] }))

const DESCRIPTIONS: Readonly<Record<Exclude<Overlay, 'off'>, string>> = {
  pentatonic: "each key area's or each chord's minor pentatonic, ranked by how far out it is",
  hexatonic: "each chord's hexatonic triad pair",
}

/** the Overlay listbox's title: what the options on offer put under the chords */
export const overlayTitle = (choices: readonly { value: Overlay }[]): string => {
  const parts = choices.flatMap((c) => (c.value === 'off' ? [] : [DESCRIPTIONS[c.value]]))
  return parts.length ? `A row under the chords: ${parts.join(', or ')}` : 'A row under the chords'
}

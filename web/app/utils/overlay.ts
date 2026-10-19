/** the Changes sheet's row under the chords (Analysis' Superimpose): Off, each key area's or chord's minor pentatonic, each chord's hexatonic pair, or its quartal stack (#432) */
export type Overlay = 'off' | 'pentatonic' | 'hexatonic' | 'quartal'
export const OVERLAYS: readonly Overlay[] = ['off', 'pentatonic', 'hexatonic', 'quartal']
export const isOverlay = (s: string): s is Overlay => (OVERLAYS as readonly string[]).includes(s)
const LABELS: Readonly<Record<Overlay, string>> = { off: 'Off', pentatonic: 'Pentatonic', hexatonic: 'Hexatonic', quartal: 'Quartal' }
export const overlayLabel = (o: Overlay): string => LABELS[o]

/** the Superimpose listbox's options */
export const OVERLAY_CHOICES: readonly { value: Overlay; label: string }[] = OVERLAYS.map((value) => ({ value, label: LABELS[value] }))

/** the Superimpose listbox's title: what each overlay puts under the chords */
export const OVERLAY_TITLE = "A row under the chords: each key area's or each chord's minor pentatonic, ranked by how far out it is, each chord's hexatonic triad pair, or its stack of fourths"

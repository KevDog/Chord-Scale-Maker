import { resolveQuality, SCALES, type ScaleOption } from '~~/engine'

/** roots offered by the scale picker, in chromatic order */
export const PICKER_ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const

/** every scale the engine knows, by its printed label (labels parse back via scaleKey) */
export const PICKER_SCALES: readonly string[] = Object.values(SCALES).map(([, label]) => label)

export type ScaleChoices = Readonly<{
  known: boolean // the chord quality is in chord_scales.json
  defaultScale: string | null
  alternates: readonly ScaleOption[] // options other than the default
}>

/** what the scale dropdown offers for a chord */
export function scaleChoices(chord: string): ScaleChoices {
  let options: readonly ScaleOption[] = []
  try {
    options = resolveQuality(chord)?.options ?? []
  } catch {
    // unparseable chord: no suggestions, the picker is still available
  }
  const def = options.find((o) => o.default) ?? options[0] ?? null // same fallback as engine defaultScale
  return { known: options.length > 0, defaultScale: def?.scale ?? null, alternates: options.filter((o) => o !== def) }
}

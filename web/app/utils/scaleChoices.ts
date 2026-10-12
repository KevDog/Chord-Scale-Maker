import { glyphs, type Mode, noteText, parseScale, resolveQuality, SCALES, type ScaleOption } from '@chord-scale-maker/engine'

/** roots offered by the scale picker, in chromatic order */
export const PICKER_ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const

/** where the Scales sheet spells each scale from: its root, the chart's key (written for the part), or a picked written note */
export type Spell = 'root' | 'key' | (typeof PICKER_ROOTS)[number]
export const SPELLS: readonly Spell[] = ['root', 'key', ...PICKER_ROOTS]
export const isSpell = (s: string): s is Spell => (SPELLS as readonly string[]).includes(s)

/** the sheet's mode and start note for a spelling, given the key's written tonic */
export const spellView = (spell: Spell, keyStart: string): Readonly<{ mode: Mode; start: string }> =>
  spell === 'root' ? { mode: 'root', start: keyStart } : { mode: 'from', start: spell === 'key' ? keyStart : spell }

export const spellLabel = (spell: Spell, keyStart: string): string =>
  spell === 'root' ? 'From root' : spell === 'key' ? `From key (${noteText(keyStart)})` : `From ${noteText(spell)}`

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

/** a scale's degrees, "1 2 ♭3 4 5 6 ♭7"; null if it can't be read */
export function scaleFormula(scale: string): string | null {
  try {
    return glyphs(SCALES[parseScale(scale).key][0])
  } catch {
    return null
  }
}

const NOTE = /^[a-g](#|b)?$/i
const SEARCH_LIMIT = 8

/**
 * any scale, from what's typed: "E ph" is E Phrygian and E Phrygian Dominant; with no root typed, the chord's.
 * Each word typed starts a word of the name. At most eight.
 */
export function searchScales(query: string, root: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const [first = ''] = words
  const typedRoot = NOTE.test(first) ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null
  const wanted = (typedRoot ? words.slice(1) : words).map((w) => w.toLowerCase())
  const named = PICKER_SCALES.filter((name) => {
    const parts = name.toLowerCase().split(/[\s-]+/)
    return wanted.every((w) => parts.some((p) => p.startsWith(w)))
  })
  return named.slice(0, SEARCH_LIMIT).map((name) => `${typedRoot ?? root} ${name}`)
}

# Pentatonic practice preset on the Scales sheet (issue #266)

## Goal

A player practising outside playing over one chord at a time picks a rank on each scale's pentatonic tension ladder
and sees, on every Scales sheet staff, which of the scale's notes that minor pentatonic shares. Rank 1 is the
pentatonic closest to the staff's scale; rank 12 the farthest. Few lit notes is the tension.

Phase 3 of the pentatonic ladders (docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md §Later phases).
Phases 1 and 2 ranked against a key (Ionian or Aeolian); this ranks against any scale.

## Decisions (from the brainstorm, 2026-10-14)

- **A rank picker, one for the sheet.** Each staff ranks the 12 minor pentatonics against its own scale and lights
  the scale notes the pentatonic at the chosen rank shares. Only scale notes are drawn, so outside notes stay unseen:
  the dimmed staff shows how far out the pentatonic is.
- **Ties by fifths from the chord root.** Among pentatonics sharing as many notes, the fewest fifths from the staff's
  chord root (written) ranks first; on equal distance the ♭ side first. Stable, and it transposes with the chord.
- **Both modes.** From root and From X both offer it: the ranking needs the scale, not the reference.
- **Named "Pentatonic"**, not "Tension" (the Tensions preset exists).
- **A practice selection**, so it is stored per chart and mode (`csm-practice:<slug>:<mode>`) and travels in share
  links like any other pick. Unlike phase 1–2's pentatonic preferences, which never travel.
- **Caption by name**; rank and shared count only where the staff's best match shares fewer than 5.

## The ranking

`rankTranspositions` (`ladder.ts`) sorts ties by root pitch class, arbitrary against a chord. A new
`rankByFifths(shape, scale, refPc)` in `ladder.ts` sorts the 12 transpositions by shared count (most first), then by
fifths distance from `refPc`: with `d = 7 · (root − refPc) mod 12`, distance `min(d, 12 − d)`, ♭ side (`d > 6`)
before ♯ side (`d < 6`) on equal distance.

Examples (minor pentatonic, 5 shared each at ranks 1–3):

| Staff | Rank 1 | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| Dm7, D Dorian | Dm (home) | Am (♯1) | Em (♯2) |
| Cmaj7, C Ionian | Dm (♯2) | Am (♯3) | Em (♯4) |
| G7, G Mixolydian | Dm (♯1) | Am (♯2) | Em (♯3) |

The tests check these rows against the computed ranking.

`pentatonicRanking(scale: ReadonlySet<number>, chordRoot: Spelled)` in `pentatonics.ts` returns the 12 as
`{ rank, root, name, shared }` (rank 1–12). The root is spelled by walking fifths from the chord root on its side,
then `simplifyRoot(…, 'aeolian')`, as `pentatonicLadder` spells; the name is `glyphs(rootName + 'm')`.

## Engine

- `practice.ts`
  - `Preset` gains `'pentatonic'`; `PRESETS.root` and `PRESETS.from` end with it; `PRESET_LABELS.pentatonic =
    'Pentatonic'`.
  - `PracticeSelection` = `{ preset: Exclude<Preset, 'pentatonic'> } | { preset: 'pentatonic'; rank: number } |
    { keys }`.
  - `practiceSelectionFrom`: a pentatonic selection needs an integer `rank` 1–12; a missing or bad rank reads as 1.
  - `selectedNotes` takes the staff's note pitch classes and reference pc as well (an options argument); under a
    pentatonic selection it lights each note whose pitch class is in the pentatonic at that rank, ranked against
    the staff's own pitch classes.
  - `PENTATONIC_RANKS = 12`.
- `sheet.ts`
  - `StaffModel.pentatonic: Readonly<{ name: string; rank: number; shared: number; best: number }> | null`: set under
    a pentatonic selection (`best`: rank 1's shared count), null otherwise or when the staff has an error.
  - `practiceFor` computes it: the scale's pitch classes are the staff's notes' (written), the reference is the
    written chord root (`writtenChordRootLenient`), else the scale's root when the chord can't be read.
  - The staff `id` gains nothing: `selected` and `pentatonic` already redraw (ScaleStaff watches `selected`).
- `share.ts`: unchanged; it reads practice through `practiceSelectionFrom`.
- `index.ts` exports the new names; `api.test.ts` snapshot updated.

## Web

- **Flag** `pentatonics` (off; e2e on). Off: `PracticePanel` hides the Pentatonic preset, and a stored or shared
  pentatonic selection is ignored (`EditorView` treats it as none).
- **`PracticePanel`**: the Pentatonic `ToggleButton` after the mode's presets. While it is the selection, a
  `UiListbox` (`aria-label="Pentatonic rank"`) beneath: `1 · closest`, `2` … `11`, `12 · farthest`. Picking a
  rank emits `{ preset: 'pentatonic', rank }`. Help text gains a sentence on the preset.
- **`ScaleStaff`**: a caption under the chord symbols in the left column: `Dm pent`; where `best < 5`:
  `F♯m pent · #2 · 3 shared`. Printed (the left column prints).
- **Box edits** while the preset is on seed a custom selection from `litKeys`, as for every preset.

## Testing

- Engine (TDD): `rankByFifths` ties and ♭-first; `pentatonicRanking` gives 12 distinct roots for every scale in
  `SCALES`, shared counts non-increasing; the table above computed; a scale whose best is under 5 (altered, whole
  tone) reported as such; `practiceSelectionFrom` round-trips and clamps rank; `selectedNotes` lights the shared
  pitch classes; `buildSheet` sets `pentatonic` only under the preset; share link round-trip.
- Web unit: `PracticePanel` shows the preset only with the flag, emits rank picks; `ScaleStaff` caption both forms.
- e2e (`practice.spec` or new): Scales sheet, Practice on, Pentatonic, rank 1 → captions present and lit notes per
  staff equal the caption's pentatonic; rank 12 → fewer lit. Print: Scales sheet lines per page unchanged.
- `make golden` only if fixtures cover practice output (they freeze engine answers); review its diff.

## Out of scope

- Drawing the pentatonic's notes outside the scale.
- Per-staff ranks, paths across the chart (phase 2's paths are the Changes sheet's).
- Other ladders (triad pairs, hexatonics) though `ladder.ts` is generic.

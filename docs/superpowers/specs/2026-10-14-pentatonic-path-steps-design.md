# Pentatonic paths: move more of the form (issue #276)

## Goal

A player choosing a pentatonic path (Side-slip, Fifths, Minor thirds, Major thirds) sees the pentatonic move
across the whole form, from page 1 on, at a pace they choose: by section, by key area, or every N bars. The sheet
says at the top which path is playing.

Today (#264) a preset gives each form section a role by position: the first (inside) and last (returning) sections
stay Home, the one before last goes outside, any between climb. On an A B C form (Waltz for Debby) only B moves, and
the first page never changes.

## Decisions (from the brainstorm, 2026-10-14)

- **A choice of unit.** A `Step by` control: Section | Key area | Bars, and with Bars, `2 | 4 | 8` (default 4).
  Default unit: Section.
- **Cycle, not arc.** Unit i (from 0) plays i steps of the preset, wrapping round. Unit 0 is Home; the second unit
  moves. The inside/climbing/outside/returning roles are dropped.
- **Key area: a revisit takes the next step.** Each run of one analysed key area is a unit (F → B♭ → F is 3 units).
- **Bars count continuously** through the form, ignoring section breaks.
- **Only the form moves.** Units are counted over the form's sections; sections before or after the form (intro,
  coda) play Home and don't count.
- **The path shows at the top of the sheet,** screen and print: `Pentatonics: Minor thirds · every 4 bars`.
- Unchanged: One rung (default Home, the sheet's Rung and Side everywhere), a stored Custom path (from before #272)
  still plays its sections, the chord basis (#272) ignores the path, picks (#272) still win over the path.

## The cycle

`pentatonicStep(semitones)` (#264) gives the rung and side of the pentatonic `semitones` above home. Unit i plays:

| Preset       | Unit i plays             | Units 0, 1, 2, 3, 4 …               |
| ------------ | ------------------------ | ----------------------------------- |
| Side-slip    | i odd: `step(1)`, else Home | Home, 5♭, Home, 5♭, Home        |
| Fifths       | `step(7i)` (i fifths up) | Home, 1♯, 2♯, 3♯, 4♯ … 6, 5♭ … 1♭, Home |
| Minor thirds | `step(3i)`               | Home, 3♭, 6, 3♯, Home               |
| Major thirds | `step(4i)`               | Home, 4♯, 4♭, Home                  |

New pure engine function `pentatonicCycle(path, i): PentatonicView` (Home for `one` and `custom`). It replaces
`pentatonicPreset`, which is removed (and from the API snapshot).

## Units

New engine type `PentatonicStep = Readonly<{ unit: 'section' | 'key-area' | 'bars'; bars: 2 | 4 | 8 }>` and guard
`isPentatonicStep`. Each chord on the sheet gets a unit index:

- **section:** the index of its section among the form's sections.
- **key-area:** the index of its run among the form's runs of one key area (the same area the key basis's ladder
  uses). A chord with no key area takes the unit of the run before it (Home if none).
- **bars:** `floor(formBar / bars)`, where `formBar` counts the form's bars from 0 in sheet order (repeats and
  endings as laid out on the sheet).

Chords outside the form: Home.

## The plan

`PentatonicPlan` gains `path?: PentatonicPathName` and `step?: PentatonicStep`. When `path` is a preset (not `one`,
not `custom`), `buildChanges` gives each chord's key-basis view as `pentatonicCycle(path, unit)` and ignores
`bySection` and `fallback`; otherwise as today (`bySection[section] ?? fallback`). `counts` stays as it is.
Missing `step` → `{ unit: 'section', bars: 4 }`.

`buildChanges` computes the units itself: it already walks the form's sections, bars and key areas.

## The caption

`ChangesSheet` gains `pentatonicCaption: string | null`: `Pentatonics: <path label> · <unit>` where unit is
`by section`, `by key area` or `every N bars`; null when the row is off, under the chord basis, for One rung and
for Custom. The path labels move from `web/app/utils/pentatonics.ts` to the engine (`PENTATONIC_PATH_LABELS`) so the
caption is pure; the web's `PENT_PATHS` reads them.

`ChangesSheet.vue` prints the caption under the page subtitle on each page, screen and print. It must fit the lines
per page `changesLinesPerPage` allows (print.spec's worst case still fits); if not, the caption takes the subtitle's
line (`<subtitle> · <caption>`).

## The controls

In `PreviewControls.vue`'s Analysis group, key basis, beside Path, shown only while the path is a preset:
- `Step by`: SegmentedControl `Section | Key area | Bars`.
- With Bars: SegmentedControl `2 | 4 | 8`.

The rail stays at 2 rows or fewer at 1440 wide (`editor.spec` "stays tidy").

Changing Step by or N clears picks, as Path, Rung, Side, Rank and basis do.

## Storage

`usePentatonicPath` stores `{ path, step, sections }` under `csm-pent-path:<key>`; a stored path with no or an
invalid `step` reads as `{ unit: 'section', bars: 4 }`. `carryTo` carries the step. Never in the chart or a share
link. The composable passes `path` and `step` in the plan instead of calling `pentatonicPreset`.

## Testing

- Engine (TDD): `pentatonicCycle` per preset, including wraps (fifths at 12, thirds at 4 and 3); `isPentatonicStep`;
  `buildChanges` with each unit: A B C moves B and C under section; a section's first chord moves on the second
  section; key-area runs, including a revisit taking the next step; bars crossing a section break, N = 2/4/8;
  intro/coda Home; picks still win; caption strings and nulls. API snapshot updated.
- `make golden` if the fixture covers the pentatonic row; review the diff.
- Web unit: storage parse with and without `step`; picks cleared on a step change.
- e2e: on a library chart, Fifths every 4 bars changes a label on page 1's second line; the caption shows and prints;
  Step by shows only for a preset; rail tidy at 1440.

## Out of scope

#275 (picks follow their chord when bars move), #277 (rung by label colour), #267 (layers menu).

# Pentatonic ladders, phase 2: section rungs and path presets (#264)

Phase 1 (#263, spec `2026-10-13-pentatonic-ladders-design.md`) gave the Changes sheet one rung and side for the whole
sheet. Phase 2 gives each section of the form its own rung, so a chorus can be played as an arc (inside, climbing,
outside, returning), and offers presets that lay such an arc over any form. Tint by rung and the contour line are #265.

## Decisions (from the brainstorm, 2026-10-13)

- **A preset fills, then each section is editable.** Picking a preset writes a rung and side into every section;
  editing one section afterwards makes the path Custom. There is no live mode.
- **Side-slip is a half step:** the outside section plays the pentatonic a half step above home (rung 5 ♭, 1 shared:
  B♭m over C major's Am). The tritone (rung 6) is the outside rung of the other presets.
- **Presets lay over the form by role**, from each section's position, so they work for any form.
- **A section's rung is set from its label's popover**; the rail's Rung and Side become the One rung path.
- Settled in phase 1, unchanged: ladders rank against the key area (Ionian or Aeolian), so a rung means the same
  distance from home in every key; labels print where they change; preferences only, never in chart rows or share
  links; the `pentatonics` flag gates it all.

## Sections

A section is a block as the Changes sheet draws it (`Run`/`blocks` in `buildChanges`), named by its marker's section:
a repeat drawn once (`A1 · A2`, or a section played twice with endings) is one section with one rung; a written-out
copy (`A3 (= A1)`) is its own. Its key is the first section name of the block (`A1` for `A1 · A2`).

Sections outside the form (Intro, Coda, Tag, Ending: `part !== 'form'`) are Home in every preset; they can still be
edited one by one.

## Paths

`PentatonicPathName = 'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'`

**Roles.** The form's sections, in order, `n` of them:

| n | roles |
| --- | --- |
| 1 | inside |
| 2 | inside, outside |
| ≥ 3 | inside, climbing × (n − 3), outside, returning |

Inside and returning are Home.

| Path | climbing | outside |
| --- | --- | --- |
| One rung | the sheet's Rung and Side (phase 1's preferences) everywhere | |
| Side-slip | Home | 5 ♭ (a half step up) |
| Fifths | spread from Home to 6 on the ♯ side: climber `j` of `k` takes rung `round(6 (j + 1) / (k + 1))` (one climber: 3 ♯) | 6 |
| Minor thirds | form section `i` steps `i` minor thirds up from home | form section `i` likewise |
| Major thirds | form section `i` steps `i` major thirds up from home | form section `i` likewise |

The thirds paths ignore roles but the last section (returning) is Home. A step of `s` semitones from home is a rung
and side by fifths: `d = 7s mod 12`; `d ≤ 6` → rung `d`, ♯ side; else rung `12 − d`, ♭ side (Home and 6 have no side).
So in C major, minor thirds go Am, Cm (3 ♭), E♭m (6), F♯m (3 ♯), …; major thirds Am, C♯m (4 ♯), Fm (4 ♭), …; the
half step is B♭m (5 ♭).

AABA over C major (`A1 · A2` drawn once is one section; with A1 and A2 drawn apart it would be four):

| | Side-slip | Fifths | Minor thirds | Major thirds |
| --- | --- | --- | --- | --- |
| A1 (inside) | Am | Am | Am | Am |
| A2 (climbing) | Am | F♯m (3 ♯) | Cm (3 ♭) | C♯m (4 ♯) |
| B (outside) | B♭m (5 ♭) | E♭m (6) | E♭m (6) | Fm (4 ♭) |
| A3 (returning) | Am | Am | Am | Am |

Rungs stay relative to each chord's key area: a bridge in another key plays its rung of that key's ladder.

**Custom** is what a path becomes when one section is edited. It is never picked from the list; it appears there only
while it is the current path.

## State

Per chart, in this browser (`storage.ts`), never in the chart or share links, under
`csm-pent-path:<slug>` (as `practiceKey`'s `csm-practice:<slug>:<mode>`):

```json
{ "path": "side-slip", "sections": { "A1": { "rung": 0, "side": "flat" }, "B": { "rung": 5, "side": "flat" } } }
```

- No entry, or `path: 'one'`: the sheet uses `csm-pent-rung` / `csm-pent-side` everywhere, as in phase 1.
- A preset writes every section's view. A section missing from `sections` (renamed, or added since) takes the
  path's computed value (for Custom: Home); an entry for a section no longer in the chart is ignored. Invalid JSON
  or views are ignored, as `storedRef` does.
- A chart with no slug (an unsaved edit) keeps its path in memory only.

## What the player sees

### Controls (Analysis group, under Pentatonics while it is on)

- **Path** (`UiListbox`, `aria-label="Pentatonic path"`): One rung, Side-slip, Fifths, Minor thirds, Major thirds,
  and Custom while current.
- **Rung** and **Side** as in phase 1, shown only with One rung.
- The rail stays ≤ 2 rows at 1440 (`editor.spec` "stays tidy"): Path replaces Rung + Side when not One rung, so the
  stack is no taller than phase 1's. On the phone they go in the Controls dialog.

### Labels

- With One rung: `Am♪`, as phase 1. With any other path the shared count follows: `B♭m♪ 1` (the count varies by
  section now). The count is in the label's `aria-label` already.
- A label prints at each section's first labelled chord: already so, since every section starts a line.
- Width: the label still fits its chord's room, as the Scales row does.

### The popover

- Titled with the section and key area: `B · C major ladder`.
- Picking a pentatonic sets **that section's** rung and side and closes the popover. If the path wasn't Custom, the
  other sections are first seeded with their current views, so nothing else moves; the path becomes Custom.

### Print

No new row, so `changesLinesPerPage` is unchanged. `print.spec` keeps its worst case.

## Engine

Pure TypeScript, exported from `engine/src/index.ts` (the API snapshot changes).

**`engine/src/pentatonics.ts`:**

```ts
export type PentatonicPathName = 'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'
export const isPentatonicPathName: (v: unknown) => v is PentatonicPathName
/** the rung and side a step of `semitones` up from home sits on (7s mod 12 fifths) */
export function pentatonicStep(semitones: number): PentatonicView
/** each section's view under a preset (not 'one' or 'custom'), keyed by section */
export function pentatonicPreset(path: PentatonicPathName, sections: readonly ChangesSection[]): Readonly<Record<string, PentatonicView>>
```

**`engine/src/changes.ts`:**

```ts
export type ChangesSection = Readonly<{ key: string; marker: string; part: FormPart }>
/** the sections the Changes sheet draws, in order (its blocks) */
export function changesSections(/* the chart, as buildChanges takes it */): readonly ChangesSection[]
export type PentatonicPlan = Readonly<{ bySection: Readonly<Record<string, PentatonicView>>; fallback: PentatonicView; counts: boolean }>
```

- `buildChanges`'s last parameter becomes `pentatonic: PentatonicPlan | null = null`: each chord's view is its
  section's, else `fallback`. `counts` adds the shared count to the label. `null` changes nothing.
- `ChangesPentatonic` gains `section` (the key), `shared` and `view`.
- `showPentatonics` is unchanged: every section starts a line, so its first label prints already.
- `changesSections` and `buildChanges` share the block-building code, so they can't disagree.

**App:** a composable `usePentatonicPath(slug, sections)` reads and writes `csm-pent-path:<slug>`, and gives the
`PentatonicPlan`, the path name, `setPath(name)` (fill) and `setSection(key, view)` (to Custom, seeding the rest).

## Testing

Tests first (TDD), engine before app:

- `pentatonicStep`: half step → 5 ♭, minor thirds → 3 ♭, 6, 3 ♯, major thirds → 4 ♯, 4 ♭, 0 → Home.
- `pentatonicPreset`: every path over AABA with `A1 · A2` merged (3 sections) and apart (4), ABAC, 1 and 2 sections,
  5 sections (fifths spread 2 ♯, 4 ♯), an Intro and Coda (Home).
- `changesSections`: markers and keys for merged repeats, endings, `@copy`, Intro/Coda.
- `buildChanges`: per-section labels; counts on (`B♭m♪ 1`) and off; a label at each section start; a modulating
  bridge plays its rung in its own key; `null` and a single `fallback` match phase 1's sheets.
- App unit: Path fills sections; Rung and Side only with One rung; Custom listed only while current; a popover pick
  sets one section and seeds the rest; per-chart key; stale and missing sections; bad JSON; the flag hides it all.
- e2e: Side-slip on an AABA tune → the bridge's labels read the half step with `1`; a popover pick → Custom and only
  that section changes; the rail stays ≤ 2 rows at 1440; the phone's Controls dialog.
- `make golden`: expect no change.

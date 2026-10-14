# Pentatonics per chord, and picks per label (issue #272)

## Goal

Two things on the Changes sheet's Pentatonics row:

1. **Ranked against the chord.** Besides the key-area ladder (#255, #264), each chord can rank the 12 minor
   pentatonics against its own scale, as the Scales sheet's Pentatonic preset does (#266), so the label changes chord
   by chord. On Waltz for Debby bars 1–4 (FMaj7/A D–7 G–7 C7) the key basis shows Dm throughout; the chord basis
   follows each chord.
2. **A popover pick applies to the label clicked**, not its whole section (today `setSection`, #264).

Out of scope (follow-up): reworking the path presets so they move more of the form (issue #272's third comment).

## Decisions (from the brainstorm, 2026-10-14)

- **A choice beside the ladder:** `Ranked against: Key | Chord`. Key is today's behaviour, unchanged.
- **Chord basis has one Rank for the sheet** (1–12), the #266 ranking (`pentatonicRanking`: most shared first, ties
  by fewest fifths from the written chord root, ♭ side first). No paths: a rank is not a rung, so the presets don't map.
- **Labels print as now** (`showPentatonics`): a line's first labelled chord and wherever the label differs from the
  last one shown on the line.
- **A pick covers the label's run:** the chord it is on and the following chords whose label it hid.
- **Picks sit on top of Path / Rung / Side / Rank**, and changing any of those (or the basis) clears them. A pick no
  longer turns the path Custom. The popover's **Reset** row drops a run's pick.
- **Chord basis always shows counts, tints and the contour**, by shared count. Key basis shows them where it does
  today (path ≠ One rung) and also whenever a pick applies (a pick on One rung makes the rungs vary).
- Unchanged: preferences only, never in chart rows or share links; the `pentatonics` flag gates it all.

## Engine

### The plan

```ts
/** a drawn chord's place: its bar's `at` (the section as drawn, a repeat's own name; the bar number) and its index */
export type ChordAt = string // `${section}:${bar}:${k}`
export type PentatonicBasis = 'key' | 'chord'
export type PentatonicPlan = Readonly<{
  basis: PentatonicBasis
  bySection: Readonly<Record<string, PentatonicView>> // key basis
  fallback: PentatonicView // key basis
  rank: number // chord basis, 1–12
  picks: Readonly<Record<ChordAt, number>> // a picked pentatonic's root, concert pitch class
  counts: boolean // key basis: the path isn't One rung
}>
```

`buildChanges(…, pentatonic: PentatonicPlan | null = null)`: `null` is the Pentatonics row off (no labels, the sheet
as before). A key-basis plan with no picks gives today's sheets.

### Each chord's pentatonic

- **Key basis:** its key area's ladder at its section's view (else `fallback`), as now.
- **Chord basis:** `pentatonicRanking(scale, root)` over the chord's scale, written for the part (its pitch classes),
  against its written root; the entry at `rank`. A chord with no scale has no label.
- **A pick** (`picks[at]`, concert) is transposed to the part, and the chord takes the ladder or ranking entry with
  that root: its spelling, its rung (key) or rank (chord) and its shared count are that entry's.

```ts
export type ChangesPentatonic = Readonly<{
  label: string // '' where showPentatonics leaves it unprinted
  basis: PentatonicBasis
  title: string // the popover's: 'B · F major pentatonic ladder'; 'D–7 · D Dorian pentatonic ranking'
  key: string // key basis: the area's key; chord basis: ''
  ladder: readonly PentatonicRung[] // key basis; [] for chord
  ranking: readonly PentatonicRank[] // chord basis; [] for key
  section: string
  view: PentatonicView // key basis: its rung and side; chord basis: Home (unused)
  rank: number // chord basis: its rank; key basis: 0
  shared: number
  level: number // 0–6: key basis its rung; chord basis from shared: 5 → 0, 4 → 2, 3 → 3, 2 → 4, 1 → 5, 0 → 6
  pc: number // its root, concert pitch class (what a pick stores)
  picked: boolean
  run: readonly ChordAt[] // the chords its printed label covers (set by showPentatonics; [] on an unprinted one)
}>
```

- **Label:** `Dm♪`, with ` <shared>` when counts show. Counts show for the chord basis, for `plan.counts`, and when
  any pick applies on the sheet.
- **`showPentatonics`** blanks labels as now and gives each printed label its `run`: its own chord and the following
  chords on the line whose label it blanked.
- **`pentatonicContour`** reads `level` instead of `view.rung`; the band and `RUNG_TINT` are keyed by level (same
  0–6 scale). Shown when counts show.

## App

### Controls (under Pentatonics while on)

- **Ranked against** (`SegmentedControl`, `aria-label="Pentatonics ranked against"`): Key | Chord. Preference
  `csm-pent-basis` (`key | chord`, `key`).
- **Key:** Path, and Rung + Side on One rung, as today.
- **Chord:** **Rank** (`UiListbox`, `aria-label="Pentatonic rank"`): `1 · closest`, `2` … `11`, `12 · farthest`.
  Preference `csm-pent-rank` (`1`–`12`, `1`).
- The rail stays ≤ 2 rows at 1440 (`editor.spec` "stays tidy"); on the phone they go in the Controls dialog.

### Picks

- `usePentatonicPicks(slug)`: `csm-pent-picks:<slug>` → `{ "<ChordAt>": <pc>, … }` (as `csm-pent-path:<slug>`; no
  slug: memory only). Bad JSON, bad keys or values are ignored; a key for a chord no longer drawn is ignored.
- Cleared when Path, Rung, Side, Rank or Ranked against changes.
- **Legacy Custom:** a stored `path: 'custom'` still reads (its sections play); a pick never creates one now, and
  Custom is still listed only while current.

### The popover

- Titled with `title`. Key basis: the ladder, as now. Chord basis: 12 rows, rank first, each with its shared count
  and name (`3 · 4 shared · Em`). The current one marked with the toggle tint and `aria-current`.
- Picking writes that pentatonic's concert pc to every chord in the label's `run`, and closes.
- **Reset** (last row, shown when `picked`): drops the run's picks.
- A picked label has a dotted underline; its `aria-label` ends `, your pick`.

### Print

No new row: `changesLinesPerPage` is unchanged. Labels with counts are a few characters wider than One rung's; they
still fit their chord's room. `print.spec`'s worst case is re-run (and with the chord basis).

## Testing

Tests first (TDD), engine before app:

- `buildChanges` chord basis: Waltz for Debby bars 1–4 at rank 1 give each chord's rank-1 pentatonic (computed by
  `pentatonicRanking`, checked against a hand-worked row); rank 12; a B♭ part spells for the part; a chord with no
  scale has no label; counts always.
- Picks: a key-basis pick changes its run only; the run's chords keep the one pentatonic; a chord-basis pick reports
  each chord's own rank and shared; a pick on a hidden-label chord is honoured; a stale `ChordAt` ignored; `picked`.
- `showPentatonics`: `run` over hidden labels, ending at a line's end or the next printed label.
- `level` for both bases; `pentatonicContour` by level; counts on with any pick under One rung.
- Unchanged: `null` plan and key basis without picks match today's sheets (existing tests); `make golden` no change.
- App unit: Ranked against shows Rank vs Path; preferences stored; picks per slug, cleared on each control change;
  Reset; legacy Custom reads; the flag hides it all.
- e2e: Waltz for Debby, Chord basis → bars 1–4 labels differ chord by chord; a popover pick changes that label only
  (not the section); Reset restores it; rail ≤ 2 rows at 1440; phone Controls dialog; `print.spec` worst case.

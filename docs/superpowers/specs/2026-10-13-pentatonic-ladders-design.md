# Pentatonic ladders on the Changes sheet: phase 1 (issue #255)

## Goal

A player practising outside playing over a tune picks a rung on the pentatonic tension ladder (how far a minor
pentatonic sits from the key) and sees, on the Changes sheet, which pentatonic that is in each key area of the form.
A popover shows a key area's whole ladder.

Phase 1 is one rung for the whole sheet. Walking the ladder across the form (rungs per section, path presets, the
tension contour, tint by rung) and the Scales sheet's Tension preset are later phases (§Later phases).

## Decisions (from the brainstorm, 2026-10-13)

- **Rank against the key, not the chord.** Each key area's ladder ranks the 12 minor pentatonics against the key's
  scale: Ionian for a major key, Aeolian for a minor key. One pentatonic holds across a key area; it changes where
  the key does. (Issue open question 1.)
- **So every ladder is diatonic** and has the same shape, which settles issue open question 2 (diatonic modes first,
  or all scales): only Ionian and Aeolian are ranked against in phase 1.
- **The control is distance and side.** Rung (Home, 1 … 6) and Side (♭ | ♯).
- **The layer is a row, like Scales.** A Pentatonics toggle beside Numerals and Scales; it can be on with a guide tone
  or arpeggio line.
- **Labels print where they change.** At the first chord of each key area and the first chord of each line.

## The ladder

Home is the key's tonic minor pentatonic: in a minor key its tonic's (C minor → Cm), in a major key its relative
minor's (C major → Am). Walking round the circle of fifths from home, a minor pentatonic `d` fifths away shares this
many notes with the key's scale:

| Rung (`d`) | 0 (Home) | 1 | 2 | 3 | 4 | 5 | 6 (Outside) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shared notes | 5 | 5 | 4 | 3 | 2 | 1 | 0 |
| C major, ♭ side | Am | Dm | Gm | Cm | Fm | B♭m | E♭m |
| C major, ♯ side | Am | Em | Bm | F♯m | C♯m | G♯m | E♭m |

Rungs 1–5 have two pentatonics each, one a side; Home and 6 have one. The counts are computed, never typed:
`sharedCount` (`ladder.ts`) counts the pitch classes a minor pentatonic (`SCALES['minor pentatonic']`) on a root shares with the
key's scale (`SCALES` Ionian or Aeolian on its tonic). A test checks the table above against it for every key.

## What the player sees

### Controls

- **Pentatonics** (`ToggleButton`) in the Changes sheet's Show group, after Numerals and Scales. Off by default.
- Beneath it while on, as the Line control's sub-listbox sits beneath Line:
  - **Rung** (`UiListbox`, `aria-label="Pentatonic rung"`): `Home · 5 shared`, `1 · 5 shared`, `2 · 4 shared`,
    `3 · 3 shared`, `4 · 2 shared`, `5 · 1 shared`, `6 · 0 shared (Outside)`.
  - **Side** (`SegmentedControl`, `aria-label="Pentatonic side"`): ♭ | ♯. Hidden at Home and at 6, where there is one
    pentatonic.
- **Preferences** (per browser, `storedRef`, never written into the chart and not carried by share links, like
  Numerals and Scales): `csm-pentatonics` (`on | off`, off), `csm-pent-rung` (`0`–`6`, `0`), `csm-pent-side`
  (`flat | sharp`, `flat`).
- **Phone** (`compactRail`): the toggle and its controls go in the Controls dialog with the rest of the Show group.
- **Flag:** `pentatonics` in `runtimeConfig.public.features`, off. The toggle, the row and the popover show only with
  it on. e2e builds have it on.

### The label row

- A row under the chord, below Numerals and Scales. A label prints on a line's first labelled chord and wherever it
  differs from the last one shown on the line, so relative keys (C major and A minor share home Am) print once. A
  chord the analysis doesn't reach (no key) has none.
- Text: the pentatonic's root and `m♪`, written for the part: `Gm♪`, `E♭m♪`. No shared count (the Rung control shows
  it; it's the same on every label). No tint (one rung for the whole sheet: a tint would say nothing).
- Style: as the Scales row (its size and muted colour).
- Fits: the label fits in its chord's room, as the Scales row does, rather than widening bars via `fitBars`.

### Spelling

The written key area's ladder is spelled from its home outwards: each step a fifth up on the ♯ side or down on the
♭ side, so the ♯ side gets sharps and the ♭ side flats. Then `simplifyRoot` respells a root with a double accidental
or on B♯/E♯/C♭/F♭ (`E♯m` → `Fm`). Rung 6 is reached by both walks; it takes the ♭ walk's, then `simplifyRoot`:
`E♭m` in C major, `Gm` in E major, `Bm` in A♭ major (`C♭m`). The label is built for the part's written key, so a B♭ part over a concert C major area shows
D major's ladder (`Bm♪` home).

### The popover

- On screen the label is a button (`aria-label="Pentatonic: G minor, 4 of 5 notes in C major. Show the ladder"`); in
  print it is text.
- It opens a popover (`bg-raised shadow-raised rounded-paper`, as the suggestions) titled with the key area ("C major
  ladder"). One row a rung, Home first: the rung, its shared count, and its pentatonics (♭ side, ♯ side). The
  current pick is marked with the toggle tint and `aria-current`.
- Picking a pentatonic sets Rung and Side for the whole sheet and closes the popover. Escape and a click outside
  close it.
- Under the bar editor (§4 of design.md: chords are buttons while editing) the label stays a separate button below
  the chord, so the two don't compete.

### Print

The row prints. `changesLinesPerPage` counts the pentatonic row as a third row. With a guide tone or arpeggio line:
6 lines a page while any of Numerals, Scales or Pentatonics is on, 7 with all three off, and 5 with all three on (6
overflowed a letter page in `print.spec`'s worst case, Stardust on the tuba, From 7th). With no line: 8, but 7 with all
three rows on (8 overflowed Stardust). `print.spec` checks both worst cases.

## Engine

Two modules, pure TypeScript (no Vue or DOM), exported from `engine/src/index.ts` (so the API snapshot test changes).

**`engine/src/ladder.ts`, generic** (per the #255 comment of 2026-10-14 and #262, triad pairs): ranks any pitch-class
set transposed 12 ways against a scale. It knows nothing of pentatonics, fifths or spelling; #262 reuses it with a
triad pair's set.

```ts
export type LadderTransposition = Readonly<{ root: number; shared: number }> // not `Transposition`: instruments exports that
export function pitchClasses(formula: string, rootPc?: number): ReadonlySet<number>
export function sharedCount(shape: ReadonlySet<number>, root: number, scale: ReadonlySet<number>): number
export function rankTranspositions(shape: ReadonlySet<number>, scale: ReadonlySet<number>): readonly LadderTransposition[]
```

**`engine/src/pentatonics.ts`**, built on it: the fifths walk, rung and side, and spelling.

```ts
export type PentatonicSide = 'flat' | 'sharp'
export type PentatonicView = Readonly<{ rung: number; side: PentatonicSide }> // rung 0–6
export type PentatonicRung = Readonly<{ rung: number; side: PentatonicSide | null; root: Spelled; name: string; shared: number }>

/** a key's 12 minor pentatonics, Home first, then rung 1 ♭, 1 ♯ … 5 ♭, 5 ♯, 6; spelled as §Spelling */
export function pentatonicLadder(home: Spelled): readonly PentatonicRung[]
/** the one at a view's rung and side (side ignored at 0 and 6) */
export function pentatonicAt(ladder: readonly PentatonicRung[], view: PentatonicView): PentatonicRung
export const isPentatonicView: (v: unknown) => v is PentatonicView
```

- `home` is the written spelling of the key's tonic minor, so the ladder spells for the part; `name` is the rung's
  root as written (`Fm`).
- **`engine/src/changes.ts`:** `ChangesPentatonic = { label, key, ladder }`; `ChangesChord.pentatonic: ChangesPentatonic
  | null` (`null` with the row off or no key; `label: ''` where it isn't printed). `buildChanges` gains a last
  parameter, `pentatonic: PentatonicView | null = null`; with `null` nothing in the sheet changes.
- `showPentatonics(lines)`, run after `breakLines`, blanks each label except on a line's first labelled chord and
  where it differs from the last one shown on the line.
- `changesLinesPerPage(line, rows)` takes `rows.pentatonics` as well.

## Testing

Tests first (TDD), engine before app:

- `ladder.ts`: `rankTranspositions` over C major for the minor pentatonic (the table above) and for a triad pair over C
  Lydian (C/D on top with 6).
- `sharedCount`: the table above for C major and A minor; every key's counts by rung are `5 5 4 3 2 1 0`.
- `pentatonicLadder`: Home is Am in C major and Cm in C minor; rung 2 ♭ in C major is Gm, ♯ is Bm; rung 6 is one
  entry.
- Spelling: every rung and side in a sharp key (E major), a flat key (A♭ major), F♯ major / G♭ major, and a minor
  key; no double accidentals, no B♯/E♯/C♭/F♭.
- `buildChanges`: labels only at key-area starts and line starts; none where the analysis has no key; a B♭ part's
  labels are D major's ladder over concert C; `null` view leaves the sheet as before (existing tests unchanged).
- `changesLinesPerPage` with the pentatonic row.
- App unit tests: the toggle and its controls (Side hidden at Home and 6), preferences stored, the flag hides it all,
  the popover lists 12 and a pick changes every label.
- e2e: toggle on → labels at key areas → open a label's popover → pick a rung → labels change; the toggle in the
  phone's Controls dialog; `print.spec` worst case.
- `make golden`: expect no change (the fixture's sheets are built with the view `null`); review the diff if any.

## Later phases (follow-up issues to file)

1. **Section rungs and path presets:** a rung per section (inside, climbing, outside, returning) and presets
   (side-slip home → outside → home, gradual by fifths, symmetric by minor or major thirds). The label carries its
   shared count then, since it varies.
2. **Tension contour:** a thin line along the system showing the arc across the bars; tint labels by rung.
3. **Scales sheet Tension preset:** each distinct scale's ladder as a practice highlight, ranked against the
   chord's scale (any scale, labelled by rank and shared count where the best match is under 5).
4. **One layers menu** shared by guide tones, pentatonics, approach notes (#251) and enclosures (#252), if the Show
   group gets crowded (issue open question 3).

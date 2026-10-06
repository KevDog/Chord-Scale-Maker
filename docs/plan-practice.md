# Practice selection: plan

Status: **phases 1–2 built** (engine; panel, highlighting, storage, print), behind the flag until sign-off. Web-only; the Python CLI is unchanged. Behind a `practice` feature flag until signed off.

Choose a subset of each scale's notes to improvise with. The chosen notes are highlighted on the Scales sheet and
the rest are dimmed, on screen and in print.

## Decisions

| | Decision |
|---|---|
| Display | Selected notes highlighted, the rest dimmed; interval labels follow |
| Spellings | Every spelling is its own box: ♭3 and 3, ♯4 and ♭5, E♯ and F |
| Scope | One selection for the whole chart; no per-note overrides (yet) |
| Saving | Per library chart, in this browser; From root and From X kept separately |
| Sheets | The Scales sheet only |
| Print | Keeps the highlighting: selected notes black, the rest light grey |
| Presets | Yes, in From root mode (see "Presets") |
| Off | Nothing selected = the normal sheet; **Clear** turns practice off |

## How notes are selected: the slicing follows the mode

| Mode | A box means | Example: ii–V–i in C minor (D–7♭5, G7alt, C–) |
|---|---|---|
| **From root** | an interval from each chord's written root (1, ♭2, 2, ♭3, 3, 4, ♯4, ♭5, 5, ♯5, ♭6, 6, ♭♭7, ♭7, 7) | "3" lights F, B, E♭: the role is fixed and the pitch moves |
| **From X** | a pitch spelled from the start note X (From C: C, D♭, D, E♭, E, …) | "A♭" lights on D–7♭5 and G7alt, then "A" takes over on C–: the slot is fixed and the change shows |

- **Spelling:** a box is a spelled interval, meaning the letter distance plus its accidental. It's measured from the
  chord root in From root mode and from the start note in From X mode. So ♭3 and ♯9 can't collide, and ♯4 and ♭5
  stay apart.
- **Which boxes appear:** only those that occur somewhere in the chart, in degree order and then by accidental. A
  pentatonic simply has no 4 or 7. In octatonic, blues and bebop scales, two notes can share a degree (♭3 and 3,
  ♭5 and 5, ♭7 and 7); each is its own box.
- **Stored relative to its reference,** so a selection survives a change of instrument (the written spellings move
  together) and, in From X mode, of start note: "a minor 3rd above the start note" shows as E♭ from C and as G♭
  from E♭.

## Presets (From root only)

Fixed sets of interval boxes would get some chords wrong. For example, "guide tones = ♭3, 3, ♭7, 7" would also
light the ♯9 (spelled ♭3) of an altered chord. So presets are **per chord**, from the chord quality, and use the
same tables as guide tones:

- **Chord tones:** 1, the 3rd, the 5th and the 7th of each chord (3 + 6 on sixth chords; the 4 on sus chords).
- **Guide tones:** the 3rd and 7th (`guideTonesFor`).
- **Tensions:** every scale note that isn't a chord tone.

A preset shows as active, and the boxes show which intervals it lights on this chart. Ticking or unticking a box
switches to a custom selection, starting from what the preset showed. From X mode has **All** and **None** only.

## Engine (`web/engine/practice.ts`, pure, unit-tested)

- `practiceKey(note, reference)` gives a spelled interval key, such as `b3` or `#4`. The reference is the written
  chord root (From root) or the written start note (From X).
- `practiceBoxes(staves, mode)` gives the boxes present in the chart, ordered, each with its key and display label
  (♭3, or the pitch name in From X).
- `presetKeys(row, part, preset)` gives the per-chord preset keys, using the guide tone and chord tone tables.
- **The sheet model:** `buildSheet` takes an optional selection and gives each `StaffModel` a `selected:
  boolean[] | null`, one entry per note.

## UI and rendering

- **Practice panel:** under the preview toolbar, on the Scales sheet only, when the flag is on.
  - The preset chips: Chord tones, Guide tones, Tensions. In From X mode, All and None instead.
  - The boxes, in a row that wraps on phones.
  - **Clear**.
- **Highlight:** `drawStaff` gives each note a class (`vf-selected` or `vf-dimmed`), and CSS colours them. On screen
  a selected note keeps the staff's ink in light mode (the clef's colour) and is pale blue in dark mode;
  a dimmed one is faint (25% opacity, 35% in dark mode). In print a selected note is black and a dimmed one is
  light grey. Interval labels follow.
- **Screen readers:** each staff's label adds "selected: …".
- **Storage:** through `utils/storage.ts`, per chart slug and mode, with keys stored relative to their reference.

## Tests

- **Engine:**
  - keys for both modes, including octatonic, blues and pentatonic
  - transposing instruments
  - start-note changes
  - presets on altered, sus and sixth chords
- **App:** the panel (boxes present, presets, custom after editing, Clear), and saving per chart and mode.
- **E2E:**
  - highlight classes on the staves
  - dark mode
  - print still 4 pages, with the dimmed notes grey
  - the selection is remembered after a reload

## Phases (each one a PR)

1. Engine: keys, boxes, presets, and selection in the sheet model.
2. The panel, rendering, storage and print, behind the flag; screenshots in light, dark and at 375 px.
3. Sign-off, then turn the flag on.

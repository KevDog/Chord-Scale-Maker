# Arpeggios sheet: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Issue: #188. Builds on
[one line per scale](2026-10-12-scale-lines-design.md) (#189, which must land first) and
[7th chord arpeggios](2026-10-12-seventh-chord-arpeggios-design.md) (#186). Upper-structure triads are #192, not this.

## Goal

A third sheet in **Work on**: **Arpeggios**. Each scale line of the tune (the Scales sheet's lines) as an arpeggio, in
eighth notes: the 7th chord, or, with **Extended**, the 7th chord and then the scale's other notes stacked above it as
tensions. It's the scale heard as a chord, and the arpeggio a player runs over each chord.

## What changes in the product

- **Work on:** Changes · Scales · Arpeggios (Arpeggios behind the `arpeggios` flag, which stays off; e2e builds with it on).
- **Controls**, shown only on the Arpeggios sheet, in a group labelled **Arpeggio**:
  - a segmented control **7th Chord · Extended** (default 7th Chord);
  - a listbox **Up · Down · Up & down** (default Up), `aria-label="Arpeggio direction"`.
  - **Show: Intervals** as on the Scales sheet. No Spell Scale, no practice panel.
- Remembered in this browser: `csm-arp-notes` (`seventh` | `extended`), `csm-arp-dir` (`up` | `down` | `up-down`).
- Share links carry `sheet: 'arpeggios'`, `arpNotes` and `arpDir`; a link opens on the Arpeggios sheet only when the
  flag is on (else the default sheet).

## The lines

- Exactly the Scales sheet's lines (`scaleLines`, #189): one per scale + chord root + canonical quality, first
  appearance order, the same label (scale, then the chord symbols). Both modes keep the same lines, so switching mode
  never reshuffles the sheet. A chord on two scales gets two lines; in 7th Chord mode they draw the same arpeggio
  (accepted: the sheet stays stable).
- A line that can't be drawn shows its error as on the Scales sheet: "Choose a scale" for Extended without a scale,
  "No chord tones for <chord>" when the chord or its quality can't be read.
- 12 lines a printed page, `last` and key signature handling as on the Scales sheet (signature on the first line when on).

## What a line plays

- **Chord tones:** `arpeggioTones(part, chord, scale)` (#186) of the line's first chord: 1 3 5 7 as written (a triad
  1 3 5, a 6 chord 1 3 5 6), spelled from its written root. In 7th Chord mode a triad plays 1 3 5 8 (the root again on
  top), as on the Changes.
- **Tensions (Extended):** the line's scale notes (written for the part, `writtenScale`) whose pitch class isn't a chord
  tone, ordered by compound degree of their interval label against the chord root (`intervalLabels`, the Intervals
  toggle's labels): 7ths (7, b7: only on triads and 6 chords) then 9s (b9 9 #9; a 2 counts as 9, and a minor 3rd
  labelled #9 is a 9), 11s (11 #11; 4 as 11), 13s (b13 13; 6 as 13, #5 as b13); ties by pitch, lower first.
  - Cm7 / C Dorian: C E♭ G B♭ · D F A
  - G7 / G Altered: G B D F · A♭ B♭ C♯ E♭
  - C7 / C Half-Whole: C E G B♭ · D♭ E♭ F♯ A (the scale spells its ♯9 as E♭)
  - CMaj7 / C Major Pentatonic: C E G B · D A
  - A scale with no notes outside the chord tones plays the chord tones alone.
- **Direction:**
  - Up: chord tones then tensions, each note the next of its pitch class above the last.
  - Down: the Up line reversed (same pitches).
  - Up & down: Up, then back down without repeating the top note, ending on the root.
- **Placement:** the Up line as one run, placed by the 7th Chords line's run-start rule (#186 `place` with no previous
  note: the octave with the fewest notes outside the instrument's range, then the average nearest the range's centre,
  a tie the higher). Exported from `arpeggios.ts` as `placeRun(pcs, up, range)`.

## Drawing

- One stave per line, no time signature (lines differ in length), all notes eighths, stems by VexFlow's default.
- **Beams** by group: the chord tones are one group, the tensions the next; Down reverses the groups, Up & down plays
  the up groups then the down groups (the down tensions without the top note). Each group is beamed on its own (a
  group of one note gets a flag). The beam break is the upper structure's mark; no other separator.
- Accidentals by the measure rule over the whole line against the key signature (`accidentalsInBar`), as the Scales
  sheet: a repeated altered note in Up & down isn't marked twice.
- Interval labels under the notes when Intervals is on (screen only), as the Scales sheet.
- Staff width as the Scales sheet's; the longest line (Extended Up & down: 13 notes) must fit at 390px wide without
  overlapping heads (the e2e width check).

## Engine (`engine/src/arpeggioSheet.ts`, new)

- `export type ArpNotes = 'seventh' | 'extended'`, `export type ArpDirection = 'up' | 'down' | 'up-down'`, guards
  `isArpNotes`, `isArpDirection`, labels `ARP_NOTES_LABELS`, `ARP_DIRECTION_LABELS`.
- `export function arpeggioLine(part, chord, scale, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | { error: string }`
  where `ArpeggioLineNotes = Readonly<{ notes: readonly Pitched[]; groups: readonly number[] }>` (`groups`: the
  length of each beamed group, in order, summing to `notes.length`).
- `export function tensionsOf(part, chord, scale, tones): readonly Spelled[]` (the ordering rule above), pure, tested on
  its own.
- `export function buildArpeggioSheet(rows, part, perPage, notes, dir, key?, resolved?): ArpeggioSheetModel`, where
  `ArpeggioSheetModel = Readonly<{ heading: string; pages: readonly (readonly ArpeggioStaffModel[])[] }>` (one part,
  no modes; heading "Arpeggios" or "Extended arpeggios"), and `ArpeggioStaffModel` has the `StaffModel` fields it shares (`id`, `chords`, `scale`,
  `notes`, `keySig`, `showClefAndKey`, `accidentals`, `intervals`, `error`, `last`) plus `groups`; no practice fields.
  It reuses `scaleLines` and `sheet.ts`'s per-line label helpers; nothing in it knows VexFlow.
- `share.ts`: `ShareSheet` adds `'arpeggios'`; `ShareView` adds `arpNotes?: ArpNotes`, `arpDir?: ArpDirection`,
  validated in `shareViewFrom`.

## App

- `web/app/utils/sheets.ts`: `SheetKind` adds `'arpeggios'`; `SHEETS` lists it third; `firstSheet` opens a link's
  `arpeggios` only when the flag is on.
- `PreviewControls.vue`: Work on lists Arpeggios when the flag is on; the Arpeggio group; Show: Intervals on Scales and
  Arpeggios; Spell Scale on Scales only.
- `usePreferences`: `arpNotes`, `arpDir` (stored refs as above); `linkPreferences` takes them from a link.
- New `ArpeggioSheet.vue` (pages and headings as `ScaleSheet.vue`, subtitle via `pageSubtitle(…, model.heading)`)
  and `ArpeggioStaff.vue` (label column as `ScaleStaff.vue`; the stave drawn by a new `drawArpeggioStaff` in
  `web/app/utils/vexflow.ts`: eighths, `vf.Beam` per group).
- `EditorView.vue`: renders `ArpeggioSheet` for `sheet === 'arpeggios'`; `shareUrl` adds `arpNotes`, `arpDir`.
- `docs/design.md`: an "Arpeggios sheet" section after the Scale sheet, and the feature flag list.

## Testing

- Engine, test first: `tensionsOf` (the four examples, a triad's 7th first, a pentatonic, a scale with no tensions,
  enharmonic #9 spelled as b3), `arpeggioLine` (each direction's notes and groups; a triad in 7th Chord mode 1 3 5 8;
  errors), `placeRun` (in range for treble, bass and a Bb part; same as the old private `place` for the Changes' run
  start: the existing arpeggio tests stay green), `buildArpeggioSheet` (lines equal the Scales sheet's; pages of 12;
  ids change with mode and direction), `shareViewFrom` (accepts and drops the new fields).
- App unit: `sheets.ts` (`firstSheet` with the flag off/on), `usePreferences` round-trip, `ArpeggioSheet` pages and
  subtitles (stubbed staff, as `ScaleSheet.test.ts`).
- e2e (`web/e2e/arpeggios-sheet.spec.ts`): choose Arpeggios on Autumn Leaves → 14 staves; Extended draws more notes per
  staff; Up & down; a share link reopens on Arpeggios with both choices; print 2 pages; 390px wide, no horizontal
  scroll.

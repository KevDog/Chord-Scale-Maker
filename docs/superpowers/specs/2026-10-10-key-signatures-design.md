# Clefs and key signatures: design

Date: 2026-10-10. Status: decided with the user (three questions answered); the user delegated the rest of the design.
Revised the same day: the user chose the jazz lead-sheet convention, the clef and signature once, at the start; key
changes by accidentals only, shown in the analysis.

## Goal

The scale, guide tone and Changes sheets read like a jazz lead sheet: the clef and the tune's key signature, written
for the instrument, once at the start of each sheet, and notes that carry accidentals only where they leave that key.

## Decisions

| Question | Decision (user's answer) |
| --- | --- |
| Scale sheet signature | The chart's key, written for the instrument; a scale's notes take accidentals only where they leave it. |
| Key areas | The home key throughout. An `@key` never changes the signature or the accidentals: key changes show by accidentals only, and in the analysis (the Changes sheet's key-area labels). |
| Placement | Clef and key signature once, at the start: the first staff of each scale sheet part (each mode), the first guide tone system, the first Changes line. Every other staff, system and line has neither. Time signature on the first line only, as before. |
| Minor keys | The relative major's signature (C minor → three flats). |
| No `key:` line | No key signature (as C): notes keep explicit accidentals as before; the clef still only once. |
| Rollout | Behind a new `keySignatures` feature flag, off; the e2e build turns it on. With it off, every sheet draws exactly as before (a clef on every scale staff and guide tone system, none on the Changes sheet). |

## 1. Engine (pure)

### The home key — `chartKeyOf(doc)`

`chartKeyOf(doc): Key | null` (`engine/analysis/index.ts`, re-exported from `engine/notes.ts`): the chart's `key:`
line (`parseKey`), else null. `@key` lines don't touch it.

### Written signature — `engine/keySignature.ts` (new)

- `keySignature(key: Key | null, part: Part): string | null` — the VexFlow major-key spec for the key as written for
  the part: a minor key uses its relative major; the tonic moves by the part's transposition and is spelled with
  `writtenRoot(part, root, 'ionian')` (the existing rule: no double accidentals, no B♯/E♯/C♭/F♭ tonic, fewest
  accidentals). Concert E♭ on a B♭ instrument → `F`; G minor on a B♭ instrument → A minor → `C`. Null for no key.
- `signatureAccidentals(spec: string | null): ReadonlyMap<Letter, number>` — the letters the signature alters and how
  (E♭ → B, E, A: −1). Empty for null or C.
- `accidentalsInBar(notes, spec)` — for one bar's (or one staff's) notes in order, each note's printed accidental
  (`'#' | 'b' | 'n' | '##' | 'bb'`) or null, by the measure rule: a note shows an accidental when its alteration
  differs from what is in force on its staff position (letter + octave) — the signature's, or an earlier note's in
  the bar; a note tied in from the previous bar shows none. Notes are `{ letter, acc, octave, tiedIn? }`.

### Sheets carry their signature

- `buildSheet(rows, part, choice, startText, perPage, practice, key?)` — with `key` (the home key, or null for no
  `key:`), every `StaffModel` gets `keySig = keySignature(key, part)` and `accidentals` from `accidentalsInBar`
  against it (a null `keySig` keeps the explicit accidentals). `showClefAndKey` is true only for the first staff of
  each `SheetPart`. Without `key` (flag off), `keySig` is null, every staff has `showClefAndKey`, and `accidentals`
  are the explicit ones.
- `buildGuideTones(rows, part, barsPerSystem, beats, key?)` — every `GuideBar` gets the same `keySig`. Without
  `key`, null.
- `buildChanges(doc, part, barsPerLine, signatures = false)` — with `signatures`, every `ChangesBar` gets
  `keySignature(chartKeyOf(doc), part)`. Otherwise null.

## 2. Drawing (app/utils)

- **Scale staff** (`vexflow.ts` `drawStaff`): the clef, and `keySig` after it, only when `staff.showClefAndKey`;
  each note's accidental from `staff.accidentals`.
- **Guide tone system** (`guideToneDrawing.ts`, `signatures` option): without signatures, every system starts with
  the clef, as before. With them, only the first system (`timeSignature`) starts with the clef and the key signature,
  its lead measured from a probe stave with the same clef, signature and time signature; the other systems have
  neither and no lead. Accidentals come from `barAccidentals` per bar and line: the measure rule against the
  signature, or, with none, the legacy rule (every altered note's sharp or flat, even repeated in the bar, and a
  natural after an altered note on the same letter and octave).
- **Changes line** (`changesDrawing.ts`): with signatures, the first line's first bar gets the part's clef and the key
  signature (and the taller `CLEF_BAND` crop); other lines have neither. Without, as before (no clef).

## 3. App

- New flag `keySignatures` (off; on in the `e2e` script).
- `EditorView` passes `homeKey = chartKeyOf(doc)` to `ScaleSheet` and `GuideToneSheet` when the flag is on (the
  guide tone sheet turns its systems' `signatures` on with it); `ChangesSheet` calls `buildChanges(…, signatures)`
  with the flag and `ChangesSystem` passes the clef to `drawChangesLine`, which draws it on the first line only.
- Print: unchanged layout rules; staves stay cropped to what's drawn.

## 4. Testing

- Engine (TDD): `keySignature` (concert, B♭ and E♭ parts, minor keys, no key); `signatureAccidentals`;
  `accidentalsInBar` (signature notes silent, a B♮ in E♭, the measure rule within a bar, octaves apart, ties);
  `chartKeyOf` (the `key:` line whatever the `@key`s, no `key:`); `buildSheet`/`buildGuideTones`/`buildChanges`
  carry the one `keySig` and, for scales, the right accidentals (D Dorian in E♭ shows only the B♮; D Ionian after an
  `@key D` takes them against E♭); `showClefAndKey` only on each part's first staff.
- App unit tests: the flag reaches the sheets (props present only when on).
- e2e (flag on): on Misty (E♭), each sheet draws one clef and one key signature, on its first staff, system (both
  lines) or line, and none on the second; an `@key` chart draws no second signature and the Changes sheet labels the
  `@key` area; the existing suites pass unchanged.
- Golden: `golden.json` covers the scale notes; `keySig`/`accidentals` are new fields — review the diff (expected:
  none, if the fixture serialises only notes; otherwise only the new fields).

## Out of scope

- Key signatures for any key area, found or `@key` (key changes are accidentals and analysis labels).
- Courtesy accidentals across barlines.
- Changing how the "From X" start note is chosen.

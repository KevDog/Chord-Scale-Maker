# Clefs and key signatures on every sheet: design

Date: 2026-10-10. Status: decided with the user (three questions answered); the user delegated the rest of the design.

## Goal

The scale, guide tone and Changes sheets read like real music: a clef and the tune's key signature, written for the
instrument, at the start of every line, and notes that carry accidentals only where they leave that key.

## Decisions

| Question | Decision (user's answer) |
| --- | --- |
| Scale sheet signature | The chart's key, written for the instrument, on every staff; a scale's notes take accidentals only where they leave it. |
| Key areas | The home key throughout; a new signature only where an `@key` line starts (analyser-found areas stay as accidentals). |
| Placement | Clef and key signature at the start of every line (every scale staff, every guide tone and Changes system); time signature on the first line only, as now. |
| Minor keys | The relative major's signature (C minor → three flats). |
| No `key:` line | No key signature (as C): notes keep explicit accidentals as today. |
| Rollout | Behind a new `keySignatures` feature flag, off; the e2e build turns it on. With it off, every sheet draws exactly as today. |

## 1. Engine (pure)

### Which key each row is in — `rowKeys(doc)`

`rowKeys(doc): readonly (Key | null)[]`, one per expanded row (the order of `expandRowLines`): the key of the `@key`
in effect at that row, else the chart's `key:` (`parseKey`), else null. It reads the analysis's `@key` spans
(`prepare()`'s `areaStated`/`areaKeys`), so the signature changes exactly where the analysis's key areas do for
`@key`; found areas don't change it. Re-exported from `engine/notes.ts` with the `Key` type.

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

### Sheets carry their signatures

- `buildSheet(rows, part, choice, startText, perPage, practice, keys?)` — with `keys` (one per row), each
  `StaffModel` gets `keySig: string | null` and `accidentals: readonly (string | null)[]` (from
  `accidentalsInBar` over the staff's notes). Without `keys`, `keySig` is null and `accidentals` is today's rule
  (every altered note shows its accidental).
- `buildGuideTones(rows, part, barsPerSystem, beats, keys?)` — each `GuideBar` gets `keySig`: the key of the first row
  starting in the bar, else the previous bar's. Without `keys`, null.
- `buildChanges(doc, part, barsPerLine, signatures = false)` — with `signatures`, each `ChangesBar` gets `keySig` the
  same way, from `rowKeys(doc)`. Otherwise null.

## 2. Drawing (app/utils)

- **Scale staff** (`vexflow.ts` `drawStaff`): with `staff.keySig`, `addKeySignature(keySig)` after the clef and each
  note's accidental from `staff.accidentals`; without, as today.
- **Guide tone system** (`guideToneDrawing.ts`): with signatures, the first bar of every system gets the clef and its
  key signature; a bar whose `keySig` differs from the bar before it in the same system gets the new signature
  (VexFlow cancels the old one with naturals). The lead width comes from measuring a probe stave with the same
  clef, signature and time signature, so the bars still line up; a mid-system signature takes its width from that
  bar's share. Accidentals come from `accidentalsInBar` per bar and line. Without signatures, as today.
- **Changes line** (`changesDrawing.ts`): with signatures, every line's first bar gets the part's clef and its key
  signature, and a mid-line `@key` bar gets the new signature, as above. Without, as today (no clef).

## 3. App

- New flag `keySignatures` (off; on in the `e2e` script).
- `EditorView` passes `keys = rowKeys(doc)` to `ScaleSheet` and `GuideToneSheet` when the flag is on; `ChangesSheet`
  calls `buildChanges(…, signatures)` with the flag and `ChangesSystem` passes the clef to `drawChangesLine`.
- Print: unchanged layout rules; staves stay cropped to what's drawn.

## 4. Testing

- Engine (TDD): `keySignature` (concert, B♭ and E♭ parts, minor keys, no key); `signatureAccidentals`;
  `accidentalsInBar` (signature notes silent, a B♮ in E♭, the measure rule within a bar, octaves apart, ties);
  `rowKeys` (home key, an `@key` span, a held bar, no `key:`); `buildSheet`/`buildGuideTones`/`buildChanges` carry
  `keySig` and, for scales, the right accidentals (D Dorian in E♭ shows only the B♮).
- App unit tests: the flag reaches the sheets (props present only when on).
- e2e (flag on): an E♭ chart's scale staff, guide tone system and Changes line each draw a key signature (VexFlow
  draws it as a group; assert on the SVG's key-signature glyphs or an `aria-label` mention); the existing suites
  pass unchanged.
- Golden: `golden.json` covers the scale notes; `keySig`/`accidentals` are new fields — review the diff (expected:
  none, if the fixture serialises only notes; otherwise only the new fields).

## Out of scope

- Key signatures for found (analyser) key areas.
- Courtesy accidentals across barlines.
- Changing how the "From X" start note is chosen.

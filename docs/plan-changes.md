# The Changes sheet

Status: **done**; the `changes` flag is on since sign-off (2026-10-08).

A third sheet beside Scales and Guide tones: the chart as a study lead sheet. No melody (we have none); the
chords over slashes, with what the analysis knows written under them. It's a study sheet: it shows why each
chord takes its scale.

## Decisions (all taken as recommended, 2026-10-08)

1. **Notation:** VexFlow slash staves, like the other two sheets (not an HTML grid).
2. **Study content:** under each chord, its Roman numeral in its key area (`ii7`, `V7/ii`, `♭VII7`) and its scale,
   each with its own toggle (both on); a key-area label wherever the key changes ("B♭ major"). The analysis's
   reasons stay in the chart text.
3. **Repeats:** a `@copy` straight after its source section prints as repeat signs; a later one (A3 after a
   bridge) is written out, labelled "A3 (= A1)". 1st and 2nd endings, and D.C./segno navigation, come later.
4. **Metre:** the chart's `time:` line (2/4, 3/4, 4/4) sets the slashes a bar.
5. **Intros and codas:** an intro prints before the form; a coda, tag or ending after it. A coda or ending is
   headed "… (after the last chorus)"; a tag isn't, since a tag can be an interlude after the head (A Night in
   Tunisia's). No segno or coda symbols yet.
6. **Name:** "Changes".
7. **Layout:** four bars a line (two on phones); each section starts a new line; transposing instruments as on the
   other sheets; a feature flag, off.

## Design

- **Engine** (`engine/changes.ts`, pure): `buildChanges(doc, part, barsPerSystem)` → lines of bars. It reads the
  expanded rows with their source lines (`expandRowLines`), times them with the guide tone timeline (the same bar
  and beat for every chord, intros and codas included, in the chart's metre), groups them into runs by section,
  and folds a run that copies the run before it into a repeat. Each chord carries its display tokens (written for
  the part), its numeral and its scale; each bar its section marker, repeat barlines and key-area label.
- **Numerals** come from the analysis (`analysis/numerals.ts`): the chord's degree in its local key, with its
  quality (`IVmaj7`, `ii7`, `iiø7`, `vii°7`), and for dominants what they lead to (`V7/ii`, `subV7`, a back door's
  `♭VII7`). Relative to the key, so the same for every instrument; the key-area labels are written for the part.
- **Scales** are the row's own (what you'd play at the chart's current level), written for the part.
- **Drawing** (`app/utils/changesDrawing.ts`): one stave a line, slash noteheads, the time signature on the first
  line, repeat barlines, a final barline at the end of the form. Chords, numerals, scales, section markers and key
  areas are HTML over and under the stave, placed at the beats VexFlow lays out (as the guide tone sheet places its
  chords).
- **App:** `ChangesSheet.vue` / `ChangesSystem.vue`, eight lines a printed page (ten don't fit with numerals and
  scales: a line is about 105 px printed); `Numerals` and `Scales` toggles in the
  preview toolbar (remembered like Intervals, carried in share links); the sheet in `SHEETS` and share links when
  the flag is on.

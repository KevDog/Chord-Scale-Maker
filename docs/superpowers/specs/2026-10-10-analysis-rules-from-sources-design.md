# Analysis rules revised against the sources: design

Date: 2026-10-10. Status: approved (decisions below are the user's). Source: the research in
[docs/research/2026-10-jazz-theory-vs-engine.md](../../research/2026-10-jazz-theory-vs-engine.md) §5, with the
detail in its appendices A1, A2, D and E. Lands after the labels spec
([2026-10-10-function-labels-design.md](2026-10-10-function-labels-design.md)); the context spec is independent.

## Goal

Bring the scale rules to what the primary sources prescribe where they clearly do, keep the engine's own
conventions where the sources attest them, and move the choices the sources split on into the level ladder. No
principle in docs/plan-analysis.md §2 changes; principle 7 (the diatonic choice at Standard, the hipper one at
Advanced) decides every split below.

## Decisions

| Question | Decision |
| --- | --- |
| IV after its own dominant | Ionian (N&G p. 47; Levine p. 120). Lydian stays the Advanced rung. |
| Blues IV7 | Mixolydian (N&G p. 105; M&H pp. 93, 125). Lydian Dominant stays in the menu. I7 is decided by D5 before D3. |
| Diminished sevenths | Berklee's key-derived "diatonic diminished" scale at Standard; Whole-Half becomes the Advanced rung; Harmonic Minor stays as a further option. The reason string names the dominant the chord actually hides. |
| iii7 | Phrygian at Standard (N&G p. 33; M&H p. 23; Chediak vol. 2 p. 48); Dorian at Advanced. Reverses plan §7.3's m9 convention. |
| V7 → minor | Unchanged at Standard (Phrygian Dominant). Altered joins Spanish Phrygian as an Advanced choice (Levine pp. 75–76; M&H p. 95). |
| Tonic m6 | Melodic Minor at Standard for the tonic i6; Dorian for any other m6 (M&H p. 85; Chediak vol. 1 p. 341; principle 5). |
| ♭VII major chord in a minor key | Ionian (N&G p. 91). |
| h1 (ø7 in a modal chart → Locrian ♮2) | Dropped: no modal chapter has a ø7; h2's ladder already offers ♮2 at Advanced. |
| Reason strings that call an avoid note "in the key" | Reworded. |
| Jobim's tunes | The library follows the *Songbook Tom Jobim* (Lumiar) for Jobim's tunes. |

Page references: the PDFs are in `design/sources/`; book page = PDF + 1 (N&G), PDF − 12 (M&H), PDF − 16 (Levine).

## 1. Rule changes

Each: the change, the reason string (principle 6), the test, the sources. Rule ids are those `rules.ts` emits;
update `RULES` for each id touched.

### R1. IV after its own dominant → Ionian (M3; today M4)

- A major chord that is IV of the local key, whose previous chord is its dominant a fifth above (V7/IV) or a half
  step above (subV7/IV), takes M3 Ionian. It opens no area (it is diatonic). A IV not so prepared stays M4 Lydian.
- Reason: "the B♭7 before it makes E♭ the key of the moment: the 4th is in the key".
- Tests: Stella, `key: Bb`, bars 5–7 `Fm7 | Bb7 | EbMaj7` → E♭ Ionian, M3. Moment's Notice bars 10–11 and 26–27
  `Bbm7 Eb7 | AbMaj7` → A♭ Ionian. Negative: All the Things bar 5 `DbMaj7` after `AbMaj7` → D♭ Lydian (M4).
- Sources: N&G p. 47 ("This is the only maj7 chord with this chord scale choice"), p. 60 (subV7/IV); Levine p. 120
  fig. 6-11 (Stella: "E♭∆ — 1st mode of E♭ major").

### R2. The blues I7 and IV7 (D5)

- In a blues context `dominant()` tries D5 for the I7 and IV7 before D3 and D7, so the I7 that precedes IV7 is not
  "an extended dominant". IV7 takes Mixolydian; I7 Mixolydian as today.
- Reasons: "I7 of the blues: a tonic with dominant colour, natural tensions"; "IV7 of the blues: a subdominant
  with dominant colour, Mixolydian (the ♯11 is an extra colour)".
- Tests: F Jazz Blues, `key: F`: bar 1 `F7` → F Mixolydian, D5 (not D3); bar 5 `Bb7` → B♭ Mixolydian, D5 (was
  Lydian Dominant). Every library blues: no I7 row reasoned by D3.
- Conflict: principle 4 yields the ♯11; plan §10.4 already names the blues exception. Menu: `7` keeps Lydian
  Dominant as an option.
- Sources: N&G pp. 100, 105; M&H pp. 93, 125, 136–137 ("I7 should not be confused with V7/IV").

### R3. Diminished sevenths (d1)

Two parts; the first is certain and should land even if the second is deferred.

**R3a, the reason.** For a `vii°7 of X` the hidden dominant is X's V7♭9. For a passing or auxiliary °7 it is the
V7♭9 a half step below one of the chord's four notes that is the dominant of the next chord, or of the chord after
a related ii (Wave: B♭°7 → Am7 D7 hides A7♭9, not E7♭9). Reasons: "vii°7 of Dm7: A7♭9 without its root";
"passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)"; "auxiliary diminished: it decorates the
chord and returns to it"; fallback "passing diminished: a rootless dominant ♭9". Sources: Levine p. 87 (Wave);
N&G p. 114.

**R3b, the scale.** A functional °7 takes a key-derived eight-note scale at Standard:

- Ascending (`vii°7 of X`): the scale D4 gives X's V7(♭9, ♯9, ♭13), from the °7's root. As a degree formula from the
  °7 root this is fixed: `1 b2 b3 3 b5 b6 6 7` (C♯°7 → Dm7 in C: C♯ D E F G A B♭ C). Add it to `SCALES` as
  `Diatonic Diminished` (alias "leading-tone diminished"). Sources: N&G p. 115 ("displacements of the secondary
  dominant chord scale (starting on the 3rd)"); M&H p. 152 ("identical in pitch content to the A Mixolydian (♭9,
  ♯9, ♭13) scale").
- Descending/passing (♭III°7, ♭VI°7) and auxiliary (I°7, V°7): the chord tones plus the key's seven notes, as M&H's
  figures give them: fig. 7.26 (♭III°7, p. 156), fig. 7.27 (♭VI°7, p. 158), figs. 7.30–7.31 (I°7, p. 160), fig. 7.32
  (V°7, p. 161). Transcribe each figure into a degree formula from the °7 root and add it to `SCALES` under one
  name with the function as a variant (the sheet prints the notes either way; CLAUDE.md: never hand-type note
  lists). The ♭VI°7 case is verified from the page image: in D, B♭°7 → B♭ B C♯ D E F♯ G A. Where N&G p. 116 (which
  reaches ♭III°7 by enharmonic equivalence with ♯II°7) differs from M&H, follow M&H and say so in docs/design.md.
- Ladder (`chord_scales.json`, `dim7`): Standard the diatonic scale, Advanced Whole-Half, Harmonic Minor (a half
  step up) kept as a further rung. Basic unchanged.
- Tests: Wave, `key: D`, bar 2 `Bbdim7` → B♭ B C♯ D E F♯ G A (Standard), B♭ Whole-Half (Advanced). `key: C`,
  `Cmaj7 | C#dim7 | Dm7` → C♯ D E F G A B♭ C. `Dm7 | G7 | Cdim7 | C6` → per fig. 7.30. Every °7 in the library moves;
  review the golden diff chord by chord against the figures.
- Sources: N&G pp. 114–116 ("the symmetric diminished chord scale is an appropriate scale for use when the
  diminished 7th chord is not functioning diatonically"); M&H pp. 149–162 (p. 162: symmetric "optional … special
  situations"). Levine p. 84 and Chediak vol. 1 p. 91 give Whole-Half: the Advanced rung.

### R4. iii7 → Phrygian (m9)

- iii7 of a major key takes Phrygian at Standard, its only available tension the 11; as the related ii of V7/vi it
  keeps Phrygian (M&H p. 57; Aeolian is M&H's alternate). Dorian becomes the Advanced rung for this chord. The
  `Phrygian` ladder's Advanced is Dorian ♭2 (for sus ♭9); add a per-quality rung so iii7's Advanced is Dorian.
- Reason: "iii: Phrygian, the key's own notes (the ♭2 is a passing note)".
- Tests: `key: C`, `Cmaj7 | Em7 | Am7 | Dm7 | G7` → E Phrygian, m9; `Cmaj7 | Em7 | A7 | Dm7` → E Phrygian (label
  `iii7` per the labels spec). Advanced offers E Dorian.
- Sources: N&G p. 33; M&H p. 23 ("only the 11 sounds pleasingly consonant"), p. 57; Chediak vol. 2 p. 48 (Dorian
  "in contemporary, less consonant music"). Plan §7.3's paragraph on m9 is rewritten.

### R5. Altered as an Advanced choice on V7 → minor (ladder only)

- `chord_scales.json`: on the `7` quality's V7-to-minor line, Advanced offers Altered beside Spanish Phrygian.
  D4 unchanged.
- Test: `Dm7b5 | G7 | Cm7`, `key: Cm`: Standard G Phrygian Dominant; Advanced lists G Altered and G Spanish Phrygian.
- Sources: Levine pp. 75–76; M&H p. 95 ("an alternative chord scale choice").

### R6. The small bundle

- **Tonic m6 → Melodic Minor (m2).** A minor sixth chord on the tonic of its key area takes Melodic Minor at
  Standard; any other m6 (iv6, ii6, a borrowed iv6) Dorian. Reason: "tonic minor sixth chord: melodic minor, the
  raised 7th is a tension" / "a minor sixth chord: Dorian". Tests: A Night in Tunisia `Dm6/9`, `key: Dm` → D Melodic
  Minor; Wave `Gm6` (iv6 in D) → G Dorian. Sources: M&H pp. 85–86; Chediak vol. 1 p. 341; N&G p. 91 (both listed).
- **♭VII major chord in a minor key → Ionian (M3).** Reason: "♭VII of C minor: B♭ major, the notes of C Dorian".
  Test: `key: Cm`, `Cm7 | BbMaj7 | AbMaj7` → B♭ Ionian, A♭ Lydian. Source: N&G p. 91, pp. 85, 88.
- **Drop h1.** A ø7 in a modal chart goes through h2 (Locrian; ♮2 at Advanced). Footprints `F#m7b5` → F♯ Locrian at
  Standard; the chart may `# keep:` the ♮2 (plan decision 9 recorded it as taste). Remove h1 from `RULES`. Sources:
  N&G p. 153; M&H pp. 187, 194.
- **Reason strings.** m7 vi: "vi: Aeolian, the key's own notes (the ♭6 is a passing note)"; m7 v of minor: "v of a
  minor key: Phrygian, the key's own notes (its ♭2 is a passing note)"; h2: "iiø7 of G minor: Locrian, the key's
  own notes (its ♭2 is a passing note)"; m5: drop the parenthetical "(Aeolian at Basic? see §11)" from the printed
  text; s2: "V7sus4 resolving down a fifth: Mixolydian, the 4th is a chord tone here" (the derived ♭6 stays).
  Sources: N&G pp. 27–28; M&H pp. 24, 97; Levine p. 46.
- **`chord_scales.json` note.** The `m`/`m7` Aeolian option's note "when the chord is vi or iv" → "when the chord is
  vi, or the symbol has a ♭6" (iv is Dorian: N&G p. 79; M&H p. 129).

## 2. Charts

Per CLAUDE.md: edit the chart, `cd web && npm run analyse -- ../charts/<tune>.txt --write --save`, read the report,
`make golden`.

- **Wave** (`charts/wave.txt`): follow the songbook (printed pp. 109–110): bar 6 `Gm6`; bars 7–10 `F#7 | B7 | E7 |
  Bb7 A7` (the chart's `Bm7` breaks the extended-dominant chain M&H p. 142 reads there; carry the songbook's
  tensions where the format allows). Keep the B section as the chart has it unless the songbook's lead sheet shows
  otherwise on inspection.
- **The Girl from Ipanema** (`charts/the_girl_from_ipanema.txt`): bars 7–8 of the first A per the songbook (p. 61):
  `Am7 Ab7 | Db7M(9) Gb7(#11)` (then `@copy` as the chart has it); the bridge per the songbook: `F#7M | B7(9) |
  F#m7 | D7(9) | Gm7 | Eb7(9) | Am7 | D7(b9) | Gm7 | C7(b9)` (the chart's `Am7/D`, `Bbm/Eb` insertions and `alt`
  symbols go). Fix the bar numbering: the bridge's rows overlap `@copy A1 A3 24`. Expected scale changes: `Eb7` →
  E♭ Lydian Dominant (D6, no related ii), `D7(b9)` → D Phrygian Dominant, `C7(b9)` → C Half-Whole (♭9 with the
  key's 13).
- **Solar** (`charts/solar.txt`): bar 1 `CmMaj7` (m1 → C Melodic Minor), as the usual lead sheet reads.
- **Footprints**: after R6, `# keep: F# Locrian natural 2` on the `F#m7b5` row if the ♮2 is wanted.

## 3. Documentation (docs/plan-analysis.md, docs/design.md)

- §7.1 table: Berklee's scale for every dominant whose ♭9 is diatonic is the eight-note one (N&G p. 43, the ♯9
  rider); the engine's seven-note Phrygian Dominant is a principle-7 choice, not Berklee's.
- §7.2: add the V-triad → Mixolydian branch of M3 (in the code, not in the plan); R1's IV rule.
- §7.3: m9 rewritten for Phrygian; m2's tonic/non-tonic split; m5's convention cited (N&G p. 91, M&H p. 84,
  Levine p. 225).
- §7.4: the diatonic diminished scale replaces the fixed Whole-Half; §8's `d1` line and `h1` line.
- §9 Stella: `D1+D4` is printed `D4` (the prefix appears only when the symbol moves the scale). §9 All the Things
  bar 9: `Cm7` is in the C area. §5.3 and §9 Autumn Leaves: the narrative describes the standard changes; the
  library chart is one G minor area. Giant Steps: note that `key: Eb` is arbitrary (Levine p. 95: B; N&G p. 163:
  no home key).
- §10.2: "N&G's table says the same; M&H pp. 45–46 prefer the ♯9/♭13 form and Levine p. 66 calls Mixolydian ♭6
  seldom played." §10.6: "N&G p. 54 says the same; M&H and Levine name no scale." §10.4: cite N&G p. 105 and M&H
  p. 125. New decision lines for R1, R3, R4, R6 citing the research doc.
- docs/design.md: the rules on one page; the ladder changes; the °7 scale family.

## 4. Order of work and verification

1. R3a and R6's reason strings and the `chord_scales.json` note (text only), tests, `analyse --all --force --save`,
   `make golden`: the fixture diff is text only.
2. R1, R2, R4, R6's rule changes, each test-first; `analyse --all --force --save`; `make golden`; read both diffs
   rule by rule. R2 depends on blues detection as it is today; the context spec widens it later.
3. R3b: `SCALES` entries, the ladder swap, tests, golden; review every °7 row against M&H's figures (the PDFs are
   in `design/sources/`).
4. R5 ladder; charts (§2); docs (§3).
5. `make test`, `make lint`, `make e2e`. In the PR: the golden diff summarised by rule id, and the list of library
   chords whose scale changed, grouped by R-number.

## 5. Out of scope

Blues and modal detection, `context:` (the context spec). The labels (the labels spec). Not adopted, with
reasons in the research doc §5: the "≥ 2-bar" tonicisation test; a borrowed-tonic clause; N&G's natural 9 on an
unmarked V7 in minor; a parallel-dominants rule; the `minor:` field.

# Function labels and the function grammar: design

Date: 2026-10-10. Status: approved (decisions below are the user's). Source: the research in
[docs/research/2026-10-jazz-theory-vs-engine.md](../../research/2026-10-jazz-theory-vs-engine.md) §3.4 and §5 P3/P9,
with the detail in its appendix [C-functions.md](../../research/2026-10-jazz-theory-vs-engine/C-functions.md).

**This PR lands before the functions help page** ([2026-10-10-functions-help-page-design.md](2026-10-10-functions-help-page-design.md)):
that page generates its tables from `numerals.ts`, `SUFFIXES` and `parseFunction`, and would otherwise publish the
labels this spec corrects. The functions-page branch rebases onto this one.

## Goal

The Changes sheet's numerals and the report's function names follow the Berklee vocabulary everywhere except in
four places, each a label the sources would call wrong. Fix those, and make the fifth cell accept the spellings a
Berklee-trained author types. No scale changes anywhere in this spec: every test below asserts the scale is
unchanged.

## Decisions

| Question | Decision |
| --- | --- |
| Numeral case | Keep the lower-case convention (`ii7`, `V7/ii`, `viiø7`): Terefenko, "Jazz Transformations of the ii7–V7–I Progression", *Current Research in Jazz* 1 (2009). The sheet's printed text does not change except where this spec says. |
| Grammar | Lenient on input, canonical on output. Every spelling in §2 reads to the same canonical text the sheet prints today. |
| Upper-case slash target | Deferred (see the decisions below): upper case keeps meaning major, the sheet's convention; a lower-case target is minor. Taking the quality from the key (`V7/II` in C as A7 → Dm7, as Berklee writes it) was proposed and not adopted. |
| Deceptive resolution | `(V7/II)` parses, sets a `deceptive` flag, changes no scale; the sheet prints the parentheses (and the target keeps its case). |
| Half-diminished glyph | `ø7` stays (understood by everyone; the Berklee texts themselves call it "not preferred" but universal). |

## 1. Label changes (`numerals.ts`, the `fn` and `reason` strings in `rules.ts`, `RULES`)

Each item: the change, the test, the sources (book pages; the PDFs are in `design/sources/`, offsets N&G book =
PDF + 1, M&H book = PDF − 12, Levine book = PDF − 16).

### L1. A dominant into the key's own V7 is `V7/V`; chain links print an arrow

- Today `D7 G7 | Cmaj7` in C prints `II7` for the D7 (`numeral()` prints an extended dominant's own degree), and
  the Rhythm bridge `D7 G7 C7 F7` in B♭ prints `III7 VI7 II7 V7`. `II7` is N&G p. 127's label for a *non-dominant*
  II7; every source labels D7 → G7 as V7/V.
- Change: the link that resolves into the local key's V7 prints `V7/V` (fn "V7 of V7: the dominant of the
  dominant"); earlier links of a chain of three or more print `→` and keep fn "extended dominant: each one falls a
  fifth into the next". A chain of two (`D7 G7 | C`) is not "extended" in the report; it is V7/V → V7. Rule ids D3/D8
  and their scales are unchanged; update their `RULES` summaries.
- Tests: `key: C`, `Cmaj7 | D7 | G7 | Cmaj7` → D7 prints `V7/V`, scale D Mixolydian, rule D3. `key: Bb`,
  `Bbmaj7 | D7 | G7 | C7 | F7 | Bbmaj7` → `→ → V7/V V7`, all Mixolydian. Into minor: `A7 | D7 | G7 | Cm7`, `key: Cm` →
  `→ V7/V V7`, D8 scales unchanged.
- Sources: N&G pp. 51–55 ("to call each a V7/V would be inaccurate"; the arrow), p. 127; M&H pp. 49–50; Chediak
  vol. 1 pp. 107, 109.

### L2. A diatonic chord acting as a related ii prints its degree

- Today `Em7 | A7 | Dm7` in C prints Em7 as `ii7/ii`, `Am7 | D7 | G7` prints `ii7/V`, `Bm7♭5 | E7 | Am7` prints
  `iiø7/vi`: the diatonic identity (iii7, vi7, viiø7) never reaches the sheet. Berklee prints the degree and a
  bracket ("dual function").
- Change: when the minor or ø chord before a dominant a fourth above is diatonic to the local key, the numeral is
  its degree (`iii7`, `vi7`, `viiø7`); the report fn keeps "ii of the ii–V to D minor" and adds "also iii of C". A
  non-diatonic related ii (`Gm7 | C7 | Fmaj7` in C) still prints `ii7/IV`. Scales (m4 Dorian, h2 Locrian) unchanged.
- Tests: `key: C`: `Cmaj7 | Em7 | A7 | Dm7 | G7 | Cmaj7` → Em7 `iii7`, E Dorian (m4) today — see the rules spec,
  which changes this chord's scale to Phrygian; this spec's test pins the label only. `Bm7b5 | E7 | Am7` → `viiø7`,
  B Locrian. `Gm7 | C7 | Fmaj7` → `ii7/IV`.
- Sources: M&H pp. 52–53; N&G pp. 46–47, 67; Chediak vol. 1 p. 102.

### L3. Auxiliary diminished: defined by the next chord

- Today "auxiliary" requires the same root before *and* after (`C C°7 C`); `Dm7 G7 | C°7 | C6` and `C | G°7 | G7`
  print "passing diminished" with the guess flag.
- Change: a °7 whose next chord is on its own root is auxiliary, whatever precedes it. Reason: "auxiliary
  diminished: it decorates the chord and returns to it". No guess flag. Scale unchanged (d1; the rules spec changes d1
  separately).
- Tests: `key: C`, `Dm7 | G7 | Cdim7 | C6` → "auxiliary diminished"; `Cmaj7 | Gdim7 | G7` → auxiliary.
- Sources: M&H p. 159 (figs. 7.30, 7.32); Chediak vol. 1 p. 103; N&G p. 111.

### L4. Diminished numerals by direction

- Today `roman()` has one flat-side table, so an ascending C♯°7 (to Dm7) prints `♭ii°7` and G♯°7 (to Am7) prints
  `♭vi°7`, colliding with the descending ♭III°7/♭VI°7. Berklee spells ascending chords sharp, descending flat;
  the accidental carries the direction.
- Change: a `vii°7 of X` (ascending) prints sharp-side (`♯i°7`, `♯ii°7`, `♯iv°7`, `♯v°7`); descending and auxiliary
  print flat-side as today (`♭iii°7`, `♭vi°7`, `i°7`). The function grammar already accepts `♯I°7`.
- Tests: `key: C`, `Cmaj7 | C#dim7 | Dm7` → `♯i°7`; `Em7 | Ebdim7 | Dm7` → `♭iii°7`; `Cmaj7 | Cdim7 | Cmaj7` → `i°7`.
- Sources: M&H pp. 148–152; N&G pp. 110, 113.

### L5. A sus before its own dominant is a suspension, not "static"

- Today `Dm7 | G7sus4 | G7 | C` labels the sus "static sus" (s3).
- Change: a `7sus4` followed by the dominant on the same root gets fn "V7sus4 before the V7: a subdominant
  suspension", reason "V7sus4 before the V7: Mixolydian, the 4th is a chord tone here". Rule id stays s3 (update its
  `RULES` summary); scale Mixolydian unchanged. "Static sus" remains for a sus with no same-root dominant after it.
- Test: `key: C`, `Cmaj7 | Dm7 | G7sus4 | G7 | Cmaj7` → the fn above, G Mixolydian, s3.
- Sources: M&H p. 6 (fig. 1.8); N&G p. 38; Levine p. 45.

### L6. Borrowed chords are named as borrowed, not "chromatic"

- Today a non-resolving ♭VII7, ♭VI7 or ♭III7 in a major key gets fn "chromatic dominant" with the guess flag
  (D6), and a borrowed major 7th (♭VImaj7, ♭IImaj7, ♭IIImaj7, ♭VIImaj7 in major, M4) is "a non-tonic major chord".
  Both are the textbook modal-interchange chords; Berklee names them by their source.
- Change: D6 for ♭VII7/♭VI7/♭III7 in a major key: fn "♭VII7, borrowed from the parallel minor (subdominant
  minor)", reason "♭VII7 from the parallel minor: Lydian Dominant, it returns to I"; no guess flag. M4 for the four
  borrowed major 7ths in a major key: fn "♭VImaj7, borrowed (modal interchange)", reason "♭VImaj7, borrowed from
  C minor: Lydian (its ♯11 is in the key)". h2 for iiø7 in a major key: fn "iiø7, borrowed". "Chromatic dominant"
  (with the guess flag) remains for a dominant on any other non-diatonic root. Scales unchanged.
- Tests: `key: C`, `Cmaj7 | Bb7 | Fmaj7` → Bb7 fn as above, B♭ Lydian Dominant, no guess; `Cmaj7 | Ab7 | Cmaj7` →
  ♭VI7 likewise; `Cmaj7 | Abmaj7 | G7` → Abmaj7 fn "borrowed (modal interchange)", A♭ Lydian; `Cmaj7 | E7 | Fmaj7`
  (E7 on a diatonic root, not resolving) → unchanged.
- Sources: M&H pp. 123, 130, 236–238; N&G pp. 74–75, 80, 82, 123; Chediak vol. 1 pp. 97, 112–113.

### L7. Print `V7sus4`

- `SUFFIXES['7sus4']` and `numerals.ts` write `7sus`. Print `V7sus4` (M&H pp. 6–7; N&G `V7(sus4)`); keep accepting
  `7sus` and `sus`. Test: `G7sus4 | Cmaj7`, `key: C` → `V7sus4`; `parseFunction('V7sus')` reads `V7sus4`.

### L8. "Passing ii–V" → "extended ii–V" in the report

- Chediak's term (vol. 1 p. 107; N&G p. 68 "related II-7 of a sequential dominant"). Fn "extended ii–V: a
  side-step, its own notes". Numerals and scales unchanged. Test: Gm `Bm7 | E7 | Bbm7 | Eb7 | Am7b5 | D7 | Gm7` → fn
  changes only.

### Decisions on the cases above the spec left open (the user's, 2026-10-10)

- **Reasons.** Users see the reason (report, chart comments, the functions page); fn is internal. Where this spec
  gives only an fn, the reason carries the same words followed by today's tension tail (e.g. "…: natural tensions").
- **L1.** The link into the key's V7 prints `V7/V`, reason "V7 of V7: the dominant of the dominant: <tensions>";
  earlier links print `→`, reason "extended dominant: each one falls a fifth into the next: <tensions>". Into a minor
  tonic (D8) the same labels, the reason keeping D8's "on the way to C minor". A chain of two that does not go into
  the key's V7 (every blues I7 → IV7; `E7 | A7 | Dm7`) is unchanged: its own degree and today's text. A chain of three
  or more that never reaches the key's V7 (Anthropology `F7 Bb7 Eb7 | Ab7`) is unchanged: arrows appear only on chains
  that lead into the key's V7. "The key's V7" is a dominant on degree V of the local key.
- **L2.** fn "ii of the ii–V to D minor; also iii of C" (ø7: "…; also viiø7 of C"). m4's reason unchanged; for h2 the
  "also …" goes in the fn only, not the reason. Major key areas only: in a minor area Autumn Leaves' `Cm7 F7 | Bb`
  keeps `ii7/♭III`. Applies to any diatonic related ii whether or not its ii–V lands.
- **L6.** `iiø7, borrowed` only when no dominant follows (today's guess case); the guess flag clears; reason
  "iiø7, borrowed from C minor: Locrian". ♭VII7/♭VI7/♭III7 print their own numeral in the text; "it returns to I"
  only when the next chord is I; "(subdominant minor)" for ♭VII7 and ♭VI7, not ♭III7. ♭IImaj7 is "borrowed from C
  Phrygian"; ♭III/♭VI/♭VIImaj7 "borrowed from C minor"; all "(its ♯11 is in the key)". Borrowed triads and sixth
  chords on those degrees get the same text with their own numeral.
- **L8.** The reason changes too: "extended ii–V: a side-step, its own key" (+ tensions when the target is minor).
- **L5.** The text uses the chord's own numeral and "its dominant" ("VI7sus4 before its dominant: a subdominant
  suspension"), so a sus on another degree reads correctly.
- **G6** (upper-case target from the key) deferred by the user: upper case keeps meaning major, the sheet's
  convention; `(V7/II)` and `SubV/III` keep their case.

## 2. Grammar changes (`functions.ts`), all additive

Every row: input → canonical text (what the sheet prints and what the file keeps when normalised). Add a test per
row to `functions.test.ts` and keep the round-trip test (every numeral the analyser gives the library reads back to
itself).

| Input accepted | Reads as | Source of the spelling |
| --- | --- | --- |
| `II-7`, `II–7` (hyphen or en dash), `I-6`, `VI-7` | `ii7`, `i6`, `vi7` | N&G, M&H, Levine |
| `I-(maj7)`, `I-Maj7` | `i(maj7)` | N&G p. 23 |
| `VII-7(♭5)`, `VII-7b5`, `♯IV-7(♭5)`, `VIIm7(b5)`, `VIIØ7` | `viiø7`, `♯ivø7` | N&G p. 23; M&H p. viii; Chediak |
| `V7(sus4)`, `Vsus4` | `V7sus4` | N&G p. 23 |
| `SubV7/II`, `subV/II`, `SubV/III` (with or without the 7, any case of "sub") | `subV7/II`, `subV7/III` (the target keeps its case: G6 deferred) | M&H pp. 70–71; Chediak |
| `I∆7` with U+2206 (what Option-J types on a Mac), as well as Δ U+0394 | `Imaj7` | Levine's glyph |
| `B♭: V7/ii` (glyph flat in the key prefix) | `B♭: V7/ii` | M&H p. 41 |
| `(V7/II)`, `(III7)` | `(V7/II)`, `(III7)` with `deceptive: true` | N&G pp. 52–55; M&H p. 48; Chediak vol. 1 pp. 105, 114 |

Semantics:

- **G6, upper-case target: deferred by the user.** Proposed: `V7/II` in C → target Dm7, the quality from the key's
  diatonic chord on that degree. Not adopted: it would read the sheet's own upper-case targets (A7 → D major prints
  `V7/II`, 185 library rows) as minor. Upper case keeps meaning major, lower case minor (`V7/II` → D major, `V7/ii` →
  Dm); `functionCandidates` keeps offering both readings where they differ.
- **G7, deceptive.** `StatedFunction` gains `deceptive: boolean`. `impliedTarget` and the scale derivation ignore
  it (the dominant's scale is still that of its expected target: N&G p. 45 "altered notes should not be changed to
  unaltered"); `fitError` does not demand the resolution; the sheet prints the parentheses.
- `chord_scales.json` aliases gain U+2206 wherever U+0394 is listed.

## 3. Order of work

1. Tests first, label by label, with the stream harness pattern from `functions.test.ts`; each asserts the numeral,
   the fn, and that the scale and rule id are unchanged.
2. `numerals.ts` and the fn/reason strings; update `RULES` summaries for D3, D8, s3, D6, M4, h2.
3. Grammar: `parseFunction`, `SUFFIXES`, `ascii()`, `fitError`, `functionCandidates`; the round-trip test.
4. `npm run analyse -- --all --force --save` and `make golden`; the only diffs are numerals, fn and reason text —
   assert in the PR that no scale changed (a script that diffs the fixture on `scale` only).
5. Docs: `docs/design.md` (numerals, the function grammar); the chart-functions spec's grammar section gains the
   new spellings; the functions-page spec's §1.1 table is generated, so nothing to edit there.

## 4. Out of scope

The scale changes the same research proposes (IV after its V7, blues IV7, °7, iii7): the rules spec. Context and
detection: the context spec. Upper-case numerals on the sheet: declined.

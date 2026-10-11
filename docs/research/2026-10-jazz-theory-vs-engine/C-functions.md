# C. Function vocabulary and notation against the sources (plan-analysis §6; functions.ts; numerals.ts)

Reviewer: research agent C. Date: 2026-10-10. Slice: Area C only (labels, spellings, glyphs; not the scale choices, which are A1 and A2).

## 0. Method, page convention, and what could not be checked

- Every page number is a printed BOOK page. Offsets, each checked against the printed footer in the text layer: N&G = PDF + 1; M&H = PDF − 12; Levine = PDF − 16 (front matter is roman); Chediak vol. 1 pp. 97–114 printed page = PDF page (footers seen on every page cited; the footer of p. 115 was not seen). Chediak vol. 2 is a two-up scan; p. 149 was imaged.
- Page images viewed for this slice: N&G pp. 42, 91, 127 (PDF 41, 90, 126); M&H p. viii (the ø line, at 400 dpi); Chediak vol. 2 pp. 148–149. Everything else is the text layer with the page taken from the chunk's footer.
- **What the engine prints was run, not guessed.** `numerals.ts`, `stream.ts` and `pitch.ts` are not in `/mnt/user-data/uploads` (only `rules.ts`, `keys.ts`, `functions.ts`, `index.ts` are); I took `numerals.ts` and `stream.ts` from the Project copy, stubbed `chart.ts`/`pitch.ts`, and ran `decide()`, `numeral()` and `parseFunction()` on hand-built streams. Harness: `scratchpad/c-harness/run.ts` (every "prints" claim below is its output; stream timing is one bar per chord, so the `bars ≥ 4` and blues/modal contexts were not exercised). `index.ts` imports a `./catalogue` that is in neither place, so it was not run.
- **Correction to the brief.** The brief says Levine writes minor numerals in lower case. He does not: his numerals are upper case throughout ("II-V-I", "I-VI-II-V", "III-VI-II-V", "the VI chord", "V of V"; pp. 15–26, 24), with quality in the chord symbol (D-7, B-7♭5, Bø). Lower-case minor numerals are the classical convention and, I believe, Terefenko's (see below, unverified).
- **Not verified.** Terefenko: no primary on disk; web search and fetch returned no page. Every Terefenko statement below is "practice (unsourced), from memory, unverified". Aebersold, Coker, Baker, Ligon, Bergonzi, Crook: not consulted for this slice (nothing on disk; searches returned only retailer pages).

## 1. What each source calls each function (the vocabulary map)

| Concept | N&G | M&H | Levine | Chediak | Engine (plan §6 / report `fn` / sheet numeral) |
|---|---|---|---|---|---|
| Primary dominant | "primary dominant", V7 (also V7/I, p. 42) | "primary dominant", V7 (p. 6) | V chord | dominante primário V7 (p. 98) | V7; fn "V7 of C"; prints `V7` |
| Dominant of a diatonic degree | "secondary dominant", `V7/II` (pp. 41–42) | "secondary dominant", `V7/II` (pp. 39–40) | not named; "V of V" only for dominant→dominant (p. 24) | dominante secundário `V7/II` (p. 99) | "V7/x"; prints `V7/ii` |
| Dominant→dominant series | "sequential dominants (also known as extended dominants)" (p. 51); classical "consecutive dominants" (p. 56) | "extended dominant: a string of three or more dominant chords that start on a strong harmonic stress point" (p. 49) | "V of V (of V …)" (pp. 24, 27) | dominantes estendidos, no numeral (p. 107) | "extended"; any dominant a fifth above another dominant; prints own degree (`II7`) |
| Tritone substitute | "substitute dominant", `subV7`, `subV7/II` (pp. 57–58) | "substitute dominant, or simply a subV" (p. 63); `subV7/II`, `subV/III` | "tritone substitution" (glossary p. xiv; ch. 13) | SubV7, SubV7 secundário (p. 98) | subV7; prints `subV7`, `subV7/ii` |
| Dominant of a borrowed chord | `V7/♭III`, `V7/♭VII` named in the minor-key list (p. 91) | `V7/♭VI` named (p. 124) | none | **dominante auxiliar** `V7/♭III`, `V7/♭VI` (p. 99) | only reached in a minor key; in a major key the cadence opens a key area (§2.4) |
| Related ii | "related II-7"; bracket, no numeral (pp. 36, 67) | "related II"; bracket, "receives no Roman numeral" (p. 51) | "II-V" (no special term) | **II cadencial** primário / secundário / auxiliar; "dispensável o número romano" (pp. 100–101) | "related ii"; prints `ii7/IV` |
| Chord that is diatonic and a related ii | "dual function"; dual analysis (pp. 47, 67) | "dual function" (p. 53) | none | função dupla: use the degree numeral plus the bracket (p. 102) | not printed: prints `ii7/ii` |
| ii–V a side-step away | related II-7 of a sequential dominant (p. 68); Dorian–Mixolydian (pp. 72–73) | non-diatonic related II (pp. 52–54) | tritone-sub II–V (ch. 13) | II V's estendidos (p. 107) | "passing ii–V" (engine's own term) |
| Dominant sound, no dominant function | "dominant chords with special functions" (ch. 7, p. 122); table p. 127 | "special function dominants or color chords"; "non-dominant dominants" (Appx B, p. 236) | none | dominantes de função especial (p. 115); "acordes de função especial, não dominante" (p. 112) | "non-resolving" (§6); fn "VII7 in C, not resolving" |
| V7 that does not go to I | "deceptive resolution"; parentheses mark changed function (pp. 33–35, 53) | "deceptive resolution" (p. 48) | "deceptive cadence": any V not resolving down a fifth (p. xi, p. 325) | resolução deceptiva; degree in parentheses (pp. 104–105, 114) | folded into "non-resolving" |
| ♭VII7 → I | "♭VII7 … Lydian♭7 … dominant without dominant function" (p. 80); table: subV7/VI nondominant more common (p. 127) | "back door cadence" (p. 124); "subdominant minor modal interchange chord" (p. 236) | none | ♭VII7, função de subdominante menor (p. 112) | "back door ♭VII7" (M&H's term) |
| Borrowed chords | "modal interchange", "subdominant minor", "tonic minor" (pp. 74–75, 128) | "modal interchange" (MI), SDM, TM; analysis by interval from tonic + quality (pp. 118–120, 130) | none | acorde de empréstimo modal (AEM), subdominante menor (p. 97) | "borrowed" (minor chords only, m8); major MI chords are "a non-tonic major chord" |
| Diminished by use | ascending, descending, auxiliary; "passing" or "approaching"; "leading tone chords" (pp. 110–113) | ascending (secondary dominant), passing (descending chromatic approach), auxiliary (pp. 148–159) | "disguised V7♭9" (p. 336) | ascendente, descendente, auxiliar, de passagem (pp. 102–103) | "vii°7 of X", "passing", "auxiliary" |
| Sus | V7(sus4) dominant or subdominant by stress (p. 38) | V7sus4 subdominant before V7, dominant before I (pp. 6–7) | "sus chords function as V chords" (p. 44) | V⁴ (7sus4) may replace the II cadencial (p. 105) | "V7sus4 of X", "static sus" |
| Key of the moment | — (modulation, ch. 10) | tonicization; `B♭: IMaj7` prefix (pp. 41, 100) | — | tonalidade secundária ou do momento (p. 106) | key area; `B♭ major` label; `Bb: V7/ii` input prefix |

## 2. Findings table

Verdicts: AGREE / DIFFER / SPLIT / UNDERSPECIFIED, as in the brief. "Prints" = the Changes-sheet numeral from the harness.

| Case | Engine (label, and what the sheet prints) | Berklee | Levine | Others | Verdict | Note |
|---|---|---|---|---|---|---|
| **V7**, primary | `V7`; fn "V7 of C" | N&G p. 41, M&H p. 6 | p. 24 ("V chord") | Chediak p. 98 | AGREE | The fn "V7/I in C (the I never arrives)" for a deceptive V7 is N&G p. 42's own usage ("same analysis … for the primary dominant"). |
| **V7/x** secondary | `V7/ii`, `V7/V`, `V7/IV` | N&G p. 42 ("a slash is used to mean 'of'"; "quality of the target chord is not necessary"); M&H pp. 39–40 | not named | Chediak p. 99 | AGREE (slash, concept) / DIFFER (case, next row) | |
| **V7/x** target case | lower case when the target is minor/ø/°: `V7/ii`, `V7/vi`, `ii7/V` | upper case always: `V7/II`, `V7/VI` (N&G p. 42 image; M&H p. 40, p. 52 figs. 2.6–2.10) | no slash form | Chediak upper case even for a minor target: `V7/VI` over a Bm chord (vol. 2 p. 149, image); `V7/III`, `SubV7/VI` (vol. 1 pp. 98–99) | DIFFER | No primary on disk writes a lower-case target (searched all five texts; the two Chediak OCR hits "V7/vi" are small caps, checked on the image). Lower case is the classical convention (practice, unsourced; Terefenko unverified). The engine's lower case carries information the grammar uses (§3 G6). |
| **The numeral itself** | lower case for minor, ø, °: `ii7`, `iiø7`, `vii°7`, `♯iv°7` | upper case only, deliberately: "contrary to traditional practice … to avoid misunderstandings like V for v (especially when handwritten)" (N&G p. 24); "A II-7 chord will be the same as a ii-7 chord" (N&G p. 31); M&H passim (`II-7`, `VII-7♭5`, `VI-7`, `IVMaj7`) | upper case ("II-V-I", "VII chord"; pp. 15–29) | Chediak upper case + quality: `IIm7`, `VIIm7(♭5)`, `IVm6` (pp. 99, 102) | DIFFER | The sheet's chord symbols already follow Berklee (`chord.ts`: minor as en dash, `Maj7`, alterations in parentheses: `B–7(♭5)`), so one sheet prints two spelling systems (Prop. V9). |
| **Extended** (term) | "extended" | "extended dominant" (M&H p. 49); "sequential (also known as extended)" (N&G p. 51) | "V of V" | "estendido" (p. 107) | AGREE | |
| **Extended** (definition) | any dominant that resolves down a fifth to another dominant (D3) | M&H: three or more, starting on a strong stress (p. 49). N&G: nondiatonic dominants resolving to other nondiatonic chords (p. 51); a dominant into the diatonic V7 is a secondary dominant, V7/V (p. 52 "in this key V7/V is C7") | "V of V" = any dominant→dominant (p. 24) | Chediak: any dominant resolved by another (p. 107, ex. 1 is D7 G7 C) | SPLIT | The engine takes Levine's and Chediak's width. Under Berklee `D7 G7 | C` is V7/V → V7, not an extended string. |
| **Extended** (sheet label) | prints own degree: D7 in `D7 G7 C` → `II7`; Rhythm bridge `III7 VI7 II7 V7`; into minor `VII7 III7 VI7 II7 V7` (harness) | N&G p. 52: use "only an arrow … to call each a V7/V would be inaccurate"; head of a chain on a strong stress is "(III7)", in parentheses, p. 53; M&H p. 50: "dispense with [numerals] when we encounter an extended dominant series. The arrow suffices"; N&G p. 54: C7 may be heard as V7/V | — | Chediak p. 107, p. 109: "os dominantes estendidos não levam o número romano" | DIFFER | `II7` is the label N&G p. 127 reserves for a *non-dominant* II7. For a plain V7/V (`D7 G7 | C`, harness: fn "extended dominant (V7 of G7)", numeral `II7`) it is wrong under every source; the scale (Mixolydian) is the same either way. Prop. V1. |
| **subV7** | `subV7` (target = tonic), `subV7/ii`, `subV7/V` | N&G pp. 57–58; M&H pp. 63–73 (`subV7/II`, `subV/III`) | "tritone substitution" | Chediak p. 98 | AGREE | Genuine subV's are I, II, IV, V; subV/III and subV/VI "não são genuínos" (Chediak p. 114; N&G p. 59; M&H p. 70). The engine's test is the actual resolution, which is the sources' own test. |
| **♭VI7 as subV7/V** | `A♭7 → G7` prints `subV7/V` (harness); `A♭7 → Cmaj7` prints `♭VI7`, fn "chromatic dominant" | N&G p. 82 ("treated as an altered subdominant minor chord or Blues chord if it progresses cadentially … if … secondary substitute dominant, it will be subV7/V. Usually the distinction is based on context"); M&H p. 144 | — | Chediak p. 113 (♭VI7 ~ II7 ~ ♯IVm7(♭5), same tritone) | AGREE (not missing, as the brief feared) | The label gap is the *cadential* ♭VI7, called "chromatic dominant" (row below). |
| **V7 of the chord before** | `V7` or `V7/x`; fn "V7 of the Gm7 before it" | none | none | none | UNDERSPECIFIED | Engine's own label; the plan's §10.3 judgement. No source names it. |
| **Cadence to a new key** | key area; the V7 prints `V7` in the new key | M&H writes the key before a colon: `B♭: IMaj7` (p. 41) | — | "tonalidade do momento" (p. 106) | AGREE | Area D owns the boundary. The `Bb: V7/ii` input prefix matches M&H p. 41. |
| **I7 / IV7 of a blues** | `I7`, `IV7` (D5) | N&G p. 122; M&H pp. 125, 136, Appx B p. 236 ("IV7, the blues subdominant") | blues chapter (no function name) | Chediak p. 112 ("função blues") | AGREE | |
| **Back door ♭VII7 → I** | `♭VII7`, preceded by `iv7`; fn "back door bVII7 to Cmaj7" | M&H p. 124 ("back door cadence"), p. 236; N&G p. 80 (relates IV-7 ♭VII7, Dorian–Mixolydian), no name | none | Chediak p. 112 (♭VII7, "subdominante menor", up a tone) | AGREE | The term is M&H's alone on disk; N&G, Levine, Chediak do not use it. |
| **Back door to a non-tonic** | Stella `B♭m7 E♭7 | Fmaj7` in B♭ prints `iv7/V`, `♭VII7/V` (harness) | no label for this; M&H p. 125 would call a bare E♭7 an `IV7` of B♭ (subdominant with dominant colour) | — | — | UNDERSPECIFIED | `♭VII7/V` is in no source. Plan §10.10 decided the scale; the *label* was not decided. |
| **♭VII7 not into I, ♭VI7, ♭III7** | any of them not resolving and not diatonic: fn "chromatic dominant" (D6, guess); prints `♭VII7`, `♭VI7` (harness: `B♭7 → Fmaj7` and `A♭7 → Cmaj7`) | the most standard non-dominant dominants: "♭VII7 is a subdominant minor modal interchange chord" (M&H p. 236; p. 123 "SUBDOMINANT, DOMINANT, OR ?"); N&G pp. 80, 82, 123–124; table p. 127 | — | Chediak pp. 112–113, 115 | DIFFER (label) | The numeral is right. "Chromatic dominant … its own key" (rules.ts D6 reason) names the chord as nothing in particular; Berklee names it by its source (subdominant minor / blues). Prop. V6. Scale (Lydian Dominant) is AGREE (A1). |
| **II7 / III7 / VI7 / VII7 not resolving** | own degree, e.g. `VII7`, fn "VII7 in C, not resolving" | N&G table p. 127 prints exactly these own-degree labels; pp. 124–126 | — | Chediak pp. 112–115 (VII7 função especial vs V7/III by duration and a preceding II) | AGREE | The engine's related-ii test (F♯ø7 before B7 → `V7/iii`) is Chediak's own criterion (p. 112). |
| **Deceptive vs non-resolving** | one label, "non-resolving" (plan §6); `V7 → ♭VI` prints `V7`, fn "V7 in C, not resolving" | "deceptive resolution": N&G p. 35 (no arrow, "Roman numerals without an arrow", p. 33); M&H pp. 47–48, parentheses `(V7/II)`; Appx B calls a no-expectation dominant a "special function dominant" | "deceptive cadence" = any V not resolving down a fifth (p. xi, p. 325): wider than Berklee's, includes the back door and subV-type moves | Chediak: parentheses around the expected function (pp. 105, 114) | SPLIT | Three different things share the engine's word: a V that goes elsewhere (deceptive), a dominant with no expectation (special function), and a half-step resolution (Levine's "deceptive", the engine's subV7). |
| **Related ii** (m4, h2) | `ii7/IV`, `iiø7/vi`, `iv7` (back door) | bracket only, no numeral (N&G pp. 36, 67; M&H p. 51; Chediak p. 101) | none | — | DIFFER (notation) | A one-line sheet cannot draw the bracket; `ii7/IV` is clear. Keep, but say in the help that Berklee brackets (Prop. V9 note). |
| **Dual function** | a diatonic minor/ø chord before its V prints the ii reading: `Em7 | A7 | Dm7` → Em7 `ii7/ii`; `Am7 | D7` → Am7 `ii7/V`; `Bm7♭5 | E7 | Am7` → `iiø7/vi` (harness) | prints the degree and brackets: "III-7 … nominal tonic function … secondary-subdominant" (M&H p. 53); "VII-7♭5" diatonic related II of V7/VI (M&H p. 52; N&G p. 46–47) | — | Chediak p. 102: "usa-se a cifra que corresponde ao grau e o colchete" | DIFFER | The diatonic identity (iii7, vi7, viiø7) is lost on the sheet; plan §6 lists `viiø7` as a label but the numeral never prints it before a V. Dorian for the pair is A2 (m4, AGREE). Prop. V2. |
| **Passing ii–V** | "passing ii–V" (§7.5); prints `ii7/II`, `V7/II` (harness, Gm: `Bm7 E7`) | not a Berklee term; related II of a sequential dominant (N&G p. 68) | — | Chediak "II V's estendidos" (p. 107) | UNDERSPECIFIED | Engine-coined; "extended ii–V" is Chediak's. Prop. V10. |
| **V7/♭III, V7/♭VI (dominant of a borrowed chord)** | in a minor key prints `V7/♭III`; in a major key the cadence opens a key area: `C: B♭7 | E♭maj7 | E♭7 | A♭maj7` prints `V7` (E♭), `V7/IV` (E♭) (harness) | M&H p. 124 ("Is E♭7 V7/♭VI in C minor or subV7/II in C major?"); N&G p. 91 (`V7/♭III`, `V7/♭VII`); M&H p. 118: modal interchange "does not cause a change of key" | — | Chediak p. 99: *dominante auxiliar*, `V7/♭III`, `V7/♭VI`, with AEM targets (his example is the harness case) | SPLIT | Tonicization (the engine) vs auxiliary dominant (Chediak, M&H). The grammar already accepts `V7/♭III`; the analyser cannot produce it in a major key. Depends on Area D. Prop. V7. |
| **ø7: diatonic VII-7♭5** | `viiø7` (own degree) | `VII-7♭5`; "not an alternate dominant" (M&H p. 8); related II of V7/VI (M&H p. 52) | `Bø` (p. 29) | Chediak `VIIm7(♭5)` (p. 99) | AGREE (function) | See glyph row. |
| **ø7: ♯ivø7** | before a V a fourth up: `iiø7/iii` (harness); otherwise `♯ivø7`, fn "#ivø7 in C" (guess) | `♯IV-7(♭5)`: related II of V7/III, ♭5 is the tonic (N&G p. 70); modal interchange from Lydian, Locrian, a common deceptive resolution of V7 (N&G pp. 119–121; M&H pp. 158–159) | — | Chediak `♯IVm7(♭5)` "II cadencial secundário do IIIm" or "subdominante alterado" (p. 113) | AGREE (numeral) / UNDERSPECIFIED (fn) | The report fn gives no reason for the unattached ♯ivø7; Berklee's is "Lydian interchange chord; deceptive resolution of V7". |
| **ø7: iiø7 of a minor ii–V** | `iiø7` | `II-7♭5`; "not considered a half diminished chord, because it is an altered minor 7th" (N&G p. 37); "almost exclusively" with V7 (M&H p. 123) | `Dø` (p. 76) | Chediak p. 101 | AGREE | |
| **°7: ascending (leading-tone)** | fn "vii°7 of Dm7"; prints `♭ii°7` for C♯°7, `♭vi°7` for G♯°7 (harness) | "ascending diminished … acts as VII°7 of the target", named by root address: `♯I°7`, `♯II°7`, `♯IV°7`, `♯V°7` (M&H pp. 148–152; N&G pp. 110, 113 "leading tone chords") | "disguised V7♭9" (p. 336) | Chediak: diminuto ascendente, função dominante (p. 102) | DIFFER (numeral) | `roman()` has one flat-side table, so C♯°7 and G♯°7 print flat and collide with the *descending* `♭III°7`/`♭VI°7`. Berklee spells ascending chords with sharps, descending with flats; direction is the information. Prop. V4. |
| **°7: ♯IV°7 → V7** | fn "passing diminished" (guess); prints `♯iv°7` | N&G p. 113: expected resolution to the primary dominant (ascending); M&H p. 152: "does not perform the same function as V7/V"; moves to I/5 | — | Chediak p. 112 inversion | DIFFER (label) | `vii°7 of` only fires when the target is a major or minor chord, so a dominant target falls to "passing". |
| **°7: descending ♭III°7, ♭VI°7** | fn "passing diminished" (guess); prints `♭iii°7`, `♭vi°7` | M&H p. 148 "passing diminished", pp. 155–158; N&G pp. 112–113 "descending", "passing … if the preparatory chord is present" | p. 87 (Wave) | Chediak "diminuto de passagem descendente" (p. 103) | AGREE | Marked [guess] although it is the textbook case; the guess flag should clear when the next chord is a half step below. |
| **°7: auxiliary** | only when the chord before *and* after are on the same root as the °7 (`C C°7 C`); `D-7 G7 | C°7 | C6` and `C | G° | G7` print "passing diminished" (harness) | M&H p. 159, fig. 7.30: I°7 "delaying final resolution" after `G7`; fig. 7.32 `G7 G°7 G7`; N&G p. 111 (same chord before and after) | — | Chediak p. 103: auxiliary = "quando resolve em acorde com o mesmo baixo": only the *next* chord matters | DIFFER (definition) | Berklee's first listed use of I°7 (M&H p. 159) and Chediak's example 2 are outside the engine's rule. Prop. V3. |
| **°7: reason text** | "the rootless V7b9 of the next chord" for all three | true for ascending only: descending and auxiliary "do not contain the secondary dominant's tritone … derived from chromatic resolution" (N&G p. 114) | — | Chediak p. 102 ("descendente não é de função dominante") | DIFFER | Principle 6: the reason is false for two of the three labels. Overlaps A2's C1 (which rewrites the d1 reason); coordinate. |
| **Sus resolving** | fn "V7sus4 of Cmaj7"; prints `V7sus` | M&H p. 7 (before I: dominant); N&G p. 38 (weak stress: dominant) | p. 44 | Chediak p. 105 | AGREE (label) / DIFFER (print) | See glyph row. |
| **Sus before V7** | `Dm7 | G7sus4 | G7`: fn "static sus" (rule s3); prints `V7sus` (harness) | "When V7sus4 precedes V7, it sounds subdominant: a suspension before the true dominant" (M&H p. 6, fig. 1.8); N&G p. 38 (strong stress → subdominant) | p. 45 (a sus is "a II-V progression contained in one chord") | Chediak p. 105 (V⁴ replaces the II cadencial) | DIFFER (label) | Not "static": it is the ii of the ii–V in one chord. Scale unchanged. Prop. V5. |
| **Major I, IV** | `Imaj7`, `IVmaj7` | N&G p. 33; M&H p. 8 | | | AGREE | |
| **Major ♭III, ♭VI, ♭VII, ♭II (borrowed)** | `♭IIImaj7`, `♭VImaj7`, `♭VIImaj7`, `♭IImaj7`; rule M4 fn "bVI in C", reason "a non-tonic major chord: Lydian" | MI chords with SDM/TM tags: "described by their intervallic distance from the tonic and by their chord quality … function as subdominant minor (SDM) or tonic minor (TM)" (M&H p. 130; fig. 5.35); N&G pp. 74–75, 84 (summary), 128–133; ♭IIMaj7 "the Dark Lord" (M&H p. 126) | none (no modal-interchange vocabulary anywhere in Levine) | Chediak AEM (p. 97) | AGREE (numeral) / DIFFER (tag) | The sheet prints the right numeral; the report never says "modal interchange", "subdominant minor", "tonic minor". Prop. V6. |
| **Minor i, ii, iii, iv, v, vi (diatonic)** | `i7`, `ii7`, `iii7`, `iv7`, `v7`, `vi7`; m4–m9 | N&G pp. 31–33, 87–91; M&H pp. 21–25, 98 | pp. 25–26 | Chediak p. 94 | AGREE (function) / DIFFER (case) | |
| **Minor borrowed (iv7, i7, v7 in major)** | fn "borrowed iv in C" (m8, guess) | SDM `IV-7`, TM `I-7`, `V-7` "minor dominant" (M&H pp. 119–127); N&G p. 76 (`V-7` normally a related II of V7/IV) | — | Chediak AEM IVm7 (p. 97) | AGREE | The only place the engine uses "borrowed". |
| **Chromatic** (no function) | "chromatic" (§6), fn "chromatic dominant" or none | "non-functional", constant structure (N&G p. 162; M&H ch. 10) | — | — | UNDERSPECIFIED | Engine-coined catch-all; acceptable if it is not applied to ♭VII7/♭VI7 (above). |

## 3. The grammar (functions.ts) against the sources: spellings accepted and rejected

Run through `parseFunction()` (harness, `parse` mode). "Reads as" is the sheet's canonical text.

| Spelling | Source | Engine | Verdict |
|---|---|---|---|
| `V7/ii` | classical (unsourced) | accepted; target minor | AGREE (internally) |
| `V7/II` | N&G p. 42, M&H p. 40, Chediak p. 99 | accepted; **target read as major (D major)** though Berklee means Dm7 | DIFFER (silent) |
| `V7/♭III`, `V7/bIII`, `V7/♭VI` | N&G p. 91, M&H p. 124, Chediak p. 99 | accepted | AGREE |
| `subV7`, `subV7/II`, `subV7/♭II` | N&G p. 58, M&H, Chediak | accepted | AGREE |
| `SubV7`, `SubV7/II` | M&H headings ("SubV's"), Chediak (pp. 98–101) | **rejected** ("isn't a function") | DIFFER |
| `subV/II`, `subV/III` (no 7) | M&H pp. 70–71 | **rejected** with "sub only goes on a dominant (subV7)" | DIFFER |
| `V/V`, `V/II` (no 7) | M&H prose | accepted as a *major* chord; fails `fitError` against a dominant | harmless |
| `II-7`, `IV-7`, `VI-7`, `I-7`, `III-7`, `V-7`, `I-6` | N&G, M&H, Levine | **rejected** | DIFFER |
| `VII-7♭5`, `VII-7(♭5)`, `♯IV-7(♭5)`, `II-7(♭5)` | N&G p. 23, M&H p. viii | **rejected** | DIFFER |
| `VIIm7(b5)` | Chediak p. 99 | **rejected** (`VIIm7b5` accepted) | DIFFER |
| `I-(maj7)`, `I-Maj7` | N&G p. 23 | **rejected** (`i(maj7)`, `mMaj7` accepted) | DIFFER |
| `IIm7`, `iim7`, `IVm6`-style | Chediak | accepted; reads as `ii7` | AGREE |
| `viiø7`, `VIIø7`, `VIIm7b5` | Levine | accepted; reads as `viiø7` | AGREE |
| `IMaj7`, `Imaj7`, `IM7`, `IΔ7` (U+0394) | M&H, N&G | accepted; reads as `Imaj7` | AGREE |
| `I∆7` (U+2206 INCREMENT) | Levine's glyph, and what Option-J types on a Mac | **rejected**: `ascii()` maps only U+0394 | DIFFER (bug-like; same gap in `chord_scales.json` aliases, which list U+0394 only) |
| `♯I°7`, `♯IV°7`, `VII°7/VI` | M&H pp. 148–152 | accepted; reads as `♯i°7`, `♯iv°7`, `vii°7/VI` (target major) | AGREE (case lost) |
| `V7sus4`, `V7sus`, `Vsus` | M&H p. 6, Levine | accepted; reads as `V7sus` | AGREE (print differs) |
| `V7(sus4)` | N&G p. 23 ("preferred") | **rejected**; `Vsus4` also rejected | DIFFER |
| `(V7/II)`, `(III7)` | N&G pp. 52–53, M&H p. 48, Chediak pp. 105, 114: parentheses mark a function the chord does not fulfil | **rejected** | DIFFER (no way to state a deceptive resolution) |
| `B♭: V7/ii` (glyph flat in the key prefix) | M&H p. 41 | **rejected** (`Bb:` accepted); the sheet's own key label prints `B♭` | DIFFER (round trip) |
| `V7alt`, `V7(♭9)` | N&G | rejected | fine: a function names a degree, not tensions |
| `related ii`, `V7 of V` | engine report fn | rejected | fine |

## 4. Prose where a row needs it

**4.1 One sheet, two spelling systems.** `chord.ts` (`qualityTokens`) writes a minor chord as an en dash (`D–7`), `m7b5` as `B–7(♭5)`, and `Maj7` with a capital M: that is the Berklee chord-symbol set (N&G p. 23: "C-7(b5) is universally understood and preferred"; M&H p. viii). The numeral under it is `iiø7`, `ii7`, `vii°7`. So the sheet shows `B–7(♭5)` over `iiø7`. Both Berklee books argue against the ø: N&G p. 23 ("almost universally recognized but the argument against it is based on the function of the chord as a minor 7th with altered 5th and not a diminished 7th chord with an altered 7th"; p. 37 repeats it for the minor ii–V), M&H p. viii ("Sometimes called Cø7; this symbol is not preferred", image-checked). Levine uses it ("most musicians today notate it as Bø", p. 29; `Aø` p. 68) but never with a 7. Chediak writes `m7(♭5)`. No primary writes `ø7`. The engine's `ø7` is a compromise none of the sources prints; it is understood by everyone.

**4.2 Why Berklee uses upper case, and what the engine's lower case costs.** N&G p. 24 gives the reason (handwriting: V against v) and p. 31 gives the logic (quality is already in the symbol, so the numeral carries degree only). The engine's lower case puts quality into the numeral, which then forces `V7/ii` (the target's quality), makes `II7` and `ii7` different chords by case alone, and needs the rule "a major quality on a lower-case numeral" error (`majorOnLowerCase`). None of this is wrong, but it is an extra convention for a Berklee-trained reader. The lower-case target is the one place where the grammar *needs* case: `D7` can be V7/V (to G) or V7/v (to Gm), and `functionCandidates` offers both. In Berklee spelling the target's quality is read from the key (diatonic) or from the chord that follows.

**4.3 "Extended" has three definitions.** M&H p. 49: three or more, starting on a strong stress. N&G p. 51: nondiatonic dominants resolving to nondiatonic chords, "also known as extended", with the head analysed in parentheses and each later link unlabelled (pp. 52–55); a dominant into the diatonic V7 is V7/V. Levine p. 24 and Chediak p. 107: any dominant resolved by another. The engine's D3 uses the widest and labels it with the narrowest's term. The scale is not at stake (N&G p. 54: "Mixolydian … whether it is diatonic or not"; V7/V is Mixolydian anyway), only what the sheet prints.

**4.4 The borrowed-chord dominant.** Chediak p. 99 is explicit: dominants of modal-interchange chords are *dominantes auxiliares* (`V7/♭III`, `V7/♭VI`), and p. 100 gives the matching *II cadencial auxiliar*. M&H p. 118 says modal interchange "does not cause a change of key". The engine's §5.3 treats `B♭7 → E♭maj7` in C as a cadence into a non-diatonic chord and opens an E♭ area (harness). Whether that is right is Area D's question (Terefenko's tonicization view would support the engine; unverified); for vocabulary, the engine has no way to *say* the Berklee/Chediak reading except by an author's stated function.

**4.5 Levine and the words the engine uses.** Levine has no "secondary dominant", "related ii", "modal interchange", "back door" or "borrowed". His terms are "V of V", "II-V", "tritone substitution", "deceptive cadence" (any V not resolving down a fifth, p. xi), "tonic minor chord", "sus chord". So Area C's vocabulary can only be Berklee + Chediak; Levine disagrees only on "deceptive".

## 5. Proposed changes

Labels only unless stated; none changes a principle. "Level": all of these are text and belong at every level.

**V1. D3 / `numeral()` branch 3: dominant → dominant.**
- Change: a dominant that resolves into the key's own V7 prints `V7/V`; earlier links of a chain print no numeral (an arrow, or `→`); the report says "extended dominant" only for a chain of three or more, or one that reaches a non-diatonic chord. Scale unchanged.
- Reasons (player's words): `V7/V` link: "V7 of V7: the dominant of the dominant, Mixolydian"; chain link: "extended dominant: each one falls a fifth into the next".
- Test: `key: C`, rows `Cmaj7 | D7 | G7 | Cmaj7`: D7 prints `V7/V` (now `II7`). `key: Bb`, rows `Bbmaj7 | D7 | G7 | C7 | F7 | Bbmaj7`: D7, G7 unlabelled, C7 `V7/V`, F7 `V7` (now `III7 VI7 II7 V7`); scales stay Mixolydian.
- Sources: N&G pp. 51–55, 127; M&H pp. 49–50; Chediak pp. 107, 109.

**V2. `numeral()` related-ii branch: dual function.**
- Change: when the minor/ø chord is also diatonic in the key, print its degree (`iii7`, `vi7`, `viiø7`), not `ii7/x`; the report fn keeps "ii of the ii–V to …". Scale (Dorian/Locrian, m4/h2) unchanged.
- Reason: unchanged ("ii of the ii–V to D minor"); add to fn: "also iii of C".
- Test: `key: C`: `Cmaj7 | Em7 | A7 | Dm7 | G7 | Cmaj7` → Em7 `iii7`; `Bm7♭5 | E7 | Am7` → `viiø7`; non-diatonic `Gm7 | C7 | Fmaj7` still `ii7/IV`.
- Sources: M&H pp. 52–53; N&G pp. 46–47, 67; Chediak p. 102.

**V3. d1: auxiliary diminished.**
- Change: auxiliary = the next chord is on the °7's own root (Chediak p. 103), whatever precedes it; the previous chord does not matter (M&H p. 159 fig. 7.30 `D-7 G7 | C°7 | C6`; fig. 7.32 `G7 G°7 G7`).
- Reason: "auxiliary diminished: it embellishes the tonic and returns to it" (not "the rootless V7♭9"; N&G p. 114).
- Test: `key: C`, rows `Dm7 | G7 | Cdim7 | C6`: C°7 label "auxiliary diminished" (now "passing", guess). Also `Cmaj7 | Gdim7 | G7`.
- Sources: M&H p. 159; Chediak p. 103; N&G pp. 111, 114. Coordinate with A2 C1 (reason strings of d1).

**V4. `roman()`/`ownNumeral`: accidental by direction for a °7.**
- Change: an ascending (leading-tone) °7 prints sharp (`♯I°7`, `♯II°7`, `♯IV°7`, `♯V°7`); descending and auxiliary print as now (`♭III°7`, `♭VI°7`, `I°7`).
- Reason: unchanged ("vii°7 of Dm7").
- Test: `key: C`, `Cmaj7 | C#dim7 | Dm7` prints `♯I°7` (now `♭ii°7`); `Em7 | Ebdim7 | Dm7` prints `♭III°7`.
- Sources: M&H pp. 148–152; N&G pp. 110, 113.

**V5. s3: sus before a same-root dominant.**
- Change: `G7sus4` followed by `G7` is "V7sus4 (subdominant), before the V7"; the "static sus" label stays for a modal or long sus. Scale Mixolydian (A1 Proposal 2 unaffected).
- Reason: "V7sus4 before the V7: a subdominant suspension, Mixolydian".
- Test: `key: C`, `Cmaj7 | Dm7 | G7sus4 | G7 | Cmaj7`: G7sus4 fn as above (now "static sus").
- Sources: M&H p. 6 fig. 1.8; N&G p. 38; Levine p. 45.

**V6. D6 and M4/m8/h2: name the modal-interchange chords.**
- Change: a non-resolving ♭VII7, ♭VI7 or ♭III7 in a major key is "♭VII7: a subdominant minor (modal interchange) dominant" instead of "chromatic dominant"; borrowed major and ø chords (♭VImaj7, ♭IImaj7, iiø7 in major) get "modal interchange (subdominant minor)" / "(tonic minor)" in the fn. Scales unchanged.
- Reason strings: "♭VII7 from the parallel minor: Lydian Dominant, it returns to I" ; "♭VImaj7, borrowed from C minor: Lydian (its ♯11 is in the key)".
- Test: `key: C`, `Cmaj7 | Bb7 | Fmaj7` → Bb7 fn "♭VII7 … modal interchange" and no "guess" flag; `Cmaj7 | Ab7 | Cmaj7` likewise (♭VI7, N&G p. 82).
- Sources: M&H pp. 123, 130, 236–238; N&G pp. 74–75, 80, 82, 123; Chediak pp. 97, 112–113.

**V7. §5.3 / `numeral()`: dominant of a borrowed chord, label only.**
- Change: when a V7 targets a modal-interchange chord (♭III, ♭VI, ♭VII, ♭II major) that is left within two bars and the home key returns, print `V7/♭III` in the home key. Depends on Area D's boundary decision, so this is conditional.
- Reason: "V7/♭III: the dominant of a borrowed chord; the key stays C".
- Test: `key: C`, `Cmaj7 | Bb7 | Ebmaj7 | Eb7 | Abmaj7 | Dm7 | G7 | Cmaj7` (Chediak p. 99): B♭7 `V7/♭III`, E♭7 `V7/♭VI`; today `V7`, `V7/IV` in E♭.
- Sources: Chediak pp. 99–100; M&H pp. 118, 124; N&G p. 91.

**V8. Print `V7sus4`.** `SUFFIXES['7sus4']` and `numerals.ts` `SUFFIX` write `7sus`; M&H writes `V7sus4` (pp. 6–7, 24), N&G `V7(sus4)` (p. 23), and "sus" alone is Levine's. Print `V7sus4`; keep accepting `7sus`, `sus`. Test: `G7sus4 | Cmaj7`, `key: C` → `V7sus4`.

**V9. Spelling system for the numerals (a decision for the lead; it touches `StatedFunction.text`, `SUFFIXES`, and the round-trip test).**
- What the sheet should print, if it follows its own chord symbols: upper-case numerals, quality from the symbol, accidental before the numeral, `–7` (en dash, as `chord.ts` prints), `–7(♭5)`, `°7`, `maj7`, `7sus4`, upper-case slash target: `II–7`, `V7/II`, `subV7/II`, `VII–7(♭5)`, `♯IV–7(♭5)`, `♯I°7`, `♭VII7`, `IVmaj7`, `I–(maj7)`. Citations: N&G pp. 18, 23–24, 31; M&H pp. vii–ix, 8, 40; Levine pp. 15–29; Chediak pp. 99–102.
- If the lead keeps the lower-case set (`ii7`, `iiø7`, `vii°7`, `V7/ii`), the sheet should at least print the half-diminished in the form its own chord symbol uses, or the chord symbol should print `Bø` (Levine p. 29). Either way the two should come from one source.
- Grammar, either way: see G1–G7. The input must stay lenient; only the canonical text changes.
- Test (if adopted): every numeral the analyser gives the library round-trips (`functions.test.ts` already checks this) in the new spelling; `II–7/V` reads back to `II–7/V`.

**V10. "passing ii–V" → "extended ii–V" in the report** (Chediak p. 107; N&G p. 68). Reason: "ii–V of E: a side-step, E7 not in the key; its own notes". Test: Gm `Gm7 | Bm7 | E7 | Bbm7 | Eb7 | Am7♭5 | D7 | Gm7`: fn "extended ii–V", numerals unchanged.

**Grammar changes (functions.ts), all additive:**

- **G1.** Accept `-` and `–` as minor: `II-7`, `II–7`, `I-6`, `I-(maj7)`, `I-Maj7`. Test: `parseFunction('II-7')` reads `ii7` (or `II–7` under V9).
- **G2.** Accept `-7(♭5)`, `-7♭5`, `m7(♭5)`, `m7b5` with any numeral case → halfdim. Test: `parseFunction('VII-7(♭5)')`, `♯IV-7(♭5)`, `VIIm7(b5)` all read as ø7.
- **G3.** Accept `7(sus4)`, `sus4`, `Vsus4`. Test: `parseFunction('V7(sus4)')`.
- **G4.** Accept `Sub`/`sub`, with or without the 7, before a dominant numeral: `SubV7/II`, `subV/II`. Test: `parseFunction('subV/III')` reads `subV7/III`.
- **G5.** Accept U+2206 (∆) wherever U+0394 is accepted, in `ascii()` and in `chord_scales.json` aliases; accept `Ø`. Test: `parseFunction('I∆7')`.
- **G6.** Upper-case target = "quality from the key": `V7/II` in C means Dm7 (diatonic II is minor), `V7/V` means G; lower-case target keeps forcing minor. Test: `V7/II` in C yields `target.minor === true`; `V7/V` yields false; `V7/ii` unchanged.
- **G7.** Accept a parenthesised function, `(V7/II)`, `(III7)`, as "this chord's expected resolution does not happen" (N&G pp. 52–55; M&H p. 48; Chediak pp. 105, 114); store a `deceptive` flag, do not change the scale. Accept `B♭:` in the key prefix. Test: `parseFunction('(V7/II)')` parses with `deceptive: true`; `B♭: V7/ii` reads.

## 6. Open questions the sources cannot settle

1. **Terefenko's conventions** (lower-case minor, `V7/ii`, ø7, "back door", tonicization) could not be read; if the lead wants the lower-case set justified by a source, it must come from his book (Routledge 2nd ed. 2018, page unknown).
2. **Which spelling system the sheet should print** (V9) is a product decision; the sources only say that all three primaries are upper case. The engine's case-carries-quality design is coherent but unsourced.
3. **Whether a dominant of a borrowed chord is a tonicization or an auxiliary dominant** (V7): Berklee/Chediak say the key does not change; the engine's key-area rule says it does. Area D.
4. **The label for a back door whose target is not the tonic** (Stella's `B♭m7 E♭7 | Fmaj7`): `♭VII7/V`, `IV7`, or "back door to V". No source.
5. **How wide "extended dominant" should be** in the report (M&H three-plus, N&G nondiatonic-only, Levine/Chediak any): the proposal V1 follows N&G/M&H for the label and keeps the engine's width for the scale.
6. **Levine's "deceptive cadence"** (any V not resolving down a fifth, p. xi) versus Berklee's (a V that goes somewhere other than I): which to use in the help text; the proposal uses Berklee's and "special function" for the rest.

## 7. Bibliography and unverified citations

- Nettles, Barrie & Graf, Richard. *The Chord Scale Theory & Jazz Harmony*. Advance Music, 1997. Page images viewed: pp. 42, 91, 127.
- Mulholland, Joe & Hojnacki, Tom. *The Berklee Book of Jazz Harmony*. Berklee Press, 2013. Image viewed: p. viii.
- Levine, Mark. *The Jazz Theory Book*. Sher Music, 1995. Text layer only.
- Chediak, Almir. *Harmonia e Improvisação*, vol. 1 (Lumiar, 1986) pp. 97–114 (printed footers seen); vol. 2 p. 149 (image).
- Not read: Terefenko, *Jazz Theory: From Basic to Advanced Study* (Routledge, 2nd ed. 2018); Aebersold, *How to Play Jazz and Improvise* vol. 1.

Citations whose page is unverified or only from the text layer without a seen footer:
- Chediak vol. 1 p. 115 ("dominantes de função especial": the heading is on PDF 115; footer not seen, inferred from p. 114's footer).
- N&G p. 111 (auxiliary "common tone" passage): the chunk's footer was not read; placed by the sequence of pp. 110 and 112 footers.
- Levine pp. xi–xiv (glossary), p. 24, 25–29, 43–45, 68, 325, 336: text layer, page by PDF − 16, not imaged.
- M&H pp. 118–131 and 148–161 are text layer with footer-confirmed pages, not imaged (except as listed above).
- Every Terefenko statement: "practice (unsourced), from memory, unverified".
- The harness results depend on the Project copies of `numerals.ts` and `stream.ts`; if the repo's versions differ, re-run `scratchpad/c-harness/run.ts` against them.

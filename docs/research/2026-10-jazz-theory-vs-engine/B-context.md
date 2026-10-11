# B. Context detection (§5.4) and chart metadata

Reviewer: research agent B. Date: 2026-10-10. Slice: Area B only (modal and blues contexts, borderline library
tunes, the proposed `context:` / `@context` / `minor:` metadata, bossa/samba as a non-context). Scale rules (A),
function labels (C) and key areas (D) are touched only where a context decision feeds them; those points are marked
"cross-reference".

## 0. Conventions and method

Page convention. Every page is the printed BOOK page. Offsets, each checked against page footers in the text layer:
N&G = PDF + 1 (images viewed: pp. 103, 104); M&H = PDF − 12 (images viewed: pp. 141, 153 of the PDF); Levine = PDF −
16 (text layer); Chediak vol. I = the printed footer (it equals the PDF page in the front of the book, PDF + 5 near
p. 340, and the plates at the end are unnumbered; image viewed: p. 113 and the Quadro geral plate).

Library evidence. Only 24 charts are on disk. The other 218 charts and `fixtures/analysis.json` (the frozen full
report) are in the attached Project (`jazz-scales/charts/*.txt`, `jazz-scales/fixtures/analysis.json`). Every
statement below about "what the engine does" to a tune comes from that fixture (242 tunes; the index has 243 rows,
`misty 2` has no fixture entry) or from reading `keys.ts`, `index.ts`, `rules.ts`. I did not re-run the engine
(`web/engine/chart.ts` and `stream.ts` are not on disk). Where I computed a number by hand from chart rows, I say so.

Not verified. Aebersold and Coker: WebSearch returned only storefront pages; nothing below rests on either. The
Jobim songbook was not needed (Wave's chart rows agree with M&H fig. 6.14 in shape; see 2.4).

## 1. Findings table

Verdict codes as in the brief. "Eng." = engine.

| # | Rule or case | Eng. | Berklee (N&G / M&H) | Levine | Others | Verdict | Note |
|---|---|---|---|---|---|---|---|
| B1 | Modal = few functional cadences | fewer than 1/3 of chords in a cadence (`isModal`) | M&H p. 183 (characteristic 2): "a lack of functional harmony, especially dominant resolution and II V patterns"; p. 184: "notable for the lack of dominant resolution"; p. 189 (factor 5): "No dominant resolution down a fifth". N&G p. 156: "The strongest cadential motion of major key, minor key, and blues is root motion of perfect fifths … The typical root motion found in modal harmony is synonymous with mode/scale-steps." | p. 29: "a good definition of modal jazz is 'few chords, lots of space'" | Chediak p. 121: "A característica básica da harmonia modal é a não resolução do trítono com expectativa." | AGREE (as a proxy) | The 1/3 is the engine's own number: practice (unsourced). The engine's "cadence" needs a major or minor target (`isTonicType`), so a run of dominants into dominants is never a cadence: see B4 and 2.3 (1). |
| B2 | Modal = slow harmonic rhythm | median chord >= 2 bars | M&H p. 183 (characteristic 4): "slow harmonic rhythm"; p. 189 (factor 6): "Relatively slow harmonic rhythm"; p. 184: "the great majority of modal jazz tunes contain long passages with just a single chord" | p. 30: "up to 24 bars on D-7 in 'So What'" | N&G p. 156: "Simplicity is important when dealing with modal systems." | AGREE (as a proxy) | No source gives a number. The median sits exactly on the threshold for Footprints (2.3 (3)). |
| B3 | Modal = chords drawn from one mode; I chord at phrase boundaries; no relative-Ionian tonic | not tested | M&H p. 183 (char. 1): "a very limited set of chords, all of which are derived from a single scale"; p. 186: "only the I or I- chord will do"; p. 189 factors 1–4 (repeated I; I at start and end of phrases; "Avoidance of the relative Ionian tonic chord"; "Only chords derived from the mode"). N&G p. 154: "The tonic chord of the mode stands alone"; p. 156: "The tonic chord receives the most stress." | — | Chediak p. 121: "puro" = "Formada apenas por acordes diatônicos a um determinado modo"; four requirements: trítono sem resolução, acordes diatônicos, notas e acordes característicos, acordes evitados | UNDERSPECIFIED (engine omits sourced tests) | Factors 1–4 are implementable (chord-set test; tonic-return test). Footprints fails "only chords of the mode" (bars 9–10) and is still listed modal by N&G p. 158. Use only as a tie-break, never as a gate. |
| B4 | Dominants and ø7 inside a modal tune (D7, h1, s3) | every dominant: Mixolydian (D7); every ø7: Locrian ♮2 (h1) | N&G p. 153: "The diatonic dominant 7th chord is most often treated as a triad"; "The diatonic -7(♭5) is avoided"; M&H p. 187: ø7 "absent … Along with dominant seventh chord, they are problematic"; "Except in the case of a Mixolydian tonic (I7), dominants are used very sparsely within a phrase"; p. 194: ø7 "almost never found" | — | Chediak p. 125: Locrian pieces "pouco comuns" | SPLIT (N&G "treat as a triad" vs M&H "sparse; I7 allowed"); h1 UNDERSPECIFIED | The sources describe modal music as *poor in dominants*, which is a discriminator the engine does not use (Locomotion, 2.3 (1)). h1 has no support in either modal chapter; it rests on Footprints' F♯ø7 alone (library: fires once in 11 modal tunes). Cross-reference A (h1). |
| B5 | Pedal point / ostinato as a mark of modality | not detected (§14) | M&H p. 183 (char. 6): "chord scale voicings over a pedal point, usually the tonic"; N&G p. 142: "pedal point is not a vertical, but a linear consideration"; p. 159: "Pedal point and ostinato … are very typically found in modal music" | p. 344: pedal = "playing a series of chords over the same bass note" | — | UNDERSPECIFIED | A pedal is a bass-line device with no scale rule of its own in any source. Not a context. A Night in Tunisia's Eb7–Dm6/9 alternation is not a pedal (2.4). |
| B6 | Modal whole tune vs modal section | whole tune only | M&H p. 183: "The overwhelming majority instead have one section that expresses a modal tonic … paired with more conventional tonal passages, cyclical II V's, or constant structure patterns" (Moanin', Bolivia, Yes and No, Recorda Me); p. 183: "base each phrase or section on a different scale", So What, Maiden Voyage. N&G p. 104: "Major key or minor key or modal progressions may be inserted into the form". | — | Chediak p. 121: "Misto … Com o tonalismo" | DIFFER (granularity) | The sources' unit is the section, the engine's is the tune. See 3.B and 3.2 (examples). |
| B7 | Blues = 12 (or 24) bars | `formBars % 12 === 0 && <= 24` | N&G p. 108: "The typical blues form is 12 measures; 24-bar blues is typical for triple meters … 8-bar blues and 16-bar blues" | p. 225: "Blues waltzes are usually 24 bars long"; p. 220: "Most blues are 12 bars long, but some blues are longer, or shorter, and some 12-bar tunes are not blues at all" | M&H p. 142: 16-bar form "usually achieved by repeating the turnaround" (Watermelon Man, Step Lightly) | AGREE for 12 and 24 | The engine has no 8, 16 or 12-12-8-12 form (B11). |
| B8 | Blues = dominant 7th on the bar-1 root | required | M&H p. 140 (bebop blues): "it retains its structural identity as a blues, because it has: 12-bar form; tonic chord in measure 1; alternate tonic in measure 3; subdominant chords in measures 5 and 6; tonic substitute in measure 7; turnaround in measures 9–10; tonic chord in measure 11" (fig. 6.13 opens CMaj7). N&G p. 104: its own "major key variation" opens Fmaj7; p. 103: minor-key variation opens D-. | p. 228: "Note the unusual first chord (FΔ instead of the usual F7)" (Blues for Alice) | — | DIFFER | The sources define the blues by position and function, not by the quality of the chord in bar 1. Parker blues (F Bird Blues, Bb Bird Blues) and every minor blues fail the engine's test. |
| B9 | Blues = IV (a fourth above) in bar 5 | dominant 7th on the fourth above at bar 5 | M&H p. 136: "Measures 5–8: subdominant to tonic"; p. 140: "subdominant chords in measures 5 and 6". N&G p. 102: the Tonic / Subdominant-Tonic / Cadence template. | p. 222 (fig. 10-4) | — | AGREE (position); DIFFER (quality, as B8) | In a minor blues the bar-5 chord is a minor chord (M&H fig. 6.17; Mr. P.C.). |
| B10 | I7 and IV7 of a blues are chords without dominant function | D5 "I7/IV7 of the blues", but placed after D3 and D7 in `dominant()` | N&G p. 100: "I7 and IV7 … are examples of dominant chords without dominant function. They are tonic and subdominant functions respectively". M&H p. 136: "only the V7 chord has dominant function. I7 should not be confused with V7/IV. Its position in the form and its duration … confirm its structural importance as the tonic"; p. 137: "The harmonic function of the I, IV, and V chords is independent of their dominant seventh quality … position, duration, root motion, and harmonic rhythm … override the resolving tendency of dominant chords" | p. 219: the I chord "is a dominant 7th chord"; "traditional music theory doesn't 'explain' the blues very well" | Chediak p. 112: "O I7 e IV7 são considerados acordes blues diatônicos (função blues)" | AGREE in principle; DIFFER in code order | In the fixture, 47 of 98 I7 rows in the 25 blues tunes are decided by D3 ("extended dominant: V7 of Eb7") and 23 of 25 tunes open on such a row. Scale unchanged (Mixolydian either way); the *reason* contradicts M&H p. 136. |
| B11 | Blues forms that are not 12 or 24 bars | not detected | N&G pp. 108–109: 8-bar and 16-bar blues; "Minority" among "Blues to analyze" (p. 109). M&H p. 142: 16-bar (Watermelon Man). | p. 226: blues with a bridge, "44 bars long (12-12-8-12)", Locomotion; "Each A section is a 12-bar blues" | — | UNDERSPECIFIED | Library: Locomotion and Tee Pee Time (44 bars), Watermelon Man (16). Locomotion is *misread as modal* (2.3 (1)). |
| B12 | A heuristic cannot define "blues" | form + chord test only | N&G p. 104: tunes "built around the blues form" "may or may not sound like blues"; "Some non-blues tunes use blues chords or blue notes for their color" | p. 220: "Limehouse Blues" and "Bye Bye Blues … are not blues"; "the blues is more than just a musical form; it's a sound, a feeling, and an attitude" | M&H p. 142: Wave's A section "almost unrecognizable as a blues" | UNDERSPECIFIED | Form is evidence, not definition. This is the case for an explicit `context:` (principle 1). |
| B13 | Minor blues: which rules? | functional minor rules (Mr. P.C., Birk's Works, Côte d'Azur); modal when it has only I and iv (Blues Minor) | N&G p. 103: minor-key blues variation (D- G-7 D-7 D7 / G-7 A7♭9 D- Fmaj7 / E-7♭5 A7♭9 D- A-7): minor-key harmony in a blues form. M&H p. 143: "Minor blues can be a pure Aeolian version of the classic progression"; p. 144: Equinox "Dorian voicings on the I-7 and IV-7 chords, then a powerful subV/V to V7"; ♭VI7 "could use a straight Mixolydian … while subV/V implies Lydian ♭7" | p. 225: Mr. P.C. is a minor blues; its minor chords are tonic minor, so C-7 may be C minor-major; bars 9–11 "♭VI, V, I" | — | AGREE (scales); UNDERSPECIFIED (label) | All three sources treat the harmony as minor-key harmony laid on the blues form. The engine's scales (i Dorian, iv Dorian, ii–V–i with harmonic-minor reference, ♭VI7 Lydian Dominant) are what they describe. "Blues" adds no scale rule for a minor blues. |
| B14 | Bossa/samba as an analysis context | none (`style:` is feel) | N&G p. 84 lists "The Girl From Ipanema (Bridge)" under "Tunes to analyze for modal interchange"; N&G pp. 104, 109 list Wave (A sections) under blues; M&H pp. 141–142 analyse Wave with ordinary labels | — | Chediak: one system (Part 2, pp. 84–126) applied to the whole MPB/bossa songbook; pp. 7, 121, 125–126 (see 2.5) | AGREE (not a context) | Zero of the 27 `style: Latin` charts is read modal or blues (fixture). |
| B15 | Which scale governs a plain tonic minor chord | Dorian by convention (m5) | N&G p. 91: "I-7 Dorian or Aeolian"; "The chord scales used for the tonic I- chord may represent any form of minor scale"; p. 76 (in a major key) "most often a Dorian chord scale with 13". M&H p. 84: tonic chords "usually come from melodic minor or Dorian, although Aeolian and Phrygian are possibilities"; p. 86: Dorian is the source of I-7; p. 87: Aeolian "when a darker sound is desired"; Footprints is "a clear example" of tonic Dorian | pp. 58, 273, 299: C-6 / C-∆ vs C-7, melody decides (C-6 "fit both the C Dorian scale (C-7) and the C melodic minor scale (C-∆)"); p. 52: "Aeolian chords are rarely played" | Chediak p. 350 (resolution chord "eólio"); Quadro geral: Im7 = Tônica, scale Eólio; Im6 = Menor melódico; p. 94: three scales, harmonic, natural, melodic | SPLIT | Berklee and Levine: Dorian (or melody-driven); Chediak: Aeolian. A per-chart choice is defensible (3.C). |

## 2. Prose where a row needs it

### 2.1 What the sources say a "modal" tune is (quotations for B1–B6)

- M&H p. 183 ("'Modal' can mean many things. As we use the term in this chapter, it describes music that has one
  or more of these characteristics"): a very limited set of chords, all derived from a single scale; a lack of
  functional harmony, especially dominant resolution and II VI patterns; limited use of the chord that represents
  the relative Ionian scale; slow harmonic rhythm; repetitive oscillation between two chords; chord scale voicings
  over a pedal point, usually the tonic. Note "one or more": the definition is a family of tendencies, not a gate.
- M&H p. 189, the factors that keep a single mode clear: repeated I; I at the beginning and end of phrases or
  sections; avoidance of the relative Ionian tonic; only chords derived from the mode; no dominant resolution down
  a fifth; relatively slow harmonic rhythm.
- M&H pp. 203–204 (default towards function): "if a passage can reasonably be interpreted as being functional in a
  key, it needs no special analytical tool." This supports the engine's choice to default to functional and to
  require positive evidence for modal.
- N&G p. 152: character note (the pitch that distinguishes a mode), p. 153: a diatonic tritone "must be carefully
  controlled in order to retain the modal character while not lapsing into the relative major or minor key";
  p. 154: tonic / cadential / noncadential chords, where "cadential" means *containing the character note*, not
  a fifth-motion cadence; p. 158: modal melodies are almost always diatonic; the modal tunes N&G name
  include Little Sunflower, Maiden Voyage, Recordame, So What, Milestones and Footprints.
- Levine p. 29: "few chords, lots of space"; p. 30: So What has "only two chords", up to 24 bars on D-7; Impressions
  is "based on the changes to 'So What'"; Milestones "was based on just three chords" (the library chart has two:
  Gm7 and Am7; I have not checked a lead sheet); p. 52: "The bridge of Miles Davis' 'Milestones' consists of a
  single chord: A Aeolian."
- Chediak p. 121: modal harmony may be "puro" (only chords diatonic to one mode) or "misto" (with other modes, or
  with tonalism); "É bastante comum vermos músicas de Caetano Veloso, Gilberto Gil, Edu Lobo ou Milton Nascimento
  com estas características." Four conditions give "o sabor modal": non-resolution of the tritone with
  expectation; diatonic chords; characteristic notes and chords; avoided chords. Examples pp. 125–126: Arrastão
  (A Dorian, part of the song), Upa Neguinho (D Mixolydian, first part), Cravo e Canela (G Ionian, first part).

Comparison with the engine. The two tests (`< 1/3` of chords in cadences; median `>= 2` bars) are a defensible
operationalisation of two of M&H's six characteristics and of Chediak's tritone criterion. They are not what a
source says; the numbers are practice (unsourced). The sources add three discriminators the engine lacks: chord set
confined to one mode (M&H 1, 4; Chediak "puro"), the tonic returning at phrase boundaries (M&H 2), and the scarcity
of dominants and ø7 (M&H p. 187; N&G p. 153). The third is the one that would have caught the only clear false
positive in the library (Locomotion).

### 2.2 What the sources say a "blues" is (quotations for B7–B13)

- Two layers. M&H p. 133: "there is no single modal source that defines blues tonality"; the pentatonic melody
  layer and the harmonic layer interact. N&G p. 98: "The primary chords of the fundamental blues are the I and IV
  triads"; pp. 100, 105: I7 and IV7 are tonic and subdominant in function. Levine p. 220: "Two main elements make up
  the blues: the blues scale and the chord changes."
- The form is structural. M&H p. 136: three 4-bar phrases (tonic; subdominant to tonic; dominant to subdominant
  to tonic). M&H p. 140 lists the identity markers of a "bebop blues" (B8 above). N&G pp. 102–103: "Any blues progression
  will follow this pattern" (tonic, subdominant, cadence, tonic).
- Form alone is not enough. Levine p. 220 (B12). N&G p. 104 says the same for tunes "built around the blues form".
- Minor blues (B13). Levine p. 225: bars 9–11 are "♭VI, V, I (A♭7, G7, C- in a C minor blues)", "The G7 chord in bar
  10 is often played as G7alt" (note 8). M&H p. 143: "pure Aeolian version"; p. 144: Dorian voicings, subV/V to V7.
- Blues with a bridge and blues waltzes. Levine p. 226 (Locomotion, 12-12-8-12); p. 225 ("Footprints" listed with
  All Blues as a 24-bar blues waltz; "Bluesette", "Tyrone").
- Wave. N&G p. 104 and p. 109 (Wave, A sections, "Blues to analyze"); M&H pp. 141–142, fig. 6.14: bars 1–10
  analysed as a reharmonised blues (Imaj7, ♭VI°7, related II, secondary dominant, IV, IV-6 "SDM", extended
  dominants, subV/V, V7), bars 11–12 "I-7 IV7 I-7 IV7 … Tonic MI (Dorian)", and "When played in a bossa nova rhythmic
  style, it is almost unrecognizable as a blues." (I viewed this plate.)

### 2.3 What the heuristic gets wrong, with the evidence

(1) Locomotion is read as MODAL. Levine p. 226 calls it a blues with a bridge. Chain of causes, all in `keys.ts`:
`bluesKey` requires `formBars % 12 === 0` (the form is 44); `findCadences` requires the target to be a major or
minor chord (`isTonicType`), and nearly every chord in the tune is a dominant 7th, so the cadence count is 0; every
chord lasts two bars or more. `isModal` is therefore true. Consequence in the fixture: of the 23 rows in the 11
modal-flagged tunes decided by D7 ("modal: its own mode"), 20 are Locomotion's. Its IV7 (E♭7, bars 5 and 17 and 37)
gets E♭ Mixolydian, while the other 24 blues in the library get Lydian Dominant for IV7 (D5). Tee Pee Time (the
same 12-12-8-12 form) is read *functional*, apparently because its ii–V chords are one bar long (fixture reading;
the median is an inference from the chart rows). Two blues-with-bridge charts, two different contexts.

(2) The blues context overrides, and then flattens, the key. In `prepare()` the order is
`blues ?? stated ?? scoreKey`: a detected blues beats the chart's `key:` line, which conflicts with §12 ("A `key:`
meta line … overrides all of this") and principle 1. No library chart disagrees with its blues key (checked: 25
of 25 agree with the index key), so this is latent. Separately, `modal || blues ? stream.map(() => global)`
switches off key areas for any blues. That is safe for the three-chord blues but would be wrong for a bebop blues
whose ii–Vs tonicise (Solar has four areas in the fixture: C minor, F, D♭ and back; Levine p. 230 lists Solar among
blues "that have unusual and unique changes"). This is a reason not to widen blues detection (3.A, C5).

(3) Footprints is modal only at the threshold. Computed by hand from the chart (eight chords: Cm7 4 bars, Fm7 2,
Cm7 2, F♯m7♭5 ½, F13♯11 ½, E7alt ½, A7alt ½, Cm7 2): sorted durations ½ ½ ½ ½ 2 2 2 4, median 2, which just meets
`>= 2`. Plan §16 records that before "a form without a stated length rounds up to four bars" the engine read it
functional. One more chord in the turnaround would drop the median to 1 and flip the whole tune to functional,
with D1-pinned alterations unaffected but F♯ø7 moving from Locrian ♮2 to Locrian and the tonic to m5. Sources:
modal (N&G p. 158; M&H p. 87, "tonic Dorian source scale"), blues (Levine p. 225, 24-bar blues waltz), and the
chart header already says "12-Bar Minor Blues in 6/4" with `style: Blues`.

(4) Blues without a dominant on bar 1 are not blues to the engine (B8): F Bird Blues, Bb Bird Blues (fixture:
functional), Birk's Works, Côte d'Azur, Mr. P.C. (functional), Blues Minor (modal). In every one of them the
scales come out as the sources describe, because the chord-level rules (D5 fallback for IV7, m4, m5, D4) reach the
same answers; what is wrong is the label and the reason text ("IV7 in F, not resolving" rather than "IV7 of the
blues").

(5) The I7 of a blues is "extended dominant" (B10), 47 of 98 rows.

(6) `style: Blues` already means "blues form" in the library: 26 charts carry it; the engine detects blues in 20,
modal in 2 (Footprints, Locomotion), functional in 4 (Birk's Works, Côte d'Azur, Mr. P.C., Tee Pee Time). `style:`
is a feel field in the format, and it is in practice carrying form. A separate `context:` field removes the overload.

### 2.4 The borderline tunes

Engine reading is from the fixture. "Right context" is what the sources support. "Scales change?" asks whether
declaring the right context changes any scale the engine writes today (practice, from the fixture rows).

| Tune (index: key, style, form) | Engine | Sources | Right context | Scales change? | What the heuristic gets wrong, and why |
|---|---|---|---|---|---|
| Footprints (Cm, Blues, A / 12 bars 6/4) | modal | modal: N&G p. 158, M&H p. 87; blues waltz: Levine p. 225; Dorian tonic M&H p. 87 | modal (blues as form only) | No | Right answer, fragile: median on the threshold (2.3 (3)). F♯m7♭5 gets Locrian ♮2 by h1, a taste rule (§10.9) that neither modal chapter supports (B4). Bars 9–10 are a chromatic turnaround, so "only chords of the mode" (M&H factor 4) fails there. |
| Milestones (Gm, —, AABBA 40) | modal | modal: Levine pp. 30, 52; N&G p. 158. M&H p. 193: Aeolian is a modal tonic scale, "the default minor scale" | modal | No (Am7 Aeolian is a written scale) | Right. The bridge's *mode* (A Aeolian) is data no context flag carries; `# keep:` is the correct tool. The library chart has two chords; the brief's "functional-ish bridge" does not occur in this chart. |
| Maiden Voyage (D, —, AABA) | modal | M&H p. 183 (each phrase a different scale), p. 190 | modal | No | Right. `key: D` names the first tonic only; the chart's saved `# analysis:` line says "Eb", a stale comment (the fixture says D major). A modal tune has no key of the tune. |
| So What, Impressions (Dm) | modal | M&H p. 183, n. 26 p. 193; Levine pp. 29–30 | modal | No | Right. B section is a half-step transposition: the modal tonic moves, so `key:` cannot describe the tune. |
| All Blues (G, Blues, A / 12 bars) | blues | Levine p. 225 (24-bar blues waltz); M&H p. 136 | blues | No | Right context, wrong reason on I7 (B10). |
| Mr. P.C. (Cm, Blues, A / 12) | functional | minor blues: Levine p. 225 (names it), M&H p. 143, N&G p. 103 | blues (minor), minor-key rules | No | Right scales. Cadence share is 3 of 6 chords, so it can never be modal; label only (B13). |
| Blues Minor (Fm, Medium up, A / 12) | modal | M&H p. 143 (fig. 6.17 is I-7, IV-7, I-7 with a turnaround); p. 144 (Equinox: Dorian on I-7 and IV-7) | blues (minor) | No | Three chords, no cadence, slow rhythm: passes both tests, so "modal". Same scales (Dorian). Reason text says "modal minor" where M&H say "blues with Dorian voicings". |
| Birk's Works, Côte d'Azur (minor blues) | functional | as Mr. P.C. | blues (minor) | No | Label only. Birk's Works' D♭7 gets Lydian Dominant: matches M&H p. 144 for subV/V, and Levine p. 225 (♭VI7). |
| F Bird Blues, Bb Bird Blues | functional | Levine p. 228 ("unusual first chord (FΔ …)"); M&H p. 140; N&G p. 104 | blues, with areas ON | No | Fails B8 (bar 1 is Maj7). The functional reading is what keeps the tonicising ii–Vs; a naive widening of the detector would switch areas off (2.3 (2)). |
| Solar (Cm, Medium up, A / 12) | functional | Levine p. 230 lists it with "unusual" blues | functional (areas ON); blues is a defensible label | Would change if blues switched areas off | Five stretches in the fixture (C minor, F, C minor, D♭, C minor), three keys; keep functional. Example of why detection must not be widened to "tonic at bar 1, subdominant root at bar 5". |
| Locomotion (Bb, Blues, AABC 44) | modal | blues with a bridge: Levine p. 226 | blues (A), functional (bridge) | Yes: IV7 E♭7 from Mixolydian to Lydian Dominant (D5), like the other 24 blues | 2.3 (1). |
| Tee Pee Time (Bb, Blues, AABC 44) | functional | as Locomotion | blues (A), functional (bridge) | No | Reached the right scales by accident (chord lengths); I7 labelled "extended dominant". |
| Watermelon Man (F, Even 8ths, A / 16) | functional | 16-bar blues: M&H p. 142 | blues (16 bars) | No | Not detected (B7/B11); scales agree via D5 fallback ("I7 in F, not resolving"). |
| Wave (D, Latin, AABC 44) | functional | A section is a blues form: N&G pp. 104, 109; M&H pp. 141–142 | functional (the tune), A bars 11–12 a "Tonic MI (Dorian)" vamp per M&H | No | Bars 11–12 `Dm7 G7 | Dm7 G7` are "passing ii–V" to the engine and "I-7 IV7" to M&H; both give D Dorian and G Mixolydian. A marker would change only the reason string. |
| A Night in Tunisia (Dm, Latin, AABA 32) | functional | ♭II7 as subV7: Lydian ♭7 (N&G p. 91; Chediak Quadro geral, ♭II7 "SubV7 Dominante, Lídio ♭7") | functional | No | Right. The Eb7–Dm6/9 vamp has one-bar chords (median 1) and the A ends on a ii–V–i, so no modal reading. It is not a pedal (B5). |
| Bolivia (G, Mixed, AB 24) | functional | M&H p. 183 names it: a modal section plus tonal passages | per-section: A modal, B functional | No: D7 ("any dominant lasting four bars or more") already gives G Mixolydian for the 8-bar G7 vamp | The textbook case for a section marker; the engine already copes because the vamp is a dominant. Would not cope if the vamp were a tonic major chord (Ionian vs Lydian). |
| Recorda-Me (Am, Latin, AB 16) | functional | N&G p. 158 (modal tune), M&H p. 183 (modal section then cyclical II V) | per-section | No | A vamp then a descending ii–V–I sequence (B♭, A♭, G♭): the engine's areas handle it. |
| On Green Dolphin Street (C, Mixed, ABCD 32) | functional | ostinato in the A sections: N&G p. 144; E♭ pedal under the first eight bars: Levine p. 344 | functional | No | A pedal or ostinato is a bass/melody device (B5), not a context; the engine reads the A as chords with a bass. |
| One-chord, two-chord bossas | none in the library | — | — | — | None of the 27 `style: Latin` charts is read modal (I did not count their distinct chords). A one-chord bossa would be modal because of its *chords* (M&H p. 183), not its genre. |
| Nefertiti (C, Medium, A / 16) | functional, with areas A♭ / B / A♭ and `key: C` matching none | not a modal or blues case; N&G pp. 162–166 ("nonfunctional harmony") is the nearest category | — | — | Outside this slice: no stated context fits. Listed in section 4. |

### 2.5 Why bossa/samba is not an analysis context (Chediak)

1. One system. Chediak's analytical Part 2 (cifragem, função tonal, dominantes secundários, SubV7, II cadencial,
   acordes de empréstimo modal, tonalidade do momento, modulação, harmonia modal: pp. 84–126) is stated once, with no
   genre switch, and applied across the book's songbook, which is Brazilian: Vol. I's index runs from "Manhã de
   carnaval" to "Carta ao Tom" (p. 354 index), Vol. II's index lists "Chega de saudade" (p. 206) and "Meditação" (p. 179). I found no passage that prescribes a different scale for a chord because the piece
   is samba or bossa.
2. The stance. Introduction (printed p. 7 inferred from the TOC's "Prefácio 6 a 15"): "O estudo da música deve
   transcender estas divisões, pois a música é uma só." What bossa changed, per p. 6–7, was *notation and
   vocabulary* ("a única maneira prática de notação seria através da cifra") and "novos caminhos harmônicos", not
   the grammar.
3. Where Chediak does single out Brazilian practice it is modal practice, and it is defined by the chords: p. 121,
   "misto … com o tonalismo", Caetano, Gil, Edu Lobo, Milton Nascimento (MPB and Northeastern modalism, not bossa),
   examples pp. 125–126. That is the existing `modal` context, selected by "não resolução do trítono com expectativa".
4. The ♭II area and tonic-minor conventions are school conventions, not genre conventions. p. 97: D♭Maj7 (♭II7M) in
   C minor "emprestado do modo frígio"; Quadro geral: ♭II7M = Subdominante menor, scale Lídio, AEM; ♭II7 = SubV7,
   Lídio ♭7. p. 350 and the Quadro: Im7 = Eólio. These differ from Berklee (Dorian) for the *same* chord in jazz
   standards too (B15), so they are not a bossa effect.
5. The Berklee sources analyse the Brazilian tunes with the standard toolkit: N&G p. 84 (Ipanema's bridge for modal
   interchange), N&G pp. 104, 109 and M&H pp. 141–142 (Wave, a blues form, reharmonised "through a Brazilian lens" but
   labelled with ordinary functions); M&H p. 142: "almost unrecognizable as a blues" in bossa rhythm, which is a
   statement about rhythm.
6. Library evidence: 27 of 27 `style: Latin` charts are functional in the fixture; the moves that look "bossa" (♭II7
   to I, B7♯11 as ♭II7, ♭VI/♭VII chords, passing °7) are labelled by the existing rules as subV7, chromatic dominant,
   modal interchange, passing diminished.
Conclusion: bossa/samba is not an analysis context. `style:` stays feel only. I found no case that shows
otherwise; the nearest candidate (Chediak's Aeolian tonic, B15) is addressed by `minor:`, which is not
genre-specific.

### 2.6 What governs the tonic minor (for B15)

| Source | I-7 (plain minor 7th / triad) | I-6 | I-(Maj7) | Notes |
|---|---|---|---|---|
| N&G p. 91 (and p. 76 in a major key) | Dorian or Aeolian; "any form of minor scale"; Dorian is where 13 becomes available | Dorian (avoid ♭7) or melodic minor | melodic or harmonic minor | p. 85: four minor scales (natural, harmonic, melodic, dorian minor); p. 91: "or any of the above assuming the melody conforms"; Phrygian "unusual" |
| M&H pp. 84–87 | Dorian source; Aeolian "when a darker sound is desired" | melodic minor (primary), Dorian (alternate) | melodic minor | p. 84: the composite minor is "not an accurate reflection of the reality of the music either"; "constantly flipping between separate scales does not accurately reflect how we hear or play"; p. 89: Phrygian tonic "in a handful of tunes" |
| Levine pp. 52, 58, 273, 299, 406–408 | C-7 ~ Dorian; the melody decides whether C-6 or C-∆ replaces it | fits Dorian and melodic minor | melodic minor (a tonic minor) | "Aeolian chords are rarely played" (p. 52) |
| Chediak pp. 94, 347, 350; Quadro geral | Eólio (Im7, DIAT. in natural minor) | Menor melódico | menor harmônica / melódica (p. 94 table) | p. 124: Aeolian "é usado no tonalismo juntamente com a menor harmônica e melódica" |

Every source ties the answer to the chord symbol first (I-6 and I-(Maj7) are melodic minor in all four) and to the
melody second. The only open choice is the scale for a plain minor-7th or triad tonic, and there the sources split
(Dorian: N&G, M&H, Levine; Aeolian: Chediak, and N&G/M&H as an option).

## 3. Proposed changes

### 3.A Chart-level field: `context:`

Name. `context:` (not `idiom:`, not `analysis:`). It is already the engine's word (`Analysis.context:
'functional' | 'modal' | 'blues'` in `index.ts`); `analysis:` collides with the saved `# analysis:` header (§12.1);
`idiom:` suggests style, and `style:` must stay feel.

Values and default.

| Value | Meaning (what rules it selects) | Source |
|---|---|---|
| `functional` | cadences, key areas, functions (today's default branch) | M&H pp. 203–204; N&G Ch. 4 |
| `modal` | each chord its own mode: m6, M5, D7, s3 (and h1 as the A review decides); no key areas | M&H Ch. 9; N&G Ch. 11; Chediak p. 121 |
| `blues` | I and IV as tonic and subdominant of a 12-bar (or 24, 16) form; I7/IV7 by D5; key from `key:` else bar 1 | N&G pp. 100–104; M&H pp. 136–140; Chediak p. 112 |

Absent line = detected (today's heuristic, with C4/C5 below). A written `context:` always wins over detection
(principle 1), and the report says which decided: `context: modal (stated)` or `context: modal (detected: 0 of 8
chords in cadences, median chord 2 bars)`. No `auto` keyword: the absence is the default. Reserved, not proposed:
`nonfunctional` (N&G pp. 162–166, M&H pp. 203–204). Both say a functional analysis "will not describe the actual
sound" (N&G p. 166), but no rule set exists to decide the scales; Giant Steps is already handled by the cadence rule
(N&G p. 163 itself gives the Ionian/Mixolydian/Dorian reading). See section 4.

Minor blues. No value: a minor blues is `context: blues` with minor-key rules inside. Declaring it changes the form
label and the key (from `key:`), not the scales, which is the sources' position (B13).

Level. Basic/Advanced untouched (context decides which rule fires, not the ladder).

### 3.B Section-level marker: `@context SECTION BAR VALUE`

Syntax parallel to `@key SECTION BAR KEY` (spec 2026-10-09 §`@key`: "parsed like `@segno`"). It holds from its bar
until the next `@context`; before the first, the chart's `context:` (or detected). Orthogonal to `@key`; inside a
`modal` span the key areas are off and the section's tonic is its first chord (M&H p. 186, N&G p. 154). Not `@modal`:
a `blues` section (Locomotion's A) needs the same device.

Is it needed? The sources say yes in principle (M&H p. 183, B6; Chediak p. 121 "misto"). The library does not need
it today: for every tune in 2.4 where a whole-tune flag is too coarse (Bolivia, Recorda-Me, Wave bars 11–12,
Footprints bars 9–10, Locomotion and Tee Pee Time bridges, On Green Dolphin Street's A) the chord-level rules
already write the sourced scales, or the only change would be the reason string. It earns its place as the principle-1
safety valve for a new chart (a modal section on a tonic major chord: Ionian by M3, Lydian wanted by M5; a modal
section with ø7 or a short dominant). Recommendation: specify it now so the `context:` field is not painted into a
corner; build it when a chart needs it.

### 3.C Minor-key flavour: `minor:`

Sources justify one narrow choice, not a four-way flavour. Harmonic minor governs only the V7, vii°7 and I-(Maj7)
(N&G p. 91; Chediak pp. 94, 349–350); melodic minor is symbol-driven (I-6, I-(Maj7): M&H p. 85, Levine p. 299, Chediak
p. 347) and the engine's m1/m2 already read the symbol; the composite is the engine's inventory (principle 5; N&G
p. 91 lists it, M&H p. 84 cautions that it is not "an accurate reflection of the reality of the music"). The
remaining choice is the scale on a plain minor tonic chord, where the sources split (B15).

- Field: `minor: dorian | aeolian`; default `dorian` (m5 as built). `phrygian` is reserved (M&H p. 89, N&G p. 91).
- Scope: rule m5 only (tonic minor on a plain minor chord). It does not touch m1, m2, m3 (the symbol decides) or
  m6 (a modal tune's mode is written in the scale cell, as Milestones' `A Aeolian`).
- Defensible per chart: three sources say melody or sound decides (N&G p. 91; M&H p. 87; Levine pp. 299, 406–408),
  and the one school that differs (Chediak) differs for the whole repertoire, which is a per-chart (house-style)
  setting, not per genre.
- Interaction with the ladder (§11, decision 7): Basic already gives Aeolian for a tonic minor, so `minor: aeolian`
  only moves Standard to meet it.
- Reason string: `tonic minor: Aeolian, as this chart says` / existing `tonic minor: Dorian by convention`.
- Test: chart `key: Cm`, `minor: aeolian`, row `A | 1 | Cm7`; expected `C Aeolian`, rule m5; row `Dm7b5` unchanged
  (`D Locrian`, h2); row `Cm6` unchanged (`C Dorian`, m2).
- Priority: lowest of the three; the library has no chart that needs it (Milestones' Aeolian bridge is a modal tonic,
  already `# keep`). Specify, do not build yet.

### 3.D Changes to rules and detection

C1. Rule ids: none (metadata). Parser accepts `context:` and `minor:` as meta, ignores unknown values with a report
line. The site ignores them.

C2. D5 / D3 order for blues I7. Change: in a blues context, I7 and IV7 are decided by D5 before D3 is tried, and I7
leading to IV7 is not an "extended dominant". Reason string: `I7 of the blues: a tonic with dominant colour, not a
V7 of the IV7: natural tensions` (M&H pp. 136–137). Test: `F Jazz Blues`, `key: F`, row `1 | F7` followed by `5 |
B♭7`; expected F Mixolydian, rule D5 (not D3). Scale unchanged; reason corrected. Level: n/a.

C3. isModal guard. Change: not modal if most chords are dominant 7ths, unless they share one root (a Mixolydian
tonic, M&H p. 190). Source: M&H p. 187, N&G p. 153. The fraction is practice (unsourced); a 1/2 cut is enough for
Locomotion (about four in five chords). Report line as in 3.A. Test: `Locomotion` as in the library, no `context:`;
expected context not modal; row `5 | E♭7` → E♭ Lydian Dominant, D5 (once C4 finds the blues) or E♭ Mixolydian, D3
(if left functional): either way not "modal: its own mode". Level: n/a.

C4. Blues detection by section. Change: test the first 12-bar section for the blues pattern when the form is
12-12-8-12 (Levine p. 226) or 12 bars repeated; keep the requirement of a dominant on bar 1 and bar 5 (do NOT widen
it to tonic and subdominant of any quality, because Solar and Bird Blues would lose their key areas, 2.3 (2)); let
`context: blues` declare the Parker and minor blues. Test: `Locomotion`, `key: Bb`: detected blues; `5 | E♭7` → E♭
Lydian Dominant, `IV7 of the blues: the #11 is in the key` (D5; the A1 review may change the scale to Mixolydian,
N&G p. 105; the context decision is independent of it).

C5. Stated key beats blues key. Change: `stated ?? blues`, so a written `key:` wins (principle 1 and §12). No
library chart changes (25 of 25 agree). Test: a 12-bar `B♭7 … E♭7` chart with `key: E♭` (blues rooted a fifth below
its stated key, as with Levine's "Mr. Day" in G♭, p. 229) should report key E♭, not B♭.

C6. Cross-reference to A (h1). M&H pp. 187, 194 and N&G p. 153 describe ø7 as absent from modal systems; h1 is
supported by no modal chapter and by one library tune. Stop here: the lead decides under A.

## 3.2 Three annotated library charts

Annotations are comments after `#`; "expected" lines state what the engine should write. Layout follows the library
(`@key SECTION BAR KEY`).

(1) Locomotion: blues-with-bridge, the one library misread.

```text
title: Locomotion
subtitle: Blues (12 12 8 12)
composer: John Coltrane
style: Blues
key: Bb
context: blues                  # stated: Levine p. 226, "Each A section is a 12-bar blues"
form: AABC, 44 bars
...
@context B 25 functional        # optional: the bridge is the I Got Rhythm bridge variation (Levine p. 226)
B  | 25 | Ab7 | ...
@context C 33 blues             # optional: back to blues for the last 12 bars
C  | 33 | Bb7 | ...
# expected: A1 | 5 | Eb7 | Eb Lydian Dominant   # IV7 of the blues (today: Eb Mixolydian, "modal: its own mode")
# expected: A1 | 1 | Bb7 | Bb Mixolydian          # I7 of the blues: natural tensions (D5, or D7 static, 4 bars)
```
Whole-tune `context: blues` is enough here; the two `@context` lines are the section-level alternative.

(2) Bolivia: a whole-tune flag is too coarse; the section marker states the structure.

```text
title: Bolivia
style: Mixed
key: G
form: AB, 24 bars
context: functional             # stated; a whole-tune "modal" would switch off B's key areas (D, G, F)
...
@context A 1 modal              # M&H p. 183 names Bolivia: a modal section, then tonal passages
A | 1 | G7   | G Mixolydian             # modal: its own mode (today: "static dominant", same scale)
A | 8 | G7b9 | G Half-Whole Diminished  # unchanged: the b9 from the symbol
@context B 9 functional
B | 9 | EbMaj7 | Eb Lydian
...
# expected: no scale changes; the reasons change. This is the evidence for "specify, do not build yet" (3.B).
```

(3) Mr. P.C.: minor blues, with the tonic-minor choice written down.

```text
title: Mr. P.C.
composer: John Coltrane
style: Blues
key: Cm
context: blues                  # stated; minor blues: Levine p. 225, M&H p. 143, N&G p. 103
minor: dorian                   # explicit default (m5); `aeolian` would give C Aeolian on bars 1, 7, 11
form: A, 12 bars
...
A | 1  | Cm7   | C Dorian   # tonic minor of a minor blues: Dorian (M&H p. 144; N&G p. 91)
A | 5  | Fm7   | F Dorian   # iv: Dorian, the key's own notes
A | 9  | Dm7b5 | D Locrian
A | 10 | G7alt | G Altered
# expected: scales unchanged; the report prints "context: blues (stated)".
```

(Optional one-liners: Blues Minor gets `context: blues`; its scales stay F Dorian and B♭ Dorian. Footprints gets
`context: modal` and keeps `style: Blues`.)

## 4. Open questions the sources cannot settle

1. Thresholds. No source gives a number for "slow" or "few": the 1/3 cadence share, the 2-bar median and the
   proposed dominant-majority cut are practice (unsourced). The report line in 3.A makes them visible.
2. Blues as melody, not harmony. Levine p. 220 and M&H p. 135 say the blues scale is a melody layer; the engine has
   no melody. Whether the sheet should offer the blues scale on a declared `blues` context is a feature decision, not
   a context one.
3. `nonfunctional` (N&G pp. 162–166; M&H pp. 203–204). The sources say a functional analysis misses the sound
   (contiguous dominants, constant structure) but give scale advice only for Giant Steps (N&G p. 164: Lydian, Lydian
   ♭7, Dorian "especially for comping players and arrangers"). Library candidates: Nefertiti (`key: C` matches none
   of its areas A♭ / B / A♭), Moment's Notice (N&G p. 167 cites it for contiguous dominants).
4. Whether Footprints is "a blues" or "modal" (Levine and M&H disagree in kind, not in scales). Resolved for scales;
   open as a label.
5. Whether `minor: aeolian` should also lift Standard in the level ladder (§11, decision 7) or stay a Standard-only
   override.
6. Milestones: Levine p. 30 says three chords; the library chart has two. Checking against a lead sheet is outside
   what I could do.
7. "Just Around the Corner" (`style: Up`, detected blues) and "Blue Trane" (Levine p. 231 calls the E♭ tune "Blue
   Train" a minor blues; the Cookbook chart is E♭7♯9 / A♭7♯11) were not checked against other sources.

## 5. Bibliography and unverified citations

Editions. Nettles, Barrie and Richard Graf, *The Chord Scale Theory & Jazz Harmony* (Advance Music, 1997).
Mulholland, Joe and Tom Hojnacki, *The Berklee Book of Jazz Harmony* (Berklee Press, 2013). Levine, Mark, *The Jazz
Theory Book* (Sher Music, 1995). Chediak, Almir, *Harmonia e Improvisação*, vols. I and II (Lumiar Editora; the
copies on disk are the scanned volumes in `design/sources/`). Project files used: `docs/plan-analysis.md`;
`web/engine/analysis/{keys,index,rules}.ts`; `fixtures/analysis.json`; `charts/*.txt` (24 on disk, others from the
Project); `docs/superpowers/specs/2026-10-09-chart-functions-design.md` (the `@key` syntax); `docs/research/library-index.txt`.

Page numbers viewed on a rendered image: N&G pp. 103, 104; M&H pp. 141 (PDF 153); Chediak vol. I p. 113 and the
Quadro geral plate.

Citations whose page is unverified or inferred (text layer only, or inferred):
- Chediak vol. I, Introduction (printed p. 7): inferred from the table of contents ("Prefácio 6 a 15") and the PDF
  sequence; the page shows no number in the text layer.
- Chediak vol. I, Quadro geral dos acordes (Parte 5, XII): a rotated, unnumbered plate after p. 351; cited by name.
- Chediak vol. II pp. 49–54 (Categoria menor: Cm7 under "modo eólio", Cm6 and Cm(7M) under "menor melódico"): page
  numbers are the table of contents' (PDF 13); the pages themselves were not opened. The statement is not relied
  on in the findings except as support for B15.
- Chediak vol. I pp. 125–126 (Arrastão, Upa Neguinho, Cravo e Canela): read from the text layer; the notated
  examples are garbled and I cite only the captions.
- Chediak vol. I p. 354 (the song index): printed "354" at the foot of the index page; Vol. II page numbers for
  "Chega de saudade" and "Meditação" are the index's, not checked on the song pages.
- M&H p. 133 ("no single modal source"): read from the text layer (PDF 145), also quoted by A1.
- Levine: all pages are text-layer reads at PDF − 16 and agree with the index entry "Footprints, 225".
- N&G p. 100: the OCR renders the tension symbols in "I7(♯9) and IV7(9)" ambiguously; I quote only the sentence
  "examples of dominant chords without dominant function".
- Every figure about the engine's behaviour on a library tune is from `fixtures/analysis.json` as frozen on its
  date, not from a fresh run; the Footprints median (2.3 (3)) is my hand computation.

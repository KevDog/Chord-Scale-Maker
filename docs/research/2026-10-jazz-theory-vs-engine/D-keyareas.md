# D. Key areas and cadences (plan-analysis §5.1–5.3) against the sources

Reviewer: research agent D. Date: 2026-10-10. Slice: Area D of BRIEF.md. Engine references: `keys.ts` (`findCadences`,
`localKeys`, `diatonic`, `scoreKey`, `impliedDiatonic`), `index.ts` (pass 2: `statedAreas`, `prepare`), plan §2, §5.1–5.3,
§5.5, §7.5, §9, §10, §14, §16, and the saved `# area:` / reason comments in the nine charts.

## 0. Conventions, method, and three facts about the materials

**Page convention** (BOOK pages throughout; offsets re-checked against printed footers, and against rendered page images
for the pages marked *):
N&G = PDF + 1 (images viewed: 47*, 76*, 150*, 151*); M&H = PDF − 12 (printed footers agree: p. 169, 177, 103, 113);
Levine = PDF − 16 (images viewed: 120*, 352*); Chediak vol. 1 = printed footer (p. 71, 94, 96, 106, 107, 111, 116–119).
Quotations are verbatim from the text layer or the image.

**Fact 1: no `@key` line exists in any supplied chart.** `grep @key charts/*.txt` is empty (the only `keep:` is
Milestones' bridge). The `# area: …` lines in the charts are the engine's own saved output (rules v1), not an author's
statement. "Engine" below therefore means (a) `keys.ts` read line by line and (b) those saved area lines. A stated `@key`
would override the found areas (`index.ts` `statedAreas`), but none is in the test set.

**Fact 2: the engine could not be run.** `web/` holds only `engine/analysis/{functions,index,keys,rules}.ts`; `chart.ts`,
`stream.ts`, `pitch.ts` and `scales.ts` are absent, so I could not execute `analyse`. Statements about what the engine does
on a chord sequence not in the chart set (How High the Moon, the standard Autumn Leaves changes) are from reading
`localKeys`, and are labelled "by code reading".

**Fact 3: the plan and the code disagree about Autumn Leaves, and about All the Things bar 9.** See §3.5 and §3.1. The
saved charts follow the code.

**Terminology the sources do not share.** "Key of the moment" is Berklee's (M&H p. 177 credits "our colleague Steve
Rochinski for this term"); Chediak has "tonalidade secundária ou do momento" (p. 106); N&G does not use the phrase (no hit
in the text) and speaks of secondary dominants with "diatonically related function" (p. 42) and of "implication of a
modulation" (p. 84); Levine uses "key" and "key center" for every ii–V–I (p. 21, 353); Terefenko calls the same
ii–V–I's "tonicizations of the secondary key areas" (secondary web source, §6). For the engine, which needs only the
*key in force for tension-derivation* (principle 4), the vocabulary does not matter; what matters is (i) whether the
local key changes and (ii) which scale the target chord gets.

---

## 1. What each source says: tonicisation versus modulation

| Source | Tonicisation / key of the moment (home key unchanged) | Modulation (new key) | Duration / metre / melody criteria |
|---|---|---|---|
| **N&G** | A secondary dominant resolves "down a perfect 5th to one of the diatonic chords other than Imaj7" (p. 41); it has "at least one nondiatonic chord tone", resolves "to a diatonic chord and therefore has a diatonically related function", and has diatonic roots (p. 42). Modal-interchange chords are not modulation: "Modal interchange between parallel keys is not perceived as modulation because the tonal reference remains" (p. 146). With subdominant-minor function "there is only an implication of a modulation to the related key" (p. 84). Many tunes never modulate ("My Romance", "A Foggy Day", "I Got Rhythm", p. 146). | "A modulation occurs when the tonal or modal center is transposed to a new tonal or modal center. The listener's focus must change from the original tonic reference to the new secondary reference." (p. 146) Types: direct (p. 148), pivot chord (p. 150), deceptive resolution of a dominant (p. 150–151), transitional (p. 151). Deceptive resolution: "A new tonic is found in place of the expected diatonic chord (*change of expected chord quality*) following V7/II, V7/III, V7/V, V7/VI" (p. 150); the Fmaj7 where "expected Phrygian III-7 becomes Ionian Imaj7" is "another single chord modulation" (p. 151). "It is not necessary for a new tonic chord to be heard after a modulation" (p. 147). | No duration test: "a modulation may occur for only one chord" (p. 147, Pensativa). Harmonic rhythm decides whether a dominant is a secondary dominant (weak to strong stress, pp. 47–49) or a sequential one (strong stress, p. 51, 53); a related ii–V needs "II-7 strong stress, V7 weak stress. This is an absolute must" (p. 68). Melody: "If the melody modulates into a new key, the harmonies must modulate" (p. 147). Relative major vs minor: "the stress placement of chords and melodic cadences determines which is in effect at any given moment" (p. 90). |
| **M&H** | "Secondary dominants are dominant chords that create an expectation of resolution down a fifth to a diatonic target other than the tonic … Their use does not mean we have left the key, even temporarily" (p. 39). Key of the moment (p. 177): "A chord progression will sometimes momentarily imply a contrasting key without definitively establishing a new key center. The mechanism is often a non-diatonically related II V pattern inserted in a tonal passage or an extended dominant string … do not represent a true or complete modulation. They point temporarily to a different tonal center without a confirming cadence, then return immediately to the primary key." Fig. 8.14 "implies Ab Major … without resolving to its tonic chord". Examples named: "Darn That Dream", "Out of Nowhere", "Just Friends" (p. 177 n. 24). | "We say that a modulation has occurred when the listener senses arrival at a new tonal center: the note we have thought of as Do changes" (p. 166). Direct: "The new tonality is often established by an unambiguous progression such as I VI II V or II V I. This can be called a 'confirming cadence.'" (p. 168). Pivot (p. 171–174), transitional (p. 174–176), multiple local modulations (p. 178–179), Coltrane changes (p. 180–181: "compress the direct modulation into a smaller temporal span"; Fig. 8.20 labels a single V7–Imaj7 as a key, "Ab: V7 IMaj7"). | "A tonic chord with a very long duration can also serve to confirm the new tonal center" (p. 168). Brevity blocks only the relative-major shift: F-7 B♭7 → E♭Maj7 is "so brief that it does not suggest a change to the relative major key" (p. 113); "any use of the ♭IIIMaj7 chord in a primary metric position (or any tonicization of ♭IIIMaj7 …) can cause a tonal shift to the relative major key" (p. 88). No bar-count rule anywhere. |
| **Levine** | None as a separate category. "Think key, not chord" (p. 39, 204): each ii–V, V–I or ii–V–I "is from" a key (p. 20–22). | "Notice how often 'Just Friends' modulates from one key to another" (p. 21), though most of its II–V's are one or two bars. "Each group of chords from the same key is called a key center" (p. 353). A key lasting "only a bar or two" is still a key center (p. 355). "My Little Brown Book … modulates … This bright new key lasts only six beats" (p. 396). | None. |
| **Chediak** | "As resoluções passageiras (acordes diatônicos ou de empréstimo modal preparados por seus dominantes individuais) não são considerados modulações" (p. 117); his examples include Cm7 F7 → B♭7M in C (V7/♭VII → ♭VII7M, p. 117 d). "Tonalidade secundária ou do momento" = the diatonic chord a dominant resolves to (p. 106). Adjacent II–V's "podem sugerir centro tonal implícito mas não estabelece a tonalidade do momento, por não haver expectativa de resolução por uma tônica nova" (p. 116). Extended dominants "não levam o número romano pelo fato de seu som não estar diretamente vinculado com a tonalidade" (p. 107). | "A modulação ocorre quando não podemos analisar um ou mais acordes dentro da tonalidade primitiva" (p. 116); example: C7M | F♯7 | B7M, where B7M "não pode ser analisada na tonalidade primitiva" (p. 117). Direct, pivot (p. 117–118), transitional (p. 119). | None. |
| **Terefenko** (secondary web source, §6) | ii–V–I's "such as in mm. 6 or 14, function as mere tonicizations of the secondary key areas, C major and E♭ major" (All the Things You Are). | The ii–V–I in mm. 33–35 "Its role is to confirm the arrival of the tonic key." | Not stated. |

**Reading of the table.** Five distinct tests appear in the sources, and none is a bar count:
(a) the target is diatonic or not (N&G p. 41–42, M&H p. 39, Chediak p. 106, 117);
(b) there is a *confirming cadence* that lands (M&H p. 168, 177; Chediak p. 116 on adjacent ii–V's);
(c) the landing chord is a new-quality tonic where a diatonic minor/dominant chord was expected (N&G p. 150–151);
(d) a long tonic may confirm (M&H p. 168), brevity prevents only the relative-major shift (M&H p. 113), metre and
harmonic rhythm matter (N&G pp. 47–51, 68; M&H p. 88);
(e) melody (N&G p. 147), which the engine cannot read (§14).
On vocabulary the primaries split (M&H "key of the moment" requires no landing; Levine and Terefenko call the landing
ii–V–I a key or a secondary key area), but **they agree on the one thing the engine needs: a ii–V–I that lands on a
chord outside the key in force makes that chord's key the key for its own ii, V and I.**

---

## 2. Findings table (output shape 1)

Verdict codes as in the brief. "Engine" cites §5.3 / `keys.ts`. Berklee = N&G and M&H.

| Rule or case | Engine | Berklee | Levine | Others | Verdict | Note |
|---|---|---|---|---|---|---|
| **KA1** a V7 / ii–V resolving down a fifth to a chord diatonic to the key in force is a secondary dominant and opens no area (§5.3: "Only a target diatonic to neither the local nor the global key opens a new area"; `diatonic(target, current)`) | stays | N&G p. 41–42; M&H p. 39 ("have left the key, even temporarily": no) | p. 20–21 reads each ii–V–I as "in" a key, silent on diatonic targets | Chediak p. 106, 117; Terefenko (ATTYA m. 36 not named) | AGREE | M&H p. 52: "the II V acts like a kind of switching mechanism to the next target". |
| **KA2** a cadence landing on a chord diatonic to neither local nor global key opens an area, with no length test (`localKeys` `next = … c.key`) | opens | N&G p. 146, 150–151 (single chord suffices, p. 147); M&H p. 166, 168, 180–181 | p. 21, 353, 355 ("only a bar or two") | Chediak p. 116–117; Terefenko "secondary key areas" | AGREE | The brief's "tonic ≥ 2 bars" clause is contradicted by N&G p. 147, M&H p. 180–181, Levine p. 355 (§4). |
| **KA3** ii–V (or V7 chain) that never lands: a "passing ii–V", its own key for its own chords, no area (§7.5) | no area; scales from the pair's own key | M&H p. 177 (key of the moment, "without a confirming cadence"); N&G p. 167–168 (contiguous dominants: Dorian–Mixolydian) | p. 28 (Moment's Notice Ab-7 Db7 "the II-V in Gb", deceptive) | Chediak p. 116 | AGREE | The engine's "passing ii–V" is M&H's "key of the moment", and its area rule is M&H's modulation rule, split on exactly M&H's line. |
| **KA4** extended dominant chain: no key of its own (D3/D8) | no area | N&G p. 51–54; M&H p. 177 (a string "implies successive unresolved key centers") | p. 40 | Chediak p. 107 (no Roman numeral) | AGREE | |
| **KA5** closing rule: an area runs until the next cadence's approach; a cadence into the global tonic, or into a chord diatonic to the global key, returns home | closes | N&G p. 146 ("we have been conditioned to expect a return to the original key"); M&H p. 177 ("return immediately to the primary key") | silent | Terefenko: the final ii–V–I "confirm[s] the arrival of the tonic key" | UNDERSPECIFIED | No source gives a mechanical closing rule. "Until the next approach" is a design choice; it makes the chord after a tonic inherit the area (ATTYA bar 9, §3.1). |
| **KA6** V7/IV (or subV7/IV) lands on IV: IV is a diatonic target, so no area; IV is then **Lydian** (M4: "IV: the ♯4 is the key's 7th") | Lydian | N&G p. 47: "When V7/IV resolves to IVmaj7 … the chord scale for the IVmaj7 is Ionian. This is the only maj7 chord with this chord scale choice." p. 60: same for subV7/IV. M&H p. 23: IVMaj7 Lydian (no exception stated) | p. 120, Fig. 6-11 (Stella): F-7 = "2nd mode of E♭ major", E♭∆ = "1st mode of E♭ major" (B♭7♭9 between them is the half-step/whole-step diminished). p. 39: Lydian "when the major 7th chord is acting like a IV chord" | | **DIFFER** (N&G, Levine) / M&H silent | Engine-wrong on Stella bar 7 and Moment's Notice bars 11, 27. Cross-reference: this is an M3/M4 question A2 did not raise. |
| **KA7** a major chord of the parallel mode (♭III, ♭VI, ♭VII) reached by its own ii–V–I opens an area; target Ionian (M3) | area, Ionian | N&G p. 76 (♭IIImaj7 Lydian: "holds the progression to the key of I major"), p. 81, 91 (♭VImaj7 Lydian, "nontonic function"), p. 83 (Lady Bird's turnaround read as modal interchange); M&H p. 90 (♭VIMaj7 Lydian), p. 113 (V7/♭VI → ♭VIMaj7 analysed as subdominant function in the same key), p. 120 | p. 357: Lady Bird turnaround "The key center moves from C down a major 3rd to Ab, and then back up" | Chediak p. 117 d: ♭VII7M prepared by its V7 is a "resolução passageira" ("não são considerados modulações"); M&H p. 171: How High the Moon "modulates to ♭VII major" | **SPLIT** | Levine and M&H p. 171 call it a key; N&G, M&H p. 113 and Chediak call it a borrowed chord. Scale effect: Ionian (engine) vs Lydian. No mechanical test exists. |
| **KA8** in a minor key, a full ii–V–I into a major chord (relative major, ♭VI) tonicises it (`tonicized`, §16) | area | M&H p. 88 (metric position, tonicisation → relative major), p. 102 (IV-7 ♭VII7 ♭IIIMaj7 "heard as diatonic minor key activity"), p. 103 (the cue is "its related II-7♭5"), p. 113 (brevity); N&G p. 90 | silent | | **SPLIT** (Berklee internally) | Identical scales on every library tune (§3), so this is documentation, not code. |
| **KA9** relative major/minor: `scoreKey` ties go to the final chord's key, then to minor | minor wins ties | N&G p. 90 (stress placement decides); M&H p. 89 (Autumn Leaves, Black Orpheus "ambiguous minor/relative major relationship") | silent | Chediak p. 71 ("O contexto harmônico é que vai indicar") | UNDERSPECIFIED | See §5. `key:` is the escape and every library chart has one. |
| **KA10** composite minor (principle 5) as the key-area reference (§5.5) | natural minor + harmonic V7 | N&G p. 84–89: natural, harmonic, melodic and dorian minor all supply "diatonic" chords; p. 80: iiø7 and V7 "borrowed from harmonic minor"; p. 88: V7 "used (instead of V-7), because of its primary dominant function"; p. 91 scale list | p. 75–76: the minor II–V–I uses three melodic minors, harmonic minor "is often mentioned in theory books … but [players] don't play it" | Chediak p. 94, 96: three minor scales, a "quadro" of the commonly used chords tagged N/M/H | **AGREE** (for key-area membership); scale choice is Area A's | `DIATONIC_MINOR` omits the dorian-minor/melodic-minor chords (IV7, ii-7, vi-ø7); N&G p. 88–91 lists them. No library tune is affected. |
| **KA11** metre ignored (§14) | ignored | N&G p. 47–49, 51, 68: weak-to-strong stress; "an absolute must" for a ii–V | | | UNDERSPECIFIED | N&G's own tests for "secondary vs sequential dominant" and "related ii vs diatonic" are metrical. Stated limit; no change proposed. |
| **KA12** Multitonic tunes (Giant Steps) | one area per V7–I / ii–V–I; global `key:` | N&G p. 163: "three tonal centers, spaced a major 3rd apart (B, G, Eb) … All three tonics carry equal weight … The tune could end on any tonic"; p. 164 chord scales Ionian/Mixolydian/Dorian "would normally reflect the diatonic of each individual tonal center"; M&H p. 181: "a triumvirate of tonics where pre-eminence is only decided by primacy" | p. 204: "'Giant Steps' has 26 chords, but only 10 key changes. And those 10 key changes involve just three keys — B, G, and Eb. Think key, not chord." Fig. 15-1 (p. 352) labels every group. p. 95: "Giant Steps … is in B". | | **AGREE** | All eleven engine areas equal Levine's Fig. 15-1 (§3.4). The chart's `key: Eb` is arbitrary (sources: B by Levine, none by N&G); no scale depends on it. |
| **Candidate rule** "a ii–V tonicises; a cadence whose tonic lasts ≥ 2 bars (or is followed by its own diatonic chords) modulates" | — | Contradicted by N&G p. 147, 151; M&H p. 168, 180–181; partly supported by M&H p. 113, 168 | Contradicted by p. 355 | | **DIFFER** (rule fails) | §4. |

---

## 3. Tune by tune: engine key areas against the sources, bar by bar where they differ

Bars are the chart's. "Mark" is one of **engine-wrong**, **source-silent**, **defensible-either-way**, or "agree".

### 3.1 All the Things You Are (A♭; engine areas A♭ 1–5, C 6–9, E♭ 10–13, G 14–19, E 21–23, A♭ 24–36)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 1–5 | A♭ | Levine p. 23 Fig. 2-21 (cycle of fifths F → D♭); ii–V–I in A♭ | agree |
| 6–8 | C area: Dm7 G7 CMaj7 | N&G p. 150: G7 would be V7/III expecting Cm7 (the real iii of A♭); it lands on CMaj7, "a new tonic … in place of the expected diatonic chord (change of expected chord quality)": a modulation by deceptive resolution. Levine p. 23: "from D to C". Terefenko: "mere tonicizations of the secondary key areas" | agree |
| 9 | Cm7 held in the C area, saved reason "a borrowed minor chord: Dorian, its own key" | Plan §9 says bar 9 Cm7 is "iii of A♭, m9"; the code and chart do otherwise, because §5.3 closes the area only at the next approach (Fm7, bar 10). N&G p. 150: a pivot chord's scale "is most often dictated by the pivot chord's initial or original key function"; Cm7 is borrowed i-7 of C, iii of A♭ and vi of E♭ | defensible-either-way (C Dorian in every reading; Aeolian would be the vi-of-E♭ reading). Plan §9 row should be corrected. |
| 10–12 | E♭ area | N&G p. 150 pattern again (B♭7 is V7/V of A♭, lands on E♭Maj7 instead of the expected E♭7/dominant). Terefenko: "secondary key areas … E♭ major" | agree |
| 13 | AbMaj7 = IV of E♭, Lydian | The A2 phrase is A1 transposed up a fifth (bars 9–13 against 1–5; D♭Maj7 at bar 5 is IV, Lydian). Read as I of A♭ it would be Ionian | defensible-either-way (the sequence supports the engine; Levine p. 39 "acting like a IV chord") |
| 14–20 | G area (two ii–V–I) | Levine p. 247 lists keys; ii–V–I in G ×2 | agree |
| 21–23 | E area, 1-bar tonic | Levine p. 247: "'All The Things You Are' has a II-V-I in the key of E" | agree. **The ≥ 2-bar candidate rule would call this a tonicisation and give EMaj7 Lydian (§4).** |
| 24–36 | A♭: C7♯5 → Fm7 is V7/vi | N&G p. 41, M&H p. 39 (secondary dominant to a diatonic target). Terefenko: mm. 33–35 "confirm the arrival of the tonic key" | agree |

### 3.2 Stella by Starlight (B♭; engine: one area, B♭, throughout)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 1–2 Em7♭5 A7♭9 (Dm never arrives) | no area (A7 → Cm7 is no fifth) | N&G p. 118: the first two bars are "in lieu of the original ♭III°7" (a reharmonised diminished chord); Levine p. 120: Eø = 6th mode of G melodic minor, A7alt = 7th mode of B♭ melodic minor (scale question: A1's) | agree on key (no area) |
| 3–4 Cm7 F7 | B♭ | Levine p. 120: "2nd / 5th mode of B♭ major" | agree |
| 5–7 Fm7 B♭7 E♭Maj7 | B♭ area; E♭Maj7 Lydian | **Levine p. 120: F-7 = "2nd mode of E♭ major", E♭∆ = "1st mode of E♭ major"**; N&G p. 47: IV after its V7 is Ionian; M&H p. 23: IVMaj7 Lydian, no exception | **engine-wrong** by N&G and Levine; M&H silent. Rule KA6. |
| 8 A♭7 | back door, Lydian Dominant | M&H p. 238 (♭VII7 "returns to IMaj7", citing Stella); Levine p. 284 (A♭7♯11 "resolve[s] up a whole step to B♭∆", bars 20–23) | agree |
| 12–13 B♭m7 E♭7 → FMaj7 | no area; F Lydian (decision 10) | N&G p. 80: ♭VII7 "uses a Lydian ♭7 scale most of the time, reflecting the implication of minor but its use in major, and its expected root motion to tonic major that is not down a perfect 5th"; no source says what the target is when it is V of the key | source-silent (the target's scale); defensible-either-way |
| 15–20 Aø7 D7♭9 G7♯5 Cm7 | no area; Cm7 (2 bars) "ii: Dorian" | Levine p. 287: "G7♯5 … resolve[s] down a 5th to C-7". N&G p. 41–42 and M&H p. 39: V7/ii to a diatonic target is a secondary dominant. The candidate rule (Cm7 two bars) would call it C minor: C Dorian either way | defensible-either-way (same scale) |
| 27–30 Dø7 G7♭9 Cø7 F7♭9 | no cadence into ø7 (§5.1) | N&G p. 41: resolution to a "-7(♭5) ('Stella by Starlight') is uncommon" | agree with §5.1's "ø7, °7, sus: none" |

### 3.3 Lady Bird (C; engine C 1–6, A♭ 7–10, C 11–15, A♭ 15–16 (beats 3–4), C 16)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 3–4 Fm7 B♭7 → CMaj7 | no area; back door | N&G p. 80; M&H p. 97–98 | agree |
| 7–10 B♭m7 E♭7 A♭Maj7 (2 bars) | A♭ area, A♭ Ionian | M&H p. 168 (confirming cadence ii–V–I, tonic held two bars) → modulation; N&G p. 81, 91 (♭VImaj7 Lydian) and Chediak p. 117 → borrowed chord, no modulation | **SPLIT** |
| 11–14 Am7 D7 | back to C ("ii–V that does not land", `implied`) | N&G p. 67 (dual function); M&H p. 52 | agree |
| 15–16 C E♭7 A♭ G7♯5 | A♭ area for E♭7 and A♭Maj7 (two beats), then C | Levine p. 357: "The key center moves from C down a major 3rd to Ab, and then back up a major 3rd to C again"; N&G p. 83: "The last three measures show a turnaround as in 'Lady Bird' including modal interchange chords" | **SPLIT** (Levine = engine; N&G = modal interchange, ♭VImaj7 Lydian) |

### 3.4 Giant Steps (engine `key: Eb`; eleven areas)

The engine's areas, from the saved lines, and Levine's labels (Fig. 15-1, p. 352, image viewed):

| Bars | Engine | Levine Fig. 15-1 |
|---|---|---|
| 1 | B (wrapped from the turnaround) | "I in B" |
| 1–2 | G | "V-I in G" |
| 2–3 | E♭ | "V-I in Eb" |
| 4–5 | G | "II-V-I in G" |
| 5–6 | E♭ | "V-I in Eb" |
| 6–7 | B | "V-I in B" |
| 8–9 | E♭ | "II-V-I in Eb" |
| 10–11 | G | "II-V-I in G" |
| 12–13 | B | "II-V-I in B" |
| 14–15 | E♭ | "II-V-I in Eb" |
| 16 | B (to the top) | "II-V-I in B" |

Identical, area for area (ten changes, as Levine p. 204 counts). Scales: N&G p. 164 "Ionian, Mixolydian, and Dorian" for each tonal centre, with "Lydian, Lydian ♭7, and Dorian" "potential (especially for comping players and arrangers)": the engine's Standard equals N&G's normal choice and N&G's alternative equals the Advanced rung. **AGREE.** The only tension with the sources is the chart's `key: Eb` (N&G p. 163: no home tonic; Levine p. 95: "in B"); it changes no row. M&H p. 181 states the strong form: "'Giant Steps' establishes new key centers a descending major third apart in measures 5 and 9".

### 3.5 Autumn Leaves (G minor)

*Library chart = "Alternate Changes"*: Cm7 | F7 | Bm7 E7 | B♭m7 E♭7 | Aø7 | D7 | Gm. Engine: **one area, G minor, throughout** (no cadence lands on a chord outside G minor: F7's next chord is Bm7; E7 → B♭m7 and E♭7 → Aø7 are not fifths; `tonicized` never fires). Chart reasons say "V7/bIII in G minor" for F7.

*Standard changes* (Cm7 | F7 | B♭Maj7 | E♭Maj7 | Aø7 | D7 | Gm), by code reading: Cm7 F7 → B♭Maj7 is a full ii–V–I into a major chord, current key minor, so `tonicized` is true and a B♭ area opens (bars 1–4); Aø7 D7 → Gm is a cadence into the global tonic and comes home. This is the plan's §5.3 and §9 narrative ("areas in B♭ major and G minor"), which describes the standard changes; the library chart's header should say "one area". Both give the same scales (F7 Mixolydian, E♭Maj7 Lydian, B♭Maj7 Ionian, Cm7 Dorian).

| Source | What it says | Mark |
|---|---|---|
| M&H p. 88–89 | "Many minor key tunes make use of a shift from tonic minor to relative major … 'Black Orpheus' … and 'Autumn Leaves' are classic examples of this ambiguous minor/relative major relationship." The shift happens when ♭IIIMaj7 arrives "in a primary metric position" (p. 88). | defensible-either-way (engine B♭ area or none) |
| M&H p. 97 | ♭VII7 "is far more common … as part of a cycle 5 progression passing through the relative major, as in 'Autumn Leaves.'" | agrees with F7 being V7 of B♭ |
| M&H p. 102 | "Progressions containing IV-7 ♭VII7 ♭IIIMaj7 are heard as diatonic minor key activity, with no secondary dominant effect" (the standard Cm7 F7 B♭Maj7) | the engine's `tonicized` rule is the more generous of the two readings; scales identical |
| N&G p. 90 | "the stress placement of chords and melodic cadences determines which is in effect at any given moment" | source-silent for the library's alternate changes |
| Levine | no statement on the key of Autumn Leaves (p. 185 uses it only to illustrate predictability) | source-silent |

The D7 scale (bars 6, 26, 30) is Area A's (A1 has it SPLIT).

### 3.6 Joy Spring (F; engine F 1–7, G♭ 8–15, G 16–17, F 18–19, E♭ 20–21, G♭ 22–23, F 24–32)

M&H p. 171: "'Joy Spring' modulates to ♯I major for the second A section and again at the bridge", and "modulates to ♭VII major twice sequentially in the first four measures of the bridge". Engine: G♭ for the second A (bars 8–15), then at the bridge G, F, E♭, G♭ (bars 16–23). **Agree** (every tonic is one bar; M&H p. 179 Fig. 8.17 treats the same pattern, ii–V–I's modulating by whole steps with one-bar tonics, as modulation). Boundary: the engine starts each area at the ii (bar 8, bar 16); M&H counts from the downbeat of the new section. Bars 4, 12 (Bm7 E7), 28: "passing ii–V" = M&H p. 177 key of the moment. **Agree.** The candidate rule fails here (§4).

### 3.7 Moment's Notice (E♭; engine E♭ with D♭ 6–7, G♭ 14–15, D♭ 22–23)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 1, 4, 5, 12, 17, 20, 21, 28: Em7 A7, Abm7 Db7, Dm7 G7 not landing | passing ii–V, no area | Levine p. 28: Coltrane "deceptively used a I-II-III-IV progression to modulate from Eb into another key … A♭-7 … resolving it to D♭7, the II-V in G♭" (it lands on Dm7 in the chart, so Levine's "modulate" is the engine's passing ii–V). N&G p. 167: the subV7/V "may resolve as a V7/I ('Moment's Notice')", figure D-7 G7 | E♭-7 A♭7 | D♭maj7 marked "contiguous"; p. 168: chord scales "especially for the player, Dorian/Mixolydian" | agree |
| 6–7 Ebm7 Ab7 DbMaj7 | D♭ area, Ionian | N&G p. 167 (as above); the tonic is a half step below the dominant chain | agree |
| 10–11 B♭m7 E♭7 A♭Maj7 | no area; A♭ Lydian | KA6: V7/IV → IV Ionian (N&G p. 47, 60) | **engine-wrong** by N&G; M&H silent; Levine does not discuss |
| 14–15 Abm7 Db7 GbMaj7 (1 bar) | G♭ area, Ionian | G♭ is ♭III of E♭; KA7 | **SPLIT** (N&G p. 76 Lydian, p. 150 modulation by deceptive resolution) |
| 26–27 | as 10–11 | as 10–11 | engine-wrong |

### 3.8 A Night in Tunisia (D minor; engine D minor 1–19, F 21–24, D minor from the last A)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 1–8 E♭7 → Dm6/9 (tritone cadence) | D minor | N&G p. 57 (subV7); M&H p. 105–106 | agree |
| 17–20 Am7♭5 D7♯9 Gm (2 bars) | stays D minor (Gm = iv, diatonic) | M&H p. 100 Fig. 4.52 (V7/IV and related II resolving to IV-7: a secondary dominant in minor). A candidate-rule reading calls G minor a modulation: G Dorian either way | agree (same scale) |
| 21–23 Gm7♭5 C7♯9 FMaj7 | F area; FMaj7 Ionian | M&H p. 103: "A further way to tonicize ♭IIIMaj7 is to precede V7/♭III with its related II-7♭5. This is an effective aural signal that a tonicization of ♭III is specifically intended."; p. 88 (shift to the relative major). Gø7 is exactly that cue. N&G p. 90 | agree |
| 24 Em7♭5 A7♯9 → (E♭7 at the top) | still in the F area, labelled "V7/vi in F" | A7 is the V7 of D minor, the home key; the section after it begins E♭7 (the cadence into home is registered one bar later) | engine imprecise label; scale identical (A Altered, the ♯9 is written) |
| Tag: F♯7♯9 → F | tritone substitute, F "♭III of D minor" | M&H p. 105–106: the interlude "sets up the infamous solo break with the subV/♭III … the arrival of the major 3 of ♭IIIMaj7" | agree |

### 3.9 Nica's Dream (B♭ minor; engine B♭m, G♭ 9–12, B♭m 13–24, D♭ 38–47, B♭m 48–56)

| Bars | Engine | Sources | Mark |
|---|---|---|---|
| 1–8 B♭m(maj7) A♭m(maj7) G♭Maj7 Cø F7alt | B♭ minor | Levine p. 59: the first chord from B♭ melodic minor, the second from A♭ melodic minor | agree |
| 9–11 Abm7 Db7 GbMaj7 (shares bar 11 with Db9) | G♭ area, G♭ Ionian | ♭VI of B♭ minor, tonic for about one and a half bars. M&H p. 112–113: V7/♭VI → ♭VIMaj7 analysed in the minor key as "subdominant function"; p. 90 ♭VIMaj7 Lydian; N&G p. 81, 91 Lydian | **defensible-either-way, leaning engine-wrong** (M&H p. 113 brevity argument; but M&H p. 168 "confirming cadence" and Levine p. 357 favour the engine) |
| 33–37 Ebm7/Ab Ab7 DbMaj7 Bb7♭9 Eb7 | B♭ minor; DbMaj7 "♭III, the relative major itself" | M&H p. 102: IV-7 ♭VII7 ♭IIIMaj7 = "diatonic minor key activity" | agree |
| 38–47 Ebm7 Ab7 DbMaj9 … | D♭ area, D♭ Ionian | The same IV-7 ♭VII7 ♭IIIMaj7 as bars 34–35, now opened as an area because the ii is present (`tonicized`). M&H p. 102 would not call it a tonicisation; M&H p. 168 and 88 (a section's worth of D♭ cadences on strong bars) would. Scales identical (A♭ Mixolydian, D♭ Ionian) in both readings | defensible-either-way |

### 3.10 How High the Moon and Ornithology (not in the chart set; reasoned from the changes)

Sources: M&H p. 171: HHtM "modulates to ♭VII major in the second phrase and then again by the same distance in the third phrase"; p. 174: HHtM "(the basis for Charlie Parker's 'Ornithology')" is a "clear example" of the pivot device in which the modal-interchange chords I-7 IV7 of the parallel Dorian are read as the II V of the key a whole step below; N&G p. 165 (Trane's "Satellite" is "How High The Moon" reharmonised); Levine p. 363 (same) and p. 417 (Ornithology is a contrafact of HHtM; no key analysis). Nothing on disk gives either tune's changes, so the A-section analysis below uses the standard changes (Gmaj7 | Gm7 C7 | Fmaj7 | Fm7 B♭7 | E♭maj7 | Am7♭5 D7 | Gmaj7), *practice, unsourced*, with the F and E♭ steps corroborated by M&H p. 171.

By code reading, the engine opens F (Gm7 C7 → Fmaj7, F Ionian) and E♭ (Fm7 B♭7 → E♭maj7, E♭ Ionian), each with a one-bar tonic, then returns home at Am7♭5 D7 → Gmaj7. Same reading as M&H p. 171. **Ornithology and HHtM have identical chords, so the engine's analysis is identical (§14: the melody is the only difference).** The candidate ≥ 2-bar rule would leave both tonics unrecognised, contradicting M&H p. 171 and 174. The *other* M&H reading of Gm7 C7 (G Dorian "I-7 IV7") gives G Dorian on Gm7: the same scale as the engine's "ii of F". Mark: agree; the ♭VII target (F, E♭ against G) is the KA7 question, SPLIT (M&H "modulates"; Chediak p. 117 d treats ♭VII7M after V7/♭VII as a passing resolution).

---

## 4. The candidate rule tested

Candidate (BRIEF): "a ii–V tonicises; a cadence whose tonic lasts ≥ 2 bars (or is followed by its own diatonic chords) modulates."

**What supports it.** M&H p. 168: "A tonic chord with a very long duration can also serve to confirm the new tonal center." M&H p. 113: a short tonicisation "does not suggest a change to the relative major key". M&H p. 88: "primary metric position". N&G p. 47–51: stress placement.
**What contradicts it.** Levine p. 355 (key centers lasting "only a bar or two"); N&G p. 147 ("a modulation may occur for only one chord") and p. 151 ("another single chord modulation"); M&H p. 168 ("II V I" is itself a confirming cadence), p. 179 Fig. 8.17 and p. 180–181 (V7–Imaj7 as the modulation, tonics a bar long).

| Tune | Candidate rule gives | Sources and engine | Result |
|---|---|---|---|
| ATTYA | C (2 bars) yes; E♭ (1 bar, then its own A♭Maj7) yes; G (2 bars) yes; **E (1 bar, then C7♯5) no** | Levine p. 247; Terefenko: E is a key | fails on E (EMaj7 would become Lydian, "non-tonic major") |
| Giant Steps | no tonic lasts two bars; none is followed by its own diatonic chords | Levine p. 204; N&G p. 163; M&H p. 181 | fails on all eleven areas |
| Moment's Notice | D♭, G♭, A♭ (1 bar each): none | Levine p. 28; N&G p. 167 | fails (D♭Maj7 would be Lydian) |
| Joy Spring | bridge tonics all one bar: none | M&H p. 171, 179 | fails |
| Stella | Cm7 (2 bars) modulates to C minor | Same scales as "ii" | no scale effect |
| Lady Bird | A♭ bars 9–10 (2 bars) yes; **bar 16 (2 beats) no** | N&G p. 83 (modal interchange) agrees; Levine p. 357 does not | differs from the engine on bar 16 only |
| Autumn Leaves | Gm (2 bars) yes (global); B♭Maj7 (standard changes, then its own E♭Maj7) yes | M&H p. 88–89 | no scale effect |
| Night in Tunisia | Gm (2 bars) modulates; **F (1 bar) no** | M&H p. 103 cue | no scale effect (♭III Ionian in a minor area either way, M3) |
| Nica's Dream | **G♭ (about 1½ bars) no**; D♭ (1 bar each, repeated cadences) no | M&H p. 113, 168 | the only place the clause does what the sources hint at (G♭ Lydian) |

**Verdict.** Reject as a general rule: it removes real key areas (E in ATTYA, all of Giant Steps, Moment's Notice, Joy Spring's bridge) that every source recognises. Its useful half (brevity blocks a *borrowed* chord from becoming a key, M&H p. 113) applies only to targets that are modal-interchange chords of the parallel mode (KA7), where the sources themselves split.

---

## 5. Minor keys (shape-3 questions 4)

**N&G.** Four minor sources are recognised (natural, harmonic, melodic, dorian minor, p. 84–85) and "about three times more chords are available in minor key than in major" (p. 86); the diatonic chords of natural and of harmonic minor are listed on p. 87, with the remark that "In most cases the V7 is used (instead of V-7), because of its primary dominant function" (p. 88); iiø7–V7 are "borrowed from harmonic minor, not from natural minor" (p. 80). So the engine's composite (§5.5: natural-minor chords, V7 and vii°7 from harmonic) is a subset of N&G's own harmonic material, and the reference-scale rule (harmonic minor only for the primary V7) is N&G p. 80/91. **AGREE.** Not covered: IV7 (V7/♭VII), ii-7 and vi-ø7 (p. 88, 91) are "chromatic" in `diatonic()`; no library tune is affected, but a dominant on IV resolving to ♭VII7 would not form a cadence.

**Relative major/minor (Autumn Leaves, Beautiful Love).** N&G p. 90: relative keys "share the same diatonic … the stress placement of chords and melodic cadences determines which is in effect". p. 84: I major and ♭III major "tunes moving freely between them ('Softly' or 'On Green Dolphin Street') … The composer's/arranger's/player's choice of chord scales is what makes this movement to the new key possible"; p. 76: ♭IIImaj7 Lydian "holds the progression to the key of I major". M&H p. 88–89, 97, 102–103, 113 as in §3.5. Chediak p. 71. Common minor-key schemes in N&G p. 90: i alone; i + relative major; i + parallel major; and two longer chains. The engine's behaviour: `diatonic()` makes ♭III and ♭VI part of the minor key, so a cadence into them stays in the minor key unless it is a full ii–V–I (`tonicized`); the tie-break favours minor (§5.2). This is defensible against both books (N&G: stress decides; M&H: tonicisation needs a cue) and changes no scale on any library tune.

**Beautiful Love.** Not in the library or the chart set; no source on disk mentions it (Levine lists it only in a tune index). Practice (unsourced): a D-minor tune built on iiø7–V7♭9–i cadences; with those cadences all landing on the global tonic, the engine's reading is one area (D minor), which is the sources' reading of a minor tune without a relative-major bridge. No verdict beyond KA9 can be sourced.

**Levine contrast.** Levine p. 75–76 teaches the minor II–V–I as three different melodic-minor scales and says harmonic minor is rarely heard; the engine's harmonic-minor reference is N&G's, not Levine's. That is an Area A (V7 → minor) matter, recorded in A1 as SPLIT.

---

## 6. Terefenko (verification status)

- *Jazz Theory: From Basic to Advanced Study*, 2nd ed. (Routledge, 2018): only the table of contents was retrievable (publisher page, pageplace preview). Chapters that matter: 13 "Idiomatic Jazz Progressions" (section "Four-Bar Modulations"), 20 "Analyzing Jazz Lead Sheets" ("Two-Level Analysis", "All the Things You Are"), 23 "Reharmonization Techniques" (a "Tonicization" heading). **No text of those chapters was read; no definition of tonicisation vs modulation is verified from the book.**
- D. Terefenko, "Jazz Transformations of the ii7–V7–I Progression", *Current Research in Jazz* 1 (2009), http://www.crj-online.org/v1/CRJ-JazzTransformations.php: the quotations in §1 were returned by a fetch tool (short excerpts only; the page reproduces a paper on All the Things You Are). His "mm. 33–35" and "m. 30" match the library chart (bars 33–35 B♭m7 E♭7 A♭6; bar 30 G♭13). His "mm. 6 or 14 … C major and E♭ major, respectively" **do not match the chart's bars for E♭ (10–12)**; his figure may be numbered differently. Treated as **secondary and unverified** for measure numbers; the *terminology* (tonicisations of secondary key areas against the confirming tonic ii–V–I) is what I rely on.

---

## 7. Proposed changes (output shape 3)

Only one change is a code change; the rest are documentation. No change to the principles.

### D-K1. IV after its own dominant is the key of the moment (rule M3/M4; §5.3 text) — DIFFER fix

- **Change.** A major chord that is the target of a dominant a fifth above (V7/IV) or a half step above (subV7/IV), where the target is IV of the local key, takes M3 (Ionian) instead of M4 (Lydian). It still opens no area (it is diatonic); only its scale changes. Lydian becomes its Advanced rung (the existing Ionian → Lydian ladder, §11).
- **Sources.** N&G p. 47, 60 (image-verified p. 47); Levine p. 120 (Stella, image-verified). M&H p. 23 states Lydian for IVMaj7 without addressing the case: M&H is silent, not opposed. Principle 4 (tensions diatonic to the key of the moment) is satisfied: the dominant has made IV the key of the moment. Principle 7: Ionian is the sources' Standard, Lydian the colour.
- **Reason string.** "the B♭7 before it makes E♭ the key of the moment: the 4th (A♭) is in the key" (player's words: "B♭7 sets up E♭; play E♭ as home").
- **Test.** `key: Bb` / Stella by Starlight: `A | 5 | Fm7`, `A | 6 | Bb7`, `A | 7 | EbMaj7` → `Eb Ionian` (was Eb Lydian). `key: Eb` / Moment's Notice: `A1 | 10 | Bbm7`, `A1 | 10 | Eb7`, `A1 | 11 | AbMaj7` → `Ab Ionian` (same at bars 26–27). Negative test: a IV not preceded by its dominant (ATTYA bar 5, D♭Maj7 after A♭Maj7) stays Lydian.
- **Level.** Ionian Standard; Lydian Advanced.

### D-K2. Document that the engine's area rule is the sources' rule; do not adopt the ≥ 2-bar clause

- **Change (documentation, plan §5.3).** Replace the unexplained heuristic with: "A V7 or ii–V that lands on a chord outside the key in force names a key of the moment; the landing chord's key opens an area (M&H's confirming cadence; N&G's deceptive-resolution modulation; Levine's key center); a ii–V or V7 chain that does not land is a key of the moment without an area (M&H p. 177)." Add that no source gives a duration test.
- **Reason string.** Unchanged ("V7 of the new key", "passing ii–V: its own key").
- **Test.** Pin the existing areas: ATTYA bars 21–23 area E (a one-bar tonic); Giant Steps' eleven areas (§3.4); Joy Spring bridge G, F, E♭, G♭; Moment's Notice bars 4 and 12 no area.
- **Level.** n/a.

### D-K3. (Optional, SPLIT: recommend **not** to implement) short borrowed tonics

- **Change considered.** A cadence into a ♭III/♭VI/♭VII major chord of the parallel mode opens an area only if the tonic lasts ≥ 2 bars, or is followed by another approach (a sequence), or begins a section; otherwise the target is a borrowed chord, Lydian.
- **Why not.** Supported by N&G p. 76, 81, 91, M&H p. 90, 113, Chediak p. 117; opposed by Levine p. 357, M&H p. 171 (HHtM, ♭VII) and p. 168 (a confirming cadence is enough). It would touch two library rows only (Nica's Dream bar 11, Lady Bird bar 16), and the "followed by another approach" clause is needed to keep Joy Spring's bridge and Moment's Notice intact, making the rule impossible to say in a player's words (principle 6). Leave to an author's `@key`/`# keep:`.
- **Test if adopted.** `key: Bbm` / Nica's Dream: `A1 | 9 | Abm7`, `A1 | 10 | Db7`, `A1 | 11 | GbMaj7` → `Gb Lydian` ("a borrowed ♭VI for two beats, not a new key").

### D-K4. Corrections to the plan text (no code)

1. §5.3 and §9 Autumn Leaves: the B♭/G alternation describes the *standard* changes (via `tonicized`); the library chart (alternate changes) is one G minor area.
2. §9 ATTYA bar 9: Cm7 is in the C area ("borrowed minor chord", the saved reason), not "iii of A♭"; either way C Dorian.
3. §5.3, last paragraph: "either way it gets Lydian … relative-key ambiguity rarely matters" is right for Autumn Leaves; add that M&H p. 102 would call Cm7 F7 B♭Maj7 "diatonic minor key activity".
4. Giant Steps: record in the chart that `key: Eb` is arbitrary (Levine p. 95 "in B"; N&G p. 163 no home); consider `key: B`.
5. Night in Tunisia bar 24: the closing Em7♭5 A7♯9 is V7 of D minor, not "V7/vi in F"; label only.

### Rejected

- A ≥ 2-bar test (§4).
- Adding dorian-minor chords (IV7, ii-7) to `DIATONIC_MINOR`: N&G supports it, no library tune needs it.

---

## 8. Open questions the sources cannot settle

1. **Borrowed tonics (KA7).** Whether a ii–V–I into ♭III, ♭VI or ♭VII is "a key" (Levine; M&H p. 171) or "a borrowed chord prepared by its dominant" (N&G p. 76, 81, 146; Chediak p. 117). The sources split by author, and no mechanical test is given.
2. **When an area closes.** None of the five sources states a closing rule (KA5).
3. **Terefenko's actual criterion** between a "secondary key area" and a modulation (ch. 13 "Four-Bar Modulations", ch. 20) was not available.
4. **Metre.** N&G's secondary/sequential and related-ii tests are metrical (p. 47–51, 68); the engine ignores metre (§14). Whether a metre input is worth adding is a design question.
5. **Multitonic tunes and `key:`.** N&G and M&H say no home key; the engine requires one. Not a scale issue today.
6. **How High the Moon / Ornithology and Beautiful Love** need charts to be tested; the sources do not contain their changes.

---

## 9. Bibliography and unverified citations

**Editions.**
- Nettles, Barrie, and Richard Graf. *The Chord Scale Theory & Jazz Harmony*. Rottenburg, Germany: Advance Music, 1997.
- Mulholland, Joe, and Tom Hojnacki. *The Berklee Book of Jazz Harmony*. Boston: Berklee Press, 2013.
- Levine, Mark. *The Jazz Theory Book*. Petaluma, CA: Sher Music, 1995.
- Chediak, Almir. *Harmonia e Improvisação*, vol. 1. Rio de Janeiro: Lumiar (printed footer pages).
- Terefenko, Dariusz. "Jazz Transformations of the ii7–V7–I Progression." *Current Research in Jazz* 1 (2009). *Jazz Theory: From Basic to Advanced Study*, 2nd ed. New York: Routledge, 2018 (contents only).

**Citations whose page number or wording is unverified.**
1. Every Terefenko citation (§1 table, §3.1, §6): quotations are from a fetch-tool excerpt of the CRJ article; the measure numbers for the E♭ and C areas ("mm. 6 or 14") disagree with the chart; nothing from the 2018 book text was read.
2. Levine pp. 20–23, 28, 39, 75–76, 95, 185, 202–204, 247, 284, 287, 355–357, 363, 396, 417: page numbers are from the `PDF − 16` offset and the printed footers in the text layer; pp. 120 and 352 were checked on rendered images. Levine's quotations in the table come from a text layer with interleaved figure text and were re-read in context, but not each against an image.
3. M&H pp. 23, 39, 52, 88–90, 97, 102–103, 105–106, 112–113, 120, 166–181, 238: from the `PDF − 12` offset and printed footers (p. 103, 113, 169, 177 confirmed); not rasterised.
4. N&G pp. 41–43, 51–55, 60, 67–68, 73, 80–91, 118, 146–148, 163–168, 171: text layer plus footers; pp. 47, 76, 150, 151 confirmed on images. p. 90's quotation is from the text layer.
5. Chediak vol. 1 pp. 71, 94, 96, 106, 107, 111, 116–119: printed footers; text layer only (the OCR is noisy in the examples, so chord details in his examples, e.g. p. 117 d, were read from OCR text of the example label "V7/♭VII ♭VII7M").
6. How High the Moon / Ornithology changes in §3.10: practice, unsourced.
7. Plan/engine statements about charts not run (standard Autumn Leaves changes, HHtM): by code reading, not executed.

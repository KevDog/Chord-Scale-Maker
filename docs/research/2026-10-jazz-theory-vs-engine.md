# Jazz theory against the analyser: findings and proposed changes

Date: 2026-10-10. Status: research complete; decisions taken 2026-10-10 and written into three specs — [function labels](../superpowers/specs/2026-10-10-function-labels-design.md), [analysis rules](../superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md), [chart context](../superpowers/specs/2026-10-10-chart-context-design.md). Scope: the analysis rules
(docs/plan-analysis.md §5–§7; `web/engine/analysis/`), compared with the published sources listed in §2. The
six detailed reviews this document synthesises are in [2026-10-jazz-theory-vs-engine/](2026-10-jazz-theory-vs-engine/)
(A1 dominants, A2 other families, B context and metadata, C function vocabulary, D key areas, E edge cases), with
the brief they worked from. Every verdict below carries a book-page citation in the review it came from; page
numbers are the printed book pages (offsets stated in each review's §0).

## 1. Summary: the findings that matter

| # | Finding | Verdict | Where |
| --- | --- | --- | --- |
| 1 | A IV chord reached by its own dominant (`Fm7 B♭7 E♭maj7` in B♭) is Ionian in Nettles & Graf (p. 47) and in Levine's own Stella analysis (p. 120); the engine gives Lydian (M4). | DIFFER | D-K1 |
| 2 | In a blues, both Berklee texts make IV7 Mixolydian by default (N&G p. 105; M&H pp. 93, 125, 136–137); the engine gives Lydian Dominant. The I7 is right (Mixolydian) but 47 of 98 library I7s are reasoned as "extended dominant", which M&H p. 136 explicitly warns against. | DIFFER | A1 P1, B C2 |
| 3 | Both Berklee texts prescribe a key-derived eight-note "diatonic diminished" scale for functional °7 chords and call the symmetric Whole-Half "optional … for special situations" (N&G pp. 114–116; M&H pp. 149–162). Levine and Chediak give Whole-Half. The engine's fixed Whole-Half (d1) is therefore the hipper choice, which principle 7 reserves for Advanced. Separately, d1's reason "the rootless V7♭9 of the next chord" is false for passing and auxiliary chords (Wave's B♭°7 is A7♭9, not E7♭9). | SPLIT, Berklee against the engine | A2 C1, E1–E2 |
| 4 | The key-area rule (§5.3) is the sources' own rule: a cadence that lands outside the key in force opens a key of the moment; one that does not land is a passing ii–V. Giant Steps' eleven areas equal Levine's Fig. 15-1 exactly; Joy Spring and All the Things match M&H and Terefenko. The brief's candidate "≥ 2-bar" clause is contradicted by N&G p. 147, M&H pp. 180–181 and Levine p. 355 and would delete real key areas in four library tunes. | AGREE; candidate rule rejected | D |
| 5 | The function vocabulary is Berklee's, with four label errors on the Changes sheet: a dominant into the key's own V7 prints `II7` (every source: `V7/V`, or an arrow for chain links); a diatonic chord acting as a related ii loses its degree (`Em7 A7 Dm7` prints `ii7/ii`, Berklee prints `iii7` with a bracket); ascending °7s print flat-side (`♭ii°7` for `♯I°7`); textbook borrowed dominants (♭VII7, ♭VI7) are labelled "chromatic dominant … a guess". | DIFFER (labels only; scales unaffected) | C V1–V6 |
| 6 | "Tensions diatonic to the key of the moment" (principle 4) is Berklee's rule for secondary dominants with diatonic roots, almost verbatim (N&G p. 43; M&H p. 42), with the ♯9 rider: wherever the ♭9 is diatonic Berklee prints the eight-note scale, of which the engine's Phrygian Dominant is the seven-note subset. Berklee uses the chord's own scale, not the key's, for subV7, sequential, special-function and blues dominants, as the engine does. | AGREE (subset) | A1 §0 |
| 7 | V7 to a minor chord is the deepest split in the literature: Berklee Mixolydian (♭9, ♯9, ♭13) with Altered as the stated alternative; Levine Altered, with harmonic minor "in fragments". The engine's Phrygian Dominant is Chediak's scale and inside Berklee's; Altered is missing from the ladder. | SPLIT | A1 P3 |
| 8 | Modal and blues detection are fair proxies for the sources' criteria but miss the discriminator the sources lead with (modal music is poor in dominants: M&H p. 187, N&G p. 153). Locomotion, a blues with a bridge, is read as modal; Parker and minor blues are not blues to the engine because bar 1 is not a dominant, which no source requires. A chart-level `context:` field is justified by principle 1; bossa/samba is not an analysis context (Chediak applies one system to the whole MPB songbook). | DIFFER (detection); metadata proposed | B |
| 9 | Three conventions in §7.3 are attested: tonic minor Dorian (N&G p. 91, M&H p. 84, Levine p. 225); related ii Dorian (N&G p. 73); the m6 Dorian/Melodic-Minor order (N&G p. 91, with M&H and Chediak the other way round). One is not: iii7 Dorian (m9) is Phrygian in both Berklee texts and in Chediak, with Dorian only "in contemporary, less consonant music". | AGREE ×3; SPLIT on iii | A2 |
| 10 | The engine's lower-case numerals (`ii7`, `V7/ii`) appear in none of the five texts on disk, which all write upper case; but Terefenko, "Jazz Transformations of the ii7–V7–I Progression" (*Current Research in Jazz* 1, 2009) uses them, so the convention has a scholarly precedent. Keep it; make the grammar accept the Berklee spellings. | DIFFER (notation); no change recommended | C §4.2, G1–G7 |

Three corrections to the brief, owned here: Levine's default for a tonic major 7th is Ionian, not Lydian (p. 37;
Lydian is his IV-chord scale, p. 39); Levine writes upper-case numerals, not lower; and the "≥ 2-bar" tonicisation
test I proposed does not survive the sources.

## 2. The sources and how they were weighed

**Berklee (primary).** Nettles & Graf, *The Chord Scale Theory & Jazz Harmony* (1997), is the system: every chord
scale is chord tones plus tensions diatonic to the key, with avoid notes marked, and function decided by root
motion and harmonic stress. Mulholland & Hojnacki, *The Berklee Book of Jazz Harmony* (2013), restates it with more
practice and more exceptions (bebop-era ♯9 on V7/II; "key of the moment"; modal interchange chords take their own
source scale, "the diatonic-tension method will often give unmusical results", p. 129). Where the two differ (the
related ii of a substitute dominant, the scale of ♭III°7, V7/iv in minor, m6) this document says so.

**Levine (override where practice has plainly won).** *The Jazz Theory Book* (1995) assigns scales by chord type
and resolution, not by key, and prefers the melodic-minor modes (Altered on V7 to minor, Locrian ♮2 on ø7, Lydian
Dominant on subV7). He is the source for "what players do"; he is not a rule system, and several of his
preferences are reharmonisations (replace the chord) rather than scale choices for the written symbol.

**Chediak (Brazilian).** *Harmonia & Improvisação* (Lumiar, 1986, 2 vols) is Berklee-derived with two house
differences: Aeolian on a plain tonic minor, and the harmonic-minor-from-the-5th scale on V7(♭9) — which is the
engine's Phrygian Dominant. He applies one analytical system to the whole bossa/MPB songbook. The *Songbook Tom
Jobim* was used only as the authoritative changes for Wave and Garota de Ipanema.

**Terefenko.** Only the 2009 article and the 2nd-edition table of contents could be read; his vocabulary
("tonicizations of the secondary key areas" versus the confirming ii–V–I) is used, his criteria are not.

**Not consulted.** Aebersold (only a web summary of the Scale Syllabus), Coker, Baker, Russell, Ligon, Bergonzi,
Crook, Faria: no primary text was available and web summaries were not relied on. Nothing below rests on them.

**Weighing.** Berklee decides a rule's default; Levine decides what the Advanced rung should offer; where Berklee's
two texts split, principle 4 (tensions diatonic to the key of the moment) and principle 7 (the diatonic choice at
Standard) break the tie. A finding that conflicts with a principle is stated and left for decision.

## 3. Findings by area

Verdicts: AGREE (the rule is what the primary prescribes); DIFFER (the primary prescribes otherwise); SPLIT (the
sources disagree among themselves); UNDERSPECIFIED (no source addresses it). Full rows with quotations are in the
reviews.

### 3.1 Dominant and sus rules (A1)

| Rule | Engine | Sources | Verdict |
| --- | --- | --- | --- |
| D1 `alt`, `7♯11` | Altered; Lydian Dominant | All agree | AGREE |
| D1 `7♭9` | Phrygian Dominant or Half-Whole, by the key's 13 | Berklee: the 8-note ♭9 ♯9 ♭13 scale; Levine p. 81: Half-Whole | SPLIT |
| D2 subV7 | Lydian Dominant | N&G p. 57, M&H p. 67 ("no matter what its target"), Levine p. 281 | AGREE |
| D3 extended dominant | Mixolydian | N&G p. 54 explicit; M&H and Levine name no scale (plan §10.6 overstates) | AGREE (N&G) |
| D4 V7, V7/IV, V7/V in major | Mixolydian | All agree | AGREE |
| D4 V7/ii | Mixolydian ♭6 | N&G first choice; M&H pp. 45–46 "has issues", prefer ♯9 ♭13; Levine p. 66 "seldom played"; Chediak agrees with engine | SPLIT |
| D4 V7/iii, V7/vi; V7 → minor | Phrygian Dominant | Berklee: the 8-note scale (♯9 rider, N&G p. 43); Levine: Altered; Chediak: engine's scale | DIFFER (subset) / SPLIT |
| D4 plain `V7` in a minor key | ♭9 derived from natural minor | N&G p. 91 prints "V7: Mixolydian (♭13)" — natural 9 — and reserves ♭9 for the `V7(♭9)` symbol | DIFFER (N&G only) |
| D5 back door ♭VII7 | Lydian Dominant | N&G p. 80, M&H p. 130, Levine p. 281 | AGREE |
| D5 blues I7 | Mixolydian | N&G p. 105: Mixolydian ♯9 first; Levine: the blues scale; "the melody decides" | SPLIT |
| D5 blues IV7 | **Lydian Dominant** | N&G p. 105, M&H pp. 93, 125: Mixolydian default, Lydian ♭7 the alternative | **DIFFER** |
| D6 chromatic non-resolving | Lydian Dominant | N&G p. 123, M&H p. 238: either Lydian ♭7 or Mixolydian | AGREE (permitted) |
| D7 static / modal | Mixolydian | M&H pp. 189–190 | AGREE |
| s1 sus ♭9 | Phrygian | M&H p. 97, Levine p. 48 (p. 60 adds Dorian ♭2) | AGREE |
| s2 resolving sus | Mixolydian, ♭6 if in key | Mixolydian everywhere; no source gives a ♭13 variant for a sus | AGREE / UNDERSPECIFIED (♭6) |
| s3 static sus | Mixolydian | All agree | AGREE |
| §7.5 passing ii–V | Dorian + Mixolydian | N&G p. 73; M&H p. 177 ("key of the moment") | AGREE |

### 3.2 Major, minor, half-diminished, diminished (A2)

| Rule | Engine | Sources | Verdict |
| --- | --- | --- | --- |
| M3 tonic Imaj7 | Ionian | N&G p. 26, M&H p. 21, **Levine p. 37**, Chediak: Ionian; Lydian is the colour (the existing Advanced rung) | AGREE |
| M4 IV, ♭VI, ♭II, ♭III, ♭VII in major | Lydian | M&H p. 129 is the rule verbatim; N&G pp. 33, 76, 81, 133 | AGREE |
| M4 ♭VII major chord in a **minor** key | Lydian | N&G p. 91: Ionian (B♭ Ionian is C Dorian's notes; Lydian needs E♮ against E♭) | DIFFER |
| M5 modal major | Lydian | Berklee derives from the named mode: right for a Lydian tonic, wrong for the mode's relative-Ionian chord | DIFFER (partial; needs the mode) |
| m1 m(maj7); m3 ♭6 | Melodic Minor; Aeolian | All agree | AGREE |
| m2 m6 | Dorian (Melodic Minor Advanced) | N&G p. 91 Dorian first; M&H p. 85 and Chediak p. 341 melodic minor first for the tonic i6 | SPLIT |
| m4 related ii | Dorian | N&G pp. 72–73, M&H p. 58 | AGREE (iii as related ii: M&H p. 57 keeps Phrygian) |
| m5 tonic minor | Dorian "by convention" | N&G p. 91, M&H pp. 84–98, Levine p. 225: attested; Chediak: Aeolian | AGREE |
| m7 vi | Aeolian | N&G p. 33, M&H p. 24; reason text wrong: the ♭13 is the avoid note, not a tension | AGREE (reason DIFFER) |
| m7 v of minor | Phrygian | M&H p. 97 Phrygian; N&G p. 91 Aeolian | SPLIT |
| m8 borrowed iv7 | Dorian | N&G p. 79, M&H p. 129 (the stale `chord_scales.json` note says Aeolian) | AGREE |
| m9 iii7 | Dorian | N&G p. 33, M&H p. 23, Chediak p. 48: Phrygian (Aeolian as related ii, M&H p. 57); Dorian "contemporary" (Chediak) | SPLIT; conflicts with principles 4 and 7 |
| h1 modal ø7 | Locrian ♮2 | No modal chapter has a ø7 at all (N&G p. 153 "avoided"; M&H p. 187); Levine's post-1960 colour | UNDERSPECIFIED |
| h2 ø7 | Locrian | Berklee and Chediak Locrian; Levine ♮2 (the Advanced rung already) | AGREE / DIFFER (Levine) |
| d1 °7 | Whole-Half | Berklee: diatonic diminished (key-derived, 8 notes), Whole-Half "optional"; Levine p. 84 and Chediak: Whole-Half | SPLIT; **Berklee against engine** |

### 3.3 Context detection (B)

| Test | Engine | Sources | Verdict |
| --- | --- | --- | --- |
| Modal: few cadences; slow harmonic rhythm | < ⅓ of chords; median ≥ 2 bars | M&H p. 183 lists six marks; p. 189 six factors; no source gives numbers | AGREE as proxy |
| Modal: poor in dominants and ø7 | not tested | M&H p. 187, N&G p. 153 | UNDERSPECIFIED (missing test; Locomotion) |
| Modal per section | whole tune | M&H p. 183: "the overwhelming majority instead have one section"; Chediak "misto" | DIFFER (granularity) |
| Blues: 12/24 bars; IV at bar 5 | required | N&G p. 108, M&H p. 136 | AGREE |
| Blues: dominant on bar 1 | required | M&H p. 140 defines a blues by position and function; Parker blues opens on Fmaj7 (Levine p. 228) | DIFFER |
| Blues: 8, 16, 12-12-8-12 forms | not detected | N&G pp. 108–109, M&H p. 142, Levine p. 226 | UNDERSPECIFIED |
| Blues I7 reasoned as extended dominant | D3 before D5 | M&H p. 136: "I7 should not be confused with V7/IV" | DIFFER (reason) |
| Minor blues | minor-key rules | Levine p. 225, M&H pp. 143–144, N&G p. 103: minor-key harmony on the blues form | AGREE (label missing) |
| Bossa/samba as a context | none | Chediak: one system; Berklee analyses Wave and Ipanema with ordinary labels | AGREE (not a context) |

### 3.4 Function vocabulary and notation (C)

Vocabulary: AGREE throughout (V7/x, subV7, related ii, back door (M&H's term), passing/auxiliary/leading-tone °7,
V7sus4, modal interchange). "Passing ii–V" and "non-resolving" are the engine's own words; Chediak's "extended
ii–V" and Berklee's "special function dominant" are the sources'. Four label DIFFERs on the sheet (§1 row 5);
"deceptive" means three things across the sources. Notation: all five texts write upper-case numerals; Terefenko
writes lower; the engine's lower-case-carries-quality design is coherent and now has a citation. The grammar
rejects the Berklee spellings a trained reader will type (`II-7`, `VII-7(♭5)`, `SubV7/II`, `V7(sus4)`, `(V7/II)`,
`B♭:` and the Mac's `∆` U+2206) and reads `V7/II` as a *major* target where Berklee means Dm7.

### 3.5 Key areas and cadences (D)

| Rule | Engine | Sources | Verdict |
| --- | --- | --- | --- |
| A V7/ii–V to a diatonic target opens no area | yes | N&G pp. 41–42, M&H p. 39, Chediak p. 106 | AGREE |
| A cadence landing outside the key opens an area, however short | yes | N&G p. 147 ("a modulation may occur for only one chord"), M&H pp. 168, 180–181, Levine p. 355 | AGREE |
| A ii–V that never lands: its own key, no area | yes | M&H p. 177 "key of the moment"; N&G pp. 167–168 | AGREE |
| IV after V7/IV | Lydian | N&G p. 47 (image-verified), p. 60; Levine p. 120 (image-verified): **Ionian** | **DIFFER** |
| ♭III/♭VI/♭VII reached by its own ii–V–I | opens an area (Ionian) | Levine p. 357, M&H p. 171: a key; N&G p. 76, M&H p. 113, Chediak p. 117: a borrowed chord (Lydian) | SPLIT (Lady Bird bar 16, Nica's Dream bar 11 only) |
| When an area closes | at the next approach | No source states a closing rule | UNDERSPECIFIED |
| Composite minor as key-area membership | natural + harmonic V7 | N&G pp. 80–91: a subset of N&G's own lists | AGREE |
| Metre | ignored (§14) | N&G's secondary/sequential and related-ii tests are metrical (pp. 47–51, 68) | UNDERSPECIFIED (stated limit) |

## 4. Edge-case verdicts

| Case | Engine (rule → scale) | Verdict | Fix |
| --- | --- | --- | --- |
| Autumn Leaves `Am7♭5 D7 Gm` | D4 → D Phrygian Dominant | SPLIT (= Chediak; ⊂ Berklee; Levine Altered) | None; Altered to the Advanced rung (P8) |
| Blue Bossa `E♭m7 A♭7 D♭maj7` | area opened; D♭ Ionian | SPLIT on the area; only D♭ Ionian/Lydian at stake | None (Lydian is the Advanced rung) |
| Girl from Ipanema bridge | G♭ Lydian (M4); B7 Lydian Dominant (D6); D7 Mixolydian ♭6 | SPLIT inside N&G (p. 84 interchange vs p. 146 modulation); the rest AGREE/permitted | Chart: the bridge is the Cookbook's, not Jobim's; see §7 |
| Wave `B♭°7` | d1 → Whole-Half, "passing", guess; reason names E7♭9 | DIFFER (Berklee); reason false (it is A7♭9, Levine p. 87) | P4; `Gm6` in bar 6 per the songbook |
| Stella `Em7♭5 A7♭9` | h2 Locrian; D4 Phrygian Dominant | SPLIT (as Autumn Leaves); the plan's `D1+D4` is printed `D4` | Documentation |
| Stella bar 7 `E♭maj7` after `B♭7` | M4 Lydian | **DIFFER** (N&G p. 47; Levine p. 120) | P1 |
| Footprints | modal by one chord's rounding; F♯ø7 → Locrian ♮2 (h1) | AGREE on every scale; h1 unsourced; flag brittle | P5 (`context: modal`), P6 (drop h1) |
| So What; Maiden Voyage | Dorian; Mixolydian on the sus chords | AGREE | None |
| Milestones bridge | `# keep: A Aeolian` | AGREE (Levine p. 52); the rule cannot see it | None (a section marker could replace `# keep:` later) |
| Beautiful Love `Eø7 A7♭9 Dm` | Locrian; Phrygian Dominant; Dorian | AGREE (Berklee) / DIFFER (Levine ♮2, Altered) | Regression test only |
| Mr. P.C. / Blues Minor | Dorian tonic and iv; ii–V or ♭VI7–V7 | AGREE (M&H p. 144; Levine p. 225) | Label `context: blues` |
| Solar `Cm` | m5 Dorian | UNDERSPECIFIED: the symbol decides; the usual lead sheet reads Cm(maj7) | Chart: `CmMaj7` if the source has it |
| Nica's Dream `B♭m(maj7) A♭m(maj7)` | m1 Melodic Minor | AGREE (Levine p. 59 is this example) | None |
| Night in Tunisia `E♭7 → Dm6/9` | D2 Lydian Dominant; m2 Dorian | AGREE; Dm6 SPLIT inside Berklee | P6 (tonic m6) |
| All the Things, Giant Steps, Joy Spring, Moment's Notice | key areas | AGREE with Levine Fig. 15-1, M&H p. 171, Terefenko; Moment's Notice bars 11 and 27 are the IV-Ionian case | P1 |

## 5. Proposed changes, ranked

Ranked by how much of the library they touch, weighted by how certain the sources are. No change alters a
principle; where a finding conflicts with one, the conflict is stated. Each change has the reason string the
engine would print (principle 6) and a test; rule ids are those `rules.ts` emits today (`D1`–`D8`, `M1`–`M5`,
`m1`–`m9`, `h1`–`h2`, `d1`, `s1`–`s3`; the table `RULES` in `rules.ts` should be updated with every change).

### P1. IV after its own dominant is Ionian (M3/M4; D-K1)

- **Change.** A major chord that is IV of the local key and is the target of a dominant a fifth above (V7/IV) or
  a half step above (subV7/IV) takes Ionian (M3). It opens no area. Lydian remains the Advanced rung.
- **Why.** N&G p. 47: "When V7/IV resolves to IVmaj7 … the chord scale for the IVmaj7 is Ionian. This is the only
  maj7 chord with this chord scale choice" (image-verified); p. 60 for subV7/IV; Levine p. 120 (Stella: "E♭∆ — 1st
  mode of E♭ major", image-verified). M&H is silent. Principle 4 is satisfied: the dominant made IV the key of the
  moment.
- **Reason.** "the B♭7 before it makes E♭ the key of the moment: the 4th is in the key".
- **Test.** Stella, `key: Bb`, bars 5–7 `Fm7 | Bb7 | EbMaj7` → E♭ Ionian (was Lydian). Moment's Notice bars 10–11
  and 26–27 → A♭ Ionian. Negative: All the Things bar 5 `DbMaj7` after `AbMaj7` stays Lydian.

### P2. The blues context (D5; detection)

- **Change (scale).** In a blues context IV7 takes Mixolydian; Lydian Dominant stays in the menu.
- **Change (order).** I7 and IV7 of a blues are decided by D5 before D3, so the I7 that precedes IV7 is not "an
  extended dominant".
- **Change (detection).** (a) A chart in which most chords are dominant 7ths is not modal unless they share one
  root (a Mixolydian tonic); (b) a 12-12-8-12 form (Locomotion, Tee Pee Time) is tested for the blues pattern on
  its first twelve bars; (c) a stated `key:` beats the detected blues key (`stated ?? blues`, today the reverse).
  Do not widen the bar-1 dominant test: Solar's and the Bird blues' key areas depend on their being read as
  functional; the `context:` field (P5) declares them instead.
- **Why.** N&G p. 105 ("The IV7 chord most often uses a Mixolydian scale"); M&H pp. 93, 125, 136–137 ("I7 should
  not be confused with V7/IV"); M&H p. 187 and N&G p. 153 (modal music is poor in dominants); Levine p. 226
  (Locomotion, "each A section is a 12-bar blues"). Conflict: principle 4 yields the ♯11 on IV7; plan §10.4 already
  carves this exception.
- **Reasons.** "IV7 of the blues: a subdominant with dominant colour, Mixolydian (the ♯11 is an extra colour)";
  "I7 of the blues: a tonic with dominant colour, natural tensions".
- **Tests.** F Jazz Blues `key: F`: bar 1 `F7` → F Mixolydian, rule D5 (not D3); bar 5 `Bb7` → B♭ Mixolydian, D5.
  Locomotion: context not modal; bar 5 `Eb7` → E♭ Mixolydian by D5. A 12-bar chart `Bb7 … Eb7` with `key: Eb`
  reports key E♭.

### P3. Function labels on the Changes sheet (C V1–V6; `numerals.ts`, `rules.ts` fn strings)

Scales are unchanged by all of these.

- **V1.** A dominant resolving into the key's own V7 prints `V7/V`; the earlier links of a chain of three or more
  print no numeral (an arrow). Test: `key: C`, `Cmaj7 | D7 | G7 | Cmaj7` → D7 prints `V7/V` (now `II7`); the Rhythm
  bridge `D7 G7 C7 F7` in B♭ → `→ → V7/V V7`. Sources: N&G pp. 51–55, 127; M&H pp. 49–50.
- **V2.** A diatonic minor or ø chord acting as a related ii prints its degree (`iii7`, `vi7`, `viiø7`), with the
  related-ii reason kept. Test: `Cmaj7 | Em7 | A7 | Dm7` → Em7 prints `iii7`; `Gm7 | C7 | Fmaj7` still `ii7/IV`.
  Sources: M&H pp. 52–53; N&G pp. 46–47, 67; Chediak p. 102.
- **V3.** Auxiliary °7 is defined by the next chord sharing its root, whatever precedes (`Dm7 G7 | C°7 | C6`).
  Sources: M&H p. 159; Chediak p. 103.
- **V4.** An ascending (leading-tone) °7 prints sharp-side (`♯I°7`, `♯IV°7`); descending and auxiliary flat-side.
  Sources: M&H pp. 148–152; N&G pp. 110, 113.
- **V5.** A `7sus4` followed by the same-root dominant is "V7sus4 before the V7: a subdominant suspension", not
  "static sus". Sources: M&H p. 6; N&G p. 38.
- **V6.** A non-resolving ♭VII7, ♭VI7 or ♭III7 in a major key is "borrowed: subdominant minor (modal interchange)",
  not "chromatic dominant"; borrowed major and ø chords carry the same tag; the guess flag clears. Reason: "♭VII7
  from the parallel minor: Lydian Dominant, it returns to I". Sources: M&H pp. 123, 130, 236–238; N&G pp. 74–82,
  123.
- Also print `V7sus4` rather than `V7sus` (M&H pp. 6–7; N&G `V7(sus4)`).

### P4. Diminished sevenths (d1; A2 C1, E1–E2)

- **Change (reason, certain).** d1's reason names the dominant the chord actually hides: for a `vii°7 of X` it is
  X's V7♭9; for a passing or auxiliary °7, the V7♭9 a half step below one of its notes that is the dominant of the
  next chord, or of the chord after a related ii (Wave: "passing diminished: A7♭9 without its A, the D7's dominant,
  with Am7 its ii"). Sources: Levine p. 87; N&G p. 114 ("do not contain the secondary dominant's tritone").
- **Change (scale, for decision).** At Standard a functional °7 takes Berklee's key-derived eight-note scale:
  ascending `vii°7 of X` → the scale D4 gives X's V7♭9, from the °7's root (which is X's harmonic minor plus the
  ♯9); passing and auxiliary → the chord tones plus the key's seven notes (M&H pp. 156–161; N&G p. 116 reaches a
  slightly different set for ♭III°7 by enharmonic equivalence — follow M&H, and say so). Whole-Half moves to
  Advanced; Harmonic Minor stays as a further rung. These are fixed degree formulas per function and belong in
  `SCALES` (ascending: `1 b2 b3 3 b5 b6 6 7`; the others per M&H's figures), not hand-typed note lists.
- **Why.** N&G pp. 114–116 (image-verified): "the symmetric diminished chord scale is an appropriate scale for use
  when the diminished 7th chord is not functioning diatonically"; M&H p. 162: symmetric "is often deployed as an
  optional chord scale for special situations". Principles 4 and 7 both point the same way. Against: Levine p. 84
  and Chediak p. 91 give Whole-Half, and on the bandstand the symmetric scale is what most players reach for; that
  is exactly principle 7's Advanced case.
- **Test.** Wave, `key: D`: bar 2 `Bbdim7` → Standard B♭ B C♯ D E F♯ G A (M&H p. 158 fig. 7.27 transposed); Advanced
  B♭ Whole-Half. `key: C`, `Cmaj7 | C#dim7 | Dm7` → C♯ D E F G A B♭ C (A7♭9's scale from C♯).
- **Cost.** New scale entries, the Standard/Advanced swap in `chord_scales.json`, every °7 in the library moves in
  the golden fixture. This is the largest change proposed; it can be deferred without blocking the others, but the
  reason-string fix should not be.

### P5. Chart metadata: `context:` (B 3.A–3.B)

- **Field.** `context: functional | modal | blues`; absent = detected. A stated context always wins (principle 1);
  the report prints which decided and the detection numbers ("modal (detected: 0 of 8 chords in cadences, median 2
  bars)"). `context:` is already the engine's word (`Analysis.context`); `style:` stays feel. A minor blues is
  `context: blues` with minor-key rules inside (no scale changes; Levine p. 225, M&H p. 143).
- **Section marker.** `@context SECTION BAR VALUE`, parallel to `@key`, holding until the next marker. Specify now;
  build when a chart needs it (no library chart does today — Bolivia and Recorda-Me get the right scales from the
  chord rules). It is the principle-1 safety valve for a modal section on a tonic major chord (Ionian by M3, Lydian
  wanted by M5) and for M5's relative-Ionian case.
- **Not proposed now.** `minor: dorian | aeolian` for rule m5: the sources split (Berklee and Levine Dorian;
  Chediak Aeolian) and the ladder already offers Aeolian at Basic; it is a house-style setting with no library
  chart needing it. Reserve the name.
- **Library edits.** Footprints `context: modal` (keep `style: Blues`); Locomotion and Tee Pee Time `context: blues`;
  Mr. P.C., Birk's Works, Côte d'Azur, Blues Minor, F/B♭ Bird Blues `context: blues`; Watermelon Man `context: blues`
  (16 bars; detection stays as is).
- **Sources.** M&H p. 183 (one section modal, "the overwhelming majority"); Chediak p. 121 ("misto"); M&H p. 140
  (a blues defined by position and function); Levine p. 220 ("some 12-bar tunes are not blues at all").

### P6. Smaller rule and reason changes (A2 C2–C3, A1 P2)

- **Tonic m6 → Melodic Minor at Standard; non-tonic m6 → Dorian** (m2). M&H p. 85 (i6 "prefer to conceive of scale
  degree 7 as a tension"), Chediak p. 341, and principle 5's composite minor (the tonic's raised 6th and 7th) all
  support it; N&G p. 91 lists Dorian first but gives both. Practice is unambiguous on the tonic (A Night in
  Tunisia's `Dm6/9` is D melodic minor, with the C♯ in the melody). Reason: "tonic minor sixth chord: melodic
  minor, the raised 7th is a tension". Test: Tunisia `Dm6/9` → D Melodic Minor; Wave `Gm6` (iv6 in D) → G Dorian.
- **♭VII major chord in a minor key → Ionian** (M3). N&G p. 91. Reason: "♭VII of C minor: B♭ major, the notes of
  C Dorian". Test: `key: Cm`, `BbMaj7` → B♭ Ionian; `AbMaj7` stays Lydian.
- **Drop h1** (modal ø7 → Locrian ♮2): no source has a ø7 in a modal system; h2's ladder already offers ♮2 at
  Advanced. Footprints' `F#m7b5` → F♯ Locrian at Standard; the chart may `# keep:` the ♮2. Removes an unsourced rule.
- **Reason strings that call an avoid note "in the key"** (m7 vi, m7 v of minor, h2): the ♭13, ♭2 and ♭9 are the
  scale's avoid notes in every source (N&G p. 27, M&H p. 24, M&H p. 97, N&G p. 28), so "the ♭13 is in the key" tells
  a player the opposite of what is meant. Reword: "vi: Aeolian, the key's own notes (the ♭6 is a passing note)".
  Also fix the stale `chord_scales.json` note that gives Aeolian "when the chord is vi or iv" (iv is Dorian).
- **s2 reason** ("with the 11 in place of the 3rd" echoes what Levine p. 46 calls a myth): "V7sus4 resolving down
  a fifth: Mixolydian, the 4th is a chord tone". Keep the derived ♭6: it is unsourced for a sus but is principle 4
  applied consistently, and Mixolydian ♭6 sits in the menu.

### P7. iii7 → Phrygian (m9) — reverses plan decision §7.3; for decision

- **Change.** iii7 of a major key takes Phrygian at Standard (its only tension the 11), Dorian at Advanced; as the
  related ii of V7/vi it keeps Phrygian (M&H p. 57), with Aeolian as M&H's alternate.
- **Why.** N&G p. 33, M&H p. 23 ("only the 11 sounds pleasingly consonant"), Chediak vol. 2 p. 48: Phrygian is the
  default in every Berklee-line source; Dorian is attested only as Chediak's "contemporary, less consonant" option.
  The plan's reason ("Phrygian puts a ♭9 a half step over the root") describes an avoid note, which Ionian's 4th and
  Aeolian's ♭6 also are; it does not single out iii. On the bandstand, over `Em7` in a `iii–vi–ii–V` in C, players
  think C major, and the F is a passing tone. Principles 4 and 7 both say Phrygian.
- **Against.** The plan recorded Dorian deliberately and the library was analysed with it; the Phrygian ladder's
  Advanced rung is Dorian ♭2, so a Dorian rung must be added.
- **Reason.** "iii: Phrygian, the key's own notes (the ♭2 is a passing note)". Test: `key: C`, `Em7` not before a
  dominant → E Phrygian; `Em7 | A7 | Dm7` → E Phrygian (related ii keeps the degree's scale, M&H p. 57).

### P8. Ladder: Altered as the Advanced rung on V7 → minor (A1 P3)

No rule change. Add Altered beside Spanish Phrygian on the V7-to-minor line (Levine's default, pp. 75–76; M&H
p. 95 "an alternative chord scale choice"). Test: `Dm7b5 | G7 | Cm7`, `key: Cm`: Standard G Phrygian Dominant;
Advanced offers G Altered.

### P9. Grammar leniency (C G1–G7)

Accept the Berklee spellings a trained reader types, without changing what the sheet prints: `II-7`, `II–7`,
`VII-7(♭5)`, `♯IV-7(♭5)`, `VIIm7(b5)`, `I-(maj7)`, `V7(sus4)`, `SubV7/II`, `subV/II`, `∆` (U+2206) and `Ø`, `B♭:` in
the key prefix. Two semantic additions: an **upper-case target takes its quality from the key** (`V7/II` in C
means Dm7, as Berklee writes it; `V7/ii` keeps forcing minor), and a **parenthesised function** `(V7/II)` records a
deceptive resolution (N&G pp. 52–55, M&H p. 48, Chediak p. 105) as a flag that changes no scale. Tests in C §5.

### P10. Documentation corrections (no code)

- plan §10.2: "Berklee's table says the same" holds for N&G only; M&H pp. 45–46 prefer ♯9/♭13 on V7/ii and Levine
  p. 66 calls Mixolydian ♭6 seldom played. §10.6: only N&G p. 54 names Mixolydian for extended dominants.
- plan §7.1 table: Berklee's scale for every ♭9 dominant is the eight-note one (♯9 rider, N&G p. 43); the engine's
  seven-note scale is a principle-7 choice, not Berklee's.
- plan §9 Stella: `D1+D4` is printed `D4` (the prefix appears only when the symbol moves the scale).
- plan §5.3 and §9 Autumn Leaves describe the standard changes; the library chart (alternate changes) is one G minor
  area. §9 All the Things bar 9: `Cm7` is in the C area, not "iii of A♭". Giant Steps' `key: Eb` is arbitrary
  (Levine p. 95: B; N&G p. 163: no home key).
- plan §7.2/§8: document the V-triad → Mixolydian branch of M3, which the code has and the plan does not list.
- The library reads Girl from Ipanema and Wave from the Colorado Cookbook; the Jobim songbook differs (Wave bar 6
  `Gm6`, bars 7–10 an extended-dominant chain; Ipanema bars 7–8 and the bridge's `Eb7`). Decide whether the
  library follows Jobim for Jobim's tunes. Ipanema's bridge numbering collides with its `@copy A1 A3 24`.
- Solar bar 1: write `CmMaj7` if the source lead sheet has it (m1 Melodic Minor).

### Not adopted

- The "≥ 2-bar" tonicisation test (brief, area D): contradicted by N&G p. 147, M&H pp. 180–181, Levine p. 355;
  deletes real areas in All the Things (E), Giant Steps, Moment's Notice and Joy Spring.
- A borrowed-tonic clause for ♭III/♭VI/♭VII reached by ii–V–I (D-K3): the sources split by author and the clause
  cannot be said in a player's words; leave to `@key`.
- Upper-case numerals on the sheet (C V9): keep the lower-case convention, now cited to Terefenko; P9 makes the
  grammar accept both.
- N&G p. 91's natural 9 on an unmarked V7 in minor: a real reading, but ♭9 is the idiom and M&H and Chediak agree
  with the engine.
- A parallel-dominants rule (A1 P4, N&G p. 123): sound, but rare; revisit with a chart that needs it.
- `minor:` chart field: reserved, not built.

## 6. Open questions the sources cannot settle

1. V7 → minor at Standard: the seven-note Phrygian Dominant (Chediak; Berklee's subset), the eight-note scale
   (Berklee), or Altered (Levine). The ladder can carry all three; which is *Standard* is a house decision.
2. Blues I7: Mixolydian, Mixolydian ♯9 (N&G's first choice) or the blues scale (Levine) — "the melody decides".
3. Whether a ii–V–I into ♭II/♭III/♭VI/♭VII is a key or a borrowed chord (Blue Bossa, Lady Bird bar 16, Nica's
   Dream bar 11): authors split; only Ionian/Lydian on the target is at stake.
4. The "V7 of the chord before" case (§10.3) and the scale of a chain's head chord on a strong stress (N&G p. 55
   decides by metre, which the engine ignores): no source.
5. The thresholds (⅓ of chords; 2-bar median; the proposed dominant-majority cut) are unsourced numbers; the
   report line in P5 makes them visible.
6. Terefenko's own criterion for tonicisation versus modulation (ch. 13 "Four-Bar Modulations", ch. 20): not read.
7. What the Real Book prints for Solar's first chord and Footprints' turnaround, and whether Milestones' A section
   has a third chord (Levine p. 30): need the lead sheets.

## 7. Method and limits

Six research agents each took one area of the brief, with the four OCR'd Berklee/Chediak texts and Levine's text
layer on disk, and returned findings in a fixed table shape; this document is the synthesis and the ranking. The
agents could not run the engine (only `engine/analysis/` was on disk), so every "the engine prints X" statement is
either from the frozen `fixtures/analysis.json`, from the charts' saved reason columns, or from a hand trace
through `rules.ts`, marked as such in the reviews; one agent ran `decide()` and `parseFunction()` in a harness
over hand-built streams for the label findings. **Every test case in §5 should be run before it is believed.**
Page images were viewed for the decisive pages (listed in each review's §0 and §5); the remainder is OCR text with
the printed footer confirmed. Chediak's page offset is not constant, so his pages are the printed footers.

## 8. Bibliography

- Nettles, Barrie, and Richard Graf. *The Chord Scale Theory & Jazz Harmony*. Rottenburg: Advance Music, 1997.
- Mulholland, Joe, and Tom Hojnacki. *The Berklee Book of Jazz Harmony*. Boston: Berklee Press, 2013.
- Levine, Mark. *The Jazz Theory Book*. Petaluma: Sher Music, 1995.
- Chediak, Almir. *Harmonia & Improvisação*, vols. 1–2. Rio de Janeiro: Lumiar, 1986.
- Chediak, Almir, ed. *Songbook Tom Jobim*. Rio de Janeiro: Lumiar, 1990 (pp. 61, 109–110).
- Terefenko, Dariusz. "Jazz Transformations of the ii7–V7–I Progression." *Current Research in Jazz* 1 (2009).
  https://crj-online.org/v1/CRJ-JazzTransformations.php. *Jazz Theory: From Basic to Advanced Study*, 2nd ed.
  New York: Routledge, 2018 (contents only).
- Aebersold, Jamey. *Scale Syllabus* (web summary only; not the book).

Citations whose page numbers rest on the text layer alone, and every secondary web source used to locate a
claim, are listed at the end of each review.

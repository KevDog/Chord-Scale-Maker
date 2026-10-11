# E. Edge cases adjudicated against the sources

Reviewer: research agent E. Date: 2026-10-10. Slice: the "Edge cases to adjudicate explicitly" list of BRIEF.md (fourteen
cases, thirteen charts plus Beautiful Love, which is not in the library).

## 0. Conventions

- Page numbers are BOOK pages. Offsets used: Nettles and Graf (N&G) = PDF + 1 (footers read on pp. 79-84, 91, 92, 118, 123, 146);
  Mulholland and Hojnacki (M&H) = PDF - 12 (footers read on pp. 88, 92, 94-96, 141-144, 158, 166, 177, 183, 192-194, 221-223);
  Levine (Jazz Theory Book) = PDF - 16 (page markers only; printed footers not read); Chediak vol. 1 and 2: the printed footer is
  quoted as it appears in the text layer (the footer-to-PDF offset varies inside the file: p. 97 is PDF 97, p. 344 is PDF 339).
- Image-checked pages (rendered and read by me): N&G pp. 91, 92, 118, 146; M&H pp. 141 (fig. 6.14), 158 (fig. 7.27, enlarged); Songbook
  printed pp. 61, 109, 110. Everything else is read from the text layer.
- "Chart" = the file in /charts. The chart's reason column is the engine's last saved decision; the rule id is recovered from rules.ts by
  tracing the code path by hand (the engine itself cannot be run here: only rules.ts, keys.ts, functions.ts and index.ts are on disk;
  stream.ts was read from the Project). A trace is marked "(traced)".
- One correction to the plan's own table: for a dominant whose symbol pins a tension the key already supplies, rules.ts prints plain
  `D4`, not `D1+D4` (the `D1+` prefix is added only when the symbol moves the scale: `moved` in `dominantDecision`). Stella's A7b9 is
  therefore `D4`; plan section 9 prints `D1+D4`.
- Verdict codes: AGREE / DIFFER / SPLIT / UNDERSPECIFIED, as in the brief. Fix type: RULE (change rules.ts), CHART (change the chart:
  a symbol, `# keep:`, a function in the fifth cell, `@key`), METADATA (a chart-level or section-level flag), NONE.

## 1. Findings table

| # | Case | Chart chord / bar | Rule id -> engine scale | Sources (book pages) | Verdict | Fix type |
|---|---|---|---|---|---|---|
| 1 | Autumn Leaves, minor ii-V-i | Am7b5 bar 5, D7 bar 6, Gm bars 7-8 (the brief's "bars 7-8") | h2 -> A Locrian; D4 (harmonic reference) -> D Phrygian Dominant; m5 -> G Dorian | N&G 91 (plain V7 = Mixolydian b13, V7(b9) = Mixolydian b9 #9 b13); M&H 94-95 (Mixolydian b9 #9 b13; altered optional); Levine 75-76 (alt; harmonic minor "you'd hear the great players playing it a lot, but they don't"); Chediak 344 (harmonic minor from the 5th) | SPLIT (engine = Chediak; a 7-note subset of Berklee; DIFFER from Levine) | NONE (ladder: Altered at Advanced, A1 P3); chart may write `D7alt` |
| 2a | Blue Bossa, the Db area | Ebm7 9, Ab7 10, DbMaj7 11 | m4 -> Eb Dorian; D4 -> Ab Mixolydian; M3 -> Db Ionian (area opened by the "ii-V-I in a minor key tonicizes" rule, keys.ts localKeys) | M&H 92 and N&G 83, 133 (bIIMaj7 = Lydian, subdominant-minor chord from Phrygian); M&H 171 ("Sophisticated Lady modulates to bII major at the bridge"); M&H 177 (key of the moment needs no confirming cadence); Chediak 97, 117 (bII7M is a modal-interchange chord; a passing resolution prepared by its own dominant "is not a modulation"); Levine none | SPLIT on the key reading; the two scales differ only on DbMaj7 (Ionian v Lydian) | NONE (Lydian is the existing Advanced rung of Ionian) |
| 2b | Blue Bossa, the tonic ending | CmMaj7 bar 7 | m1 -> C Melodic Minor | Levine 58-60; N&G 91; M&H 85 | AGREE | NONE |
| 3a | Girl from Ipanema, bridge start | GbMaj7 17 | M4 -> Gb Lydian | N&G 84 (bridge listed under modal interchange: bII = Lydian, N&G 133) v N&G 146-147 (the bridge is a modulation; "it is not necessary for a new tonic chord to be heard") | SPLIT (inside N&G) | NONE; optional CHART (`@key Gb`, then M3 Ionian) |
| 3b | same, B7 | B7#11 19 | D6 (traced) -> B Lydian Dominant, fallback | N&G 123 ("Lydian b7 ... or any form of Mixolydian ... or symmetric dominant"); M&H 238 ("either"); songbook p. 61 gives B7(9) | AGREE (permitted); UNDERSPECIFIED which | NONE |
| 3c | same, F#m | F#m 21 | m8 -> F# Dorian, fallback | in E (N&G 146 "VII (E)") it is ii: Dorian (m7 would also give Dorian); songbook F#m7 | AGREE | CHART (symbol: F#m7) |
| 3d | same, D7 | Am7/D 23 (s3 -> D Mixolydian), D7 24 (D4 -> D Mixolydian b6) | see rows | N&G 43-46 Mixolydian (b13) first; M&H 45-46 prefer b9 #9 b13; Levine 66 "seldom played"; Chediak 345 | SPLIT (A1, V7/ii) | NONE |
| 3e | same, Eb7 | Bbm/Eb 27 (m4), Eb7 28 (passing ii-V, D4 -> Mixolydian) | -- | songbook p. 61: Gm7 then Eb7(9), no Bbm: the same Eb7 would be D6 -> Eb Lydian Dominant (traced) | UNDERSPECIFIED (N&G 123, M&H 238: either) | CHART (see 4.3) |
| 4a | Wave, the diminished chord | Bbdim7 2 | d1 (traced: not vii-dim, not auxiliary) -> Bb Whole-Half Diminished, "passing diminished", fallback | M&H 141-142, 158 (bVI-dim7 "descending chromatic approach chord to the related II-7 of the V/IV"; fig. 7.27 = Bb B C# D E F# G A transposed, the key's notes plus the chord); N&G 116 (same, by enharmonic equivalence, from A2); Levine 84, 87 (Whole-Half; "B-flat dim is the disguised V (A7b9) of the D7 chord, with A-7 inserted"); Chediak 91 | SPLIT: DIFFER from Berklee, AGREE with Levine and Chediak | RULE (A2 C1) plus reason string (4.4) |
| 4b | Wave, the minor sixth | Gm7 bar 6 (the songbook, p. 109, writes Gm6) | m8 -> G Dorian, fallback; with `Gm6`: m2 -> G Dorian | M&H 141-142 (IV-6, "subdominant minor modal interchange"); N&G 79 (IV-6: Dorian, or melodic minor); M&H 120 (IV-7 and IV-6 freely substituted); M&H 85 (tonic I-6 = melodic minor, p. 86 Dorian "alternate") | AGREE (same scale either way) | CHART (write `Gm6`) |
| 5 | Stella, opening iiø7-V7 | Em7b5 1, A7b9 2 | h2 -> E Locrian; D4 (traced; the implied D minor is diatonic to Bb) -> A Phrygian Dominant, fn "V7/iii (the iii never arrives)" | N&G 118 (the first two measures are the reharmonization of the original bIII-dim7, "nondominant, or deceptive, resolutions"); N&G 43-46, M&H 44-46 (V7/III = Mixolydian b9 #9 b13); Levine 120 fig. 6-11 (A7alt = 7th mode of Bb melodic minor), 276, 84 | SPLIT (Berklee 8-note scale; Levine altered; engine = the 7-note subset) | NONE (ladder) |
| 6 | Footprints, modal context and turnaround | Cm7 1, Fm7 5, Cm7 7; F#m7b5 and F13#11 9; E7alt and A7alt 10; Cm7 11 | context: modal (traced); m6 -> Dorian; h1 -> F# Locrian natural 2; D1+D7 -> F Lydian Dominant; D1 -> E Altered, A Altered | M&H 87 (Footprints = "tonic Dorian source scale"); N&G 158 (modal tunes list); Levine 225 (a 24-bar blues waltz), 64 (V7#11 = Lydian dominant), 70-71 (alt = melodic minor mode 7); Levine 76 and M&H 90 (Locrian v Locrian natural 2); Wikipedia (secondary): Shorter's turnaround F#m9b5, F7#11, E9b5, A7#9, Cm7 | AGREE on every scale except F#m7b5: UNDERSPECIFIED (A2 h1) | METADATA (modal flag, 4.6) |
| 7 | So What | Dm7 1, Ebm7 17 | m6 -> Dorian, both | Levine 30 ("musicians are more apt to be thinking D Dorian and E-flat Dorian"); M&H 183; N&G 158 | AGREE | NONE |
| 8 | Milestones, bridge | Am7 17 | m6 -> A Dorian; chart `# keep:` A Aeolian (present, and carried to B2 by `@copy`) | Levine 52 ("A Aeolian"); M&H 193 (Aeolian tonic, from A2), 183; N&G 155 (Aeolian tonic, from A2), 158; Chediak 124 | DIFFER (rule) / AGREE (chart) | CHART (done); METADATA candidate (section mode) |
| 9 | Maiden Voyage | Am7/D 1 (read as D7sus4), Cm7/F 5, Bbm7/Eb 17, C#m7 21 | s3 -> Mixolydian (D, F, Eb); m6 -> C# Dorian | Levine 43-47 (Mixolydian on a sus chord; "D-7/G describes the function"); M&H 24, 223 (V7sus4 = Mixolydian, 4th is a chord tone, 3rd the avoid; D-7/G is the sus voicing); N&G 29, 158; M&H 183 | AGREE (A Dorian over a D bass has the same seven notes as D Mixolydian) | NONE |
| 10 | Beautiful Love (not in library) | Em7b5, A7b9, Dm | h2 -> E Locrian; D4 (harmonic) -> A Phrygian Dominant; m5 -> D Dorian | N&G 91, M&H 90 (Locrian); Levine 76 ("the notes played over the Dø chord are from F melodic minor"); Chediak vol. 2 p. 113 (Locrian, from A2); V7 as row 1 | Locrian: DIFFER (Levine) / AGREE (Berklee); A7: SPLIT | NONE (Locrian natural 2 is the existing Advanced rung) |
| 11a | Minor blues, tonic and iv | Mr. P.C.: Cm7, Fm7, Cm7; Blues Minor: Fm, Bbm, Fm | Mr. P.C. is functional: m5 -> C Dorian, m7 -> F Dorian; Blues Minor is modal: m6 -> Dorian | M&H 143 (pure Aeolian blues), 144 (Equinox: "Dorian voicings on the I-7 and IV-7"); N&G 91 (I-7 Dorian or Aeolian; IV-7 Dorian), 103; Levine 225 (notate C- so that C minor major or C Dorian are open) | AGREE (Dorian by convention; Aeolian valid) | NONE |
| 11b | Minor blues, bars 9-11 | Mr. P.C. chart: Dm7b5 9, G7alt 10 (a ii-V, not Ab7-G7) | h2 -> D Locrian; D1 -> G Altered. For Ab7-G7 (not in the library): D2 (traced) -> Ab Lydian Dominant | Levine 225 and fn. 8 (bVI-V-I; "the G7 in bar 10 is often played as G7alt"); M&H 144, 104, 106 (subV/V = Lydian b7; "Coltrane hammers at the #11 of Ab7"); N&G 82, 124 (bVI7 cadential = Lydian b7); N&G 103 (a minor blues variation with a ii-V) | AGREE | NONE |
| 12 | Solar | `Cm` bar 1 (the chart has the triad); Gm7 3, C7alt 4, FMaj7 5; Fm7 7, Bb7alt 8, EbMaj7 9; Ebm7 10, Ab7alt 10, DbMaj7 11; Dm7b5 12, G7alt 12 | `Cm`: m5 -> C Dorian; `CmMaj7` would be m1 -> C Melodic Minor. ii-Vs: m4 -> Dorian; D1 -> Altered; M3 -> Ionian (F, Db areas by the tonicization rule; EbMaj7 is bIII of C minor, M3) | Levine 58-60 (minor-major = tonic minor, first mode of melodic minor), 230 (Solar named as a blues with unusual changes; no chords), 75-76; N&G 91 (I-(maj7) melodic or harmonic minor; I- triad: any form, the melody decides); M&H 85; Wikipedia (secondary): Cm(maj7) | Symbol: UNDERSPECIFIED between sources; scales: AGREE | CHART (if the source symbol is Cm(maj7), write `CmMaj7`) |
| 13 | Nica's Dream | BbmMaj7 and AbmMaj7 (Intro 1-2; A1 1-6) | m1 -> Bb Melodic Minor, Ab Melodic Minor | Levine 59 (fig. 3-69: "the first chord is a B-flat minor-major chord from the B-flat melodic minor scale. The second chord (A-flat minor-major) is from the A-flat melodic minor scale"), 65 (Eb7#11 Lydian dominant, then Absus9, C/Db, Asus); N&G 91; M&H 85 | AGREE | NONE |
| 14 | A Night in Tunisia, Eb7-Dm | Eb7 (Intro 1, 3; A1 1, 3, 5), Dm6/9 | D2 (traced) -> Eb Lydian Dominant; m2 -> D Dorian | M&H 103-106 (subV7 in minor: Lydian b7; the interlude is cited by name); Levine 64, 281-282 (V7#11 resolves down a half step; the melody note decides); M&H 85-86 and N&G 91 (a tonic 6 chord: melodic minor first in M&H, Dorian first in N&G) | AGREE (Eb7); SPLIT inside Berklee on Dm6/9 (A2 m2) | NONE |

## 2. Prose, case by case

### 2.1 Autumn Leaves, Am7b5 D7 Gm (row 1)

The chart's brief numbering ("bars 7-8") does not match the chart: Am7b5 is bar 5, D7 bar 6, Gm bars 7-8. The D7 is a plain `D7`
with no tension in the symbol. Trace: `dominant()` skips D1 and modal; the next chord is Gm (down a fifth, not a dominant), so it
reaches the branch `if (n && downFifth(e, n))` with `tonic` true and `key.minor` true, hence `harmonic` true, so `derive(e, key,
true)` reads G harmonic minor (G A Bb C D Eb F#): 9 absent and b9 present, 11 present, 13 absent and b13 (Bb) present: Phrygian
Dominant, rule D4, fn "V7 of G minor". Same for the bar-26 and bar-30 D7s.

The sources do not agree. N&G p. 91 (image) lists two lines: V7(b9) = "Mixolydian (b9, #9, b13) (This is a composite of most minor key
pitches)" and plain V7 = "Mixolydian (b13)", that is, N&G keep the natural 9 for an unmarked V7. M&H pp. 94-95 build the composite
minor (natural minor with the leading tone) and read G Mixolydian (b9, #9, b13) off its fifth degree, with the altered scale "an
alternative chord scale choice", fig. 4.40. Levine pp. 75-76: a minor II-V-I is "a half-diminished chord, an alt chord, and a
minor-major chord"; the harmonic minor is "often mentioned in theory books ... if that were true, you'd hear the great players
playing it a lot, but they don't." Chediak p. 344 f) gives V7(b9) and V7(b13) "the notes of C harmonic minor, starting on the fifth
ascending degree", which is the engine's scale.

So the engine's Phrygian Dominant is Chediak's scale, the seven-note subset of Berklee's eight-note scale, and what Levine says
players do not choose. The default is defensible under principles 4 and 7 (the diatonic choice at Standard). Nothing in the
sources makes the engine's choice wrong; it is not what any of the two Berklee books prints. Verdict SPLIT. If an author wants
Levine's sound the symbol settles it: `D7alt` (D1 -> Altered) or `D7b9` plus `# keep:`. A1's Proposal 3 (Altered as the Advanced
rung of the V7-to-minor line) covers the ladder. No new proposal here.

### 2.2 Blue Bossa, the Db area (rows 2a, 2b)

Engine path (traced): the cadence Ab7 -> DbMaj7 has an ii (Ebm7); `localKeys` takes `tonicized = current.minor && c.ii &&
!c.tritone && !c.key.minor && !sameKey(c.key, current)`, true here, so bars 9-11 are a D-flat major area. Hence Ebm7 m4 (Dorian,
"ii of the ii-V to Db"), Ab7 D4 (V7 of Db: 9, 11, 13 all in Db, Mixolydian), DbMaj7 M3 (Ionian). If the area were not opened, DbMaj7
would be a chromatic major chord in C minor (M4, Lydian), and Ab7 would derive from C natural minor (11 absent, natural 11 taken,
Mixolydian again). So the whole disagreement is one scale: Db Ionian or Db Lydian.

What the sources say. Berklee's scale for a bIIMaj7 is Lydian: M&H p. 92 fig. 4.27 ("If we displace the C Phrygian source scale to
the root of bIIMaj7, the result is a Lydian chord scale"; "a more exotic-sounding subdominant chord ... 'Nardis' and 'Deluge'");
N&G p. 83 (bIImaj7 as a subdominant-minor cadential chord, to be shown "as a modal interchange chord from parallel Phrygian") and
p. 133 ("the bIImaj7 (Lydian chord scale) chord derived from this mode"). That reading treats the chord as a colour of C minor.
Against it, both Berklee books accept a flat-II key: M&H p. 171 lists "Sophisticated Lady modulates to bII major at the bridge";
N&G p. 146 calls the keys of bII and VII "the most distant" and p. 147: a new tonic chord is not necessary to establish a key. M&H
p. 177 defines "key of the moment" as a non-diatonically related II-V "without a confirming cadence"; Blue Bossa has the cadence and
a two-bar tonic. Chediak goes the other way: p. 97 files Db7M in C as a modal-borrowed chord (from Phrygian), and p. 117 says
"passing resolutions (diatonic or modal-interchange chords prepared by their own dominants) are not considered modulations."
Levine does not analyse the tune's harmony (pp. 182, 277, 310 are about voicings and slash chords; p. 277 shows the C-6 of bars 7-8).
Practice (unsourced, label: forum thread jazzguitar.be/forum/songs/2404, 2008): posters split between Db major and Db Lydian and one
notes "the melody in measures 9-12 is completely from the Db major scale".

Verdict SPLIT on the area, with an immaterial scale consequence. The engine's reading is M&H's "tonicization of a chord"
reading (compare M&H p. 88 on bIII: "any tonicization of the bIIIMaj7 chord ... can cause a tonal shift"; the source is about
bIII, not bII, so it is an analogy, not a ruling). Lydian is already the Advanced rung of Ionian (plan section 11). No change.
Row 2b: the chart writes `CmMaj7` in bar 7 (m1); Levine p. 277 prints the same bars as C-6. Both are minor-key tonic chords and
the scale is the same family; AGREE.

### 2.3 The Girl from Ipanema (rows 3a-3e)

Chart against the Jobim songbook (Chediak, Songbook Tom Jobim, printed p. 61, read from the image; bar lengths not verified):

| Place | Chart | Songbook p. 61 | Scale effect |
|---|---|---|---|
| A, first A, bars 7-8 | FMaj7, Gb7 (same as A2, A3 by `@copy`) | Am7, Ab7, Db7M(9), Gb7(#11) | none in the chart; the songbook's own first A has a ii-V-I in Db before returning to F |
| A, all, Gb | `Gb7` | `Gb7(#11)` | none (D2 gives Lydian Dominant either way) |
| bridge, first chord | GbMaj7 | F#7M | enharmonic, none |
| bridge, 2nd | B7#11 | B7(9) | none (D6 -> Lydian Dominant, #11 or not) |
| bridge, 3rd | F#m | F#m7 | none (m8 Dorian) |
| bridge, 4th | Am7/D (sus) then D7 | D7(9) | D Mixolydian (s3) is a chart addition; D7 Mixolydian b6 either way |
| bridge, 5th | Gm | Gm7 | none |
| bridge, 6th | Bbm/Eb then Eb7 | Eb7(9) (after Gm7) | chart: Eb Mixolydian (passing ii-V); songbook: Eb Lydian Dominant (D6) |
| bridge, 7th-10th | Am7, D7alt, Gm7, C7alt | Am7, D7(b9), Gm7, C7(b9) | alt -> Altered; the songbook's b9 would give D Phrygian Dominant and C Half-Whole (b9 11 13) |

Whether this is "the Real Book bridge discrepancy" I cannot say (no Real Book on disk); the chart's bridge is the Colorado Cookbook p. 79
version and differs from the songbook in the places above, none of which moves a scale except bar 28 and the bar-30 and bar-32 symbols.
A chart anomaly outside this slice: the bridge rows run to bar 32 while `@copy A1 A3 24` places the last A at bars 25-32 as well. One of
the two is mis-numbered (a 16-bar bridge would need offset 32). The stream is read in row order, so scales are unaffected; durations
are.

Engine and sources, chord by chord.

- GbMaj7 (M4, Lydian). N&G is split. p. 84 lists "The Girl From Ipanema (Bridge)" under modal interchange, where the bIImaj7 is
  Lydian (pp. 83, 133). p. 146 (image) says the tune "moves between the keys of I (F), bVI (Db), VII (E) and back to I (F)" while the
  preceding sentence names "a half step higher (key of bII)" and "a half step lower (key of VII)" and cites this tune for both. "bVI
  (Db)" contradicts that sentence and the chord on the page of the chart (Gb); it is a slip in the book, bII (Gb) being meant. p.
  147: "If the melody modulates into a new key, the harmonies must modulate (again, the bridge of 'The Girl From Ipanema')." M&H lists
  the tune only for the non-resolving II7 (p. 237). The engine's Lydian is the interchange reading; the modulation reading would be
  Ionian. Either is Berklee. A cadence-free modulation cannot be found by the engine (plan section 14, "no melody"); the author's
  tool is `@key Gb`. Not recommended: it buys an Ionian where Berklee itself prefers Lydian for this chord.
- B7#11 (D6 -> Lydian Dominant, "a chromatic dominant with nowhere to go"). Trace: not alt, not modal; next chord F#m (up a fifth),
  previous chord GbMaj7 (not a fifth below), no related ii, 2 bars, not blues, B not in F; so D6. N&G p. 123 and M&H p. 238 allow
  Lydian b7 or any Mixolydian for a non-resolving dominant, with N&G p. 123 adding the symmetric dominant. In the key of Gb the
  chord is Cb7, the IV7 (M&H p. 236: "IV7, the blues subdominant ... typically returns to IMaj7"); in E it is the V7 (Mixolydian) before
  its ii. AGREE; no rule would prefer one. The songbook's `B7(9)` pins the 9 only; the engine's answer is unchanged.
- F#m (m8 -> F# Dorian). In E major it would be ii (m7 -> Dorian), so the two readings coincide. AGREE.
- Am7/D, D7 (s3 Mixolydian; D4 Mixolydian b6). The V7/ii question belongs to A1 (N&G 43-46 first Mixolydian b13; M&H 45-46
  "has issues"; Levine 66: "seldom played"); the sus before it is a chart addition: Jobim writes only D7(9).
- Eb7 (passing ii-V). With the chart's Bbm/Eb the engine reads a passing ii-V (target Ab major not diatonic to F), Eb Mixolydian. The
  songbook's Gm7 then Eb7(9) would lose the ii and fall to D6 (Eb Lydian Dominant). N&G p. 123 and M&H p. 238 accept both; UNDERSPECIFIED.
  If the lead wants the chart to follow Jobim the Eb7 scale moves to Lydian Dominant; the chart's Bbm/Eb is an arranger's insertion.

A1 (its A-section row) says N&G p. 126 names the Girl from Ipanema for the non-resolving II7. It does not: the text layer of N&G
names the tune only at pp. 50, 66, 84, 146-147. M&H p. 237 does name it, in the II7 paragraph ("a brighter subdominant, in effect a II
chord from the parallel Lydian"), whose second mode of F Lydian is G Mixolydian, the engine's scale for the bar-3 G7.

### 2.4 Wave (rows 4a, 4b)

The bar-2 Bbdim7. Trace: `diminished()`: the next chord is Am7, a half step below Bb, not above it (interval(Bb, A) = 11, not 1), so the label is not
"vii-dim of"; the previous chord (DMaj7) and the next (Am7) do not share a root, so the label is "passing diminished" (fallback),
the scale Whole-Half, the rule d1, and the reason text says "the rootless V7b9 of the next chord".

The reason text is false for this chord. Bb-dim7 (Bb Db E G) is not E7b9 without its root (E G# B D F), the V7b9 of Am7; it is A7b9
without its root (A C# E G Bb), as Levine p. 87 says in so many words: "Bb-dim doesn't appear to be a disguised V7b9 of A-7, the
following chord. However A-7 is followed by D7, and A-7, D7 is a II-V. Bb-dim is the disguised V (A7b9) of the D7 chord, with A-7
inserted between the two chords to create a II-V." M&H pp. 141-142 (fig. 6.14, image) label it "bVI-dim7 ... Dom (reharm)", "hints at
V7(b9), and chromatically approaches the G-7 in measure 3" (their key of C; here Am7).

Scale. Levine p. 84: "You play this scale [whole-step/half-step diminished] over diminished 7th chords"; Chediak p. 91 and p. 345 h):
the same. Berklee prescribes otherwise: M&H p. 158 (image of fig. 7.27, enlarged): for Ab-dim7 in C, "Ab Diatonic Diminished" is Ab A B C D
E F G, labelled 1, b3, b5, Tb13, dim7, T7 (A and C are black, avoid notes): the chord tones plus the parent key's seven notes, and
the text says "the chord scale consists of chord tones, diatonic tensions, and diatonic avoid tones from the parent key." The page
sends the reader to "Corcovado" and "Wave". Transposed to the key of D: Bb B C# D E F# G A. The engine's Bb Whole-Half is Bb C C#
D# E F# G A: it adds C and D# (neither in D) and drops B and D. This confirms A2's reading (A2 section 3, C1). N&G p. 116 reaches
the same set for bVI-dim7 by enharmonic equivalence with #V-dim7 (from A2; not re-read by me). M&H p. 162 allows the symmetric
scale as "optional ... special situations". Verdict: SPLIT (Berklee DIFFER; Levine, Chediak AGREE). Under principles 4 and 7, the
diatonic scale is the Standard answer and Whole-Half the Advanced rung: this is change E1 below, owned by A2's C1.

The bar-6 chord. The chart has `Gm7`; the songbook (p. 109 chord line; p. 110 lead sheet) has `Gm6`. The engine reads Gm7 as a borrowed
minor chord (m8, Dorian, a fallback) and would read Gm6 as m2 (Dorian, "a minor sixth chord"), so the scale does not move. M&H p. 141
labels the bar "IV-6 ... SDM" (subdominant minor). N&G p. 79 gives IV-6 as "Dorian (avoid b7 - usually due to melodic content) or
melodic minor"; M&H p. 120 says IV-7 and IV-6 "both have an Aeolian source; sixth chords and seventh chords can be freely
substituted", and its IV-7 is Dorian (p. 90 fig. 4.20). AGREE. The only gain from the symbol is that rule m2 and the function IV-6 are
reached instead of the fallback. CHART fix, no scale change.

The rest of the A section differs from the songbook too: bars 7-10 are F#7(13) F#7(b13) | B7sus4(9) B7(b9) | E7sus4(9) E7(9) | Bb7(9)
A7(b13) (printed p. 109), the chart has F#7 | B7 | Bm7 E7 | Bb7 A7alt. M&H p. 142 reads bars 7-10 as "an extended dominant series ... an
interpolated subV/V in measure 10", the chain the songbook has and the chart breaks with Bm7. The bridge of the songbook (Dm7 G/D Dm7
G/D | Gm7 | Gm6/Bb | Am7 | Bb7sus4(9) | Fm6/Ab | Gm7 | A7sus4(b9), printed p. 110) is not the chart's B section (Gm7 C7 FMaj7 | Fm7 Bb7
EbMaj7 | Em7b5 A7b9). N&G pp. 104, 109 and M&H pp. 141-142 both read the A section as a blues; M&H calls bars 11-12 "a tonic Dorian modal
vamp", the same as the engine's reading of Dm7 G7 (D4).

### 2.5 Stella by Starlight, bars 1-2 (row 5)

Trace: Em7b5 -> `halfDiminished()`: related (A7b9 follows a fourth up), but the chord after A7b9 is Cm7, not a fifth below, so `to` is null
and fn is "iiø7 of A7b9": h2 -> Locrian. A7b9: the next chord Cm7 is up a minor third; related ii present; the implied chord is D
minor (D F A) which is diatonic to Bb, so the code returns D4 with fn "V7/iii in Bb (the iii never arrives)", derived from Bb (b9
Bb, 11 D, b13 F): Phrygian Dominant. The `b9` in the symbol equals the derived b9, so the id is `D4`, not `D1+D4`. With a plain
`A7` (the original symbol, Levine p. 276: "E-7, A7, a II-V") the engine's answer is the same, because the key supplies the b9.

Sources. N&G p. 118 (image): "Older standard tunes have used the reharmonizations more often than the original diminished chords
(the first 2 measures of 'Stella by Starlight' in lieu of the original bIII-dim7)", with the half-diminished chord "followed by a full
diminished as the upper structure within the dominant" and "nondominant, or deceptive, resolutions" for the chromatically derived
chords. Berklee therefore reads A7b9 as the dominant that stands for a descending bIII-dim7, whose scale is that of the equivalent
ascending chord (N&G p. 116, from A2: #II-dim7 -> V7/III), the eight-note V7/III scale, Mixolydian (b9, #9, b13): N&G pp. 43-46 and M&H
pp. 44-46 (A1). Levine p. 120 fig. 6-11 (text layer of the caption): Eø = "6th mode of G melodic minor", A7alt = "7th mode of B-flat
melodic minor"; p. 276: after an Eø "the V chord that follows is usually reharmonized as either b9 or alt"; p. 84: "b9 is just a
shorthand symbol for all three alterations found in the scale: b9, #9, #11" (half-whole). The engine's choice is the Berklee scale minus
the #9, and differs from Levine's altered. Verdict SPLIT (same family as row 1). NONE.

Bars 21-23 Ab7#11 (Lydian Dominant) are Levine's example on p. 64 and p. 284 (Ab7#11 resolving up a whole step to Bb); AGREE. Bar 17 G7#5:
Levine p. 92 prefers G7alt to G7#5, the engine gives Altered; AGREE in effect.

### 2.6 Footprints (row 6)

What the chart has: `Cm7 (4 bars) | Fm7 (2) | Cm7 (2) | F#m7b5 F13#11 | E7alt A7alt | Cm7`. The three
turnaround forms I could find, labelled by source quality: (a) the chart's, and Wikipedia's (secondary) "Shorter instead uses F#m9(b5),
F7(#11), E9(b5), A7(#9), Cm7"; (b) a jazzguitar.be forum thread (forum, unverified): "Real Book 1: D7, Db7, Cm7" (read: D7#11 Db7#11
Cm7), New Real Book 1: "F7#11, E7#9, D7alt, G7#5, Cm11" and "F#m7#11, F13#11, E7alt, A7alt, Cm11"; (c) Wikipedia: the standard
C-minor turnaround Dm7b5 G7 Cm7. The brief's "A7alt-Ab7" turnaround is not in any of these; I could not source it. I did not
have the Real Book.

Context (traced). No dominant here resolves to a major or minor chord a fifth or half step below, so there are no cadences; the
median chord lasts two bars (the 12-bar form is rounded up to a multiple of four, plan section 16), so `isModal` is true. In a modal
chart: Cm7 and Fm7 m6 Dorian; F#m7b5 h1 Locrian natural 2; F13#11 D7 with the symbol's pins, D1+D7, Lydian Dominant; E7alt, A7alt D1 Altered.
If the tune were read as functional the answers would be identical except F#m7b5 (h2 Locrian): F13#11 would be D2 (subV7 of E7alt,
Lydian Dominant), E7alt and A7alt are pinned, Cm7 is m5 (Dorian), Fm7 is m7 (iv, Dorian). For the Real Book variant D7#11 Db7#11 Cm7 the
heuristic sits on the boundary: one tritone cadence (Db7 -> Cm7) puts 2 of 6 entries in a cadence and `2 < 6/3` is false, so that
version reads functional by one chord, with the same scales (D2 on both dominants). The flag is brittle, not wrong.

Sources. M&H p. 87: "Wayne Shorter's 'Footprints' is a clear example of a tune in a minor key that employs a tonic Dorian source
scale"; N&G p. 158 lists it among modal tunes and p. 145 among tunes with pedal point or ostinato; Levine p. 225 calls it a 24-bar
blues waltz. F13#11: Levine p. 64 ("when improvising you play the Lydian dominant mode ... on dominant 7th #11 chords"). alt: Levine
pp. 70-71. The ø7 in a modal tune: N&G p. 153 ("the diatonic -7(b5) is avoided"), M&H pp. 187, 194 (ø7 almost never found) and Levine
p. 76 (Locrian natural 2 as the great players' sound) give no Berklee prescription for a chromatic ø7 inside a turnaround; h1 is a
taste rule, as plan decision 9 says. Verdict: every scale AGREE except F#m7b5, UNDERSPECIFIED. Fix: METADATA. A chart-level modal flag
would state the context instead of inferring it from bar rounding (Area B proposes names).

### 2.7 So What, Milestones, Maiden Voyage (rows 7-9)

So What. Levine pp. 29-30 (page 30: "although the two chords in 'So What' are D-7 and E-flat-7, musicians are more apt to be thinking 'D
Dorian' and 'E-flat Dorian'"); M&H p. 183 names the tune as one whose sections each use a different scale; N&G p. 158 lists it as
modal. m6 -> Dorian. AGREE.

Milestones. The chart carries the right answer under principle 1: `B1 | 17 | Am7 | A Aeolian  # keep: the bridge is A Aeolian; the
melody says so`, and `@copy B1 B2 8` repeats it. Levine p. 52 (the Aeolian-mode passage): "The bridge of Miles Davis' 'Milestones' consists of a single chord: A
Aeolian ... Aeolian chords are rarely specifically called for"; N&G p. 155 and M&H p. 193 give the Aeolian tonic I-7 as a
modal-system tonic (from A2; I read M&H p. 193 "Aeolian ... Tonic chord: I-7, Characteristic pitch: b6, the default minor scale" and
Chediak p. 124 "a composition containing harmony exclusively of the Aeolian mode will have the modal Aeolian flavour"). The rule m6
(Dorian) is DIFFER for the bridge, the chart AGREEs. METADATA candidate: a section-level mode marker would remove the `# keep:`.
One discrepancy I could not settle: Levine p. 30 says "Milestones" (1958) "was based on just three chords"; the chart has two
(Gm7, Am7). Unverified whether the A section has a third chord.

Maiden Voyage. The chart's `Am7/D` is read by pass 1 as D7sus4, the reading M&H p. 223 spells out (fig. 11.33: "D-7/G" is a
G7sus4 hybrid; "a 7sus4 chord will function syntactically as a dominant"; chord scale fig. 11.32: Mixolydian, "not to think of scale
degree 4 as an avoid tone, but as a substitute for the 3"). Levine p. 43: "G Mixolydian is the scale that is usually played over a
Gsus chord"; "D-7/G describes the function of the sus chord, because a sus chord is like a II-V progression contained in one
chord" (p. 45); p. 46: "Maiden Voyage ... consisted almost entirely of sus chords"; p. 47: "where the harmony consists entirely of
sus chords ... you might want to use dissonance". M&H p. 24: "For V7sus4, the G Mixolydian chord scale is still appropriate; however,
4 is now the chord tone and 3 the avoid". A Dorian and D Mixolydian have the same seven notes, so "Dorian/Mixolydian hybrid" is a
naming question, not a scale question; the sheet prints the root the bass plays. s3 AGREE. The bridge chords (Bbm7/Eb, C#m7) I could not
verify against a lead sheet (the web pages found did not list changes); if the real bridge is not a minor-7th chord the m6 row for
C#m7 is wrong, which is a chart matter.

### 2.8 Beautiful Love (row 10)

Reasoning from the standard changes (Em7b5 A7b9 Dm ...; no chart exists). With `key: Dm` the engine gives E Locrian (h2), A
Phrygian Dominant (D4, harmonic reference, b9 pinned equal to derived), D Dorian (m5, `Dm`). Sources: Locrian for the ii-7(b5) of a
minor key: N&G p. 91 (image) and M&H p. 90 (fig. 4.19); Levine p. 76: "The notes played over the Dø chord are from F melodic minor"
(Locrian natural 2). The engine's Locrian is Berklee's and the Standard rung; Locrian natural 2 is the Advanced rung (plan
section 11); AGREE (Berklee), DIFFER (Levine). A7: the same split as row 1. NONE. A test is proposed (E6) because the library has
no iiø7-V7-i opening.

### 2.9 Minor blues: Mr. P.C. and Blues Minor (rows 11a, 11b)

Mr. P.C. is functional because it has a ii-V (cadences: 3 of 6 entries; `3 < 2` false); Blues Minor is modal (Fm 4 bars, Bbm 4 bars,
Fm 4 bars, no dominant). Both give Dorian on the tonic and iv. M&H p. 144: "John Coltrane's 'Equinox' is a good example of a
blues with Dorian voicings on the I-7 and IV-7 chords"; M&H p. 143, fig. 6.17: a "Basic Aeolian Blues" is also possible; N&G p. 91:
I-7 "Dorian or Aeolian", IV-7 "Dorian"; Levine p. 225: the minor chords are written C- and F- so that "you could play C minor major,
rather than just the C Dorian scale that C-7 would imply". The default Dorian AGREE; Aeolian and melodic minor are the sources'
alternatives, and plan decision 7 already puts Aeolian at Basic.

The cadence. The chart's Mr. P.C. has `Dm7b5 | G7alt` in bars 9-10 (h2 Locrian, D1 Altered), the form of N&G p. 103 ("a minor key blues
variation" with E-7(b5) A7(b9) D-). Levine p. 225 gives the other form, bVI-V-I (Ab7 G7 C-), and fn. 8: "The G7 chord in bar 10 is often
played as G7alt." For that form the engine's path (traced): Ab7 -> G7 is down a half step to a dominant, so D2 (not into a ø7 or
dim7): Ab Lydian Dominant, "tritone substitute: resolves down a half step to G7"; G7 resolving to C-: D4 harmonic, or alt if written.
M&H p. 144 (fig. 6.18): "bVI7 could use a straight Mixolydian chord scale, while subV/V implies Lydian b7. In fact, Coltrane hammers at the
#11 of Ab7 in the melody, clearly sounding the Lydian b7 chord scale choice"; M&H p. 106: subV/V = Lydian b7; N&G pp. 82, 124: bVI7 as a
cadence chord or as subV/V uses Lydian b7; Levine p. 226 (Gary's Notebook): "every minor chord is followed by a V7#11 chord a
half-step up". AGREE; Mixolydian for a bVI7 is the permitted bluesy alternative (M&H pp. 104, 144), and Levine's p. 298 test (the melody
decides) applies. A1 recorded this as SPLIT on the strength of M&H's "could use a straight Mixolydian"; the same paragraph resolves in
favour of Lydian b7, so I record AGREE. The library has no chart with the Ab7-G7 form (Minority, 16 bars, is not examined).

### 2.10 Solar (row 12)

The chart's bar 1 is `Cm`, from the Colorado Cookbook p. 207; Wikipedia (secondary, fetched) prints the chart as Cm(maj7) and a
tutorial (jazz theory substack, fetched, also secondary) as Cm with the maj7 as an option. Levine does not give Solar's changes (p.
230 only names it among "blues that have unusual and unique changes"). So the symbol itself is not settled by any primary source on
disk. Engine: `Cm` -> m5, C Dorian; `CmMaj7` -> m1, C Melodic Minor. N&G p. 91 (image): I-(maj7) "melodic minor or harmonic minor";
I- triad "either a scale using degrees 1 through 5 ... or any of the above scales assuming the melody conforms to the choice"; M&H p. 85
(melodic minor for I-(Maj7)); Levine pp. 58-60 (the minor-major chord "functions as a minor I chord" and the scale is "the first mode of
the melodic minor scale"; p. 60, a minor 7th that is not part of a II-V can be replaced by a minor-major chord). The symbol decides, so
this is a CHART matter: if the author's lead sheet reads Cm(maj7), write `CmMaj7`; if it reads `Cm`, m5 is the sources' own
convention (UNDERSPECIFIED: N&G p. 91).

Following ii-Vs. Gm7 C7alt FMaj7: m4, D1 Altered, M3 Ionian (F area, "ii-V-I in a minor key tonicizes", traced). Fm7 Bb7alt EbMaj7: the
area stack goes F major then back to C minor, because EbMaj7 is diatonic to the global minor key (bIII) and the engine returns to
the global key (keys.ts); M3 gives Ionian "bIII of C minor: the relative major itself" (N&G p. 91 "bIIImaj7 Lydian or Ionian"; M&H p. 88
treats a tonicized bIII as a shift to the relative major). Ebm7 Ab7alt DbMaj7: Db area, as Blue Bossa (row 2a). Dm7b5 G7alt:
D Locrian, G Altered; Levine p. 75. Altered on a minor ii-V-I's dominant is Levine's default (pp. 75-76). AGREE on all.

### 2.11 Nica's Dream (row 13)

Levine p. 59 (page marker PDF 75; fig. 3-69): "The first chord in Horace Silver's 'Nica's Dream' is a B-flat minor-major chord
(Bb-maj7) from the B-flat melodic minor scale. The second chord (Ab-maj7) is from the A-flat melodic minor scale." The chart's m1
rows give exactly that. Levine p. 65 uses the same tune for the Eb7#11 (Lydian dominant) followed by "A-flat sus 9, then C/D-flat ... then
an Asus chord"; the chart's later Ebm7/Ab (read as Ab7sus4, s3) is consistent. The Bb-m(maj7) is also the tonic of Bb minor, which M&H p. 85 and
N&G p. 91 give as melodic minor or harmonic minor. AGREE. The chart's GbMaj7 (Intro 3, M4 Lydian) is the bVImaj7 of Bb minor: N&G p.
81 and M&H p. 90 give Lydian. NONE.

### 2.12 A Night in Tunisia, Eb7 to Dm (row 14)

Traced D2 for each Eb7 (down a half step to Dm6/9, not a ø7 or dim7): Lydian Dominant; also for the Tag's Eb7#11 (the symbol's pins equal the rule's
slots, so the id stays D2, not D1+D2). Sources: M&H p. 103 (subV7 in minor: "non-diatonic roots, the expectation of resolution down a half step, a diatonic target chord,
Lydian b7 chord scales"; fig. 4.59 Db7 in C minor); pp. 105-106 cite the tune's interlude: "makes use of subV7 and then sets up the
infamous solo break with the subV/bIII ... we hear [scale degree 5] first as 11, then #11, then 5, then 9, and finally as a dramatic
#9 on the Gb7 chord (subV/bIII)", which is the chart's Tag Em7, Eb7#11, Dm7, G7#11, ... F#7#9 (the Eb7 carries the #11: "A is the #11").
Levine p. 281: "V7#11 chords can resolve anywhere, but their strongest resolutions are down a half step ... up a whole step"; p. 282: the
melody decides ("If the melody note is the b9, #9, or b13, the #11 chord won't work"). The head's melody over the A-section Eb7 is not
on disk, so the melody test (Levine p. 282) cannot be run; practice (unsourced): the vamp is the tritone substitute and Lydian
dominant is how it is taught. AGREE for Eb7. The Dm6/9 (m2 -> Dorian): M&H p. 85 gives I-6 melodic minor first, Dorian as an alternate
(p. 86); N&G p. 91 gives Dorian "(avoid b7)" or melodic minor. SPLIT inside Berklee (A2's m2); the engine follows N&G.

## 3. Proposed changes

Rule ids and reason strings obey principle 6; no principle is changed. No library-impact estimates.

**E1 (d1; owner A2, C1). A passing or descending diminished 7th takes the key's diatonic diminished scale at Standard; Whole-Half
at Advanced.** Wave supplies the worked case from a primary source (M&H p. 158, fig. 7.27, image-checked).
- Reason string: "passing diminished: the chord tones and the notes of D".
- Test: `key: D`; rows `A | 1 | DMaj7`, `A | 2 | Bbdim7`, `A | 3 | Am7`, `A | 4 | D7`. Expected bar 2 at Standard: B-flat B C# D E F# G A (M&H
  p. 158 transposed from Ab in C); Advanced: B-flat Whole-Half (B-flat C C# D# E F# G A).
- Level: Standard (diatonic), Advanced (Whole-Half). Basic unchanged.
- Conflict: none with principles 4 and 7; it contradicts plan section 7.4's fixed Whole-Half, as A2 notes.

**E2 (d1 reason text). The reason "the rootless V7b9 of the next chord" is wrong for a passing diminished chord.** For a °7 that is not
a vii°7, say which V7b9 it hides, from the candidates a half step below any of its four notes; choose the one a fifth above the root
of the next chord or, when the next chord is a minor ii, of the chord after it.
- Reason string (Wave): "passing diminished: A7b9 without its A (the D7's dominant, with Am7 its ii)". Fallback when no candidate fits: "passing
  diminished: a rootless dominant b9".
- Test: the Wave rows above; expected text as given.
- Level: text only.

**E3 (CHART, Wave). Write `Gm6` in bar 6** (Jobim, songbook printed p. 109; M&H p. 141 labels it IV-6). Reason: m2 fires instead of the m8
fallback; the scale (G Dorian) does not move. Add the function `iv6` in the fifth cell if the sheet is to print it. The same chart's
bars 7-10 and B section differ from the songbook (section 2.4); the lead should decide whether the library follows Jobim or the Cookbook.

**E4 (CHART, Ipanema). No scale-changing edit is recommended.** Optional: `F#m7` for `F#m`; `B7(9)`-style symbols are irrelevant to
the scale. If the lead wants the chart to follow Jobim, the Eb7 in bar 28 loses its Bbm/Eb ii and becomes Eb Lydian Dominant (D6); the
alt symbols in bars 30 and 32 become b9 symbols and the engine then gives D Phrygian Dominant and C Half-Whole. Also check the
numbering of B against `@copy A1 A3 24` (section 2.3).

**E5 (CHART, Solar). `CmMaj7` in bar 1 if the author's source reads Cm(maj7)** (m1 -> C Melodic Minor, N&G p. 91, M&H p. 85, Levine
p. 58). Reason string already exists ("from the symbol: minor-major 7th"). Test: `key: Cm`, `A | 1 | CmMaj7`, expected C Melodic Minor.
Level: Standard (a symbol is evidence, principle 2).

**E6 (test, library gap). Beautiful Love ii-V-i.** Test: `key: Dm`; rows `A | 1 | Em7b5`, `A | 2 | A7b9`, `A | 3 | Dm`; expected E Locrian (h2),
A Phrygian Dominant (D4), D Dorian (m5). A plain `A7` must give the same A scale.

**E7 (METADATA, Footprints; Area B). State the modal context in the chart rather than infer it from rounding the form to bar
multiples of four.** Reason string for the chromatic ø7 in a modal chart, now flagged as a taste rule (plan decision 9): "modal: Locrian
natural 2, the melodic-minor colour". Test: Footprints with `F#m7b5` row unchanged; expected F# Locrian natural 2 only when the flag is
present; without it, h2 Locrian. Level: Advanced for the natural 2 (Standard stays Locrian).

**E8 (METADATA, Milestones; Area B). A section-level mode marker (A Aeolian on the bridge) would replace the `# keep:` hand edit.** The
chart already carries `# keep:`, so no urgency. If added: expected A Aeolian from the marker, reason "the bridge is A Aeolian".

**E9 (documentation).** Plan section 9's Stella rows print `D1+D4` for A7b9 (bars 1, 10, 14); rules.ts prints `D4` (the `D1+` prefix only
when the symbol moves the scale). Plan section 14's "Milestones' bridge is Aeolian because the tune says so" is supported by Levine p.
52. Plan section 10.7 (tonic minor Dorian) is supported by M&H pp. 84-87: "tonic chords usually come from melodic minor or Dorian ...
Aeolian and Phrygian are possibilities as well", with Footprints named as the Dorian example.

## 4. Open questions the sources cannot settle

1. Whether a ii-V-I into a bII chord in a minor key (Blue Bossa, Solar bars 10-11) is a modulation: M&H p. 171 and N&G p. 146 allow a key of bII;
   Chediak p. 117 does not count a ii-V to a modal-borrowed chord as a modulation. Only the DbMaj7 scale depends on it.
2. The Girl from Ipanema bridge: modulation (N&G p. 146-147) or modal interchange (N&G p. 84). Also the "bVI (Db)" printed in N&G p. 146.
3. What the real Footprints turnaround is in the Real Book (not on disk); the brief's "A7alt-Ab7" form is unsourced here.
4. Whether Solar's bar 1 is Cm or Cm(maj7) in the author's source; the primary sources do not print the tune.
5. Whether the Milestones A section has a third chord (Levine p. 30: "just three chords").
6. Maiden Voyage's bridge chords, and A Night in Tunisia's head melody over Eb7 (the Levine p. 282 melody test cannot be run).
7. Aebersold, Coker, Baker, Ligon, Bergonzi, Crook, Terefenko, Russell and Faria were not consulted (none on disk); no verdict above
   rests on them. Every "practice (unsourced)" label is explicit.

## 5. Bibliography and unverified citations

Editions: Nettles, B. and Graf, R., The Chord Scale Theory and Jazz Harmony (Advance Music, 1997). Mulholland, J. and Hojnacki, T., The
Berklee Book of Jazz Harmony (Berklee Press, 2013). Levine, M., The Jazz Theory Book (Sher Music, 1995). Chediak, A., Harmonia e
Improvisacao, vol. 1 and vol. 2 (Lumiar; the scanned copies supplied). Chediak, A. (ed.), Songbook Tom Jobim (Lumiar, 1990; supplied
scan; printed pp. 61 and 109-110 read from images; the volume number was not identified). Web, secondary, labelled in text: Wikipedia
"Footprints (composition)" and "Solar (composition)"; jazzguitar.be forum threads on the Footprints turnaround (forum 47153) and on Blue
Bossa scales (forum 2404); a substack article on Solar; jazzadvice.com Maiden Voyage page (no changes listed).

Citations not fully verified (read from the text layer only, or relied on A1/A2):
- All Levine pages (offset PDF - 16; printed footers not read): 29-30, 43-47, 52, 58-60, 64-65, 68, 70-71, 75-77, 84-87, 92, 120, 134, 182, 185,
  225-226, 229-230, 276-277, 281-284, 298, 309-310, 386-387.
- N&G pp. 43-46, 54-55, 57, 60, 66 (A1): not re-read by me. N&G pp. 116, 155 (A2): not re-read. N&G pp. 123-124 and 104, 109, 126: text layer.
- M&H pp. 44-46, 67-69, 74-75 (A1) not re-read; M&H p. 193 read (Aeolian tonic); pp. 187, 194 (A2).
- Chediak vol. 1 pp. 91, 345 h) (A2); p. 344 f) and p. 345 g) read in the text layer; vol. 2 p. 113 (A2).
- Rule ids for D6, D2, passing ii-V, m4, m7, m8, s3, d1 were traced by hand against rules.ts and keys.ts; the engine was not executed.
- The N&G p. 146 reading "bVI (Db)" was read from the rendered page and is taken to be a slip for bII (Gb).

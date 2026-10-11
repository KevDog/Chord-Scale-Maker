# A2. Non-dominant scale rules against the sources (M1–M5, m1–m9, h1–h2, d1)

Reviewer: research agent A2. Date: 2026-10-10. Slice: Area A, the non-dominant families of `rules.ts` (`major`, `minor`,
`halfDiminished`, `diminished`), plan-analysis.md §7.2–7.4, §8, §10, §11, §14, and the edge cases that fall in them.
Dominant and sus rules are A1's and are not re-adjudicated here.

## 0. Page convention and method

Every page is the printed BOOK page. Offsets, checked against page footers in the text layers and, for the starred
pages, against rendered page images:

- N&G (Nettles & Graf 1997): book = PDF + 1. Images viewed: 91* (minor key chord scales), 114*, 115*, 116* (diminished).
- M&H (Mulholland & Hojnacki 2013): book = PDF − 12. Image viewed: 98* (summary table of diatonic functions in minor).
- Levine (1995): book = PDF − 16, taken from the text layer; the page of each quoted line was computed from the
  `=== page N ===` markers.
- Chediak: the offset is NOT constant. Vol. 1 is PDF = book up to about PDF 128, then PDF + 2 growing to PDF + 5 by the
  scale chapter. I cite the printed footer found in the page chunk. Vol. 2 is scanned two-up, so one PDF page holds two
  book pages (PDF 26 = pp. 48–49; PDF 58 = pp. 112–113); images viewed: vol. 2 pp. 48*, 112–113*.
- Engine references: `rules.ts` (`major`, `minor`, `halfDiminished`, `diminished`, `decide`, `RULES`), `keys.ts`
  (`reference`, `diatonic`, `hasRelatedII`), `chord_scales.json` (qualities `maj`, `Maj7`, `6`, `m`, `m7`, `m6`, `mMaj7`,
  `m7b5`, `dim7`; `ladders`).

Where a quotation is given it is verbatim from the text layer or the image.

---

## 1. Answers to the specific adjudication questions

**(a) Tonic Imaj7: Ionian (M3) or Lydian?** Ionian is the primary sources' default; Lydian is the sources' optional
colour, not their rule for the tonic. The brief's pairing "Lydian (Levine, Russell)" does not hold for Levine.

- N&G p. 26: "The Ionian chord scale contains: the chord tones of a major 7th chord (1, 3, 5, maj7), and available
  tensions 9 and 13 (scale degrees 2 and 6), and an avoided 4th degree (11th)." Directly after: "Context will determine
  the choice of pitches. The F natural is obviously a pitch from the key of C major. In the key of G major, the note
  would be F sharp and be an available tension in a Lydian chord scale." That is the engine's principle 4 almost word
  for word: the scale is whichever of Ionian and Lydian holds the key's own 4th. The summary p. 29 lists both ("Ionian
  for maj7 and maj6 chords", "Lydian for maj7 and maj6 chords").
- M&H p. 21: "the diatonic 11 is generally considered too dissonant to be used in a voicing of a IMaj7 chord ... The 11
  is unstable scale degree 4 in the key—the note that defines subdominant function. Employing the diatonic 11 in a
  voicing of a IMaj7 chord will obscure its tonic function." Ionian with S4. M&H p. 188 (modal chapter) is where Lydian
  is a tonic: "Even brighter than Ionian: a 'super major' scale", and p. 129: "Lydian tonic is very often used at the end
  of jazz performances, and is a prominent feature in many Brazilian tunes as well."
- Levine p. 37: "On a C∆ chord, play the C Ionian mode." The 4th is the "avoid" note (p. 37, "handle with care", p. 37).
  p. 38: before bebop "most jazz musicians played the 4th of a major chord as a passing note only"; Parker, Powell and
  Monk "often raised the 4th". p. 39: "One place to play a raised 4th on a major 7th chord (making it a Lydian chord) is
  when the major 7th chord is acting like a IV chord"; also "You can play it on almost any major 7th chord. Well, almost.
  ... Learn to think key, not chord as much as possible." p. 211: "Just as you can raise the 4th on any major 7th chord".
  So Levine's default is Ionian, with the raised 4th always available as a choice, and Lydian is explicitly the IV
  chord's scale.
- Russell (*Lydian Chromatic Concept*): no primary text on disk; "Lydian is the tonic's parent scale" is the standard
  summary of the book, labelled secondary, page unverified.
- Chediak vol. 1 p. 338: "a) Escala do modo iônico ... CIM(9), CIM(6)" for the I chord; Lydian is given for the IV chord
  (p. 339).

Verdict: M3 AGREE. The engine's `chord_scales.json` already holds Lydian as the `Maj7` Advanced rung (principle 7); that
is exactly the sources' ranking (Ionian first, Lydian a colour).

**(b) M4: are all non-tonic major chords Lydian in Berklee?** Yes for IV, ♭VI, ♭II, ♭III-in-major, ♭VII-in-major; no for two
cases the engine also treats as Lydian.

- IV in major: N&G p. 33 (list of diatonic scales, "Lydian ... IVmaj7") and M&H p. 23 ("Any combination of 9, ♯11, and 13
  will sound pleasing"; "no harmonic avoid tones").
- Modal-interchange major 7ths: M&H p. 129: "there is a subset of all MI chords that share major 7 quality: ♭VIIMaj7,
  ♭IIIMaj7, ♭VIMaj7, and ♭IIMaj7 ... To reflect their similarity, they are all expressed with a Lydian chord scale,
  whether they sound alone or in a patterned string ... The Lydian chord scale also provides an important connection to
  the major modality: in every case, ♯11 is diatonic to the key." This is the exact text behind M4's reason line "a
  borrowed major chord: Lydian, as all non-tonic major chords". N&G p. 76 (♭IIImaj7 "usually a Lydian scale. The ♯11
  holds the progression to the key of I major"), p. 76 (♭VIImaj7 "Lydian to reflect its nontonic function"), p. 81
  (♭VImaj7 Lydian), p. 133 (♭IImaj7 Lydian).
- The two exceptions are in a MINOR key, where the same chords are not borrowed: ♭IIImaj7 is "Lydian or Ionian" (N&G p. 91)
  or Ionian (M&H pp. 87, 98: "bIIIMaj7 Aeolian source, Ionian chord scale"), which the engine's M3 second branch has;
  and ♭VIImaj7 is Ionian in N&G p. 91 ("bVIImaj7 ... Ionian", from dorian minor, p. 85, p. 88: "The ♭VIImaj7 is the only chord
  [dorian minor] contributes"). The engine sends ♭VIImaj7 in a minor key to M4 Lydian; see row M4-minor and change C2.
- Levine p. 39 (IV: Lydian), p. 158 (the two major 7th chords ♭VI and ♭III-like A♭∆, C♭∆ in "Fee-Fi-Fo-Fum": "can be played
  with either the major scale or the Lydian scale"), p. 211.

**(c) vi7: Aeolian or Dorian?** Aeolian in Berklee, Chediak and Levine's chart; Levine dislikes the chord.

- N&G p. 33 (VI-7 Aeolian), p. 27 (Aeolian: avoid ♭13). M&H p. 24: "Diatonic tensions 9 and 11 are available on the VI-7
  chord. The diatonic S♭6 is a half step above chord tone 5 and thus unavailable." Note that the ♭13 (S♭6) is an AVOID
  note on Aeolian. The engine's reason text for m7 says the opposite ("vi: the ♭13 is in the key", suggesting a tension);
  see change C3.
- Levine p. 52: "Aeolian chords are rarely played ... it is sometimes played over the VI chord in a I-VI-II-V ... In
  practice, modern jazz musicians play the VI chord as a dominant chord ... most of the time. One reason often given for
  playing the Aeolian mode on a VI chord is that it allows you to stay in the same key over all four chords of a I-VI-II-V.
  This is a lazy musician's approach". Levine gives the mode and then advises against the chord; he never names Dorian
  for a diatonic vi.
- When vi is a related ii (Am7 D7 G in C: V7/V) Berklee allows Dorian: N&G p. 67: "The dual function -7 chord may use the
  appropriate diatonic scale or a Dorian scale to reflect the relationship to the dominant chord"; M&H p. 58: "the related
  II's of V7/IV and V7/V are often expressed with a Dorian chord scale, reflecting a typical major key II-7 sound". The
  engine's m4-over-m7 order therefore matches M&H for vi.
- Chediak vol. 2 p. 99 (contents): "escala do modo eólio associado ao acorde menor do I ou do VI grau Am7".
- Aebersold's Scale Syllabus (web secondary summary only, music-theory-practice.com, unverified against the book):
  minor 7 default Dorian, Aeolian a colour.

Verdict: m7 vi AGREE (Berklee, Chediak); Levine ambivalent (names the mode, discourages the chord).

**(d) iii7: Phrygian or Dorian?** This is the one place where all the Berklee text is against the engine, and the engine
knows it (plan §7.3 "m5 and m9 are conventions, not derivations").

- N&G p. 33: "Phrygian ... III-7". M&H p. 23: "Only the 11 sounds pleasingly consonant; ♭2 and ♭6 are unacceptably dissonant in a
  voicing. The tonic function of III-7 would also be obscured by S♭2, which is Fa, the characteristic note of subdominant
  function." The Dorian alternative is not offered.
- Related ii of V7/vi (the Stella case when iii is followed by a dominant): M&H p. 57: "The default chord scales for related
  II's reflect their function in a progression. For example, III-7 has tonic function; its diatonic Phrygian chord scale
  reinforces that perception"; p. 57–58: "Another possibility is to treat E-7 as a related II by employing an Aeolian chord
  scale" (E Aeolian, with T9; "The introduction of the non-diatonic F♯ creates a momentary brightening"). M&H p. 58: "Tunes that
  use the diatonic chord scale for dual function chords such as III-7 and VI-7 sound more 'inside.'" Dorian is given for the
  related ii of V7/IV and V7/V, not of V7/vi. N&G p. 67 allows "a Dorian scale", with the warning "The use of a Dorian
  scale has potential for destroying any deceptive sound for the dominant."
- Levine never names a scale for iii7. p. 26: the Phrygian mode "is played most often on an entirely different chord—one
  that isn't even a minor 7th chord"; p. 48: "You usually play C on E-7 only in diatonic progressions such as III-VI-II-V ...
  where the C in the E-7 chord is played only as a passing note. The Phrygian mode is usually played, not over minor 7th
  chords, but over sus ♭9 chords." This is evidence against Phrygian on a -7, and for the ♭6 being a passing note (so
  Dorian or Aeolian in practice), but it is not a statement "play Dorian".
- Chediak vol. 2 p. 48: "Esses mesmos tipos de acordes quando encontrados sobre o IIm7, usa-se a escala do modo dórico; no
  IIIm7, com exceção dos acordes com nona, usa-se a escala do modo frígio. Em música contemporânea de contexto menos
  consonante aceita-se o modo dórico para ... o IIIm." So: Phrygian, with the Aeolian (chords with a 9, the scale shown for
  the category) and, "in contemporary, less consonant music", Dorian.

So "Dorian by convention" for iii7 IS attested, but only as the second-rank, contemporary choice (Chediak p. 48) and by
inference from Levine pp. 26 and 48; Berklee's default is Phrygian, with Aeolian as the related-ii alternative.
Verdict: m9 SPLIT, and it conflicts with principles 4 and 7 as written; principle 5 licenses a convention for the tonic
minor only, not for iii. Per the brief, I state the conflict and stop; options are in §4 (Q1).

**(e) Tonic minor: Dorian by convention (m5) or Aeolian, melodic, harmonic? Is "Dorian by convention" attested, or is it
Levine's "minor-major/melodic minor"?** Both Dorian and melodic minor are attested, for different things; the engine's rule is
on the symbol `m7`/`m` and Dorian is attested for that.

- N&G p. 91 (image): "The potential diatonic I- chord scales are: I-7 Dorian or Aeolian. I-6 Dorian (avoid ♭7) or melodic
  minor. I-(maj7) melodic minor or harmonic minor. I- (triad) either a scale using degrees 1 through 5 ... or any of the
  above scales assuming the melody conforms to the choice. I-7 Phrygian is a potential scale, especially if the melody is
  phrygian minor (unusual)." p. 91 also: "Avoid note criteria remains the same as major key except for the Dorian scale,
  allowing the use of tension 13, especially on the I-7 chord. This important tension inclusion is indicative of the sound of
  dorian minor." and "The chord scales used for the tonic I- chord may represent any form of minor scale." p. 76 (tonic
  minor in a major key): "The I-7 chord is most often a Dorian chord scale with 13 as an available tension."
- M&H p. 84: "In minor key music, the tonic chords usually come from melodic minor or Dorian, although Aeolian and Phrygian are
  possibilities as well." p. 86: Dorian is "frequently used". p. 87: "I-7 can be derived from an Aeolian source when a darker
  sound is desired." p. 98 (image, summary table): rows I-6 / I-(Maj7) melodic minor; "I-7 I-6 Dorian / Dorian"; "I-7 Phrygian /
  Phrygian"; "I-7 Aeolian / Aeolian". p. 112: "The alternating I-7 IV7 Dorian vamp evokes a brighter mood than an Aeolian I-7 IV-7."
  p. 128 (tonic modal interchange): "The Dorian scale serves as the most common tonic modal source".
- Levine: the -7 symbol on the tonic is Dorian, and he then recommends replacing it. p. 225 (minor blues, Mr. P.C.): "Notating
  the first chord simply as C- gives you the option of playing one of several scales: For instance, you could play C minor major,
  rather than just the C Dorian scale that C-7 would imply." p. 299: "C-6 is a safe chord ... because the notes in C-6 fit both the
  C Dorian scale (C-7) and the C melodic minor scale (C-∆)." pp. 58, 272, 273, 406: a minor chord that is not part of a II-V is a
  tonic minor; "D-6 or D-∆ may sound prettier than D-7"; "C-7 isn't wrong; it's optional" (p. 406). p. 75–76: the minor II-V-I is
  "a half-diminished chord, an alt chord, and a minor-major chord", the last "from C melodic minor". So Levine's tonic-minor SCALE
  for the symbol -7 is Dorian; his preferred SOUND is the minor-major/-6, reached by changing the chord. That is not a
  contradiction of m5; it is a different operation (reharmonisation) from the one the analyser performs (naming the scale of
  the written symbol), and the engine's `m(Maj7)` rule m1 already gives the melodic minor when the symbol says it.
- Chediak: Aeolian. Vol. 2 p. 48: the minor-chord scale shown for Cm, Cm7, Cm7(9), Cm7(11) is "ESCALA DE ACORDE (DÓ EÓLIO)" (♭6
  bracketed as a passing note). Vol. 2 pp. 112–113 (image): in "IIm7(♭5) V7(♭13) Im7" the three scales are "Lócrio, Menor harm. 5↓,
  Eólio"; the Im7 is Aeolian. Vol. 1 p. 350: the ♭9 of V7(♭13) is "a sexta menor da escala do acorde de resolução (eólio)".
- Aebersold (web secondary): Dorian "the jazz default" for -7.

Verdict: m5 AGREE (N&G p. 91 first-listed with the 13 tension, M&H p. 98, Levine pp. 225, 299), with Chediak DIFFER (Aeolian) and an
open choice among the sources between Dorian and Aeolian that the plan's decision 7 already records (Aeolian at Basic).

**(f) m6 (minor sixth chord): Dorian or melodic minor?** SPLIT in ordering; both scales are in every source.

- N&G pp. 79, 91: "I-6 Dorian (avoid ♭7) or melodic minor"; the first-named is Dorian. IV-6 likewise, p. 79 (also "IV-(maj7)
  melodic minor").
- M&H p. 85: "the I-6 chord ... it is preferred to conceive of scale degree 7 as a tension" (melodic minor first); p. 86 "Dorian ... an
  alternate source for I-6 ... On I-6, ♮7 is an avoid note"; p. 98 table gives I-6 "Melodic Minor" and also "I-7 I-6 Dorian".
- Levine p. 299: C-6 fits both C Dorian and C melodic minor. Chediak vol. 1 p. 341: the melodic scale is the scale for Cm6
  ("O acorde menor com sexta é usado, também, no IV grau").

Verdict: m2 SPLIT. The engine (Dorian Standard, Melodic Minor Advanced) matches N&G's order and is defensible under principle 7
(Dorian is the diatonic option for iv-6 and ii-6; the melodic minor needs a chromatic note). M&H and Chediak put melodic minor first
for i6; see Q3.

**(g) m3 (symbol ♭6 → Aeolian).** Levine p. 53: "When the 5th of a minor chord moves up chromatically to a ♭6, the resulting minor ♭6
chord is a very effective place to play the Aeolian mode" ("Sunshower", "Ain't Misbehavin'"). M&H p. 107: the min♭6 chord symbol
"communicates the musical device: a familiar moving line" (line cliché, p. 107). AGREE; the player's word for it is "line cliché",
but the scale the symbol implies is Aeolian.

**(h) m4 (related ii → Dorian: universal?)** For non-diatonic related ii and for ii and vi: yes. N&G p. 72 (the Dorian chord scales
for related II-7 chords), p. 73 ("it is very common to use Dorian-Mixolydian when a ii–V occurs"); M&H p. 58 (ii of V7/IV and V7/V
Dorian); Levine p. 37 (II-7 Dorian) and p. 53; Chediak vol. 2 p. 48 (IIm7 dórico). For the dual-function iii7 the Berklee default
is the diatonic Phrygian, not Dorian (above). Verdict m4 AGREE, with the iii7 sub-case DIFFER (M&H p. 57).

**(i) iv7 in major (m8: borrowed minor → Dorian).** AGREE in both Berklee texts: N&G p. 79 ("The IV-7 chord is a Dorian chord scale"),
p. 129 (IV-7 "Dor."); M&H p. 129: "Recognizing the Aeolian scale as the source for IV-7, we get a Dorian chord scale: no avoid
notes, no awkward altered intervals" (and the Ionian-derived scale "a Questionable Choice", p. 129). M&H p. 129: the diatonic-tension
method "will often give unmusical results" for MI chords, unlike secondary dominants; this is the one place in Berklee where
"tensions diatonic to the key" is explicitly rejected, and M4 and m8 are the engine's two rules that already follow the chord's own
source instead. The stale note in `chord_scales.json` (`m` and `m7`: Aeolian "when the chord is vi or iv") contradicts both the
analyser and Berklee for iv; see change C3.

**(j) ø7: Locrian (h2) everywhere or Locrian ♮2?**

- Berklee: Locrian. N&G p. 28 ("The chord scale used for the -7(♭5) chord is Locrian", avoid ♭9), p. 29 summary ("Locrian: avoid
  ♭9"), p. 80 ("The Locrian — Mixolydian (♭9, ♭13) chord scales will reflect their harmonic minor origin" for II-7(♭5) V7(♭9)), p. 91
  (II-7(♭5) Locrian; VI-7(♭5) "Locrian or Locrian(♮9)"), p. 121 (♯IV-7(♭5) "diatonically oriented Locrian"; Locrian ♮9 "when
  movement is expected to IV-"). M&H p. 25 (VII-7♭5 Locrian), p. 58 (related II of minor chords, Locrian), p. 90 (II-7♭5 Locrian),
  p. 98 (table), p. 159 (♯IV-7♭5 Locrian). The Locrian ♮9 belongs to VI-7♭5 (the tonic-function ø7 of a minor key): M&H p. 85 "The chord
  scale for VI-7♭5 is Locrian natural 9, a displacement of the melodic minor source scale. All tensions are available." That is a
  DIFFER for `♭vi ø7 in a minor key` (the engine's h2 gives Locrian; Berklee gives ♮9 there).
- Levine splits internally. p. 54: "When the early bebop masters did think of a scale for a half-diminished chord, Locrian was their
  usual choice, although Bud Powell often played the harmonic minor scale ... Some musicians play the Locrian mode, others the mode
  from melodic minor harmony." p. 69: "Almost all of the early bebop musicians played the Locrian mode on half-diminished chords, and
  it is still the first choice of many musicians ... From the 1960s on, however, the trend has been toward playing the sixth mode of
  melodic minor ... Many musicians play both. For example, on a minor III-VI-II-V (as in Eø, A7♭9, Dø, G7alt), Freddie Hubbard likes to
  play Locrian on the Eø chord, while playing the half-diminished mode on the Dø chord." p. 70: "When improvising, you play the
  half-diminished mode, the sixth mode of the melodic minor scale, on minor 7th ♭5 chords." p. 76: for a minor II-V-I "The notes played
  over the Dø chord are from F melodic minor" (D Locrian ♮2). p. 408: "Neither of the scales usually played on Dø (D Locrian from
  E♭ major, or the sixth mode from F melodic minor)". So Levine's default is ♮2; he lists Locrian as the older and still-common first choice.
- Chediak: Locrian. Vol. 1 p. 340 (h) "Escala do modo lócrio", vol. 1 p. 341 (i) "lócrio com nona"; vol. 2 pp. 112–113 (image) Dm7(♭5) "Lócrio".
- Aebersold (web secondary): half-diminished default Locrian ♮2 (unverified against the book).

Verdict: h2 AGREE with Berklee and Chediak, DIFFER from Levine (and the web Aebersold summary). The engine's ladder (Locrian Standard, Locrian ♮2
Advanced) is exactly principle 7's resolution of this split and needs no change. One reason-string issue (below, C3): the ♭9 of a
Locrian chord is an avoid note in all three sources, so "the ♭9 is in the key" misleads.

**(k) °7: Whole-Half always (d1)?** This is the one rule where Berklee, in both texts, prescribes something else.

- N&G p. 114 (image): the symmetric diminished scale is rejected for functional use: "These chords have diatonic function, hence,
  the tensions should be diatonic ... Result—the symmetric diminished chord scale is an appropriate scale for use when the diminished 7th
  chord is not functioning diatonically." p. 115 (image): "For the diatonic functioning diminished chords, a more appropriate chord
  scale must rely on the diatonic functioning secondary dominant chords which contain the necessary 8 notes. These are the Mixolydian
  chord scales with ♭9 and ♯9"; "Because the ascending diminished chords are derived from the secondary dominant of the target diatonic
  chord of resolution, that secondary dominant chord scale is the choice for the diminished chord scale" (♯I°7 → II-7 = V7(♭9)/II, ♯II°7
  → III-7, ♯IV°7 → V7, ♯V°7 → VI-7), "displacements of the secondary dominant chord scale (starting on the 3rd)". p. 116 (image): descending
  and auxiliary diminished chords "are not derived from dominant function. The scale of choice is based on the enharmonic similarities
  between the ascending diminished chords and the chromatically derived diminished chord because the key remains unchanged": ♯V°7 = ♭VI°7,
  I°7 = ♭III°7 = ♯II°7, and ♯IV°7 has two usable scales (V7(♭9) of V; V7(♭9) of III, "From a harmonic (chordal) viewpoint, the secondary
  dominant of III tends to sound best", p. 117). N&G p. 121: VII°7 "a displacement of harmonic minor (starting on the 7th degree) or V7
  (Mixolydian ♭9, ♯9, ♭13) starting on the 3rd".
- M&H p. 149: "diminished chord scales are created with chord tones plus tensions and avoid tones from the prevailing key", "Chord Scale for
  ♯V°7—G♯ Diatonic Diminished or Mixolydian (♭9,♯9,♭13) from 3"; the same equivalences for ♯II°7 (p. 151), ♯I°7 (p. 152: "The C♯ diatonic
  diminished chord scale is identical in pitch content to the A Mixolydian (♭9, ♯9, ♭13) scale"), ♯IV°7 (p. 152); passing ♭III°7 (p. 156: "Eb°7
  Eb Diatonic Diminished", with an optional scale adding the diatonic 9); ♭VI°7 (p. 158, "See Jobim's 'Corcovado' or 'Wave'", "the chord scale
  consists of chord tones, diatonic tensions, and diatonic avoid tones from the parent key"); auxiliary I°7 (p. 160: "The chord scale for I°7 is
  created by spelling the chord tones, and then connecting them with scale tones that are diatonic to the parent key ... Neither is a mode of any
  other conventional scale") and V°7 (p. 161). p. 162: "Throughout this chapter we have put a premium on embedding functional diminished seventh
  chords in the key by using only diatonic tensions. However, the use of nondiatonic tensions on diminished chords can have a startling dramatic
  effect ... The symmetric diminished chord scale is not diatonic to any key. It is often deployed as an optional chord scale for special situations
  where its vibrant color is desired as contrast to a more diatonic passage."
- Levine p. 84: "Figure 3-130 shows the whole-step/half-step diminished scale. You play this scale over diminished 7th chords"; p. 85: "Diminished
  chords are usually played in place of V7 chords to create a chromatic bass line ... G♯o is E7♭9 without E, the root"; p. 86: "Early jazz
  musicians played the diminished scale solely on diminished chords"; p. 87: "Not all diminished chords are disguised V7♭9 chords of the following
  chord ... Wave ... B♭o is the disguised V (A7♭9) of the D7 chord, with A-7 inserted between the two chords to create a II-V"; p. 87: "Few modern
  jazz musicians actually write diminished chords into their tunes anymore." So Levine: Whole-Half, with the rootless-V7♭9 reading the engine's
  reason text uses; he gives no diatonic alternative.
- Chediak: Whole-Half too. Vol. 1 p. 91: "As notas naturais do acorde, mais as tensões, formam a escala diminuta (tom e semitom)" with tensions "(7M), (9),
  (11) e (♭13)"; vol. 1 p. 345 "h) Escala diminuta (tom e semitom)", VIIº; vol. 2 contents p. 105 and the clichés pp. 118–123 (VIIº Im, I7M ♯Iº IIm7
  V7, I7M ♭IIIº IIm7 V7: "Iônico, Diminuta, Dórico, Mixolídio").
- Aebersold (web secondary): Whole-Half default, Half-Whole alternative (unverified against the book).

Verdict: d1 SPLIT, with Berklee (rank 1, both texts) DIFFERING from the engine and Levine/Chediak AGREEING with it. Under the brief's hierarchy, and
under principles 4 and 7 (diatonic at Standard, the hipper at Advanced), the engine's choice is inverted: Whole-Half should be the Advanced rung
and the key-derived "diatonic diminished" scale the Standard. Details and a worked case (Wave) in §3, change C1.

**(l) Auxiliary (same-root) °7 versus passing: same scale?** Not in Berklee. N&G p. 114 splits "dominant versus nondominant" derivation: ascending
diminished chords contain the target's secondary-dominant tritone; descending and auxiliary "do not contain the secondary dominant's tritone,
therefore ... are derived from chromatic resolution" (p. 114), so they get the enharmonically equivalent ascending scale (p. 116). M&H gives separate
chord-scale figures for ascending (pp. 149–152), passing (♭III°7 p. 156, ♭VI°7 p. 158) and auxiliary I°7 (two options, p. 160) and V°7 (p. 161); the
auxiliary I°7 gets chord tones plus the home key's notes, not the ascending scale. The engine's three `fn` labels (vii°7 of, auxiliary, passing)
already separate them but give all three the same scale.

**(m) Modal-tune rules M5, m6, h1 against N&G Modal Systems (p. 152).**

- N&G pp. 152–153: each mode is distinguished by its character note; "The diatonic ~7(♭5) is avoided. The diatonic dominant 7th chord is most often
  treated as a triad." p. 155: the diatonic chords of each mode are divided into tonic, cadential (contain the character note) and non-cadential; the
  chord scale of each modal chord is its diatonic displacement (p. 157: "For the diatonic Dorian chord scale, 13 is an available tension ... Because all
  the notes of Dorian and Lydian are available on the I chord, the total sound of the mode is self-contained": "Imaj7 (9, ♯11, 13) C Lydian"). Berklee
  therefore derives the scale from the NAMED MODE, which a chord-only analyser cannot see. "Milestones" is in N&G's list of modal tunes (p. 158).
- M&H pp. 183–197: "modal" has several marks (limited chord set from one scale; no functional harmony; slow harmonic rhythm ...). p. 183: "The Dorian,
  Phrygian, Lydian, Mixolydian, and Aeolian scales can each be employed as a modal system" (p. 184). p. 187: "You will notice that -7♭5 chords are absent
  from all the following discussions. Along with dominant seventh chord, they are problematic, because of their strong potential to resolve away from the
  modal tonic." p. 194: "As in all the other modes, the -7♭5 chord is almost never found." p. 197: Locrian tunes "simply do not exist in the repertoire."
  p. 188: Lydian: "Tonic chord: IMaj7 (♯11) ... No avoid notes on the tonic chord". p. 192: Dorian "I-6 is a common variation".
- Levine pp. 29–30: "musicians are more apt to be thinking 'D Dorian' and 'E♭ Dorian'" on "So What"; p. 52: "The bridge of Miles Davis' 'Milestones' consists of a
  single chord: A Aeolian."

Consequences: M5 is right where the named mode makes the chord Lydian (tonic of a Lydian mode; ♭III of Dorian; ♭VI of Aeolian; ♭II of Phrygian) and not
where the chord is the mode's relative-Ionian chord (♭VII of Dorian, ♭III of Aeolian, IV of Mixolydian), which is Ionian by displacement; M&H p. 183 notes modal
tunes make "limited use of the chord that represents the relative Ionian scale". m6 (every minor chord Dorian) is right for the tonic of a Dorian tune, wrong for
the tonic of an Aeolian or Phrygian tune ("Milestones" bridge, "Crystal Silence": M&H p. 199 "composite modal ... predominant tonic color (Aeolian)") and for the
non-tonic minor chords of a Dorian mode (II-7 is Phrygian, M&H p. 93). h1 has no Berklee prescription at all (the ø7 is avoided); Locrian ♮2 is Levine's
post-1960 colour. Verdicts: M5 DIFFER (partial); m6 UNDERSPECIFIED (default Dorian is the brightest and commonest tonic, M&H p. 128, p. 191, but no source says
"default"); h1 UNDERSPECIFIED (Levine-supported practice).

---

## 2. Findings table

Columns: rule id or case | engine | Berklee (N&G, M&H) | Levine | others | verdict | note. "ped." = pedagogical baseline, web summary only. All pages are book pages.

| Rule / case | Engine | Berklee | Levine | Others | Verdict | Note |
|---|---|---|---|---|---|---|
| M1 `Maj7♯11` | Lydian, "from the symbol" | N&G p. 26 (Lydian where the key holds ♯4); M&H p. 188 (`IMaj7(♯11)` is the Lydian tonic) | p. 39 ("♯4 added to the chord symbol", "Lydian chord") | Chediak vol. 1 p. 339 `F7M(♯11)` Lydian | AGREE | principle 2 |
| M2 `Maj7♯5` | Lydian Augmented | M&H p. 86 (♭III+(Maj7) Lydian Augmented, melodic minor source). N&G: no chord scale for the ♯5 symbol found in the text layer (page unverified) | p. 63 ("you play the Lydian augmented mode ... on major 7th ♯5 chords") | Chediak vol. 1 p. 341 (j) lídio ♯5 | AGREE | N&G side UNDERSPECIFIED |
| M3 tonic Imaj7 / 6 / triad in major | Ionian, "tonic: the 4th is in the key" | N&G p. 26 (Ionian, avoid 4; Lydian where the key holds ♯4); M&H p. 21 (Ionian, S4 "will obscure its tonic function") | p. 37 (C Ionian over C∆; 4th "handle with care"); p. 38–39 (raised 4th a bebop-era choice, "almost any major 7th chord"); p. 211 | Chediak vol. 1 p. 338 (Ionian: `CIM(9)`, `CIM(6)`); Russell: Lydian tonic (secondary, unverified); ped.: Ionian default, Lydian "the preferred choice for many jazz pianists" | AGREE | Lydian = the existing Advanced rung (`Maj7`, `6`, ladder Ionian→Lydian). The "(Levine)" in the brief should read: Levine defaults to Ionian |
| M3 ♭III of a minor key | Ionian, "♭III of G minor is B♭ major itself" | N&G p. 91 ("♭IIImaj7 Lydian or Ionian"); M&H pp. 87, 98 (Ionian, from the Aeolian source) | not addressed (Lydian discussion is for major keys) | N&G p. 129: Ionian "in a more pure sense" | AGREE | M4's Lydian for ♭III *in major* is N&G p. 76, M&H p. 129 |
| M3 V triad in major → Mixolydian | Mixolydian "V without its 7th" | No chord scale for a V triad as such; N&G p. 153 (modal: dominant treated as a triad) | not addressed | | UNDERSPECIFIED | The code has this branch (`d === 7 && quality 'maj'`) and plan §7.2/§8 do not list it; document it |
| M4 IV in major | Lydian, "IV: the ♯4 is the key's 7th" | N&G p. 33 (IVmaj7 Lydian); M&H p. 23 (no avoid notes) | p. 39 ("when the major 7th chord is acting like a IV chord") | Chediak vol. 1 p. 339 | AGREE | |
| M4 ♭VI, ♭II, ♭VII, ♭III in major (borrowed) | Lydian, "a non-tonic major chord: Lydian" | M&H p. 129 (the whole subset "expressed with a Lydian chord scale ... in every case, ♯11 is diatonic to the key"); N&G pp. 76, 81, 133 (♭III, ♭VII, ♭VI, ♭II: Lydian) | p. 158 (A♭∆, C♭∆ "either the major scale or the Lydian scale") | | AGREE | M&H p. 129 is the exact source of the rule |
| M4 ♭VI in a minor key | Lydian | N&G p. 91, M&H pp. 90, 98 (♭VImaj7 Lydian) | | | AGREE | |
| M4 ♭VII (major chord) in a minor key | Lydian, "a non-tonic major chord: Lydian" | N&G p. 91: "♭VIImaj7 Ionian" (dorian minor source, pp. 85, 88). M&H: not in the minor-key table (p. 98) | | | DIFFER | N&G only; B♭ Ionian is C Dorian exactly, B♭ Lydian needs E♮ against the key's E♭. Change C2 |
| M4 chromatic major chord (no function) | Lydian, fallback | no source gives a rule; M&H p. 129's rationale (the ♯11 is the key's) covers borrowed chords only | p. 39: raised 4th is optional | | UNDERSPECIFIED | stays a "guess" in the engine's tiers, correctly |
| M5 modal major | Lydian for every major chord | N&G pp. 155, 157 (scale by displacement of the named mode); M&H p. 188 (Lydian tonic; "Lydian progressions are almost non-existent" in jazz, but Lydian tonic MI is common) | p. 39 | M&H p. 183 (relative-Ionian chord rare in modal tunes) | DIFFER (partial) | right for the chords whose mode-displacement is Lydian (§1m); wrong for the relative-Ionian chord. Cannot be fixed without the mode (Area B) |
| m1 `m(Maj7)` | Melodic Minor, "from the symbol" | N&G p. 91 (melodic minor or harmonic minor); M&H p. 85 (I-(Maj7) melodic minor) | pp. 58, 60 ("you play the minor-major mode, the first mode of the melodic minor scale"); p. 59 (Nica's Dream) | Chediak vol. 1 p. 341 | AGREE | Harmonic Minor already the Advanced rung |
| m2 `m6` | Dorian (Melodic Minor at Advanced) | N&G pp. 79, 91: "Dorian (avoid ♭7) or melodic minor" (Dorian first); M&H pp. 85–86: melodic minor preferred, Dorian "alternate source" | p. 299 (C-6 fits both) | Chediak vol. 1 p. 341: melodic for Cm6 | SPLIT | engine follows N&G's order; consistent with principle 7 |
| m3 symbol ♭6/♭13 | Aeolian, "from the symbol" | N&G p. 27 (Aeolian avoids ♭13; the ♭6 of the symbol is Aeolian's); M&H p. 107 (min♭6 is a line cliché, a device) | p. 53 (minor ♭6 chord: "a very effective place to play the Aeolian mode") | | AGREE | player's word: line cliché |
| m4 related ii, non-diatonic (G-7 of C7 in C) | Dorian, "ii of the ii–V to …" | N&G p. 72; M&H p. 58 (ii of V7/IV, V7/V Dorian) | p. 37 | Chediak vol. 2 p. 48 (IIm7 dórico) | AGREE | |
| m4 related ii = vi7 (Am7 D7 in C) | Dorian | N&G p. 67 ("diatonic scale or a Dorian scale"); M&H p. 58 (Dorian "often") | | | AGREE | |
| m4 related ii = iii7 (Em7 A7 in C) | Dorian | M&H p. 57: Phrygian default, Aeolian alternate (with T9), Dorian not given; N&G p. 67 diatonic or Dorian | p. 48 (C played "only as a passing note") | Chediak vol. 2 p. 48: Phrygian; Dorian accepted contemporary | DIFFER | see m9 |
| m5 tonic minor of a minor key | Dorian, "tonic minor: Dorian by convention" | N&G p. 91 (I-7 "Dorian or Aeolian"; the 13 on I-7 "indicative of the sound of dorian minor"), p. 76 (Dorian "with 13"); M&H pp. 84, 86, 98 (Dorian, also Aeolian, Phrygian; melodic minor for I-6/I-(Maj7)) | pp. 225, 299 (the -7 symbol implies Dorian; prefers -6/-∆); pp. 58, 272, 406 | Chediak vol. 2 pp. 48, 112–113: Aeolian; ped.: Dorian jazz default | AGREE | "by convention" is attested (§1e). Chediak DIFFER; Aeolian at Basic is plan decision 7 |
| m6 modal minor | Dorian | N&G p. 157 (Dorian 13 available); mode named by the tune; M&H pp. 183–197 (each tonic by its mode; Dorian "frequently"); II-7 of a Dorian mode is Phrygian (M&H p. 93) | pp. 29–30 ("D Dorian", "E♭ Dorian"); p. 52 (Milestones bridge Aeolian) | | UNDERSPECIFIED | default Dorian is practice; tonic of Aeolian/Phrygian tunes needs metadata (Area B) |
| m7 ii of major | Dorian, "the key's own notes" | N&G p. 33; M&H p. 22 | p. 37 | Chediak p. 338 | AGREE | |
| m7 vi of major | Aeolian, "vi: the ♭13 is in the key" | N&G pp. 27, 33; M&H p. 24 (S♭6 "unavailable") | p. 52 ("rarely played", "lazy") | Chediak vol. 2 p. 99 | AGREE | reason text misleading: ♭13 is the avoid note (C3) |
| m7 iv of minor | Dorian | N&G pp. 79, 91; M&H pp. 90, 98 | | | AGREE | |
| m7 v of minor | Phrygian, "v of a minor key: the ♭9 is in the key" | M&H pp. 97, 98 (Phrygian); N&G p. 91 (V-7 Aeolian), p. 77 (Dorian as MI chord from Mixolydian) | | | SPLIT | engine takes M&H; reason text misleading (♭2 is an avoid note, M&H p. 97) |
| m8 iv7 in major | Dorian, "a borrowed minor chord: Dorian, its own key" | N&G pp. 79, 129 (IV-7 Dorian); M&H p. 129 (Dorian from the Aeolian source) | | | AGREE | `chord_scales.json` note "Aeolian when vi or iv" is stale (C3) |
| m8 i7 in major (parallel tonic) | Dorian | N&G p. 76 (Dorian "with 13"); M&H p. 128 (Dorian source) | | | AGREE | |
| m8 v7 in major | Dorian | N&G p. 77 ("If the function is truly V-7 ... Dorian ... as a modal interchange chord from Mixolydian"; 13 available); Aeolian only if it acts as a tonic minor, p. 76 | | | AGREE | |
| m9 iii7 (as target or passing) | Dorian, "iii: Dorian (its Phrygian would put a ♭9 over the root)" | N&G p. 33, M&H p. 23: Phrygian; M&H p. 57: Aeolian as the related-ii alternate | pp. 26, 48 (Phrygian "not over minor 7th chords"; ♭6 only a passing note) | Chediak vol. 2 p. 48: Phrygian, Aeolian for chords with 9, "Dorian accepted in contemporary music" | SPLIT | conflicts with principles 4 and 7; principle 5 licenses only the tonic minor. §4 Q1 |
| h1 modal ø7 | Locrian ♮2, "modal: the melodic-minor colour, with a 9 to lean on" | N&G p. 153 (ø7 "avoided" in modal systems); M&H pp. 187, 194, 197 (ø7 absent/almost never found) | pp. 69–70 (melodic-minor mode is the post-1960 trend) | | UNDERSPECIFIED | Footprints' F♯ø7: Levine-supported taste rule, as plan decision 9 says |
| h2 iiø7 of minor, related iiø7, viiø7, ♯ivø7 | Locrian, "…: the ♭9 is in the key" | Locrian: N&G pp. 28, 80, 91, 121; M&H pp. 25, 58, 90, 98, 159 | pp. 54, 69, 76, 408 (♮2 is the default since the 1960s; Locrian "still the first choice of many") | Chediak vol. 1 pp. 340–341; vol. 2 pp. 112–113: Locrian; ped.: ♮2 | AGREE (Berklee, Chediak); DIFFER (Levine) | principle 7 already ranks Locrian Standard / ♮2 Advanced |
| h2 ♭vi ø7 in a minor key | Locrian | M&H p. 85: Locrian natural 9, "All tensions are available"; N&G p. 91: "Locrian or Locrian(♮9)" | p. 70 (♮2 mode) | | DIFFER | tonic-function ø7 of the minor key, not a related ii |
| d1 ascending `vii°7 of` (♯I°7, ♯II°7, ♯IV°7, ♯V°7) | Whole-Half, "the rootless V7♭9 of the next chord" | N&G pp. 114–115, 117 (8-note scale = the secondary dominant's chord scale from the dim's root; symmetric scale "when not functioning diatonically"); M&H pp. 149–153 ("Diatonic Diminished or Mixolydian (♭9,♯9,♭13) from 3"), p. 162 (symmetric: optional, special) | pp. 84–87 (Whole-Half over diminished chords; rootless V7♭9) | Chediak vol. 1 pp. 91, 345: diminuta tom–semitom | SPLIT (Berklee DIFFER) | change C1 |
| d1 passing (♭III°7, ♭VI°7, descending) | Whole-Half | N&G p. 116 (scale of the enharmonic ascending chord, "because the key remains unchanged"); M&H pp. 155–158 (♭III°7 Diatonic Diminished, optional 9; ♭VI°7 diatonic) | p. 87 (Wave) | | SPLIT (Berklee DIFFER) | same scale for ascending and passing in the engine; Berklee gives separate figures |
| d1 auxiliary I°7, V°7 | Whole-Half | N&G p. 116 (I°7 = ♭III°7 = ♯II°7 scale); M&H p. 160 (two diatonic scales for I°7), p. 161 (V°7) | | Chediak vol. 2 pp. 118–123 | SPLIT (Berklee DIFFER) | |
| Case: Milestones bridge Am7 | Dorian (m6); chart `# keep:` Aeolian | N&G p. 155 (Aeolian tonic I-7); M&H p. 193 | p. 52: "The bridge of Miles Davis' 'Milestones' consists of a single chord: A Aeolian" | | DIFFER (rule), correct under principle 1 | the chart is right; no rule can see the melody (§14) |
| Case: Solar Cm | Dorian (m5) (library chart writes `Cm`) | N&G p. 91 (I- triad: degrees 1–5 or any form, "assuming the melody conforms"); M&H p. 84 (tonic triad: min7, min6 or min(Maj7)?) | pp. 406, 299 (tonic minor: -7, -6, -∆ all fine) | | UNDERSPECIFIED | if the lead sheet symbol is `Cm(Maj7)` the rule is m1 Melodic Minor, AGREE (N&G p. 91, M&H p. 85, Levine p. 60); the chart should carry the symbol |
| Case: Nica's Dream B♭m(maj7), A♭m(maj7) | Melodic Minor each | N&G p. 91, M&H p. 85 | p. 59: "The first chord ... is a B♭ minor-major chord from the B♭ melodic minor scale. The second chord (A♭-∆) is from the A♭ melodic minor scale" | | AGREE | Levine's own example |
| Case: Footprints F♯ø7 | Locrian ♮2 (h1) | no chord scale (ø7 avoided, N&G p. 153) | pp. 69–70, 76 | | UNDERSPECIFIED | see h1 |
| Case: So What E♭m7 | Dorian (m6) | M&H p. 183 (phrase-by-phrase scales: "So What"); p. 185 | pp. 29–30 ("D Dorian" and "E♭ Dorian") | | AGREE | |
| Case: Wave B♭°7 → Am7 (D) | Whole-Half, "passing diminished", fallback flag | M&H p. 158 (♭VI°7, "See Jobim's 'Corcovado' or 'Wave'": diatonic diminished); N&G p. 116 (♭VI°7 = ♯V°7 scale) | p. 87 (B♭o = A7♭9 without root, Wave) | Chediak vol. 1 p. 91 (Whole-Half) | DIFFER (Berklee) | worked pitch sets in §3 C1 |
| Case: Beautiful Love iiø7 V7 i | Locrian | N&G p. 80; M&H p. 90 | p. 76: "The notes played over the Dø chord are from F melodic minor" | Chediak vol. 2 p. 113: Lócrio | AGREE (Berklee); DIFFER (Levine) | |
| Case: Blue Bossa D♭maj7 area | Ionian (tonicised, M3) | M&H pp. 92, 126: ♭IIMaj7 is Lydian when it is the cadential chord; a tonicised ♭II is not discussed; M&H p. 88 (the key shifts when the chord takes metrical stress and its ii–V) | pp. 39, 158 (maj7: either scale) | | UNDERSPECIFIED | Ionian is the tonicisation reading; Lydian is a legitimate alternate (Advanced rung) |
| Case: Girl from Ipanema bridge G♭maj7 | Lydian (M4) | N&G p. 84 (the bridge is listed under modal interchange); M&H p. 92 (♭IIMaj7 Lydian), N&G p. 133 | | | AGREE | |
| Case: minor blues tonic (Mr. P.C., Blues Minor) | Dorian (m5 / m6) | M&H p. 98 | p. 225: "You could play C minor major, rather than just the C Dorian scale that C-7 would imply"; Mr. P.C. is Levine's example | | AGREE | iv7 Dorian: M&H p. 98, N&G p. 91 |

---

## 3. Proposed changes

Rule ids: C1 (d1), C2 (M4/M3 ♭VII in minor), C3 (reason strings and one stale note). No principle is changed. m9 is flagged (Q1), not proposed.

### C1. d1: the key-derived diminished scale at Standard, Whole-Half at Advanced

- Change: a °7 takes the "diatonic diminished" scale of Berklee (chord tones plus the key's tensions, from the rootless dominant's scale) at Standard, and
  Whole-Half Diminished becomes the Advanced rung (the Berklee text's "optional ... special situations", M&H p. 162; Levine's and Chediak's default).
- Basis: N&G pp. 114–116 (image-checked), M&H pp. 149–162. It also follows from principle 4 (tensions diatonic to the key of the moment) and principle 7 (the diatonic
  choice is the analyser's; the hipper one is Advanced). The plan's case for a fixed Whole-Half (§7.4: "every function of a diminished 7th is the same rootless dominant
  ♭9 a major third below") is correct as a reading of the function, and is exactly what N&G and M&H use to derive the diatonic scale; the plan then stops one step early by
  not asking which tensions the rootless dominant has in the key (the question D4 already answers for dominants).
- Sketch for the lead (implementation is not mine to decide): ascending `vii°7 of X` → the scale D4 gives the rootless V7(♭9) of X, shown from the diminished's root
  (N&G p. 115; M&H p. 152: "identical in pitch content to the A Mixolydian (♭9, ♯9, ♭13)"); descending/passing and auxiliary → chord tones plus the local key's notes
  (M&H pp. 156–160), with N&G's enharmonic equivalence as the check. A new scale entry (`Diatonic Diminished`, 8 notes) is needed in `scales.ts`; it has no fixed
  interval pattern, so the sheet should print its notes, as the sheet does for any scale.
- Reason string (a player's words): "passing diminished: the rootless A7♭9, its other notes from the key of D" (ascending: "vii°7 of Dm7: the rootless A7♭9, its other notes from the key of D").
  Whole-Half at Advanced: "diminished scale: every note a tension".
- Test case: `key: D`; rows `A | 1 | DMaj7`, `A | 2 | Bbdim7`, `A | 3 | Am7`, `A | 4 | D7`. Expected for bar 2: B♭ diatonic diminished = B♭ B C♯ D E F♯ G A
  (the A7 chord scale in D with the B♭ added, displaced to the diminished's root; M&H p. 158 and N&G p. 116, ♭VI°7 ≡ ♯V°7); Advanced: B♭ Whole-Half = B♭ C C♯ D♯ E F♯ G A
  (it adds the non-diatonic C and D♯; the key's B and D drop out). Second case: `key: C`; `C#dim7` between `CMaj7` and `Dm7` → ascending: C♯ D E F G A B♭ C (A7♭9 in the
  key of the target, from C♯; N&G p. 115, M&H p. 152); Advanced: C♯ Whole-Half.
- Level: Standard (diatonic diminished), Advanced (Whole-Half, with the existing `Harmonic Minor` rung kept as a further alternative, since the 7-note harmonic minor a half
  step up is a subset of N&G's scale for ascending chords). Basic: unchanged (the `ladders` entry for Whole-Half has none). The `dim7` row of `chord_scales.json` has to put Whole-Half
  at `advanced` and name the new default.
- Conflict check: none with principles 1–7. It contradicts plan §7.4 and §8's `d1` line, which would need rewording.

### C2. M3/M4: ♭VII major chord in a minor key → Ionian

- Change: in a minor area the major chord on ♭VII takes Ionian (as M3 already does for ♭III), the Lydian remaining the Advanced rung (`Ionian` ladder: advanced `Lydian`).
- Basis: N&G p. 91 ("♭VIImaj7 ... Ionian"), p. 85 and p. 88 (dorian minor's one contribution to modal interchange), M&H p. 129 for the major-key case that M4 already handles.
  B♭ Ionian over a C minor area is C Dorian's own seven notes; B♭ Lydian needs E♮ against the key's E♭.
- Reason string: "♭VII of C minor: B♭ major, the notes of C Dorian".
- Test case: `key: Cm`; rows `A | 1 | Cm7`, `A | 2 | BbMaj7`, `A | 3 | AbMaj7`, `A | 4 | Dm7b5`, `A | 4 | G7alt`. Expected bar 2: B♭ Ionian (was B♭ Lydian); bar 3 stays A♭ Lydian (M4, ♭VI).
- Level: Standard.
- Note: the third M3 branch (V triad in a major key → Mixolydian) is in the code but missing from plan §7.2 and §8; document it.

### C3. Reason strings that call an avoid note "in the key", and one stale menu note

- Change: the reason texts of m7 (vi of major, v of minor), m9, and h2 say a ♭13, ♭2 or ♭9 "is in the key". For a dominant that is a tension and the text is right (§7.1). For a vi (Aeolian ♭13, N&G p. 27, M&H p. 24), a v of minor (Phrygian ♭9 and ♭13, M&H p. 97) and a ø7 (Locrian ♭9, N&G p. 28, M&H p. 25, Levine p. 54) the same note is the scale's avoid note, so a player reading "the ♭13 is in the key" is told the opposite of what all four sources say (principle 6: a reason a player would say, and would not misread).
- Reason strings: vi: "vi: Aeolian, the key's own notes (the ♭6 is a passing note)"; v of minor: "v of a minor key: Phrygian, the key's own notes (its ♭2 is a passing note)"; iiø7 of G minor: "iiø7 of G minor: Locrian, the key's own notes (its ♭2 is a passing note)"; m5: drop "(Aeolian at Basic? see §11)" from the printed text and keep it in the plan.
- Stale note: in `chord_scales.json`, the `m` and `m7` Aeolian options say "when the chord is vi or iv". For iv the engine (m7, m8) and both Berklee texts give Dorian (N&G p. 79, M&H p. 129); change the note to "when the chord is vi, or the symbol has a ♭6".
- Test case: any chart with `key: C`, row `A | 1 | Am7` not before a dominant → reason text as above; `key: Gm`, row `Aø7` before `D7` → as above.
- Level: n/a (text only).

### Not proposed, with the reason

- h2 stays Locrian at Standard with Locrian ♮2 at Advanced: that is both principle 7 and the two Berklee texts; Levine's ♮2 default is the hipper choice. One narrow addition could follow M&H p. 85 (♭vi ø7 of a minor key → Locrian ♮9); it is a rare chord and is listed under Q4.
- m2 stays Dorian/Melodic Minor (Q3).
- M5 and m6 cannot improve without the mode (Area B).

---

## 4. Open questions the sources cannot settle

- **Q1. iii7 (m9, and m4 for a related iii7).** Berklee's default is Phrygian (M&H pp. 23, 57; N&G p. 33), with Aeolian for the related ii (M&H p. 57); Chediak accepts Dorian in contemporary music (vol. 2 p. 48); Levine says only that Phrygian is "usually played, not over minor 7th chords" (p. 48). The plan's own test (§9: "I'd have played Dorian on every one") is practice (unsourced). The plan's principle 5 names the tonic minor and no iii. The lead has two ways to stay inside the principles: (i) iii7 Phrygian at Standard with Dorian at Advanced, which the `Phrygian` ladder does not currently offer (its Advanced is Dorian ♭2); or (ii) keep Dorian and add iii to principle 5's list of conventions, which changes a principle and so is not mine to propose.
- **Q2. Which scale names a modal tonic.** Dorian, Aeolian, Phrygian are each a Berklee tonic (M&H pp. 84, 87, 89); only the tune's melody or a `context:` annotation can tell them apart (Milestones' bridge, "Crystal Silence"). Area B.
- **Q3. i6 / m6.** Whether the tonic minor's sixth chord should be Melodic Minor at Standard (M&H p. 85; Chediak vol. 1 p. 341) rather than Dorian (N&G p. 91 first-named). The engine's reference scale for a minor key already contains the raised 6th and 7th (principle 5's "composite"), which would support melodic minor for i6 and Dorian for iv6/ii6.
- **Q4. ♭vi ø7 of a minor key** (Locrian ♮9, M&H p. 85) and **♯ivø7 moving to iv-** (Locrian ♮9, N&G p. 121): rare; a rule would need the next chord, as h2 already looks at it.
- **Q5. Russell, Coker, Baker, Ligon, Bergonzi, Crook** are not verified here (no primary text on disk; web summaries only). Russell's tonic-Lydian position is the one the brief expected to find in Levine and does not appear there.
- **Q6. Whether `d1`'s new default should be one scale entry or a per-function table.** The sources give the notes by function (N&G pp. 115–116; M&H pp. 149–161), not as a single named scale.
- **Q7. ♭VII major in a minor key** rests on N&G alone (p. 91); M&H's minor-key table (p. 98) omits it.

---

## 5. Bibliography and unverified citations

### Editions used (copies on disk, `design/sources/`)

- Nettles, Barrie & Graf, Richard. *The Chord Scale Theory & Jazz Harmony*. Rottenburg: Advance Music, 1997 (ISBN 3-89221-056-X; order no. 11216). OCR text layer plus page images.
- Mulholland, Joe & Hojnacki, Tom. *The Berklee Book of Jazz Harmony*. Boston: Berklee Press, 2013. OCR text layer plus page images.
- Levine, Mark. *The Jazz Theory Book*. Petaluma: Sher Music, 1995. Text layer (layout mode).
- Chediak, Almir. *Harmonia e Improvisação*, vol. 1 (Rio de Janeiro: Lumiar, 1986) and vol. 2 (Lumiar). OCR text layer plus images; vol. 2 scanned two-up.
- Web (secondary, to locate a claim only): music-theory-practice.com, "Jazz Scale Syllabus", fetched 2026-10-10: summary of an Aebersold-style syllabus (major 7 Ionian with Lydian as colour; minor 7 Dorian; ø7 Locrian ♯2; °7 Whole-Half). Not the Aebersold book; its pages are unverified.

### Citations with an unverified or qualified page

- All Aebersold statements (web secondary, not the book); all Russell statements (no primary text).
- N&G on `Maj7♯5` (M2): no chord scale found in the text layer; page unverified. N&G p. 25 (index to "Chord Scale Theory") and p. 22 (chord-symbol table, ♯5 symbols) are the places to look.
- N&G p. 91, first list line "II-7 Phrygian or Dorian(♭2)": the image does not show whether the numeral carries a ♭; it is a ii of the minor key's melodic/dorian forms or a ♭II-7. I do not rely on it.
- N&G p. 85 for the four minor scales (natural, harmonic, melodic, dorian minor): verified in the text layer, not imaged.
- M&H p. 98 (table), N&G pp. 91, 114–116 were checked on page images; every other M&H and N&G page is from the text layer, with the page confirmed from the printed footer of the chunk.
- Levine pages are from the text layer; the quoted lines were located by marker arithmetic (PDF − 16) and the page was not re-imaged. Levine pp. 225, 272, 273, 299, 406, 408 are in the reharmonization and lead-sheet chapters; p. 158 and p. 211 are in "From Scales to Music" and "Pentatonic Scales".
- Chediak vol. 1: pages cited are the printed footers (see §0); vol. 1 p. 350 (the V7(♭13) "eólio" remark) is on the page footed 350. Vol. 2 p. 99 and p. 105 are from the contents list (not imaged). Vol. 2 pp. 118–123 (the diminished and "Iônico, Diminuta, Dórico, Mixolídio" clichés) are from the OCR labels, not imaged.
- Plan references are to `docs/plan-analysis.md` section numbers; the chart rows quoted are from `charts/*.txt` as read on 2026-10-10.

# RESEARCH BRIEF — Jazz theory vs. the Chord Scale Maker analyser

Date: 2026-10-10. Deliverable (assembled by the lead): docs/research/2026-10-jazz-theory-vs-engine.md

## Role
Act as a senior jazz theorist and working player: Berklee-trained in chord-scale theory, fluent in Levine's
practice, with bandstand judgement about what is actually played. Be exact. Prefer "Nettles & Graf, ch. 4, says X;
Levine p. 60 says Y; the engine does Z" over summary. Never invent a page number: cite to the chapter or section
when the page is not verifiable, and mark it so ("ch. 4, page unverified"). Any claim you cannot source at all is
labelled "practice (unsourced)".

## Materials (read these first; they are the thing under review, not authority)
- /mnt/user-data/uploads/jazz-scales/docs/plan-analysis.md — the analyser's design: principles (§2), passes,
  key areas (§5), functions (§6), the rules (§7, summarised in §8), decisions (§10), stated limits (§14).
- /mnt/user-data/uploads/jazz-scales/web/engine/analysis/{rules,keys,functions,index}.ts — the rules as code.
  Rule ids: D1–D7 (dominant), M1–M5 (major), m1–m9 (minor; m9 is the iii-in-major Dorian case, formerly m7'),
  h1–h2 (half-diminished), d1 (diminished), s1–s3 (sus).
- /mnt/user-data/uploads/jazz-scales/chord_scales.json — quality → scale options and defaults.
- /mnt/user-data/uploads/jazz-scales/docs/research/library-index.txt — the 243-tune library (file | title |
  key | style | form).
- /mnt/user-data/uploads/jazz-scales/charts/*.txt — 24 charts for the edge cases (format: README-style rows,
  one chord per row: chord | scale | reason …; `key:` in the header; `@key` and `# keep:` annotations).

## Source hierarchy (apply in this order; say when they conflict)
1. Berklee chord-scale theory: Nettles & Graf, *The Chord Scale Theory & Jazz Harmony* (Advance Music, 1997);
   Mulholland & Hojnacki, *The Berklee Book of Jazz Harmony* (Berklee Press, 2013).
2. Levine, *The Jazz Theory Book* (Sher, 1995) and *The Jazz Piano Book* (Sher, 1989) where it adds.
3. Pedagogical baseline: Aebersold (Vol. 1 scale syllabus, "Nomenclature" and "Scale Syllabus" pages), Coker
   (*Improvising Jazz*, *Elements of the Jazz Language*), David Baker (*Jazz Improvisation*).
4. Linear sources: Ligon, *Connecting Chords with Linear Harmony*; Bergonzi, *Inside Improvisation* series;
   Hal Crook, *How to Improvise* — for where line-thinking contradicts scale-thinking.
5. Brazilian: Almir Chediak, *Harmonia e Improvisação* (Lumiar); Nelson Faria, *The Brazilian Guitar Book* — for
   bossa/samba harmony (27 `style: Latin` charts in the library).
6. Terefenko, *Jazz Theory: From Basic to Advanced Study* (Routledge, 2nd ed. 2018) — a rigorous functional view,
   especially for key areas, tonicisation and modulation (area D).
7. Historical: Russell, *Lydian Chromatic Concept* — only where it explains why Lydian-on-major exists.
Secondary web summaries are acceptable only to locate a primary claim; label them. Where the primaries disagree
with each other, that is a finding, not a problem to resolve by averaging.

## Verdict codes (one per engine rule or case)
- AGREE — the rule is what the primary source prescribes
- DIFFER — the sources prescribe something else (say what, and who)
- SPLIT — the sources disagree among themselves (say who says what)
- UNDERSPECIFIED — the sources do not address the case; say what practice does

## Scope — four areas

### A. Scale rules (§7; ids D1–D7, M1–M5, m1–m9, h1–h2, d1, s1–s3)
For each rule: the engine's rule and reason; each source's position; verdict; and if DIFFER/SPLIT, which choice
better serves principles 4 (tensions diatonic to the key of the moment), 6 (one reason per decision) and 7
(consistency; the hipper choice goes to the Advanced level).
Adjudicate explicitly:
- Tonic Imaj7: Ionian (engine, M3) vs Lydian (Levine, Russell).
- vi7 Aeolian vs Dorian; iii7 Dorian-by-convention (m9) vs Phrygian.
- Tonic minor Dorian-by-convention (m5) vs Aeolian / melodic / harmonic.
- m6 → Dorian (m2) vs Melodic Minor.
- V7 → minor: Mixolydian ♭6 / Phrygian Dominant / Altered / Half-Whole — the engine derives from harmonic minor;
  what do Berklee and Levine each say the default is, and when?
- The reference-scale derivation itself (§7.1): is "tensions diatonic to the key" Berklee's actual rule, or a
  simplification? Where does Berklee use the chord's own chord-scale rather than the key?
- ø7: Locrian (h2) everywhere vs Locrian ♮2 — Levine's default vs Berklee's.
- °7: Whole-Half always (d1) vs harmonic minor a half step up for passing ♯i°7/♯ii°7; auxiliary (same-root) °7
  vs passing — same scale?
- subV7 → Lydian Dominant (D2): universal?
- Back door ♭VII7 → Lydian Dominant vs Mixolydian; extended dominants (D3) Mixolydian vs derive; the "V7 of the
  chord before" case.
- Sus: s2 "as a dominant with 11 for 3"; s1 Phrygian for sus♭9 — Berklee's 7sus4(♭9) treatment?
- Blues I7/IV7 (D7 static → Mixolydian): what do the sources say about the tonic dominant in a blues —
  Mixolydian, blues scale, both, or "melody"?

### B. Context detection (§5.4) and chart metadata
The engine detects modal (< ⅓ of chords in cadences, median chord ≥ 2 bars) and blues (12-bar, I7 bar 1, IV7
bar 5) by heuristic. Do the sources define "modal tune" and "blues form" in ways a heuristic can implement? Which
library tunes are borderline (Footprints, Milestones' bridge, Maiden Voyage, minor blues, Parker blues, 16-bar
blues, one-chord bossas)? Then PROPOSE the metadata: a chart-level field (name it; candidates: `context:`,
`idiom:`, `analysis:`) with values and defaults; whether a section-level marker (`@modal`) is needed, with
library examples; and a minor-key flavour field (harmonic / Dorian / melodic / composite) if the sources justify
one. `style:` is tempo/feel and stays as is; say explicitly why bossa/samba is not an analysis context, or show
a case where it is (Chediak on tonic-minor and ♭II-area conventions).

### C. Function vocabulary (§6)
The labels: V7, V7/x, extended, subV7, "V7 of the chord before", cadence to a new key, I7/IV7 blues,
non-resolving (♭VII7 back door, ♭VI7, deceptive); related ii / passing ii–V; ø7 and °7 functions; sus. Is this
the Berklee vocabulary? What is missing that the sources consider standard (♭VI7 as subV7/V, ♯IV°7, I°7 as
auxiliary, V7/♭III, modal-interchange labels like ♭VImaj7 and iv7 as "borrowed")? Does the `V7/ii` notation and
the lower-case convention follow the sources? Say what the sheet should print for each.

### D. Key areas and cadences (§5.1–5.3)
The engine opens a key area on a V7 (or ii–V) that resolves to a chord not diatonic to the local key, and closes
it by rule. Compare with how the sources teach tonicisation vs modulation (Berklee's "key of the moment";
Terefenko's treatment). Test against: All the Things You Are (A♭, C, E♭, G, E areas), Stella, Lady Bird, Giant
Steps / Coltrane changes, Joy Spring, Moment's Notice, How High the Moon vs Ornithology (the same changes in two
tunes). Where does the engine's heuristic produce a wrong key of the moment, and would a source-derived rule
(e.g. "a ii–V tonicises; a cadence with a tonic lasting ≥ 2 bars modulates") do better?

## Edge cases to adjudicate explicitly, with a source for each verdict
Autumn Leaves bars 7–8 (Am7♭5 D7 Gm: the D7 scale); Blue Bossa's D♭maj7 area; Girl from Ipanema bridge
(G♭maj7 B7 F♯m7 D7 …); Wave (Dmaj7 B♭°7 Am7 D7 …); Stella's opening Em7♭5 A7 in B♭; Footprints' ending
(F♯m7♭5 F7♯11 / the Real Book turnaround); So What's E♭m7 bridge; Milestones' bridge (Aeolian by melody);
Maiden Voyage's sus chords; Beautiful Love's iiø7–V7–i; a minor blues (Mr. P.C., Blues Minor); Solar's Cm(maj7);
Nica's Dream's Cm(maj7)/B♭m(maj7) tonics; A Night in Tunisia's E♭7–Dm.

## Output (per area, in this exact shape; the lead assembles the final document)
1. A findings table: `rule id or case | engine | Berklee | Levine | others | verdict | note`.
2. Prose only where a row needs it.
3. Proposed changes for the area: rule id(s); the change in one sentence; the reason string the engine would
   print (principle 6: if it cannot be said in a player's words, drop the change); a test case (chart row,
   `key:`, expected scale); which level (Basic/Advanced) it belongs to if principle 7 says the hipper choice stays
   Advanced. No library-impact estimates.
4. Open questions the sources cannot settle.
5. Bibliography with editions, and a list of every citation whose page number is unverified.
Do not propose changing the engine's principles themselves; where a finding conflicts with a principle, say so
and stop. Do not re-derive the rules from first principles: compare them to the sources.

# Harmonic analysis for scale choice: the rule set

Status: **proposal, for review.** Nothing here is built. The rules below are meant to be argued with; the
decisions they need from you are collected in §10.

## 1. What this is

Today the app chooses a scale by chord *type* alone: `Cm7` → C Dorian, whatever surrounds it. When a chart is
written by hand, the writer uses more than the type: where the chord resolves, what key it sits in, whether it is
the ii of a ii–V. That knowledge lives only in the chart files, applied inconsistently (the library's D7♭9 chords
are Phrygian Dominant in one chart and Half-Whole in another).

This document turns that judgement into rules the app can apply the same way every time, as a script that fills
in a chart's scales from its chords (§12). The site itself doesn't change: visitors see the result, as now.

What the analyser reads: the chord symbols, their order and durations, and the form (sections, `@copy`).
What it cannot read: the melody, the voicings, the tempo, or the composer's intent. Those stay the chart
writer's business (§13), and the chart's explicit choices always win over the analyser (§2).

The method is the one taught as chord-scale theory (Nettles and Graf, *The Chord Scale Theory and Jazz
Harmony*; Levine, *The Jazz Theory Book*), reduced to what a program can decide. Where the sources disagree with
each other or with common practice, the rule says so and §10 asks you to pick.

## 2. Principles, in order of precedence

1. **The chart's explicit choice wins.** A scale written in a chart is a decision, whoever made it. The analyser
   fills blank cells and *reports* where it disagrees with filled ones; it never silently overwrites.
2. **The symbol is evidence.** A chord's written tensions and alterations (`7♭9`, `7♯11`, `7alt`, `Maj7♯5`)
   constrain the scale: only scales containing those notes are candidates. The symbol is the composer's or
   arranger's word; function fills in what the symbol leaves open.
3. **Function over type.** Two chords with the same symbol get different scales when they do different jobs:
   `D7` resolving to G minor is not `D7` in a chain of dominants.
4. **Tensions are diatonic to the key of the moment.** Given a chord's function and its local key, each tension
   (9th, 11th, 13th) takes whichever form, natural or altered, belongs to that key. The scale is then the one
   that contains the chord tones and those tensions. Most of the rule set is this one principle applied.
5. **The composite minor.** A minor key is treated as natural minor, except that its primary dominant raises the
   7th (harmonic minor) and its tonic chord is played Dorian by jazz convention (§7.3).
6. **One reason per decision.** Every scale the analyser writes comes with the rule that chose it, in words a
   player would use. If a reason can't be stated, the rule is wrong.
7. **Consistency over flair.** Where two scales are both defensible, the analyser picks the diatonic one and
   leaves the hipper one to the Advanced level (§11). The library should read as one hand wrote it.

## 3. The passes

```text
chart text ─> 1. chord stream ─> 2. keys and key areas ─> 3. functions ─> 4. scales (+ reasons) ─> report / --write
```

Each pass is a pure function over the previous pass's output, so each is testable alone.

## 4. Pass 1: the chord stream

From the chart's expanded rows (after `@copy`), one entry per chord:

- **Root, type and bass**, from the existing parser (`parseChord`, `baseQuality`). Slash readings apply first
  (`D♭Maj7/C` is a sus♭9 on C; `Am7/D` is a 9sus4 on D), so the stream sees the chord the ear hears.
- **Duration** in bars: the distance to the next row's bar number; chords sharing a bar split it evenly; the
  last chord lasts to the end of the form, which is the next section's first bar or, for the final row, one
  bar (a `bars:` meta line can state the form length; see §12).
- **Next chord**: the following entry, and for the final entry, the first. The form repeats, so the turnaround's
  last chord resolves to the top (Autumn Leaves' G7 in bar 32 resolves to the Cm7 of bar 1).
- **Previous chord**, likewise, wrapping.

Two identical consecutive rows (`Gm | Gm`) are one chord lasting two bars.

## 5. Pass 2: keys

### 5.1 Cadences

A **cadence** is a dominant-type chord followed by a chord whose root lies a perfect fifth below (the "down a
fifth" resolution). Its **target** is that chord. The cadence's key is:

| Target type | Key |
|---|---|
| Maj7, 6, 6/9, major triad | the target's **major** key |
| m7, m6, m(Maj7), minor triad | the target's **minor** key |
| dominant 7th | none: this is an **extended dominant** link, not a cadence (§7.1) |
| ø7, °7, sus | none |

A **ii–V** is a cadence whose dominant is preceded by a m7 or ø7 chord a fifth above the dominant's root
(`Dm7 G7`, `Dø7 G7`). It strengthens the cadence. A **tritone cadence** is a dominant followed by a chord a half
step below (`D♭7 C`); it counts as a cadence into the target's key at lower weight.

### 5.2 The global key

Score each of the 24 keys:

| Evidence | Weight |
|---|---|
| A cadence into the key (per occurrence in the form) | 3, plus 2 if it is a ii–V |
| A tritone cadence into the key | 2 |
| The final chord of the form is the key's tonic | 3 |
| The first chord of the form is the key's tonic | 1 |
| A chord diatonic to the key (§5.5), per bar of duration | 1 |

The global key is the highest score; ties go to the key of the final chord, then to minor over its relative
major (jazz charts that end on a minor chord are in that minor). A `key:` meta line in the chart overrides all
of this (§12).

### 5.3 Key areas

Tunes move through keys. Each cadence opens a **key area**:

- It starts at the first chord of the cadence's approach: the ii of a ii–V, or the dominant itself. A chain of
  extended dominants ending in the cadence belongs to it too.
- It ends just before the next cadence's approach begins.
- Chords before the first cadence belong to the global key.

A chord gets its **local key** from its key area. Within an area, a chord is either **diatonic** to the local
key (§5.5), or **chromatic**: a borrowed chord, a substitute, a passing chord, or a chord of a passing ii–V that
never lands (§7.5). Chromatic chords stay in the area; they don't open a new one.

Autumn Leaves (G minor) alternates areas: `Cm7 F7 B♭Maj7 E♭Maj7` is a B♭ major area, `Aø7 D7 Gm` a G minor
area. E♭Maj7 is IV of B♭ and ♭VI of G minor; either way it gets Lydian (§7.2), which is why relative-key
ambiguity rarely matters.

### 5.4 Modal and blues contexts

Two whole-tune contexts change the rules:

- **Modal:** fewer than a third of the chords take part in cadences, and the median chord lasts two bars or
  more. So What, Maiden Voyage, Milestones, Impressions and Footprints qualify. In a modal tune the functional
  rules are off: each chord is its own mode (§7.6).
- **Blues:** the form is 12 bars (or a multiple), with a dominant 7th on one root in bar 1 and the dominant a
  fourth above it in bar 5. The key is the bar-1 root, major. The tonic and subdominant are dominant 7ths by
  nature, not by function (§7.1, rule D7).

### 5.5 Diatonic chords

Major key, on each degree: `IMaj7 ii7 iii7 IVMaj7 V7 vi7 viiø7`, plus triads and sixth chords on I and IV.

Minor key (the composite, principle 5): `i7 i6 i(Maj7) iiø7 ♭IIIMaj7 iv7 v7 V7 ♭VIMaj7 ♭VII7 vii°7`.

Everything else is chromatic.

## 6. Pass 3: functions

Each chord gets a function label relative to its local key, which the report prints (`V7/ii in F`). The labels
are inputs to pass 4, not scales themselves.

**Dominant 7ths** (including 9, 13, and altered forms), by what follows:

| Label | Condition |
|---|---|
| **V7** (primary) | resolves down a fifth to the local tonic |
| **V7/x** (secondary) | resolves down a fifth to a diatonic chord other than the tonic |
| **extended** | resolves down a fifth to another dominant 7th (`D7 G7 C7 F7`) |
| **subV7** (substitute) | resolves down a half step to any chord |
| **V7 of the chord before** | doesn't resolve forward, but the previous chord is a fifth above its root (`Gm D7/F♯ Fm7`: the bass-line dominant after its own tonic) |
| **cadence to a new key** | resolves down a fifth to a chord that is not diatonic to the local key: it opens a key area (§5.3) and is that area's V7 |
| **I7, IV7** (blues) | the tonic and subdominant of a blues form |
| **non-resolving** | anything else: ♭VII7 (the back door), ♭VI7, a deceptive V7 → vi, a dominant that just sits |

**Minor 7ths:** `i` (tonic minor), `ii`, `iii`, `iv`, `v`, `vi`; **related ii** when a dominant a fourth above
follows (the ii of any ii–V, functional or passing); **chromatic** otherwise.

**Major 7ths, 6ths, triads:** `I` (local tonic), `IV`, `♭III`, `♭VI`, `♭VII`, `♭II`; **chromatic** otherwise.

**Half-diminished:** `iiø7` (of a minor area), `viiø7`, `♯ivø7`, **related iiø7** (before a dominant a fourth
above); **chromatic** otherwise.

**Diminished 7ths:** **passing** (between chords a whole step apart, ascending or descending), **auxiliary**
(same root as the chord on either side: `C C°7 C`), **vii°7** (resolving up a half step to the tonic); all take
the same scale (§7.4), so the label is for the report.

**Sus chords:** `V7sus4` (resolves down a fifth), **static** otherwise.

## 7. Pass 4: the scale

### 7.1 Dominant 7ths

The reference scale for deriving tensions:

| Case | Reference |
|---|---|
| Any dominant in a **major** area | the local key's Ionian |
| The **primary V7** of a **minor** area | the local key's harmonic minor (the raised 7th makes the V7 major) |
| Any other dominant in a **minor** area | the local key's natural minor |
| A dominant opening a **new key area** | the new key, as above |

Derivation: for each tension slot, take the form that is in the reference: 9 or ♭9; 11 or ♯11 (a natural 11 is
an avoid note on a dominant, but it still determines whether the scale is Mixolydian-type or Lydian-type); 13 or
♭13. If neither form is in the reference, take the natural one. The symbol's own tensions override the
derivation for their slot (principle 2), and a written ♯5 or `alt` removes the natural 5th.

Then the scale:

| Tensions | Scale | Also called |
|---|---|---|
| 9 11 13 | Mixolydian | |
| 9 ♯11 13 | Lydian Dominant | Lydian ♭7 |
| 9 11 ♭13 | Mixolydian ♭6 | Mixolydian ♭13 |
| ♭9 11 ♭13 | Phrygian Dominant | Mixolydian ♭9 ♭13, harmonic minor mode 5 |
| ♭9 ♯11 13 (adds ♯9) | Half-Whole | diminished, dominant diminished |
| ♭9 11 13 | Half-Whole | rare; no scale of ours fits exactly, Half-Whole keeps the natural 13 |
| 9 ♯11 ♭13, no 5 | Whole Tone | for `7♯5`, `7+` |
| ♭9 ♯9 ♯11 ♭13, no 5 | Altered | for `7alt`, `7♯9`, `7♯5♯9` |
| ♭9 ♯9 with 3 and 11 | Spanish Phrygian | only when the symbol or the chart asks |

The rules, in priority order. The first that applies decides.

| | Rule | Scale | Reason text |
|---|---|---|---|
| D1 | The symbol pins enough tensions to leave one scale (`7alt`, `7♯5`, `7♯11`, `7sus4♭9`…) | per the table above | "from the symbol" |
| D2 | **subV7:** resolves down a half step | Lydian Dominant | "tritone substitute of … (resolves down a half step)" |
| D3 | **extended:** resolves down a fifth to another dominant | Mixolydian | "extended dominant: V7 of the next dominant" |
| D4 | **V7, V7/x, V7 of the chord before, cadence to a new key:** resolves down a fifth to a non-dominant chord | derive from the reference | "V7 of G minor: ♭9 and ♭13 are in the key" / "V7/ii in C: the 9 is in the key, the 13 isn't" |
| D5 | **I7 / IV7 in a blues**, or a **non-resolving** dominant whose root is diatonic (♭VII7, deceptive V7) | derive from the local key | "IV7 in a blues: the ♯11 is the key's major 7th" / "back-door ♭VII7" |
| D6 | **Non-resolving with a chromatic root** (♭VI7 that doesn't resolve, ♭II7 sitting) | Lydian Dominant | "a chromatic dominant with nowhere to go: Lydian Dominant, its own key" |
| D7 | **Modal or static** (a modal tune, or any dominant lasting four bars or more) | Mixolydian, or Lydian Dominant if the symbol says ♯11 | "static dominant: its own mode" |

What D4 yields in a major key, for the record (the derivation, not a lookup):

| Function | 9 | 11 | 13 | Scale |
|---|---|---|---|---|
| V7 → I | 9 | 11 | 13 | Mixolydian |
| V7/IV, V7/V | 9 | 11 | 13 | Mixolydian |
| V7/ii | 9 | 11 | ♭13 | Mixolydian ♭6 |
| V7/iii, V7/vi | ♭9 | 11 | ♭13 | Phrygian Dominant |

And in a minor key: V7 → i (harmonic minor reference) gives Phrygian Dominant; V7/iv gives Mixolydian ♭6; V7/♭III
and V7/♭VI give Mixolydian; V7/v gives Phrygian Dominant.

Notes:

- D3 before D4: in the Rhythm Changes bridge, `D7 G7 C7 F7` are all Mixolydian, though D7 is also V7/vi of B♭. The
  chain is heard as a sequence of dominants, and natural tensions keep it bright. Levine and Berklee agree here;
  some players alter each one on the way down, which is what the Advanced level is for.
- D4 uses the **current** area's key for secondary dominants, not the target's key. That is what makes V7/ii
  Mixolydian ♭6 (natural 9) rather than Phrygian Dominant. The symbol often settles it anyway: `A7♭9 → Dm7` pins
  the ♭9, and the ♭13 is diatonic, so Phrygian Dominant.
- A V7 whose symbol pins a natural 13 (`13`, `13♭9`) but whose derivation wants ♭13 keeps the 13: the symbol wins.
  `D13♭9 → Gm` is Half-Whole.

### 7.2 Major 7ths, 6ths and triads

Only the 11th varies. Natural 9 and 13 are assumed (a ♭9 or ♭13 on a major chord is not a tension, it's a
different chord).

| | Rule | Scale | Reason text |
|---|---|---|---|
| M1 | The symbol says `♯11` | Lydian | "from the symbol" |
| M2 | The symbol says `♯5` | Lydian Augmented | "from the symbol" |
| M3 | The natural 11 is in the local key's reference (this is the **tonic I**, and ♭III in a minor area, where ♭IIIMaj7 shares the key's notes) | Ionian | "tonic: the 4th is in the key" / "♭III of G minor is B♭ major itself" |
| M4 | Otherwise (IV, ♭II, ♭III in major, ♭VI, ♭VII, any chromatic major chord) | Lydian | "IV: the natural 4th would be the key's ♭7" / "a borrowed major chord: Lydian, as all non-tonic major chords" |
| M5 | Modal tune | Lydian, unless the symbol has a natural 11 (`Maj7sus`, rare) | "modal major: Lydian" |

### 7.3 Minor 7ths, 6ths, minor-major 7ths and triads

| | Rule | Scale | Reason text |
|---|---|---|---|
| m1 | The symbol is `m(Maj7)` | Melodic Minor | "from the symbol" |
| m2 | The symbol is `m6` | Dorian (the current default; Melodic Minor at Advanced) | "a sixth chord: Dorian" |
| m3 | The symbol says `♭6` or `♭13` | Aeolian | "from the symbol" |
| m4 | **Related ii** of any ii–V (a dominant a fourth above follows) | Dorian | "ii of the ii–V to …" |
| m5 | **Tonic minor** (i of a minor area) | Dorian | "tonic minor: Dorian by convention (Aeolian at Basic? see §11)" |
| m6 | Modal tune | Dorian | "modal minor: Dorian" |
| m7 | Diatonic, by derivation from the local key: ii → Dorian; iii → Phrygian (♭9, ♭13 in the key); vi → Aeolian (♭13 in the key); iv of minor → Dorian; v of minor → Phrygian | as derived | "iii: the 9 and 13 would be out of the key" |
| m8 | Borrowed or chromatic (iv7 in major, ♭vi7…) | Dorian | "a borrowed minor chord: Dorian, its own key" |

m4 outranks m7 on purpose: `Em7 A7 Dm7` in C makes Em7 a ii, so Dorian, not Phrygian. m5 is a convention, not a
derivation: natural minor would say Aeolian. It matches the library and most players; Aeolian is one click away
in the menu.

### 7.4 Half-diminished and diminished

| | Rule | Scale | Reason text |
|---|---|---|---|
| h1 | ø7 in a **modal** tune | Locrian ♮2 | "modal: the melodic-minor colour, with a 9 to lean on" |
| h2 | Any other ø7 (iiø7 of minor, viiø7, ♯ivø7, related iiø7, chromatic) | Locrian | "iiø7 of G minor: the ♭9 is in the key" |
| d1 | Any °7 | Whole-Half | "passing diminished: the rootless V7♭9 of the next chord" / "vii°7" |

Locrian ♮2 is never diatonic to the key the ø7 serves (D Locrian ♮2 needs E♮ against C minor), so it stays a
colour choice: the Advanced level, and the modal rule. The °7 scale is fixed because every function of a
diminished 7th is the same rootless dominant ♭9 a major third below; Whole-Half on the °7 root is Half-Whole on
that dominant. The harmonic minor a half step up (`D harmonic minor` over `C♯°7 → Dm7`) stays the alternate in
the menu.

### 7.5 Passing ii–Vs

A ii–V whose implied target neither follows nor is diatonic to the local key (`Bm7 E7` in G minor, going to
`B♭m7 E♭7`) is a **passing ii–V**: a side-slip, its own key for two beats. Its ii is Dorian (m4) and its dominant
Mixolydian ("passing ii–V: its own key, natural tensions"). This is D4 with the pair's own key as reference; it is
listed separately because the report should name it.

A ii–V whose implied target **is** diatonic but doesn't follow (`Am7 D7 | A♭m7 D♭7 | Gm7` in F: D7 implies Gm7,
which arrives two chords later) is a secondary ii–V to that target: D4 applies with the local key (D7 = V7/ii in
F → Mixolydian ♭6), and the next pair, a half step down, is its tritone substitute (D♭7 → Gm7 = subV7, D2).

### 7.6 Sus chords

| | Rule | Scale |
|---|---|---|
| s1 | `7sus4♭9` | Phrygian |
| s2 | V7sus4 resolving down a fifth | as a dominant (§7.1), with the 11 in place of the 3rd: Mixolydian, or Mixolydian ♭6 if the ♭13 is in the key |
| s3 | Static or modal (Maiden Voyage) | Mixolydian |

### 7.7 Fallback

A chord no rule reaches (an unparseable symbol, an unknown quality) keeps its quality default if it has one and
is otherwise left blank, and the report flags it. The analyser never invents a chord.

## 8. The rules on one page

Priority runs top to bottom within each family; the families are independent.

```text
Dominant   D1 symbol pins it  ▸ D2 subV7: Lydian Dominant  ▸ D3 extended: Mixolydian  ▸ D4 resolves: derive
           ▸ D5 blues / diatonic non-resolving: derive  ▸ D6 chromatic non-resolving: Lydian Dominant  ▸ D7 static: Mixolydian
Major      M1 ♯11: Lydian  ▸ M2 ♯5: Lydian Augmented  ▸ M3 tonic (or ♭III of minor): Ionian  ▸ M4 else: Lydian  ▸ M5 modal: Lydian
Minor      m1 m(Maj7): Melodic Minor  ▸ m2 m6: Dorian  ▸ m3 ♭6: Aeolian  ▸ m4 related ii: Dorian  ▸ m5 tonic: Dorian
           ▸ m6 modal: Dorian  ▸ m7 diatonic: derive (ii Dorian, iii Phrygian, vi Aeolian)  ▸ m8 chromatic: Dorian
Half-dim   h1 modal: Locrian ♮2  ▸ h2 else: Locrian
Dim        d1 Whole-Half
Sus        s1 ♭9: Phrygian  ▸ s2 resolving: as a dominant  ▸ s3 static: Mixolydian
```

## 9. Worked examples

The rules run over the library as it is. ✓ means the analyser agrees with the chart; ✗ is a disagreement, listed
again in §10.

### Autumn Leaves (G minor; areas in B♭ major and G minor)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1 | Cm7 | related ii (of F7) | m4 | C Dorian | ✓ |
| 2 | F7 | V7 of the B♭ area | D4 | F Mixolydian | ✓ |
| 3 | Bm7 E7 | passing ii–V | §7.5 | B Dorian, E Mixolydian | ✓ |
| 4 | B♭m7 E♭7 | passing ii–V | §7.5 | B♭ Dorian, E♭ Mixolydian | ✓ |
| 5 | Aø7 | iiø7 of G minor | h2 | A Locrian | ✓ |
| 6 | D7 | V7 of G minor | D4 (harmonic minor: ♭9 ♭13) | **D Phrygian Dominant** | ✗ D Half-Whole |
| 7–8 | Gm | tonic minor | m5 | G Dorian | ✓ |
| 24 | E♭Maj7 | IV of B♭ (♭VI of Gm) | M4 | E♭ Lydian | ✓ |
| 27 | D7/F♯ | V7 of the chord before (Gm) | D4 | **D Phrygian Dominant** | ✗ D Half-Whole |
| 28 | Fm7 B♭7 | secondary ii–V to ♭VI (E♭Maj7 implied) | m4, D4 | F Dorian, B♭ Mixolydian | ✓ |
| 32 | G7 | V7/iv in G minor (→ Cm7 at the top) | D4 (natural minor: ♭13) | **G Mixolydian ♭6** | ✗ G Half-Whole |

Twenty-two of twenty-nine rows agree; the seven that don't are three decisions (every D7, the D7/F♯, the G7).

### F Bird Blues (F major, blues form with secondary ii–Vs)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1 | FMaj7 | I | M3 | F Ionian | ✓ |
| 2 | Eø7 A7♭9 | related iiø7, V7/vi; ♭9 pinned, ♭13 in F | h2, D1+D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 3 | Dm7 G7 | related ii, V7/V (→ Cm7, the next ii) | m4, D4 | D Dorian, G Mixolydian | ✓ ✓ |
| 4 | Cm7 F7 | related ii, extended (→ B♭7) | m4, D3 | C Dorian, F Mixolydian | ✓ ✓ |
| 5 | B♭7 | IV7 of the blues | D5 (♯11 = E, the key's 7th) | **B♭ Lydian Dominant** | ✗ B♭ Mixolydian |
| 6 | B♭m7 E♭7 | iv7, ♭VII7 (back door, doesn't resolve) | m4, D5 | B♭ Dorian, **E♭ Lydian Dominant** | ✓ ✗ E♭ Mixolydian |
| 7 | Am7 D7 | related ii, V7/ii (Gm7 implied) | m4, D4 | A Dorian, **D Mixolydian ♭6** | ✓ ✗ D Mixolydian |
| 8 | A♭m7 D♭7 | passing ii, subV7 → Gm7 | m4, D2 | A♭ Dorian, **D♭ Lydian Dominant** | ✓ ✗ D♭ Mixolydian |
| 9–10 | Gm7 C7 | ii–V → I | m4, D4 | G Dorian, C Mixolydian | ✓ ✓ |
| 11 | FMaj7 D7♭9 | I; V7/ii, ♭9 pinned | M3, D1+D4 | F Ionian, **D Phrygian Dominant** | ✓ ✗ D Half-Whole |
| 12 | Gm7 C7 | ii–V → I | m4, D4 | G Dorian, C Mixolydian | ✓ ✓ |

The chart's A7♭9 and D7♭9 are the same function and currently get different scales; the analyser gives both
Phrygian Dominant. Bars 5–8 are the one real argument (§10, decision 4).

### Rhythm Changes (B♭ major)

Every row agrees: G7♭9 → Phrygian Dominant (V7/ii with ♭9 pinned), Cm7 F7 → Dorian, Mixolydian, B♭7 → Mixolydian
(extended, into E♭7), E♭7 → Lydian Dominant (IV7, D5), E°7 → Whole-Half, the bridge → Mixolydian throughout
(D3). The chart was written to these rules before they were written down, which is a good sign for both.

### Blue Bossa (C minor, with a D♭ major area)

All fourteen rows agree: tonic Cm7 Dorian (m5), Fm7 Dorian (iv, m7), B♭7 Mixolydian (♭VII7, D5 with natural
minor), Dø7 Locrian (h2), G7♯5♯9 Altered (D1), Cm(Maj7) Melodic Minor (m1), E♭m7 A♭7 D♭Maj7 as a ii–V–I in D♭
(m4, D4, M3: D♭ Ionian as the local tonic), G7♯5 Altered (D1: ♯5 removes the 5th; ♭9 is in the key).

### F Jazz Blues (F major, blues form)

| Bar | Chord | Analyser | Chart |
|---|---|---|---|
| 1, 3, 7, 11 | F7 | F Mixolydian (I7, D5) | ✓ |
| 2, 5 | B♭7 | **B♭ Lydian Dominant** (IV7, D5) | ✗ B♭ Mixolydian |
| 4 | Cm7 F7 | C Dorian, F Mixolydian (related ii; extended into B♭7) | ✓ |
| 6 | B°7 | B Whole-Half (d1) | ✓ |
| 8, 11 | Am7 D7♭9 | A Dorian, **D Phrygian Dominant** (V7/ii, ♭9 pinned, ♭13 in F) | ✓ ✗ D Half-Whole |
| 9–10, 12 | Gm7 C7 | G Dorian, C Mixolydian | ✓ |

### Footprints (C minor, modal)

Four of eight chords are the tonic for four bars; no cadence. Modal. Cm7 → Dorian (m6), Fm7 → Dorian, F♯ø7 →
Locrian ♮2 (h1), F13♯11 → Lydian Dominant (D1), E7alt and A7alt → Altered (D1). All agree.

### Maiden Voyage, So What, Milestones (modal)

Maiden Voyage's slash chords read as sus chords (pass 1) and get Mixolydian (s3); C♯m7 gets Dorian (m6). So
What: Dorian. Milestones: Gm7 → Dorian ✓; **Am7 → Dorian, where the chart says Aeolian.** The chart is right (the
tune's bridge is A Aeolian, which only the melody tells you), and its explicit choice stands. This is the clearest
example of what the analyser can't know (§13).

### Score

Over the library's fourteen functional charts (every chart but the two modes charts, which are teaching lists),
the rules reproduce the written scales on 156 of 190 rows, 82%. If decision 4 goes to Mixolydian for the blues
subdominant, it is 170 of 190, 89%. Every disagreement is one of the decisions in §10; none is a case where the
chart is plainly right and the rule plainly wrong, except Milestones' Aeolian, which the explicit-choice
principle handles. The B♭ blues charts mirror the F ones row for row.

## 10. Decisions for you

Each of these is a place where the sources, common practice and our own charts don't all agree. The analyser
needs one answer per line. My recommendation is first.

1. **V7 resolving to a minor chord: Phrygian Dominant or Half-Whole?** (Autumn Leaves' D7s; every D7♭9 → Gm7 in
   the blues charts.) *Phrygian Dominant.* It is the diatonic answer (♭9 and ♭13 are in the minor key), it is what
   the Bird Blues chart already does for A7♭9, and Half-Whole's natural 13 is a Dorian colour that belongs at the
   Advanced level. Half-Whole stays the answer when the symbol says `13♭9`.
2. **V7/ii in a major key, no ♭9 written (`D7 → Gm7` in F): Mixolydian ♭6, Phrygian Dominant, or plain
   Mixolydian?** *Mixolydian ♭6*, by derivation (the 9 is the key's 7th; the 13 is not in the key). Berklee's
   table says the same. Many players simply alter it; that's Advanced.
3. **A V7 after its own tonic, in a bass line (`Gm D7/F♯ Fm7`): treat as V7 of the chord before?** *Yes.* It is
   heard as the dominant of the Gm it leaves. The alternative, "non-resolving, derive from the key", gives the
   same scale here (G minor, natural minor: ♭9 ♭13) but a different reason.
4. **IV7 in a blues: Lydian Dominant or Mixolydian?** *Lydian Dominant.* The ♯11 (E over B♭7 in F) is the key's
   major 7th, the textbook "IV7 → Lydian ♭7", and it is what the Rhythm Changes chart already does for E♭7. The
   case for Mixolydian: it is what most people play on a blues, and the Basic level (major pentatonic) sidesteps
   the question. If you'd rather hear plain Mixolydian on blues subdominants, rule D5 gets an exception for the
   blues context only, and the back-door ♭VII7 stays Lydian Dominant.
5. **The Bird Blues chain (bars 6–8): analyse each pair, or treat the chain as passing ii–Vs (all Mixolydian)?**
   *Analyse each.* E♭7 is a back door, D7 is V7/ii, D♭7 is a tritone sub, and each has a reason. The counter-case:
   at bebop tempo nobody hears the difference, and the current chart's uniform Mixolydian reads cleaner on the
   page. If you choose "passing", the rule is: a chain of three or more ii–Vs descending by half steps is passing
   throughout.
6. **Extended dominants (the Rhythm bridge): Mixolydian for all, or derive each from the key?** *Mixolydian for
   all* (D3). Deriving would make D7 Phrygian Dominant (V7/vi of B♭), G7 Mixolydian ♭6, C7 Mixolydian, F7
   Mixolydian: accurate to the key, but the bridge is heard as a dominant sequence, and the chart agrees with D3.
7. **The tonic minor: Dorian (jazz convention) or Aeolian (the diatonic answer)?** *Dorian.* It matches every
   minor-key chart we have and the quality default. Aeolian is the natural-minor truth and should be the Basic
   level's choice for a tonic minor in the ladder (§11), since beginners are taught the natural minor first.

Two smaller ones:

8. **iii7 → Phrygian.** It is the diatonic answer and the modes chart agrees, but many players use Dorian on iii
   and ignore the ♭9. *Keep Phrygian;* the Advanced ladder offers Dorian ♭2 and the menu has Dorian.
9. **ø7 in a modal tune → Locrian ♮2** (h1). It reproduces Footprints and is the melodic-minor sound modal players
   favour, but it's a taste rule, not a derivation. *Keep,* flagged as such in the reason text.

## 11. How this meets the levels

The Scale level control (Basic / Standard / Advanced / Random) keys its choices by chord *quality*: a `7` chord's
Advanced is Bebop Dominant. Once the analyser sets `D7 → D Phrygian Dominant` as a row's Standard, "Advanced for
a 7 chord" would move it to Bebop Dominant and lose the minor-key colour.

The fix is to key the ladder by the **Standard scale** instead of the quality. Today's quality table is the
special case where Standard is the quality default, so nothing already built changes its answer.

Proposed ladders (roots relative to the chord root; a blank keeps the Standard scale, as now for m(Maj7)):

| Standard | Basic | Advanced |
|---|---|---|
| Ionian | Major Pentatonic | Lydian |
| Lydian | Major Pentatonic | |
| Lydian Augmented | | |
| Mixolydian | Major Pentatonic | Bebop Dominant |
| Lydian Dominant | Major Pentatonic | |
| Mixolydian ♭6 | 4 Minor Pentatonic (the target minor's pentatonic) | Altered |
| Phrygian Dominant | 4 Minor Pentatonic | Spanish Phrygian |
| Half-Whole | Major Pentatonic | Altered |
| Altered | ♭5 Major Pentatonic | Half-Whole |
| Whole Tone | | Altered |
| Dorian | Minor Pentatonic | Bebop Dorian |
| Dorian (tonic minor) | Aeolian, then Minor Pentatonic? see decision 7 | Melodic Minor |
| Aeolian | Minor Pentatonic | |
| Phrygian | Minor Pentatonic | Dorian ♭2 |
| Melodic Minor | Minor Pentatonic | Harmonic Minor |
| Locrian | ♭6 Major Pentatonic | Locrian ♮2 |
| Locrian ♮2 | ♭6 Major Pentatonic | |
| Whole-Half | | ♭2 Harmonic Minor |
| Explicit colours (Blues, pentatonics, bebop scales) | the root's pentatonic | |

"4 Minor Pentatonic" over a dominant is the classic beginner's move: G minor pentatonic over the whole
`Aø7 D7 Gm`, which lands ♭13, ♯9 and 11 on the D7 without naming them.

Random keeps picking among the quality's inside options; the ladder doesn't change it.

This is a follow-up change to `chord_scales.json` (a `ladders` table replacing the `level` tags) and
`engine/levels.ts` (look up by the row's Standard scale). It can ship with the analyser or before it.

## 12. The tool

A script, not a page: `npm run analyse -- charts/<tune>.txt`. The site is untouched.

- **Report** (default): the key and key areas found, then one line per row: bar, chord, function, the scale the
  rules give, the reason, and the chart's current scale where it differs (`≠ D Half-Whole`). Rows the rules
  couldn't reach are marked `?`.
- `--write`: fills **blank** scale cells only, leaving every written scale as it is. The usual way to add a chart:
  write the chords, run `--write`, read the report, fix the chart or the rules.
- `--force`: rewrites every cell the rules reach, so a chart can be brought back into line with the rules after
  they change. The report shows what moved. Explicit choices you want to protect get a `# keep` comment on the
  line above (the analyser leaves the next row alone).
- `--all`: runs the report over every chart in `charts/`, for the regression check in §13.
- **Hints in the chart:** an optional `key: Gm` meta line fixes the global key when the scoring would get it wrong
  (a tune that ends away from home); `bars: 32` fixes the form length when the last chord's duration matters.
  Both are plain meta lines the editor already tolerates, and the site ignores them.

The analyser writes only scale names into charts, never reasons; reasons live in the report (and in the test
fixtures), so charts stay clean to edit by hand.

The code: `engine/analysis/` with one module per pass (`stream.ts`, `keys.ts`, `functions.ts`, `scales.ts`) and a
`rules.ts` holding the tables above as data, so a rule change is a table edit with a test. Pure TypeScript, no
DOM, like the rest of the engine; `scripts/analyse.ts` is the only thing that touches files.

## 13. Testing, and how the rules grow

- **Rule tests:** each rule gets a short chart snippet and its expected function label and scale, named for
  the rule (`D4 V7/ii in major is Mixolydian b6`). A rule without a test doesn't exist.
- **Key-finding tests:** each library chart's key and key areas, plus the hard cases: relative keys (Autumn
  Leaves), a tune that modulates by cadence (Giant Steps, when we add it: every V7 opens a new area, which the
  design already handles), a tune ending away from home (`key:` hint).
- **Regression fixture:** `fixtures/analysis.json`, the full report over `charts/`, frozen like `golden.json`. A
  rule change shows exactly which rows move, in the diff, for review before it lands.
- **Disagreements are the backlog.** When I read a lead sheet and would choose differently from the analyser,
  one of three things is true: the rules are missing something (add a rule and its test), I was inconsistent (the
  rules win), or it's something only the melody tells you (write the scale in the chart, and note why in a
  comment). Each case leaves the system better than it found it.
- **Adding a rule:** write the test first, from a real tune; add the row to the tables in `rules.ts` and in this
  document; run `--all` and read the fixture diff; decide any chart that moved.

## 14. Limits, stated

- **No melody.** The bridge of Milestones is Aeolian because the tune says so. Lydian on a tonic because the
  melody sits on the ♯4. A blues scale because the head is a blues head. None of this is derivable from chords.
- **No voicings or bass movement** beyond slash chords. `C C°7 Dm7` and `C C♯°7 Dm7` are told apart by root only.
- **Pedal points and polychords** (`G7/C`, `D/C`) are read as the chord over a bass note, by the existing slash
  rules; a pedal section is not detected as such.
- **Metre** is ignored: a bar is a bar, in 4/4 or 6/4. Durations are relative.
- **Chords the parser rejects** stay blank and are flagged.
- **Coltrane changes** work by the cadence rule (each V7 opens a key area), but a tune that modulates without
  dominants (by common tone, or by fiat) will be read in one key, and its chromatic chords get the Lydian
  Dominant / Lydian / Dorian fallbacks: reasonable, not insightful. The `key:` hint is the escape.
- **The analyser never changes a chord symbol.** Symbols are the composer's.

## 15. Glossary

- **Tensions:** the notes a scale adds above the chord tones: 9, 11, 13, in natural or altered forms.
- **Avoid note:** a tension a half step above a chord tone (the natural 11 on a dominant or major chord); it
  still belongs to the scale and still decides which scale it is.
- **Reference scale:** the key's scale that tensions are checked against: Ionian for a major key, natural or
  harmonic minor for a minor one (principle 5).
- **Key area:** the stretch of a tune governed by one key, opened by a cadence.
- **Related ii:** the minor chord a fifth above a dominant that precedes it, making a ii–V.
- **Passing ii–V:** a ii–V that neither resolves nor belongs to the key: a side-slip.
- **Extended dominant:** a dominant resolving down a fifth to another dominant.
- **subV7, tritone substitute:** a dominant resolving down a half step; it shares its tritone with the V7 it
  replaces.
- **Back door:** `iv7 ♭VII7 → I` in major (`Fm7 B♭7 → CMaj7`).
- **Mixolydian ♭9 ♭13, Mixolydian ♭13, Lydian ♭7:** Berklee's names for our Phrygian Dominant, Mixolydian ♭6 and
  Lydian Dominant.

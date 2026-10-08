# Harmonic analysis for scale choice: the rule set

Status: **built** (`web/engine/analysis/`, `npm run analyse`; docs/design.md §7a) and run over the library. The
decisions in §10 were all taken as recommended (2026-10-08). The analysis each run produces is saved into the chart
as comments (§12.1), so it can be corrected in a text editor. Building it against the library refined a handful
of rules; §16 lists each one with the tune that forced it, and the tables below are updated to match.

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

A cadence **into the global key's tonic** always returns home (§16), and so does a section that starts on the
home tonic chord. In a **minor** key, a full ii–V–I into a
major chord (not a tritone cadence) **tonicizes** it and opens that key's area (§16). A minor chord that is
itself the ii of the next ii–V (`Dm7 G7 | Cm7 F7 | B♭7`) opens no area. A turnaround that resolves into the top of
the form carries its key into the opening bars (Giant Steps' `F♯7 | BMaj7`).

A cadence whose target is **diatonic to the global key** returns to the global key, and the target keeps its
function there: All the Things You Are's `C7♯5 → Fm7` after the E major bridge is V7/vi in A♭, not the start of
an F minor area, so Fm7 is vi (Aeolian) in bar 25 exactly as in bar 1. Only a target diatonic to neither the
local nor the global key opens a new area (`Dm7 G7 → CMaj7` in the same tune).

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
♭13. If neither form is in the reference, take the natural one; if both are (a chromatic root: A♭7 in B♭ has A and
B♭), take the natural one too. The symbol's own tensions override the
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
| D1 | The symbol pins enough tensions to leave one scale (`7alt`, `7♯5`, `7♯11`, `7sus4♭9`…); a ♯11 written alone pins the natural 9 and 13 with it | per the table above | "from the symbol" |
| D2 | **subV7:** resolves down a half step, to anything but a ø7 or °7 (`Fm7 B♭7 \| Aø7` is the ii–V of E♭) | Lydian Dominant | "tritone substitute of … (resolves down a half step)" |
| D3 | **extended:** resolves down a fifth to another dominant, in a chain that ends on a **major** tonic | Mixolydian | "extended dominant: V7 of the next dominant" |
| D3′ | **extended**, in a chain that ends on a **minor** tonic (`D7♭9 G7♯5 → Cm7` in Stella), the last link included | derive each link from that minor key (harmonic minor for the last) | "V7 of the V7 of C minor: ♭9 and ♭13 are in the key" |
| D4 | **V7, V7/x, V7 of the chord before, cadence to a new key:** resolves down a fifth to a non-dominant chord | derive from the reference | "V7 of G minor: ♭9 and ♭13 are in the key" / "V7/ii in C: the 9 is in the key, the 13 isn't" |
| D5 | The **back door** (♭VII7 up a whole step to a major chord), **I7 / IV7 in a blues**, or a **non-resolving** dominant whose root is diatonic (deceptive V7) | derive from the local key | "IV7 in a blues: the ♯11 is the key's major 7th" / "back door ♭VII7 to …" |
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
- A `7♯5` or `+` symbol pins the ♯5 and removes the 5th, and the key decides the 9th: Whole Tone where the 9 is
  diatonic (Lady Bird's `G7♯5 → CMaj7`), Altered where the ♭9 is (Stella's `G7♯5 → Cm7`, Blue Bossa's). The
  symbol alone doesn't say "whole tone"; arrangers write `+` for both sounds.

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
| m7 | Diatonic, by derivation from the local key: ii → Dorian; vi → Aeolian (the ♭13 is in the key); iv of minor → Dorian; v of minor → Phrygian | as derived | "vi: the ♭13 is in the key" |
| m7′ | **iii** | Dorian | "iii: its diatonic scale (Phrygian) puts a ♭9 a half step over the root; Dorian is what gets played" |
| m8 | Borrowed or chromatic (iv7 in major, ♭vi7…) | Dorian | "a borrowed minor chord: Dorian, its own key" |

m4 outranks m7 on purpose: `Am7 D7 G7` in C makes Am7 a ii, so Dorian, not Aeolian. m5 and m7′ are conventions,
not derivations: natural minor would say Aeolian for the tonic, and the key says Phrygian for iii. Both match
what players do and what the library has (Stella's Dm7, All the Things' Cm7, each reached as a tonic of the
moment); Aeolian and Phrygian are one click away in the menu.

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

A ii–V's implied target counts as diatonic when its triad is in the key (`Cm7 F7` in E♭ implies B♭: B♭ D F), so
F7 there is V7/V, not a passing ii–V.

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
Dominant   D1 symbol pins it  ▸ D2 subV7: Lydian Dominant  ▸ D3 extended: Mixolydian (to minor: derive)  ▸ D4 resolves: derive
           ▸ D5 blues / diatonic non-resolving: derive  ▸ D6 chromatic non-resolving: Lydian Dominant  ▸ D7 static: Mixolydian
Major      M1 ♯11: Lydian  ▸ M2 ♯5: Lydian Augmented  ▸ M3 tonic (or ♭III of minor): Ionian  ▸ M4 else: Lydian  ▸ M5 modal: Lydian
Minor      m1 m(Maj7): Melodic Minor  ▸ m2 m6: Dorian  ▸ m3 ♭6: Aeolian  ▸ m4 related ii: Dorian  ▸ m5 tonic: Dorian
           ▸ m6 modal: Dorian  ▸ m7 diatonic: derive (ii Dorian, vi Aeolian), iii Dorian  ▸ m8 chromatic: Dorian
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

### Stella by Starlight (B♭ major)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1–2 | Eø7 A7♭9 | ii–V of iii; Dm never arrives | h2, D1+D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 3–4 | Cm7 F7 | ii–V to I, not landing (Fm7 follows) | m4, D4 | C Dorian, F Mixolydian | ✓ ✓ |
| 5–6 | Fm7 B♭7 | related ii; V7/IV | m4, D4 | F Dorian, B♭ Mixolydian | ✓ ✓ |
| 7 | E♭Maj7 | IV | M4 | E♭ Lydian | ✓ |
| 8 | A♭7 | ♭VII7, the back door to B♭Maj7 | D5 | A♭ Lydian Dominant | ✓ |
| 9 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |
| 10 | Eø7 A7♭9 | ii–V of iii, landing this time | h2, D1+D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 11 | Dm7 | iii, reached by its own ii–V | m7′ | D Dorian | ✓ (Phrygian before the m7′ refinement) |
| 12 | B♭m7 E♭7 | iv7 ♭VII7: the back door to FMaj7 | m4, D5 | B♭ Dorian, E♭ Lydian Dominant | ✓ ✓ |
| 13 | FMaj7 | V as a major 7th: chromatic, reached by the back door | M4 | F Lydian | ✓, decision 10 |
| 14 | Eø7 A7♭9 | ii–V of iii, not landing | h2, D1+D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 15–16 | Aø7 D7♭9 | related iiø7; extended dominant in a chain ending on Cm7 | h2, D3′ | A Locrian, D Phrygian Dominant | ✓ ✓ (Half-Whole before D3′) |
| 17–18 | G7♯5 | V7 of the C minor area; ♯5 pinned, ♭9 in the key | D1+D4 | G Altered | ✓ (my hand said Whole Tone; the rule won) |
| 19–20 | Cm7 | tonic of the C minor area (ii of B♭, tonicized) | m5 | C Dorian | ✓ |
| 21–22 | A♭7♯11 | ♭VII7 back door, ♯11 pinned | D1 | A♭ Lydian Dominant | ✓ |
| 23–24 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |
| 25–28 | Eø7 A7♭9, Dø7 G7♭9 | minor ii–Vs of iii and of ii, each landing on the next ii | h2, D1+D4 | E, D Locrian; A, G Phrygian Dominant | ✓ |
| 29–30 | Cø7 F7♭9 | iiø7 (borrowed) and V7 → I; ♭9 pinned, the 13 is in B♭ | h2, D1+D4 | C Locrian, **F Half-Whole** (the table's rare ♭9 11 13 row, with a real chord) | ✓ ✓ |
| 31–32 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |

### All the Things You Are (A♭ major; areas in C, E♭, G and E)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1 | Fm7 | vi (the turnaround before it is a secondary ii–V to vi) | m7 | F Aeolian | ✓ |
| 2–4 | B♭m7 E♭7 A♭Maj7 | ii–V–I | m4, D4, M3 | B♭ Dorian, E♭ Mixolydian, A♭ Ionian | ✓ |
| 5 | D♭Maj7 | IV | M4 | D♭ Lydian | ✓ |
| 6–8 | Dm7 G7 CMaj7 | ii–V opening a C major area; its tonic | m4, D4, M3 | D Dorian, G Mixolydian, C Ionian | ✓ |
| 9 | Cm7 | iii of A♭, on the root of the tonic just left | m7′ | C Dorian | ✓ (Phrygian before m7′) |
| 10–12 | Fm7 B♭7 E♭Maj7 | ii–V opening an E♭ area (E♭Maj7 isn't diatonic to A♭); its tonic | m4, D4, M3 | F Dorian, B♭ Mixolydian, E♭ Ionian | ✓ |
| 13 | A♭Maj7 | IV of the E♭ area | M4 | A♭ Lydian | ✓ |
| 14–16 | Aø7 D7 GMaj7 | iiø7–V opening a G area; its tonic | h2, D4, M3 | A Locrian, D Mixolydian, G Ionian | ✓ |
| 17–20 | Am7 D7 GMaj7 | ii–V–I in G | m4, D4, M3 | A Dorian, D Mixolydian, G Ionian | ✓ |
| 21–23 | F♯ø7 B7 EMaj7 | iiø7–V opening an E area; its tonic | h2, D4, M3 | F♯ Locrian, B Mixolydian, E Ionian | ✓ |
| 24 | C7♯5 | → Fm7, vi of the global key: V7/vi in A♭ (§5.3); ♯5 pinned, ♭9 in the key | D1+D4 | C Altered | ✓ |
| 25 | Fm7 | vi again, not the tonic of an F minor area (§5.3) | m7 | F Aeolian | ✓ (Dorian before the §5.3 refinement) |
| 26–29 | as bars 2–5 | | | | ✓ |
| 30 | G♭13 | ♭VII7, non-resolving, 13 pinned | D5 | G♭ Lydian Dominant | ✓ |
| 31 | Cm7 | iii, passing down to B°7 and B♭m7 | m7′ | C Dorian | ✓ (Phrygian before m7′) |
| 32 | B°7 | passing diminished | d1 | B Whole-Half | ✓ |
| 33–35 | B♭m7 E♭7 A♭6 | ii–V–I | m4, D4, M3 | B♭ Dorian, E♭ Mixolydian, A♭ Ionian | ✓ |
| 36 | Gø7 C7 | secondary ii–V to vi, into the top of the form | h2, D4 | G Locrian, C Phrygian Dominant | ✓ ✓ |

### Lady Bird (C major, with an A♭ area)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1–2 | CMaj7 | I | M3 | C Ionian | ✓ |
| 3–4 | Fm7 B♭7 | iv7 ♭VII7: the back door to I | m4, D5 | F Dorian, B♭ Lydian Dominant | ✓ ✓ |
| 7–10 | B♭m7 E♭7 A♭Maj7 | ii–V opening an A♭ area (♭VI, tonicized); its tonic | m4, D4, M3 | B♭ Dorian, E♭ Mixolydian, A♭ Ionian | ✓ |
| 11–12 | Am7 D7 | ii–V of V; G7 never arrives | m4, D4 | A Dorian, D Mixolydian | ✓ ✓ |
| 13–14 | Dm7 G7 | ii–V → I | m4, D4 | D Dorian, G Mixolydian | ✓ ✓ |
| 15 | CMaj7 E♭7 | I; V7 opening the A♭ area again | M3, D4 | C Ionian, E♭ Mixolydian | ✓ ✓ |
| 16 | A♭Maj7 G7♯5 | the A♭ tonic for two beats; V7 → I as the form repeats, ♯5 pinned, 9 in C | M3, D1+D4 | A♭ Ionian, G Whole Tone | ✓ ✓ |

### What the three standards changed

They were chosen to hit rules the first fourteen charts never reached, and they found four things:

1. **§5.3, returning to the global key.** As first written, `C7♯5 → Fm7` after the E major bridge of All the
   Things opened an F minor area, making bar 25's Fm7 a tonic (Dorian) while bar 1's identical Fm7 was vi
   (Aeolian). A cadence into a chord diatonic to the global key now returns there. No earlier chart changes:
   Autumn Leaves' B♭Maj7 is ♭III of G minor, and reads the same either way.
2. **D3′, dominant chains into a minor tonic.** Stella's `Aø7 D7♭9 | G7♯5 | Cm7` made D7♭9 Half-Whole under D3
   (natural tensions for an extended dominant), a bright sound in the darkest bar of the tune. A chain that ends
   on a minor tonic now derives each link from that key: Phrygian Dominant. The Rhythm Changes bridge, which ends
   on B♭ major, is unchanged.
3. **m7′, iii → Dorian.** Three iii chords (Stella's Dm7, All the Things' Cm7 twice) and I'd have played Dorian on
   every one. The diatonic scale, Phrygian, has its one distinctive note a half step above the root. Decision 8 is
   withdrawn: iii is Dorian, and Phrygian stays in the menu and in the modes chart, where it belongs.
4. **The rule beat my hand once.** I wrote Whole Tone for Stella's G+ out of habit; the derivation says Altered (the
   ♭9 is in C minor), which is at least as idiomatic, and the chart now says so. This is the "I was inconsistent;
   the rules win" branch of §13, in practice.

After these, the three tunes are reproduced in full: 81 of 81 rows.

### Score

Over the library's seventeen functional charts (every chart but the two modes charts, which are teaching lists),
the rules as they now stand reproduce the written scales on 237 of 271 rows, 87%: 156 of 190 on the first
fourteen charts (82%; 170 of 190 if decision 4 goes to Mixolydian for the blues subdominant) and 81 of 81 on the
three standards added to test them. Every disagreement is one of the decisions in §10; none is a case where the
chart is plainly right and the rule plainly wrong, except Milestones' Aeolian, which the explicit-choice
principle handles. The B♭ blues charts mirror the F ones row for row.

## 10. Decisions

Each of these is a place where the sources, common practice and our own charts don't all agree. **All were
decided as recommended** (the first option in each). They are kept here with their reasoning, because they are
the places a future rule change is most likely to revisit.

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

8. ~~**iii7 → Phrygian.**~~ Withdrawn: the three standards settled it for Dorian (§9, "What the three standards
   changed", item 3). Phrygian stays in the menu.
9. **ø7 in a modal tune → Locrian ♮2** (h1). It reproduces Footprints and is the melodic-minor sound modal players
   favour, but it's a taste rule, not a derivation. *Keep,* flagged as such in the reason text.
10. **The back door's target: tonicized or not?** Stella's `B♭m7 E♭7 → FMaj7` lands on a major chord that isn't
    diatonic to B♭. If the back door counts as a cadence, FMaj7 is a tonic (Ionian); if not, it's a chromatic major
    chord in B♭ (Lydian, M4). *Lydian.* The back door is a colour cadence that stays in the key, and F Lydian is
    B♭'s own notes. Lady Bird's back doors land on I and are unaffected either way.

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

Built (after the analyser) as a `ladders` table in `chord_scales.json` beside the `level` tags rather than
replacing them: a row whose Standard is its quality's default keeps the tags (so nothing built before changes,
and `7sus4`'s Mixolydian keeps its own rungs), and a row whose Standard the analysis chose climbs that scale's
ladder (`engine/levels.ts`, `ladderScale`). A tonic minor chord (rule m5) is Aeolian at Basic (decision 7): the
level control runs the analysis on the chart to find those rows. Lydian's and
Lydian Dominant's Advanced rungs are blank, as in the table.

## 12. The tool

A script, not a page: `npm run analyse -- charts/<tune>.txt`. The site is untouched.

- **Report** (default): the key and key areas found, then one line per row: bar, chord, function, the scale the
  rules give, the reason, and the chart's current scale where it differs (`≠ D Half-Whole`). Rows the rules
  couldn't reach are marked `?`.
- `--save`: writes the analysis into the chart as comments (§12.1), alongside `--write` or on its own.
- `--write`: fills **blank** scale cells only, leaving every written scale as it is. The usual way to add a chart:
  write the chords, run `--write`, read the report, fix the chart or the rules.
- `--force`: rewrites every cell the rules reach, so a chart can be brought back into line with the rules after
  they change. The report shows what moved. Explicit choices you want to protect get a `# keep` comment on the
  line above (the analyser leaves the next row alone).
- `--all`: runs the report over every chart in `charts/`, for the regression check in §13.
- **Hints in the chart:** an optional `key: Gm` meta line fixes the global key when the scoring would get it wrong
  (a tune that ends away from home); `bars: 32` fixes the form length when the last chord's duration matters.
  Both are meta lines; the parser needs to accept them (today only `title:` and `subtitle:` are meta), and the
  site ignores them.

### 12.1 Saving the analysis in the chart

The analysis is worth keeping with the chart: it records why each scale is what it is, it lets a chart be
corrected by hand in a text editor, and it makes the analyser's next run start from the corrected version
instead of from scratch. It is saved as **comments**, which the parser already keeps and the site already
ignores, so the chart format and the editor don't change.

```text
title: Autumn Leaves
key: Gm
# analysis: 2026-10-08, rules v1

# area: Bb major (bars 1–4)
A1 | 1 | Cm7    | C Dorian             # ii of the ii–V to Bb
A1 | 2 | F7     | F Mixolydian         # V7 of Bb: natural tensions
A1 | 3 | Bm7    | B Dorian             # passing ii–V: its own key
A1 | 3 | E7     | E Mixolydian         # passing ii–V: its own key
# area: G minor (bars 5–8)
A1 | 5 | Am7b5  | A Locrian            # iiø7 of G minor
A1 | 6 | D7     | D Phrygian Dominant  # V7 of G minor: b9 and b13 are in the key
A1 | 7 | Gm     | G Dorian             # tonic minor: Dorian by convention
```

- A **trailing comment** on a row (`# …` after the scale) holds that row's function and reason. The parser treats
  everything from `#` as a comment today, so this needs one small change: a row may end in a comment, which the
  text ⇄ grid sync keeps verbatim. The grid doesn't show it.
- **Area lines** (`# area: …`) and the **header line** (`# analysis: date, rules version`) are ordinary comment
  lines. The header lets `--all` report which charts were analysed under older rules.
- **Editing by hand:** change the scale, and the comment, in any text editor. On its next run the analyser
  compares its answer with the row and, where they differ, reports both; `--write` never touches a filled cell.
  To make a hand choice permanent and silence the report, write `# keep: …` as the reason; to make it a rule,
  change the rules (§13).
- **A dedicated tool** (an analysis view in the editor, or a diff of two runs) can come later; the comments are
  the format either would read.

The analyser never writes anything but scale names and comments.

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
- **Tunes that would test the rest.** The seventeen charts leave some rules untouched. In order of what each
  would teach: Giant Steps (key areas from cadences alone, no ii chords, three keys a major third apart); There
  Will Never Be Another You (V7/IV, V7/V and III7 in one major-key tune); Days of Wine and Roses (a V7/IV that
  lands on IV, a ♭VII7 that doesn't resolve, ♯ivø7); Alone Together (a minor key with ii–Vs to several degrees
  and a major bridge: the composite minor under load); Satin Doll (ii–Vs a step apart and a tritone-sub ii–V into
  I); A Night in Tunisia (♭II7 → i as the engine of the tune, and a form that ends on its ii–V).
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

## 16. What building it changed

The rules were run over the library before any chart was written, and every row where they disagreed with a
hand-scaled chart was read. Each refinement below has a test named for it (`web/engine/__tests__/analysis.test.ts`).

| Refinement | The tune that forced it | Before | After |
|---|---|---|---|
| A tritone substitute doesn't fire into a ø7 or °7 | Autumn Leaves, `Fm7 B♭7 \| Aø7` | B♭ Lydian Dominant | B♭ Mixolydian (V7/♭VI, as §9 has it) |
| The back door is its own case (D5) | Stella, `B♭m7 E♭7 \| FMaj7`; Lady Bird | E♭ Mixolydian (read as a passing ii–V) | E♭ Lydian Dominant |
| A tension takes its natural form when the key holds both | Stella's A♭7 → B♭Maj7: A and B♭ are both in B♭ | A♭ Half-Whole | A♭ Lydian Dominant |
| D3′ includes the chain's last link | Stella, `G7♯5 → Cm7` | G Whole Tone (V7/ii in B♭) | G Altered (§9's verdict) |
| A ♯11 written alone pins the natural 9 and 13 | `D7♯11` resolving to a minor chord | Altered | Lydian Dominant |
| A minor ii of the next ii–V opens no area | Bird Blues, `Dm7 G7 \| Cm7 F7 \| B♭7` | G Phrygian Dominant (V7 of C minor) | G Mixolydian (V7/V, as §9 has it) |
| A cadence into the home tonic comes home | Long Ago and Far Away, `Gm7 C7 \| FMaj7` after a bridge in C | F Lydian (IV of C) | F Ionian |
| In a minor key, a ii–V–I into a major chord tonicizes it | Bernie's Tune's bridge (B♭ in D minor) | `G7 → Cm7` as "V7/♭vii in D minor" | V7/ii in B♭, Mixolydian ♭6 |
| Intros, codas, tags and endings sit outside the form | A Night in Tunisia's interlude, Moment's Notice's tag | the form's last chord resolved into the tag | the form wraps to its own top; each such section is analysed around it |
| A section that starts on the home tonic is home again | Nardis' last A, after a bridge in C, with no cadence back | C Ionian, A Aeolian (in C) | C Lydian, A Dorian (in E minor) |
| A turnaround into the top carries its key into bar 1 | Giant Steps, `F♯7 \| BMaj7` | B Lydian | B Ionian |
| An implied ii–V target counts when its triad is in the key | There Will Never Be Another You, `Cm7 F7♯11` | passing ii–V | V7/V in E♭ |
| A form without a stated length rounds up to four bars | Footprints (12 bars, last chord two) | read functional | modal (F♯ø7 Locrian ♮2, as the chart has it) |

After these, the hand-scaled charts agree with the rules on every row except the decisions in §10 (now applied to
the charts) and Milestones' Aeolian bridge (kept, `# keep:`). The cookbook's 222 charts were filled from the rules
(`--force --save`). Where a `@copy` repeat's function differed from its source row's, the repeat is written out
(Epistrophy's last section); the section-start rule settled Nardis'.

Four `key:` lines from the book's index were wrong for its own lead sheets (This I Dig of You, Voyage, Snapper,
Bernie's Tune) and are corrected, with a comment. Key scoring alone (§5.2) is weak on these tunes: it disagrees
with the stated key on about a quarter of them, mostly by choosing a relative minor or a key a step away; every
library chart states its key, so this affects only charts written without one.


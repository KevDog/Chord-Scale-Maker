# Harmonic analysis for scale choice: the rule set

Status: **built** (`web/engine/analysis/`, `npm run analyse`; docs/design.md §7a) and run over the library. The
decisions in §10 were all taken as recommended (2026-10-08). The analysis each run produces is saved into the chart
as comments (§12.1), so it can be corrected in a text editor. Building it against the library refined a handful
of rules; §16 lists each one with the tune that forced it, and the tables below are updated to match.

A second pass checked the rules against the primary sources (Nettles and Graf, *The Chord Scale Theory and Jazz
Harmony*; Mulholland and Hojnacki, *The Berklee Book of Jazz Harmony*; Levine; Chediak) and revised eight of them
(R1–R6 below, with the ladders they touch in §11). The research is in `docs/research/2026-10-jazz-theory-vs-engine.md`;
the design is in `docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md`. No principle in §2 changed.

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

Autumn Leaves (G minor) as the standard changes are usually heard alternates areas: `Cm7 F7 B♭Maj7 E♭Maj7` is a B♭
major area, `Aø7 D7 Gm` a G minor area. E♭Maj7 is IV of B♭ and ♭VI of G minor; either way it gets Lydian (§7.2),
which is why relative-key ambiguity rarely matters. The library chart does not make two areas of it: its
`Cm7 F7 | B♭Maj7` is read inside one G minor area (F7 is V7/♭III, B♭Maj7 is ♭III, Ionian by M3), and only the
`Bm7 E7` and `B♭m7 E♭7` pairs are side-steps (§7.5).

### 5.4 Modal and blues contexts

Two whole-tune contexts change the rules. A chart may state its context in its header, `context: functional |
modal | blues`, as it states a key (principle 1); a written context always wins, and without one it is detected
(`prepare()` in `index.ts`: context `stated ?? detected`; docs/superpowers/specs/2026-10-10-chart-context-design.md).

| Context | Rules | Key areas |
| --- | --- | --- |
| `functional` | cadences, functions, areas (the default) | on |
| `modal` | each chord its own mode: M5, m6, D7, s3 | off |
| `blues` | the I, IV and V by their degree (docs/superpowers/specs/2026-10-18-blues-analysis-design.md): D9 (I7, IV7, a V7 that doesn't resolve), M6 (a triad or 6 on I, IV or V), m10 (a minor blues' i and iv), s4 (sus); Basic plays the key's Blues scale on them | off |

- **Blues (detected):** a dominant 7th on one root in bar 1 and the dominant a fourth above it in bar 5, in a
  12-bar (or 24-bar) form, or in the first section of a form of 12-bar sections or of a 12-12-8-12 one (`AABC, 44
  bars`; Levine p. 226: Locomotion, Tee Pee Time, Unit Seven). The tests stay dominant-on-bar-1 and -bar-5, not
  "tonic and subdominant of any quality": Solar's key areas depend on its being read as functional, and a chart
  that is a blues by another shape (the Bird blues, a minor blues, Watermelon Man's 16 bars) says `context: blues`.
  The key: `key:` beats the blues key (`stated ?? blues ?? scored`); with no `key:` a blues form's key is its
  bar-1 root, major, whatever the context (a 12-bar B♭ blues stated `functional` is still in B♭, its blues rules
  off), and for a stated blues the detection missed, the bar-1 chord's root and mode. The tonic and subdominant are
  dominant 7ths by nature, not by function (§7.1, R2). A minor blues is `context: blues` too: its i and iv are
  Dorian (m10), its V7 keeps the minor-key rules (Levine p. 225; M&H pp. 143–144). A blues of any other form (a 9-,
  13- or 16-bar Delta blues) says `context: blues`; `csm add` writes it from an iReal style containing "Blues".
- **Modal (detected):** fewer than a third of the chords take part in cadences, and the median chord lasts two bars
  or more, unless more than half the chords are dominant 7ths on more than one root (modal music is poor in
  dominants, M&H p. 187, N&G p. 153; an all-dominant tune has no cadences by §5.1's definition, and read modal
  until this guard; one root is a Mixolydian tonic, M&H p. 190, so a `G7` vamp stays modal). So What, Maiden
  Voyage, Milestones and Impressions qualify; Footprints sits exactly on the median and says `context: modal`. In
  a modal tune the functional rules are off: each chord is its own mode (§7.6).
- **The thresholds** (a third of the chords in cadences; a median of two bars; half the chords dominant) are
  unsourced numbers. The report shows them: `context: modal (detected: 0 of 8 chords in cadences, median chord 2
  bars)`, or `context: modal (stated)`, with ", but N of M dominant 7ths" when the guard alone kept a chart from
  modal; `--ambiguous` names a detection within one chord of one of them ("context: modal by the median exactly (2
  bars); consider  context: modal"). A chart with no chord in a cadence is not near the cadence cut: a cadence takes
  two chords. A trailing `# …` on the `context:` line is a comment; an empty `context:` is absent.
- **Not built:** `minor: dorian | aeolian` is reserved (accepted and reported as ignored); `@context SECTION BAR
  VALUE` is parsed like `@key` (from its bar until the next; inside a `modal` span the span's first chord is its
  tonic, inside a `blues` span its bar 1 is the I), and reported as "not yet supported: using the chart's context"
  until a chart needs it. A bad `context:` value is a header diagnostic; the analysis detects and reports it.

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

Berklee's own scale for every dominant whose ♭9 is diatonic is the eight-note one that also carries the ♯9 (N&G
p. 43, the ♯9 rider). The engine's seven-note Phrygian Dominant is a principle 7 choice (the diatonic scale at
Standard), not Berklee's; the eight-note colour is the Advanced rung, Altered (§11).

The rules, in priority order. The first that applies decides.

| | Rule | Scale | Reason text |
|---|---|---|---|
| D1 | The symbol pins enough tensions to leave one scale (`7alt`, `7♯5`, `7♯11`, `7sus4♭9`…); a ♯11 written alone pins the natural 9 and 13 with it | per the table above | "from the symbol" |
| D2 | **subV7:** resolves down a half step, to anything but a ø7 or °7 (`Fm7 B♭7 \| Aø7` is the ii–V of E♭) | Lydian Dominant | "tritone substitute of … (resolves down a half step)" |
| D3 | **extended:** resolves down a fifth to another dominant, in a chain that ends on a **major** tonic | Mixolydian | "extended dominant: V7 of the next dominant" |
| D8 | **extended**, in a chain that ends on a **minor** tonic (`D7♭9 G7♯5 → Cm7` in Stella), the last link included | derive each link from that minor key (harmonic minor for the last) | "V7 of the V7 of C minor: ♭9 and ♭13 are in the key" |
| D4 | **V7, V7/x, V7 of the chord before, cadence to a new key:** resolves down a fifth to a non-dominant chord | derive from the reference | "V7 of G minor: ♭9 and ♭13 are in the key" / "V7/ii in C: the 9 is in the key, the 13 isn't" |
| D5 | The **back door** (♭VII7 up a whole step to a major chord), or a **non-resolving** dominant whose root is diatonic (deceptive V7) | derive from the local key | "back door ♭VII7 to …" |
| D6 | **Non-resolving with a chromatic root** (♭VI7 that doesn't resolve, ♭II7 sitting) | Lydian Dominant | "a chromatic dominant with nowhere to go: Lydian Dominant, its own key" |
| D9 | **In a blues:** the I7 and IV7 (decided by their degree, before D3), or a V7 that doesn't resolve (after D3/D4; not in a minor blues) | Mixolydian (written tensions move it: D1+D9); Basic: the key's Blues scale | "I7 of the blues: a tonic with dominant colour, Mixolydian" / "IV7 of the blues: a subdominant with dominant colour, Mixolydian (the ♯11 is an extra colour)" / "V7 of the blues: a dominant that needn't resolve, Mixolydian" |
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
- D5 for the blues I7 and IV7 comes before D3: the I7 that precedes its IV7 is not "an extended dominant" (M&H
  p. 137: "I7 should not be confused with V7/IV"). The blues IV7 is Mixolydian, though the key holds its ♯11:
  principle 4 yields, as N&G p. 105 and M&H pp. 93, 125 write the blues (decision 4). Lydian Dominant stays in the
  `7` menu. A symbol that moves the IV7's scale (`7♯11`) names it, and the Mixolydian clause drops from the reason.
- A V7 into a minor chord is Phrygian Dominant at Standard and Altered at Advanced (R5; Levine pp. 75–76, M&H
  p. 95: "an alternative chord scale choice"). A rung holds one scale, so Altered is the rung and Spanish Phrygian
  stays in the menu (§11).
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
| M3 | The natural 11 is in the local key's reference (this is the **tonic I**, and ♭III in a minor area, where ♭IIIMaj7 shares the key's notes); **♭VII of a minor key**, the notes of the tonic's Dorian (R6; N&G pp. 85, 88, 91); a **V triad** without its 7th, which is Mixolydian; a **IV reached by its own dominant** (R1, below) | Ionian (Mixolydian for the V triad) | "tonic: the 4th is in the key" / "♭III of G minor is B♭ major itself" / "♭VII of C minor: B♭ major, the notes of C Dorian" / "V without its 7th: Mixolydian, the key's own notes" / "the B♭7 before it makes E♭ the key of the moment: the 4th is in the key" |
| M4 | Otherwise (IV not so prepared, ♭II, ♭III in major, ♭VI, ♭VII of a major key, any chromatic major chord) | Lydian | "IV: the natural 4th would be the key's ♭7" / "a borrowed major chord: Lydian, as all non-tonic major chords" |
| M5 | Modal tune | Lydian, unless the symbol has a natural 11 (`Maj7sus`, rare) | "modal major: Lydian" |
| M6 | A blues: a major triad or 6 chord on I, IV or V (not a maj7) | Mixolydian; Basic: the key's Blues scale | "IV of the blues: a triad here implies its ♭7, Mixolydian" |

R1 is the one exception to "IV is Lydian". A major chord that is IV of the local key and whose previous chord is its
own dominant, a fifth above (V7/IV) or a half step above (subV7/IV), is the key of the moment: the 4th is in that
key, so it is Ionian (N&G p. 47: "the only maj7 chord with this chord scale choice", p. 60 for the subV7/IV; Levine
p. 120, fig. 6-11, Stella's E♭∆ as "1st mode of E♭ major"). Lydian stays its Advanced rung (§11). It opens no area
(it is diatonic), applies in major local keys only (a major IV in a minor key stays M4), and needs a dominant-family
chord before it: a 7sus4 does not make the IV the key of the moment. Like every rule that reads the previous chord,
it wraps the form, so a bar-1 IV is prepared by the last chord (Just Friends, Stardust). A stated function that
moves the chord off IV (`# keep:`, `V7/ii`) overrides it. A IV not so prepared (All the Things' D♭Maj7 after
A♭Maj7) stays Lydian.

### 7.3 Minor 7ths, 6ths, minor-major 7ths and triads

| | Rule | Scale | Reason text |
|---|---|---|---|
| m1 | The symbol is `m(Maj7)` | Melodic Minor | "from the symbol" |
| m2 | The symbol is `m6`: on the **tonic** of a minor key area (R6) | Melodic Minor | "tonic minor sixth chord: melodic minor, the raised 7th is a tension" |
| m2 | any other `m6` (iv6, ii6, a borrowed iv6, any in a modal chart) | Dorian | "a minor sixth chord: Dorian" |
| m3 | The symbol says `♭6` or `♭13` | Aeolian | "from the symbol" |
| m4 | **Related ii** of any ii–V (a dominant a fourth above follows) | Dorian | "ii of the ii–V to …" |
| m5 | **Tonic minor** (i of a minor area) | Dorian | "tonic minor: Dorian by convention" |
| m6 | Modal tune | Dorian | "modal minor: Dorian" |
| m10 | A minor blues: the i or iv (triad, m7 or m6) | Dorian; Basic: the key's Blues scale | "i of the minor blues: Dorian" |
| m7 | Diatonic, by derivation from the local key: ii → Dorian; vi → Aeolian; iv of minor → Dorian; v of minor → Phrygian | as derived | "vi: Aeolian, the key's own notes (the ♭6 is a passing note)" / "v of a minor key: Phrygian, the key's own notes (its ♭2 is a passing note)" |
| m9 | **iii** of a major key, also as the related ii of the next dominant (R4) | Phrygian (Dorian at Advanced) | "iii: Phrygian, the key's own notes (the ♭2 is a passing note)" |
| m8 | Borrowed or chromatic (iv7 in major, ♭vi7…) | Dorian | "a borrowed minor chord: Dorian, its own key" |

m4 outranks m7 on purpose: `Am7 D7 G7` in C makes Am7 a ii, so Dorian, not Aeolian. m5 is a convention, not a
derivation: natural minor would say Aeolian for the tonic. It matches what players do and what the library has
(Stella's Dm7, All the Things' Cm7, each reached as a tonic of the moment); Aeolian is one click away in the menu.

m9 reverses the first version of this document (which chose Dorian, decision 8). iii7 takes the key's own notes, its
only available tension the 11 (N&G p. 33; M&H p. 23, "only the 11 sounds pleasingly consonant"; Chediak vol. 2
p. 48 gives Dorian only "in contemporary, less consonant music"), so Phrygian is Standard (principle 7) and Dorian
the Advanced rung. As a related ii (`Cmaj7 | Em7 | A7 | Dm7`) a diatonic iii keeps Phrygian (M&H p. 57; Aeolian is
M&H's alternate); it takes rule m9 and the report adds "also iii of C". A iii triad climbs like iii7. The same
per-quality rung (`quality_ladders`, §11) also makes a minor-key v7 climb to Dorian: Dorian ♭2 (♮6 over a v) is
not that chord's colour either.

The reasons for m7, h2 and m5 say "the key's own notes" with the passing note named, not "the ♭9 is in the key": a
♭9 or ♭6 over a chord tone that is a passing note is how these scales are used, not a tension (N&G pp. 27–28;
M&H pp. 24, 97; Levine p. 46). The Aeolian menu note reads "when the chord is vi, or the symbol has a ♭6" (iv is
Dorian: N&G p. 79; M&H p. 129); m5's convention is cited at N&G p. 91, M&H p. 84, Levine p. 225.

### 7.4 Half-diminished and diminished

| | Rule | Scale | Reason text |
|---|---|---|---|
| h1 | *(dropped)* | | A ø7 in a modal tune goes through h2: no modal chapter of the sources has a ø7, and h2's ladder offers ♮2 at Advanced. The chart may `# keep:` the ♮2 (Footprints' F♯ø7 is now F♯ Locrian) |
| h2 | Any ø7 (iiø7 of minor, viiø7, ♯ivø7, related iiø7, chromatic), in a modal tune too | Locrian (Locrian ♮2 at Advanced) | "iiø7 of G minor: Locrian, the key's own notes (its ♭2 is a passing note)" / "…: Locrian, its own mode (the chord is outside the key)" |
| d1 | A °7 by its **function** (below) | the diatonic diminished scale of that function; Whole-Half where the figures do not cover it | "vii°7 of Dm7: A7♭9 without its root" / "passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)" / "auxiliary diminished: it decorates the chord and returns to it" |

Locrian ♮2 is never diatonic to the key the ø7 serves (D Locrian ♮2 needs E♮ against C minor), so it stays a
colour choice: the Advanced rung (N&G p. 153; M&H pp. 187, 194).

**d1, the °7 (R3).** Every function of a diminished 7th hides a dominant ♭9 without its root, and the reason names
the one it actually hides: for a `vii°7 of X`, X's V7♭9; for a passing or auxiliary °7, the V7♭9 a half step below
one of its four notes that is the dominant of the next chord, or of the chord after a related ii (Wave: B♭°7 →
Am7 D7 hides A7♭9, not E7♭9); with none, "a rootless dominant ♭9" (Levine p. 87; N&G p. 114). The scale then
follows the function, from Mulholland and Hojnacki pp. 149–162 (Berklee's "diatonic diminished"), and the symmetric
Whole-Half is the Basic and Advanced rung (N&G p. 114: it is "appropriate when the diminished 7th chord is not
functioning diatonically"; Levine p. 84 and Chediak vol. 1 p. 91 give Whole-Half):

| Function | Scale (`SCALES` key), degrees from the °7 root | Source |
|---|---|---|
| ascending `vii°7` of X (a half step below the next chord's **root or bass**, a major or minor chord: C♯°7 → Dm7; ♯II°7 → I/3) | `diatonic diminished` (alias `leading tone diminished`), `1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭♭7 ♭8`: X's V7(♭9 ♯9 ♭13) from the °7's root | M&H p. 152; N&G p. 115 |
| ♯IV°7 to I, over its 5th or not (an inversion of ♯II°7); the blues I7 too | `diatonic diminished #iv`, `1 ♭2 ♭3 4 ♭5 ♭6 ♭♭7 ♭7` (menu: `#iv optional`, with the major 7th) | M&H figs. 7.13, 7.14, 7.15 |
| passing ♭III°7 (falling to ii) | `diatonic diminished biii`, `1 ♯1 ♭3 3 ♯4 ♯5 6 7` (menu: `biii optional`, the 9 in place of the ♯1) | M&H figs. 7.22, 7.23, 7.24 |
| passing ♭VI°7 | `diatonic diminished bvi`, `1 ♯1 ♯2 3 ♯4 ♯5 6 7` | M&H figs. 7.26, 7.27 |
| auxiliary I°7 (returns to the tonic) | `diatonic diminished i`, `1 2 ♭3 3 ♭5 5 6 7` (menu: `i optional`, `1 2 ♭3 4 ♭5 5 6 7`) | M&H figs. 7.30, 7.31 |
| auxiliary V°7 | `diatonic diminished v`, `1 2 ♭3 4 ♭5 5 6 ♭7` | M&H figs. 7.32, 7.34 |
| any other °7 (other roots, a minor key's passing or auxiliary °7) | `Whole-Half Diminished`, reason "…; not functioning diatonically: the symmetric scale" | N&G p. 114 |

A °7 is ascending when its root is a half step below the next chord's **root or its bass** (R16): `C♯°7 → Dm7/A`
and `B°7 → C/G` (vii°7 to I6/4) by the root, `♯II°7 → I/3` (Our Delight, Slow Boat to China) by the bass. ♯IV°7 → I
is tested first, in any inversion, so `F♯°7 → C/G` takes fig. 7.13. The figures give the formulas; none is a
hand-typed note list. The decisions the figures left open were the user's: the ♭III°7 takes fig. 7.22 and the
auxiliary I°7 the first of fig. 7.31 at Standard, their optional forms in the menu; ♯IV°7 → I takes fig. 7.13 with
fig. 7.14 in the menu. Where N&G p. 116 reaches ♭III°7 by its enharmonic equivalence with ♯II°7 (the ascending
pattern from the sharp root), the engine follows M&H's fig. 7.22 and prints the ♭III°7's own figure
(`Diatonic Dim. (♭III°7)`) where its root spells cleanly. That is the minority: 26 of the library's 34 ♭III°7 rows
have no clean root for fig. 7.22 and print the ascending lettering of the same notes (`B Diatonic Diminished`, R9),
so their sheet label reads "Diatonic Dim.", while the reason still says "passing diminished".

**Spelling.** The scale's root is spelled by `simplifyRoot` per scale (R9), so an E♭°7 ascending is D♯ Diatonic
Diminished and the sheet has no double accidentals or B♯/E♯/C♭/F♭. Where no spelling of the function's formula is
clean, the enharmonically equivalent figure's lettering is used (fig. 7.22 prints B°7 in A♭ as B C D E♭ F G A♭ B♭,
the ascending pattern from the sharp root). A few rows keep a single C♭ or F♭ because no clean root exists
(Miss Premise 6/22, Relaxin' 26), and the earlier Whole-Half rows on E♭, F♯ and C♯ keep theirs (R11). The notes of
a °7 scale are labelled and practised **by semitone** from the root, not by formula degree (the formulas' ♯1 or ♭♭7
would misname them): `intervals.ts` and `practice.ts` read the dim7 scales that way. The choice is one pure helper,
`cleanLettering` (`scales.ts`), which the analyser, a transposed chart (`transposeRow`, where the key's side would
put back a B♯ or a double flat) and the `dim7` menu's diatonic diminished options all use, so the written scale is
always one of the menu's entries (R17).

The ladder: Standard the function's scale, Basic and Advanced Whole-Half, Harmonic Minor (a half step up) kept in
the menu (§11). Because a °7's Standard differs from the `dim7` quality default (still Whole-Half: no quality default
can hold a scale that depends on function and key), the Level control climbs the new scales' ladders.
Function-specific scales carry `functional: true` in `chord_scales.json`: they are offered in the menu and never
dealt by the Random level (R10).

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
| s2 | V7sus4 resolving down a fifth | as a dominant (§7.1), with the 11 in place of the 3rd: Mixolydian, or Mixolydian ♭6 if the ♭13 is in the key. Reason: "V7sus4 resolving down a fifth: Mixolydian, the 4th is a chord tone here" (the ♭13 branch keeps "the b13 is in the key") |
| s3 | Static or modal (Maiden Voyage) | Mixolydian |
| s4 | A blues: a sus chord on I, IV or V | Mixolydian; Basic: the key's Blues scale |

### 7.7 Fallback

A chord no rule reaches (an unparseable symbol, an unknown quality) keeps its quality default if it has one and
is otherwise left blank, and the report flags it. The analyser never invents a chord.

## 8. The rules on one page

Priority runs top to bottom within each family; the families are independent.

```text
Dominant   D1 symbol pins it  ▸ D5 blues I7 (derive) / IV7 (Mixolydian)  ▸ D2 subV7: Lydian Dominant  ▸ D3 extended: Mixolydian
           (to minor: derive)  ▸ D4 resolves: derive  ▸ D5 back door / diatonic non-resolving: derive  ▸ D6 chromatic
           non-resolving: Lydian Dominant  ▸ D7 static: Mixolydian
Major      M1 ♯11: Lydian  ▸ M2 ♯5: Lydian Augmented  ▸ M3 tonic, ♭III or ♭VII of minor, IV after its own dominant: Ionian
           (V triad: Mixolydian)  ▸ M4 else: Lydian  ▸ M5 modal: Lydian
Minor      m1 m(Maj7): Melodic Minor  ▸ m2 tonic m6 of a minor key: Melodic Minor, any other m6: Dorian  ▸ m3 ♭6: Aeolian
           ▸ m4 related ii: Dorian  ▸ m5 tonic: Dorian  ▸ m6 modal: Dorian  ▸ m9 iii: Phrygian  ▸ m7 diatonic: derive
           (ii Dorian, vi Aeolian, v of minor Phrygian)  ▸ m8 chromatic: Dorian
Half-dim   h2 Locrian (h1 dropped: a modal ø7 goes through h2)
Dim        d1 the diatonic diminished scale of the °7's function (ascending, ♯IV°7→I, ♭III°7, ♭VI°7, I°7, V°7); else Whole-Half
Sus        s1 ♭9: Phrygian  ▸ s2 resolving: as a dominant  ▸ s3 static: Mixolydian
```

## 9. Worked examples

The rules run over the library as it is. ✓ means the analyser agrees with the chart; ✗ is a disagreement, listed
again in §10. The tables below were written with the first version of the rules; where the second pass (R1–R6)
moved a row, the row says so, and the library charts are now the rules' output.

### Autumn Leaves (G minor; the standard changes read as areas in B♭ major and G minor)

The library chart is one G minor area (§5.3): the bars below are the standard changes, and the rules give the same
scales on them. In the chart, `F7` is V7/♭III and the rest is as listed.

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
| 2 | Eø7 A7♭9 | related iiø7, V7/vi; ♭9 and ♭13 in F | h2, D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 3 | Dm7 G7 | related ii, V7/V (→ Cm7, the next ii) | m4, D4 | D Dorian, G Mixolydian | ✓ ✓ |
| 4 | Cm7 F7 | related ii, I7 of the blues (R2, not an extended dominant) | m4, D5 | C Dorian, F Mixolydian | ✓ ✓ |
| 5 | B♭7 | IV7 of the blues (`context: blues`) | D5 (R2) | B♭ Mixolydian | ✓ |
| 6 | B♭m7 E♭7 | related ii; an extended ii–V, a side-step in its own key | m4, D4 | B♭ Dorian, E♭ Mixolydian | ✓ ✓ |
| 7 | Am7 D7 | iii; an extended ii–V, a side-step | m9, D4 | A Phrygian, D Mixolydian | ✓ ✓ |
| 8 | A♭m7 D♭7 | related ii; an extended ii–V, a side-step | m4, D4 | A♭ Dorian, D♭ Mixolydian | ✓ ✓ |
| 9–10 | Gm7 C7 | ii–V → I | m4, D4 | G Dorian, C Mixolydian | ✓ ✓ |
| 11 | FMaj7 D7♭9 | I; V7/ii, ♭9 pinned | M3, D1+D4 | F Ionian, D Phrygian Dominant | ✓ ✓ (Half-Whole in the first chart) |
| 12 | Gm7 C7 | ii–V → I | m4, D4 | G Dorian, C Mixolydian | ✓ ✓ |

The first chart gave A7♭9 and D7♭9, the same function, different scales; the analyser gives both Phrygian
Dominant, and so does the chart now. The chart opens on FMaj7, so the detection doesn't read it as a blues; it says
`context: blues` (§5.4), and bar 5's B♭7 is the blues IV7, Mixolydian by R2 (§10, decision 4), where as a IV7 in F
that doesn't resolve it was Lydian Dominant. Nothing else moves: its ii–Vs are side-steps and secondary dominants
read pair by pair, not key areas, so turning the areas off costs no scale. With R5 the V7 → minor rows
(A7♭9 → Dm7, D7♭9 → Gm7) climb to Altered at Advanced.

### Rhythm Changes (B♭ major)

Every row agrees: G7♭9 → Phrygian Dominant (V7/ii with ♭9 pinned), Cm7 F7 → Dorian, Mixolydian, B♭7 → Mixolydian
(extended, into E♭7), E♭7 → Lydian Dominant (IV7 of a non-blues, D5), E°7 → ♯IV°7 to I, E Diatonic Dim. (♯IV°7) in
bar 6 (d1; it was Whole-Half), while bars 14 and 30's E°7, falling to Cm7 F7, stay Whole-Half (passing diminished,
Q5: "not functioning diatonically"), the bridge → Mixolydian throughout (D3). The chart was written to these rules
before they were written down, which is a good sign for both.

### Blue Bossa (C minor, with a D♭ major area)

All fourteen rows agree: tonic Cm7 Dorian (m5), Fm7 Dorian (iv, m7), B♭7 Mixolydian (♭VII7, D5 with natural
minor), Dø7 Locrian (h2), G7♯5♯9 Altered (D1), Cm(Maj7) Melodic Minor (m1), E♭m7 A♭7 D♭Maj7 as a ii–V–I in D♭
(m4, D4, M3: D♭ Ionian as the local tonic), G7♯5 Altered (D1: ♯5 removes the 5th; ♭9 is in the key).

### F Jazz Blues (F major, blues form)

| Bar | Chord | Analyser | Chart |
|---|---|---|---|
| 1, 3, 7, 11 | F7 | F Mixolydian (I7, D5) | ✓ |
| 2, 5 | B♭7 | B♭ Mixolydian (IV7 of the blues, D5; R2) | ✓ |
| 4 | Cm7 F7 | C Dorian, F Mixolydian (related ii; extended into B♭7) | ✓ |
| 6 | B°7 | B Diatonic Dim. (♯IV°7), ♯IV°7 to I (d1) | ✓ |
| 8, 11 | Am7 D7♭9 | A Phrygian (iii, m9), **D Phrygian Dominant** (V7/ii, ♭9 pinned, ♭13 in F) | ✓ ✓ |
| 9–10, 12 | Gm7 C7 | G Dorian, C Mixolydian | ✓ |

### Footprints (C minor, modal)

No cadence (0 of 8 chords), and the median chord exactly two bars: modal by the detection, on its threshold, so
the chart says `context: modal` (§5.4). Cm7 → Dorian (m6), Fm7 → Dorian, F♯ø7 →
Locrian (h2; h1 dropped, so the chart's ♮2 is a `# keep:` if wanted), F13♯11 → Lydian Dominant (D1), E7alt and A7alt
→ Altered (D1).

### Maiden Voyage, So What, Milestones (modal)

Maiden Voyage's slash chords read as sus chords (pass 1) and get Mixolydian (s3); C♯m7 gets Dorian (m6). So
What: Dorian. Milestones: Gm7 → Dorian ✓; **Am7 → Dorian, where the chart says Aeolian.** The chart is right (the
tune's bridge is A Aeolian, which only the melody tells you), and its explicit choice stands. This is the clearest
example of what the analyser can't know (§13).

### Stella by Starlight (B♭ major)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1–2 | Eø7 A7♭9 | ii–V of iii; Dm never arrives | h2, D4 (D1+D4 only when the symbol moves the scale) | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 3–4 | Cm7 F7 | ii–V to I, not landing (Fm7 follows) | m4, D4 | C Dorian, F Mixolydian | ✓ ✓ |
| 5–6 | Fm7 B♭7 | related ii; V7/IV | m4, D4 | F Dorian, B♭ Mixolydian | ✓ ✓ |
| 7 | E♭Maj7 | IV reached by its own dominant (B♭7) | M3 (R1) | E♭ Ionian | ✓ (Lydian before R1) |
| 8 | A♭7 | ♭VII7, the back door to B♭Maj7 | D5 | A♭ Lydian Dominant | ✓ |
| 9 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |
| 10 | Eø7 A7♭9 | ii–V of iii, landing this time | h2, D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 11 | Dm7 | iii, reached by its own ii–V | m9 | D Phrygian | ✓ (R4; Dorian before it) |
| 12 | B♭m7 E♭7 | iv7 ♭VII7: the back door to FMaj7 | m4, D5 | B♭ Dorian, E♭ Lydian Dominant | ✓ ✓ |
| 13 | FMaj7 | V as a major 7th: chromatic, reached by the back door | M4 | F Lydian | ✓, decision 10 |
| 14 | Eø7 A7♭9 | ii–V of iii, not landing | h2, D4 | E Locrian, A Phrygian Dominant | ✓ ✓ |
| 15–16 | Aø7 D7♭9 | related iiø7; extended dominant in a chain ending on Cm7 | h2, D8 | A Locrian, D Phrygian Dominant | ✓ ✓ (Half-Whole before D8) |
| 17–18 | G7♯5 | V7 of C minor, the chain's last link; ♯5 pinned, ♭9 and ♭13 in the key | D1+D8 | G Altered | ✓ (my hand said Whole Tone; the rule won) |
| 19–20 | Cm7 | ii of B♭, where the chain lands | m7 | C Dorian | ✓ |
| 21–22 | A♭7♯11 | ♭VII7 back door; the ♯11 is in the key | D5 | A♭ Lydian Dominant | ✓ |
| 23–24 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |
| 25–28 | Eø7 A7♭9, Dø7 G7♭9 | minor ii–Vs of iii and of ii, each landing on the next ii | h2, D4 (A7♭9), D1+D4 (G7♭9) | E, D Locrian; A, G Phrygian Dominant | ✓ |
| 29–30 | Cø7 F7♭9 | iiø7 (borrowed) and V7 → I; ♭9 pinned, the 13 is in B♭ | h2, D1+D4 | C Locrian, **F Half-Whole** (the table's rare ♭9 11 13 row, with a real chord) | ✓ ✓ |
| 31–32 | B♭Maj7 | I | M3 | B♭ Ionian | ✓ |

### All the Things You Are (A♭ major; areas in C, E♭, G and E)

| Bar | Chord | Function | Rule | Analyser | Chart |
|---|---|---|---|---|---|
| 1 | Fm7 | vi (the turnaround before it is a secondary ii–V to vi) | m7 | F Aeolian | ✓ |
| 2–4 | B♭m7 E♭7 A♭Maj7 | ii–V–I | m4, D4, M3 | B♭ Dorian, E♭ Mixolydian, A♭ Ionian | ✓ |
| 5 | D♭Maj7 | IV | M4 | D♭ Lydian | ✓ |
| 6–8 | Dm7 G7 CMaj7 | ii–V opening a C major area; its tonic | m4, D4, M3 | D Dorian, G Mixolydian, C Ionian | ✓ |
| 9 | Cm7 | in the C area, a borrowed minor chord (C minor in C major), not iii of A♭ | m8 | C Dorian | ✓ |
| 10–12 | Fm7 B♭7 E♭Maj7 | ii–V opening an E♭ area (E♭Maj7 isn't diatonic to A♭); its tonic | m4, D4, M3 | F Dorian, B♭ Mixolydian, E♭ Ionian | ✓ |
| 13 | A♭Maj7 | IV of the E♭ area | M4 | A♭ Lydian | ✓ |
| 14–16 | Aø7 D7 GMaj7 | iiø7–V opening a G area; its tonic | h2, D4, M3 | A Locrian, D Mixolydian, G Ionian | ✓ |
| 17–20 | Am7 D7 GMaj7 | ii–V–I in G | m4, D4, M3 | A Dorian, D Mixolydian, G Ionian | ✓ |
| 21–23 | F♯ø7 B7 EMaj7 | iiø7–V opening an E area; its tonic | h2, D4, M3 | F♯ Locrian, B Mixolydian, E Ionian | ✓ |
| 24 | C7♯5 | → Fm7, vi of the global key: V7/vi in A♭ (§5.3); ♯5 pinned, ♭9 in the key | D1+D4 | C Altered | ✓ |
| 25 | Fm7 | vi again, not the tonic of an F minor area (§5.3) | m7 | F Aeolian | ✓ (Dorian before the §5.3 refinement) |
| 26–29 | as bars 2–5 | | | | ✓ |
| 30 | G♭13 | ♭VII7, non-resolving, 13 pinned | D5 | G♭ Lydian Dominant | ✓ |
| 31 | Cm7 | iii, passing down to B°7 and B♭m7 | m9 | C Phrygian | ✓ (R4) |
| 32 | B°7 | passing diminished, hiding B♭7♭9 (the E♭7's dominant, B♭m7 its ii) | d1 (R3b) | B Diatonic Dim. (ascending pattern: M&H fig. 7.22's ♭III°7 in A♭) | ✓ |
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

### Giant Steps (`key: Eb`)

The chart's `key: Eb` is arbitrary: the tune has three tonal centres (B, G, E♭) a major third apart, and the sources
disagree on a home key (Levine p. 95 gives B; N&G p. 163 says no home key). The analyser reports areas in all
three and reads each ii–V or V–I inside its own area, so no scale depends on which is "home".

### What the three standards changed

They were chosen to hit rules the first fourteen charts never reached, and they found four things:

1. **§5.3, returning to the global key.** As first written, `C7♯5 → Fm7` after the E major bridge of All the
   Things opened an F minor area, making bar 25's Fm7 a tonic (Dorian) while bar 1's identical Fm7 was vi
   (Aeolian). A cadence into a chord diatonic to the global key now returns there. No earlier chart changes:
   Autumn Leaves' B♭Maj7 is ♭III of G minor, and reads the same either way.
2. **D8, dominant chains into a minor tonic.** Stella's `Aø7 D7♭9 | G7♯5 | Cm7` made D7♭9 Half-Whole under D3
   (natural tensions for an extended dominant), a bright sound in the darkest bar of the tune. A chain that ends
   on a minor tonic now derives each link from that key: Phrygian Dominant. The Rhythm Changes bridge, which ends
   on B♭ major, is unchanged.
3. **m9, iii → Dorian.** Three iii chords (Stella's Dm7, All the Things' Cm7 twice) and I'd have played Dorian on
   every one. The diatonic scale, Phrygian, has its one distinctive note a half step above the root. Decision 8 is
   withdrawn: iii is Dorian, and Phrygian stays in the menu and in the modes chart, where it belongs.
   *(Reversed in the second pass: the sources put iii7 on Phrygian, Dorian at Advanced; §7.3, decision 8.)*
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
   Advanced level. Half-Whole stays the answer when the symbol says `13♭9`. Altered is the Advanced rung of the whole
   Phrygian Dominant ladder (R5; Levine pp. 75–76, M&H p. 95), Spanish Phrygian stays in the `7` menu.
2. **V7/ii in a major key, no ♭9 written (`D7 → Gm7` in F): Mixolydian ♭6, Phrygian Dominant, or plain
   Mixolydian?** *Mixolydian ♭6*, by derivation (the 9 is the key's 7th; the 13 is not in the key). Berklee's
   table says the same (N&G's table says the same; M&H pp. 45–46 prefer the ♯9/♭13 form and Levine p. 66 calls
   Mixolydian ♭6 "seldom played"). Many players simply alter it; that's Advanced.
3. **A V7 after its own tonic, in a bass line (`Gm D7/F♯ Fm7`): treat as V7 of the chord before?** *Yes.* It is
   heard as the dominant of the Gm it leaves. The alternative, "non-resolving, derive from the key", gives the
   same scale here (G minor, natural minor: ♭9 ♭13) but a different reason.
4. **The blues chords: IV7 Lydian Dominant or Mixolydian?** ~~*Lydian Dominant.*~~ **Revised (R2): Mixolydian**, and
   since rules v2 (D9, M6, m10, s4) every I, IV and V of a blues is Mixolydian (a minor blues' i and iv Dorian), the
   key's Blues scale at Basic. The
   first answer was Lydian Dominant, the ♯11 (E over B♭7 in F) being the key's major 7th. The sources write the
   blues IV7 as Mixolydian (N&G p. 105; M&H pp. 93, 125), which is what most people play, so principle 4 yields
   for the blues subdominant, exactly the exception this entry foresaw; the I7 is decided by D9 before D3 (M&H
   p. 137). Lydian Dominant stays in the `7` menu, and the back-door ♭VII7 and Rhythm Changes' IV7 (not a blues) stay
   Lydian Dominant; the Bird Blues' bar 5 B♭7 is Mixolydian once the chart says `context: blues` (§5.4).
5. **The Bird Blues chain (bars 6–8): analyse each pair, or treat the chain as passing ii–Vs (all Mixolydian)?**
   *Analyse each.* E♭7 is a back door, D7 is V7/ii, D♭7 is a tritone sub, and each has a reason. The counter-case:
   at bebop tempo nobody hears the difference, and the current chart's uniform Mixolydian reads cleaner on the
   page. If you choose "passing", the rule is: a chain of three or more ii–Vs descending by half steps is passing
   throughout.
6. **Extended dominants (the Rhythm bridge): Mixolydian for all, or derive each from the key?** *Mixolydian for
   all* (D3). Deriving would make D7 Phrygian Dominant (V7/vi of B♭), G7 Mixolydian ♭6, C7 Mixolydian, F7
   Mixolydian: accurate to the key, but the bridge is heard as a dominant sequence, and the chart agrees with D3.
   N&G p. 54 says the same; M&H and Levine name no scale.
7. **The tonic minor: Dorian (jazz convention) or Aeolian (the diatonic answer)?** *Dorian.* It matches every
   minor-key chart we have and the quality default. Aeolian is the natural-minor truth and should be the Basic
   level's choice for a tonic minor in the ladder (§11), since beginners are taught the natural minor first.

Two smaller ones:

8. ~~**iii7 → Phrygian.**~~ Withdrawn after the three standards (§9, item 3), **reinstated by the second pass (R4):**
   iii7 is Phrygian at Standard (N&G p. 33; M&H p. 23; Chediak vol. 2 p. 48), Dorian at Advanced; also as a related
   ii (M&H p. 57). It is principle 7 deciding a split the sources do not: the diatonic scale at Standard.
9. ~~**ø7 in a modal tune → Locrian ♮2** (h1).~~ **Dropped (R6).** No modal chapter in the sources has a ø7 (N&G
   p. 153; M&H pp. 187, 194), so a modal ø7 is Locrian through h2 and ♮2 is its Advanced rung. A chart can `# keep:`
   the ♮2 (a taste, as this entry recorded).
10. **The back door's target: tonicized or not?** Stella's `B♭m7 E♭7 → FMaj7` lands on a major chord that isn't
    diatonic to B♭. If the back door counts as a cadence, FMaj7 is a tonic (Ionian); if not, it's a chromatic major
    chord in B♭ (Lydian, M4). *Lydian.* The back door is a colour cadence that stays in the key, and F Lydian is
    B♭'s own notes. Lady Bird's back doors land on I and are unaffected either way.

Decisions of the second pass (sources: `docs/research/2026-10-jazz-theory-vs-engine.md` §5, appendices A1, A2, D, E;
the user decided Q1–Q6 on 2026-10-10):

11. **IV after its own dominant → Ionian** (R1; §7.2). N&G p. 47, Levine p. 120. Lydian is the Advanced rung.
12. **The °7 takes its function's diatonic diminished scale** (R3; §7.4). Berklee's key-derived scales at Standard,
    Whole-Half at Basic and Advanced, Harmonic Minor a further option. Q1: ♭III°7 takes M&H fig. 7.22 (fig. 7.23
    optional); Q2: I°7 the first of fig. 7.31 (the second optional); Q5: °7s the figures do not cover keep
    Whole-Half, reason "not functioning diatonically: the symmetric scale" (N&G p. 114); Q6: ♯IV°7 → I takes
    fig. 7.13 (fig. 7.14 optional); a °7 is ascending a half step below the next chord's root or its bass (R16; by
    the bass, ♯II°7 → I/3, fig. 7.9). The sources split on ♭III°7 (N&G p. 116 by enharmonic equivalence with ♯II°7;
    M&H fig. 7.22): M&H, with the equivalent lettering where no clean spelling exists (R9).
13. **A rung holds one scale** (Q3, R5). Altered is the Advanced rung of Phrygian Dominant, so Spanish Phrygian
    stays in the menu only.
14. **A per-quality rung overrides the ladder** (Q4, R4): an `m7` or `m` on Phrygian is Dorian at Advanced, not
    Dorian ♭2, so a minor-key v7 and a related iii climb to Dorian; `m6` on Melodic Minor stays there at Advanced,
    since Harmonic Minor's ♭6 would clash with its 6th (R6).
15. **Tonic m6 → Melodic Minor, ♭VII of a minor key → Ionian** (R6): M&H pp. 85–86, Chediak vol. 1 p. 341; N&G p. 91.
16. **A chart comment is at most 120 characters** (`LIMITS.maxMeta`; R7). A reason longer than that drops its
    "(X its ii)" aside first, then is cut with "…"; the longer reason stays in the Why note.
17. **Jobim's tunes follow the *Songbook Tom Jobim*** (Lumiar), the user's decision: Wave in full (R12),
    The Girl from Ipanema's bars 7–8 and bridge, with Solar opening on CmMaj7 as the usual lead sheet reads.

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
| Phrygian Dominant | 4 Minor Pentatonic | Altered (Spanish Phrygian stays in the `7` menu) |
| Half-Whole | Major Pentatonic | Altered |
| Altered | ♭5 Major Pentatonic | Half-Whole |
| Whole Tone | | Altered |
| Dorian | Minor Pentatonic | Bebop Dorian |
| Dorian (tonic minor) | Aeolian, then Minor Pentatonic? see decision 7 | Melodic Minor |
| Aeolian | Minor Pentatonic | |
| Phrygian | Minor Pentatonic | Dorian ♭2 (for a sus ♭9); Dorian for `m7` and `m` (`quality_ladders`) |
| Melodic Minor | Minor Pentatonic | Harmonic Minor (for `m6`, stays Melodic Minor: `quality_ladders`) |
| Locrian | ♭6 Major Pentatonic | Locrian ♮2 |
| Locrian ♮2 | ♭6 Major Pentatonic | |
| Whole-Half | | ♭2 Harmonic Minor |
| Each diatonic diminished scale (ascending, ♯IV, ♭III, ♭VI, I, V and their optional forms) | Whole-Half | Whole-Half |
| Explicit colours (Blues, pentatonics, bebop scales) | the root's pentatonic | |

"4 Minor Pentatonic" over a dominant is the classic beginner's move: G minor pentatonic over the whole
`Aø7 D7 Gm`, which lands ♭13, ♯9 and 11 on the D7 without naming them.

Random keeps picking among the quality's inside options; the ladder doesn't change it.

Built (after the analyser) as a `ladders` table in `chord_scales.json` beside the `level` tags rather than
replacing them: a row whose Standard is its quality's default keeps the tags (so nothing built before changes,
and `7sus4`'s Mixolydian keeps its own rungs), and a row whose Standard the analysis chose climbs that scale's
ladder (`engine/levels.ts`, `ladderScale`), after the chord quality's own override in `quality_ladders` (`m` and
`m7` on Phrygian: Dorian at Advanced; `m6` on Melodic Minor: Melodic Minor); the override is keyed by the chord's own
quality, not by a slash reading. The default is compared by pitch: a Standard the analysis only respelled (G♭°7's
F♯ Whole-Half, R9) is still the default, and keeps its spelling at Basic and Advanced. Scales that fit one function
only (the diatonic diminished family) carry `functional: true` and are never dealt by Random, which picks among the
quality's other inside options. A tonic minor chord (rule m5) is Aeolian at Basic (decision 7), and a blues chord
(D9, M6, m10, s4) plays the key's Blues scale at Basic: the level control runs the analysis on the chart to find those
rows. Lydian's and Lydian Dominant's Advanced rungs are blank, as in
the table.

## 12. The tool

A script, not a page: `npm run analyse -- charts/<tune>.txt`. The site is untouched.

- **Report** (default): the key and key areas found, then one line per row: bar, chord, function, the scale the
  rules give, the reason, and the chart's current scale where it differs (`≠ D Half-Whole`). Rows the rules
  couldn't reach are marked `?`.
> Since the [proposed scales spec](superpowers/specs/2026-10-11-proposed-scales-design.md), a blank scale cell plays
> the analysis, so `--write` and `--force` are gone; `--strip` blanks the written scales the rules reproduce
> (never a `# keep:` row). See docs/design.md §7a.

- `--save`: writes the analysis into the chart as comments (§12.1), alongside `--write` or on its own.
- `--write`: fills **blank** scale cells only, leaving every written scale as it is. The usual way to add a chart:
  write the chords, run `--write`, read the report, fix the chart or the rules.
- `--force`: rewrites every cell the rules reach, so a chart can be brought back into line with the rules after
  they change. The report shows what moved. Explicit choices you want to protect get a `# keep` comment on the
  line above (the analyser leaves the next row alone).
- `--all`: runs the report over every chart in `charts/`, for the regression check in §13.
- **Hints in the chart:** an optional `key: Gm` meta line fixes the global key when the scoring would get it wrong
  (a tune that ends away from home); `bars: 32` fixes the form length when the last chord's duration matters;
  `context: modal` (`functional`, `modal`, `blues`) fixes the context when the detection would get it wrong (§5.4),
  and `@context SECTION BAR VALUE`, parsed but not yet used, will fix it for a span. All are meta lines or
  directives the site ignores. The report's second line says which context decided: `context: blues (stated)` or
  `context: functional (detected: 9 of 12 chords in cadences, median chord 1 bar)`.

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
- **Area lines** (`# area: …`) and the **header line** (`# analysis: date, rules version; key, context`) are
  ordinary comment lines. The analyser writes scales and comments only: never a `key:`, a `context:`, a function or
  an `@key`; those are the author's (`context:` and `@context` sit in the header and among the rows, §5.4). The header lets `--all` report which charts were analysed under older rules.
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
| D8 includes the chain's last link | Stella, `G7♯5 → Cm7` | G Whole Tone (V7/ii in B♭) | G Altered (§9's verdict) |
| A ♯11 written alone pins the natural 9 and 13 | `D7♯11` resolving to a minor chord | Altered | Lydian Dominant |
| A minor ii of the next ii–V opens no area | Bird Blues, `Dm7 G7 \| Cm7 F7 \| B♭7` | G Phrygian Dominant (V7 of C minor) | G Mixolydian (V7/V, as §9 has it) |
| A cadence into the home tonic comes home | Long Ago and Far Away, `Gm7 C7 \| FMaj7` after a bridge in C | F Lydian (IV of C) | F Ionian |
| In a minor key, a ii–V–I into a major chord tonicizes it | Bernie's Tune's bridge (B♭ in D minor) | `G7 → Cm7` as "V7/♭vii in D minor" | V7/ii in B♭, Mixolydian ♭6 |
| Intros, codas, tags and endings sit outside the form | A Night in Tunisia's interlude, Moment's Notice's tag | the form's last chord resolved into the tag | the form wraps to its own top; each such section is analysed around it |
| In a major area, a ii–V that doesn't land but implies a chord of the home key brings it back | Lady Bird's `Am7 D7` after the A♭ section | ii–V "of VII in A♭" | ii7/V V7/V in C (same scales); Old Devil Moon's and Unit Seven's last A sections home again |
| A section that starts on the home tonic is home again | Nardis' last A, after a bridge in C, with no cadence back | C Ionian, A Aeolian (in C) | C Lydian, A Dorian (in E minor) |
| A turnaround into the top carries its key into bar 1 | Giant Steps, `F♯7 \| BMaj7` | B Lydian | B Ionian |
| An implied ii–V target counts when its triad is in the key | There Will Never Be Another You, `Cm7 F7♯11` | passing ii–V | V7/V in E♭ |
| A form without a stated length rounds up to four bars | Footprints (12 bars, last chord two) | read functional | modal (F♯ø7 Locrian ♮2, as the chart had it; Locrian after h1 was dropped) |
| The second pass, from the sources (R1–R6) | Stella's `Bb7 \| EbMaj7`; the blues IV7; the °7s; iii7; V7 → minor; m6 | E♭ Lydian; B♭ Lydian Dominant; Whole-Half; Dorian; Spanish Phrygian at Advanced; Dorian | E♭ Ionian (R1); B♭ Mixolydian (R2); the diatonic diminished scales (R3); Phrygian (R4); Altered at Advanced (R5); tonic m6 Melodic Minor, ♭VII of minor Ionian, h1 dropped (R6) |
| A rung can hold only one scale | Phrygian Dominant's Advanced rung | Spanish Phrygian | Altered (Q3) |
| A °7 spells cleanly on its own root | Eb°7 ascending, B°7 in A♭ (♭III°7) | double accidentals on the sheet | the root `simplifyRoot` spells best; the equivalent figure's lettering where none is clean (R9) |

After these, the hand-scaled charts agree with the rules on every row except the decisions in §10 (now applied to
the charts) and Milestones' Aeolian bridge (kept, `# keep:`). The cookbook's 222 charts were filled from the rules
(`--force --save`). Where a `@copy` repeat's function differed from its source row's, the repeat is written out
(Epistrophy's last section); the section-start rule settled Nardis'.

Four `key:` lines from the book's index were wrong for its own lead sheets (This I Dig of You, Voyage, Snapper,
Bernie's Tune) and are corrected, with a comment. Key scoring alone (§5.2) is weak on these tunes: it disagrees
with the stated key on about a quarter of them, mostly by choosing a relative minor or a key a step away; every
library chart states its key, so this affects only charts written without one.


# Blues-aware analysis

Date: 2026-10-18. Status: draft for review.

## Why

The library is about to take iReal Pro's Blues 50 playlist (Chicago, Delta and jump blues: 9-, 13-, 16-, 46-bar forms
as well as 12-bar). Today the analysis reads a blues as a jazz tune with a few exceptions:

- a major triad in a blues gets the major rules (the IV triad is Lydian, M4/M5);
- the V7 that doesn't resolve (bar 9) is a fallback, "V7 in F, not resolving", and a ❓ in every import;
- a minor blues takes the minor-key rules (docs/plan-analysis.md §5.4 says so on purpose);
- no level reaches the Blues scale: Basic of Mixolydian is Major Pentatonic;
- only 12- and 24-bar forms (and 12-12-8-12) are detected; the rest of Blues 50 isn't read as a blues at all.

The goal: a chart read as a blues gets blues scales at every level, a step per level, and no false ❓ questions; a
chart can say it is a blues whatever its form.

## What the player gets

| Level | Over the blues chords (I, IV, V and, in a minor blues, i and iv) |
|---|---|
| Basic | the tune's Blues scale (`1 ♭3 4 ♭5 5 ♭7`) on the key note, over every one of them: E Blues over E7, A7 and B7 |
| Standard | each chord's own scale: Mixolydian on the dominants and triads, Dorian on a minor blues' i and iv |
| Advanced | the existing ladder from the Standard scale: Mixolydian → Bebop Dominant, Dorian → its ladder |

Chords that leave the blues (a ii–V, a turnaround's VI7 or ♭III7, a passing diminished, a tritone sub) keep the rules
they have now, at every level.

The Blues scale keeps its ♭5 spelling. No major blues scale is added.

## 1. How a chart becomes a blues

- `context: blues` in the chart's header, as 11 library charts already have. No new header key.
- The 12-bar detector (`bluesTest`, `engine/src/analysis/keys.ts`) is unchanged: a stated context still wins over it.
- `style:` still has no effect on the analysis (Footprints, Limehouse Blues and Willow Weep for Me are styled Blues and
  are not blues).
- `csm add` writes `context: blues` when the iReal song's style contains "Blues", and takes a new
  `--context <auto|functional|modal|blues>` (`auto` writes no `context:` line).
- Section-level `context:` stays "not yet supported" (out of scope).

## 2. The rules (Standard)

A chord is **a blues chord** when the chart's context is blues, the chord is in the global key (not under an `@key` or
section `key:`), and its root is the key's I, IV or V. Each rule below applies only to a blues chord with no written
scale and no stated function; a written scale or a stated function still wins, as everywhere.

| Rule | Chord | Scale | Reason (as the Why note reads) |
|---|---|---|---|
| D9 | a dominant 7th on I, IV or V (V only in a major key) | Mixolydian (written tensions still move it, D1+) | "I7 of the blues: a tonic with dominant colour" · "IV7 of the blues: …" · "V7 of the blues: …" |
| M6 | a major triad, 6 or 6/9 on I, IV or V | Mixolydian | "IV of the blues: a triad here implies its ♭7" |
| m10 | a minor triad, m7 or m6 on i or iv, in a minor key | Dorian | "i of the minor blues: Dorian" |
| s4 | a sus chord on I, IV or V | Mixolydian | "V7sus of the blues: Mixolydian" |

Order and precedence:

- D9 takes the place of D5's blues clause (D5 keeps the back door and the unresolved diatonic dominant). Like today's
  D5 it is decided by degree before the chords around it, so a blues I7 before its IV7 is not an extended dominant. A
  stated function that names a target (V7/IV) still goes the usual way.
- A V7 that resolves (a ii–V–I inside a jazz blues) keeps D4: in a major key its tensions from the key are the
  Mixolydian ones, so the scale doesn't change; only the unresolved V7 moves from the D5 fallback to D9, and it is no
  longer a fallback (no ❓).
- A maj7 or mMaj7 chord is not a blues chord (the symbol says the 7th is major): the major and minor rules keep it.
- A minor blues' V7 keeps the minor-key rules (D4 from the minor key: Phrygian Dominant).
- In a minor key, a major triad on I (All Your Love's E major section in E minor) is still a blues chord: M6.

`RULES` (`engine/src/analysis/rules.ts`) gets the four rows (D9 tier 3, M6 tier 2, m10 tier 2, s4 tier 2) and D5's
summary and scale drop the blues clause. `RULES_VERSION` goes to 2.

## 3. Levels

In `engine/src/levels.ts`, beside the m5 special case: at Basic, a row whose rule is D9, M6, m10 or s4 plays
`<key note> Blues` (the global key's tonic, spelled by `simplifyRoot`). Standard plays the analysis; Advanced takes the
ladder from the Standard scale as now. `chord_scales.json` is unchanged.

## 4. Chart format

- No new header key; `context: blues` (existing) is the switch.
- README "Charts" gains a line: `context: blues` for a blues whatever its form; the detector covers 12- and 24-bar
  forms by itself.
- The editor's raw-text help tip names `context:` and its values.

## 5. UI

- **Read as** in the editor's heading fields (`web/app/components/ChartHeadingFields.vue`, folded with composer,
  style and form): a `UiListbox` labelled "Read as" with Auto · Functional · Modal · Blues. Auto removes the
  `context:` line; the others write it (`setMeta`). It shows the stated value, or Auto when there is none.
- **Why note** (`ChangesNote.vue`): the rule's reason as above; at Basic, for a D9/M6/m10/s4 row, a second line:
  "Basic: the E Blues scale over the whole blues".
- **/functions** lists the four new rules from `RULES` (no page change).
- **How it decides** gets a "Blues" section under Scales (`DecisionSection id="scale.blues"`), with a `DECISIONS` row
  in `engine/src/decisions.ts`.
- **Help**: one sentence on Read as, under the editor's heading fields.
- **Release note** in `web/app/utils/releaseNotes.ts`.

No feature flag: as with every rule change, the golden fixture's diff is the gate.

## 6. Docs

- `docs/plan-analysis.md`: §5.4's context table (blues row: the four rules), §7 (each family's blues rule), §8's
  one-page list, §10 Decision #4 (IV7 in a blues) extended to the blues chords, §11 levels (the Basic override), §9's
  F blues examples re-read.
- `docs/design.md` if it names the levels' special cases.

## 7. Library impact

- About 40 charts analyse as blues today (31 of the 32 styled Blues, plus 9 detected or stated). Their Basic changes on
  every blues chord; their Standard changes where a triad was Lydian/Ionian (west-coast-blues, unit-seven,
  your-mind-is-on-vacation) and where a bar-9 V7 was a fallback (10 rows: the reason changes, the scale doesn't).
- After the rules: `make golden`, read `engine/fixtures/analysis.json`'s diff, then
  `cd engine && npm run analyse -- --all --strip --save` to re-save the reasons at rules v2 and blank any written scale
  the new rules now give. `make og` is unaffected (no chart changes its title).

## 8. Tests

Engine, test first (`engine/src/__tests__/`):

- D9: a 12-bar blues in F: F7, B♭7, C7 all D9 Mixolydian; the bar-9 C7 not a fallback; F7 before B♭7 not D3.
- D9 with a written tension (F7#9): D1+ moves it.
- A stated `V7/IV` on the I7 goes to D4, not D9.
- M6: a blues of triads (E A B): Mixolydian on each; Emaj7 in the same chart keeps the major rules.
- m10: a minor blues in C minor: Cm7 and Fm7 Dorian; G7 keeps the minor-key D4 (Phrygian Dominant).
- s4: C7sus in an F blues: Mixolydian.
- A chord under `@key` inside a blues chart: the ordinary rules.
- A ii–V–I inside a jazz blues (Gm7 C7 F7): Gm7 and C7 keep their rules.
- A 13-bar form with `context: blues` reads as a blues; the same chart without it does not.
- Levels: Basic over a blues plays the key's Blues scale on every D9/M6/m10/s4 row and the ladder elsewhere; Advanced
  of a D9 row is Bebop Dominant.
- `ambiguities`: a blues chart's unresolved V7 is no longer listed.

CLI: `csm add` writes `context: blues` from a Blues style; `--context auto` writes none.

Web: `ChartHeadingFields` writes and removes `context:`; the Why note's Basic line. E2e: choosing Read as Blues on a
13-bar chart changes a triad's scale label to Mixolydian; at Basic the labels read the key's Blues scale.

## Out of scope

- Section-level `context:` (one section a blues, another not).
- A major blues scale; spelling the blue note ♯4 when a line climbs.
- The Blues 50 import itself: a follow-up PR once this has merged, with its composers corrected (`--composer`) and
  `source: iReal Pro`.

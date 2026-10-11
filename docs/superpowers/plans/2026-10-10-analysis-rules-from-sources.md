# Analysis Rules from the Sources Implementation Plan (PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the scale rules to what the primary sources prescribe (R1–R6), with the °7 "diatonic diminished" family at Standard, in the spec's reviewable commit order.

**Architecture:** Rule changes in `web/engine/analysis/rules.ts` (and `RULES`), new degree formulas in `SCALES` (`web/engine/scales.ts`), ladder changes in `chord_scales.json`, and one new ladder mechanism — a per-quality override (`quality_ladders`) read by `ladderScale` in `web/engine/levels.ts`. Every rule change is test-first, followed by `analyse --all --force --save` and `make golden`, with both diffs read.

**Tech Stack:** TypeScript engine (`web/engine/`), `chord_scales.json`, Vitest, the `fixture-scales` script from PR 1.

**Spec:** docs/superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md (with docs/research/2026-10-jazz-theory-vs-engine.md and appendices A1, A2, D, E). Branch `analysis-rules`, from main after PR 1 (#99) merged.

## Global Constraints

- No principle in docs/plan-analysis.md §2 changes; principle 7 (diatonic at Standard, hipper at Advanced) decides every split.
- Scales come from degree formulas in `SCALES`; never hand-typed note lists (CLAUDE.md).
- After every engine or chart change: `cd web && npm run analyse -- --all --force --save`, `make golden`, read both diffs. `--force --save` may rewrite deliberately written scales in `modes_of_major`, `modes_of_melodic_minor` and `maiden_voyage`: revert those chart edits (`git checkout charts/<file>`) unless the change is the rule's intended effect, and list what was reverted.
- `npm run fixture-scales -- <ref>` (from PR 1) lists every scale that changed against a ref; use it after each rule to confirm only that rule's chords moved.
- Commit order is the spec's §4: text only first, then each rule alone, then R3b, then R5/charts/docs.
- web/engine free of Vue/DOM; no new runtime deps; hashed CSP untouched.
- Where the spec is silent and this plan doesn't rule, stop and ask.
- Stage by name; never `git add -A` (iCloud `* 2.*` copies). Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push until the user says so.

## Decisions (Q1–Q5 decided by the user, 2026-10-10)

The figures were read from the page images (M&H pp. 156–161 = PDF 168–173). Note: the spec's figure numbers are off for ♭III°7 — the ♭III°7 scales are figs. 7.22–7.24 (pp. 156–157); fig. 7.26 is ♭VI°7 as an approach chord, fig. 7.27 its scale.

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| Q1 | ♭III°7 (C: E♭°7) | (a) fig. 7.22 "E♭ Diatonic Diminished": E♭ E G♭ G A B C D (`1 #1 b3 3 #4 #5 6 7`); (b) fig. 7.23 "Optional", also fig. 7.24: E♭ F G♭ G A B C D (`1 2 b3 3 #4 #5 6 7`), adds the 9 (F, common with the goal ii) | **Decided (user): (a)** at Standard; (b) as a menu option (`diatonic diminished biii optional`, `1 2 b3 3 #4 #5 6 7`) |
| Q2 | I°7 (auxiliary on the tonic) | fig. 7.31 gives two, "both possible": (a) C D E♭ E G♭ G A B (`1 2 b3 3 b5 5 6 7`), which keeps the tonic's 3rd E as a passing tone; (b) C D E♭ F G♭ G A B (`1 2 b3 4 b5 5 6 7`), with the 11 | **Decided (user): (a)** at Standard; (b) as a menu option (`diatonic diminished i optional`, `1 2 b3 4 b5 5 6 7`) |
| Q3 | R5 "Altered beside Spanish Phrygian" | a ladder rung holds one scale. (a) Altered becomes the Advanced rung on Phrygian Dominant (Levine's default; research §2: "Levine decides what the Advanced rung should offer"), Spanish Phrygian stays in the `7` menu; (b) keep Spanish Phrygian as the rung and add Altered to the menu note only; (c) let a rung hold a list (the Level control applies the first; both listed) | **Decided (user): (a)** |
| Q4 | R4's per-quality rung | an `m7` on Phrygian also covers v of a minor key (m7) and iii as related ii: their Advanced becomes Dorian, not Dorian ♭2 | **Decided (user): accept** — Dorian ♭2 (♮6 over a minor-key v) is not that chord's colour either |
| Q5 | °7s the figures don't cover: auxiliary on roots other than I and V; descending/passing on roots other than ♭III and ♭VI; passing/auxiliary in a minor key | (a) Whole-Half at Standard ("not functioning diatonically": N&G p. 114's own criterion for the symmetric scale); (b) chord tones plus the key's notes, derived; (c) stop | **Decided (user): (a)**, with the reason saying so ("not functioning diatonically: the symmetric scale") |

Rulings already taken in this plan (cost if wrong in brackets):
- **Ascending spelling.** The spec's formula `1 b2 b3 3 b5 b6 6 7` spells C♯°7 as C♯ D E E♯ G A A♯ B♯; its own example is C♯ D E F G A B♭ C. Same pitches; use the spelling that gives the example: `1 b2 b3 b4 b5 b6 bb7 b8` (verified: C♯, F♯, G♯, B all spell with the key's letters). [a formula string]
- **Names.** One family, the function as a suffix, so a chart row reads e.g. `Bb Diatonic Diminished bVI`: `SCALES` keys `diatonic diminished` (ascending; alias `leading tone diminished`), `diatonic diminished biii`, `diatonic diminished bvi`, `diatonic diminished i`, `diatonic diminished v`; printed labels `Diatonic Dim.`, `Diatonic Dim. (♭III°7)`, `Diatonic Dim. (♭VI°7)`, `Diatonic Dim. (I°7)`, `Diatonic Dim. (V°7)`. [renaming later rewrites charts]
- **dim7 quality default stays Whole-Half.** The diatonic scales depend on function and key, so no quality default can hold them; the analysis writes them. Because the Standard then differs from the default, the Level control climbs the new scales' ladders. [none]

## Review Focus

1. **Library °7 rows:** every one must match a figure (or Q5's fallback). → Task 6 lists every °7 row in the golden diff with its figure.
2. **Level control on the new scales:** Basic stays Whole-Half (today's Basic), Advanced Whole-Half, and Harmonic Minor stays in the menu. → Task 6 levels test.
3. **iii7 at Advanced is Dorian, and sus ♭9 at Advanced is still Dorian ♭2:** the per-quality override must not leak into `7sus4b9`. → Task 4 test.
4. **Blues I7 never reasoned by D3:** every library blues. → Task 3 library test.
5. **A stated function or `# keep:` scale still wins** over every changed rule (principle 1). → Tasks 2–5: one test each with a `# keep:` row.

---

### Task 1: Text only (R3a, R6's reason rewordings, the `chord_scales.json` note)

**Files:** `web/engine/analysis/rules.ts` (d1, m7, h2, m5, s2 reasons), `chord_scales.json` (the m/m7 Aeolian note), `web/engine/__tests__/analysis.test.ts`, fixtures and charts via regeneration.

- [ ] Tests first (exact strings from the spec): d1 `vii°7 of Dm7: A7♭9 without its root`; Wave `key: D` bars 1–3 (`DMaj7 | Bbdim7 | Am7 D7`) → `passing diminished: A7♭9 without its A, the D7's dominant (Am7 its ii)`; auxiliary → `auxiliary diminished: it decorates the chord and returns to it`; fallback `passing diminished: a rootless dominant ♭9`. m7 vi `vi: Aeolian, the key's own notes (the ♭6 is a passing note)`; m7 v of minor `v of a minor key: Phrygian, the key's own notes (its ♭2 is a passing note)`; h2 `iiø7 of G minor: Locrian, the key's own notes (its ♭2 is a passing note)` (for `Am7b5 | D7 | Gm7`); m5 without "(Aeolian at Basic? see §11)"; s2 `V7sus4 resolving down a fifth: Mixolydian, the 4th is a chord tone here`. Each also asserts the scale and rule id are unchanged. Watch them fail.
- [ ] The hidden-dominant search for passing °7 (R3a): for each of the °7's four notes n, the dominant a half step below n (root n − 1 semitone); pick the one that is the V of the next chord, or of the chord after the next when the next is its related ii. Write it as a small pure helper in rules.ts with its own unit tests (Wave → A7♭9; C♯°7 → Dm7 → A7♭9; no match → fallback string).
- [ ] Implement; `make test`; `analyse --all --force --save`; `make golden`; `npm run fixture-scales -- main` must print no changes (text only). Commit alone: "Analysis: reasons that name the dominant a °7 hides, and avoid notes as passing notes (text only)".

### Task 2: R1 — IV after its own dominant → Ionian (M3)

- [ ] Tests (spec R1): Stella `key: Bb` bars 5–7 → E♭ Ionian, M3, reason `the B♭7 before it makes E♭ the key of the moment: the 4th is in the key`; Moment's Notice bars 10–11 and 26–27 → A♭ Ionian; negative: All the Things bar 5 D♭ Lydian (M4); subV7/IV (`B7 | EbMaj7` in B♭: B is a half step above B♭? no — subV7/IV of E♭ is E7) → `E7 | EbMaj7` in B♭ → E♭ Ionian; a `# keep: Eb Lydian` row stays Lydian.
- [ ] Implement in `major()`: IV of the local key whose previous entry is a dominant a fifth above (`downFifth(prev, e)`) or a half step above (`downHalf(prev, e)`) → M3 Ionian with the reason. Update `RULES` (M3, M4 summaries).
- [ ] `make test`, regenerate, `fixture-scales` shows only IV-after-V7 rows (list them); commit alone.

### Task 3: R2 — the blues I7 and IV7 by D5 before D3

- [ ] Tests: F Jazz Blues `key: F` bar 1 `F7` → F Mixolydian, D5, reason `I7 of the blues: a tonic with dominant colour, natural tensions`; bar 5 `Bb7` → B♭ Mixolydian, D5, reason `IV7 of the blues: a subdominant with dominant colour, Mixolydian (the ♯11 is an extra colour)`; a library test: no I7 row of any detected blues is reasoned by D3; the `7` menu still lists Lydian Dominant.
- [ ] Implement in `dominant()`: when `ctx.blues` and the chord is its I7 or IV7, return D5 before the D2/D3/D7 checks; IV7's base slots NATURAL (Mixolydian), I7 as today. Keep D1 (symbol pins) first. Update `RULES` (D5, D3).
- [ ] Regenerate; `fixture-scales`: only blues IV7 rows change scale (Lydian Dominant → Mixolydian) and I7 rows change reason; list them; commit alone.

### Task 4: R4 — iii7 → Phrygian (m9), Dorian at Advanced via a per-quality rung

**Files:** `rules.ts` (m9), `chord_scales.json` (new top-level `quality_ladders`), `web/engine/levels.ts`, `web/engine/__tests__/levels.test.ts`.

- [ ] Tests: `key: C`, `Cmaj7 | Em7 | Am7 | Dm7 | G7` → E Phrygian, m9, reason `iii: Phrygian, the key's own notes (the ♭2 is a passing note)`; `Cmaj7 | Em7 | A7 | Dm7` → E Phrygian (related ii keeps the degree's scale — m4 must not override it for a diatonic iii; label `iii7` from PR 1); levels: `scaleAtLevel('Em7', 'advanced', 0, '', 'E Phrygian')` → `E Dorian`; `scaleAtLevel('G7sus4b9', 'advanced', 0, '', 'G Phrygian')` → still the sus ♭9's advanced (`G Dorian ♭2` via the quality's own option); `ladderScale('E Phrygian', 'advanced')` without a quality → `E Dorian b2` (unchanged).
- [ ] `chord_scales.json`: add `"quality_ladders": { "m7": { "Phrygian": { "advanced": ["1", "Dorian"] } } }` and a sentence in `$schema_note`: "quality_ladders: per-quality overrides of a ladder (m7 on Phrygian: Dorian at Advanced, where sus ♭9 keeps Dorian ♭2)".
- [ ] `levels.ts`:

```ts
const QUALITY_LADDERS: Readonly<Record<string, Readonly<Record<string, Readonly<{ basic?: Rung; advanced?: Rung }>>>>> = (raw as { quality_ladders?: never }).quality_ladders ?? {}
/** Basic or Advanced on a Standard scale's ladder (the chord quality's own override first) … */
export function ladderScale(standard: string, level: 'basic' | 'advanced', quality?: string): string | null {
  …
  const override = quality ? Object.entries(QUALITY_LADDERS[quality] ?? {}).find(([name]) => scaleKey(name) === s.key)?.[1]?.[level] : undefined
  const rung = override ?? LADDER_BY_KEY.get(s.key)?.[level]
  …
}
```

and `scaleAtLevel` passes the chord's resolved quality key (`resolveQuality(chord)?.quality` — check the field name in `qualities.ts`).
- [ ] Implement m9 (Phrygian) and the related-ii case (a diatonic iii before its V7/vi keeps m9's Phrygian rather than m4's Dorian). Update `RULES` (m9, m4).
- [ ] Regenerate; `fixture-scales`: only iii7 rows; commit alone. Rewrite plan §7.3's m9 paragraph in Task 8.

### Task 5: R6's rule changes (tonic m6, ♭VII in minor, drop h1)

- [ ] Tests: A Night in Tunisia `Dm6/9` (`key: Dm`) → D Melodic Minor, m2, reason `tonic minor sixth chord: melodic minor, the raised 7th is a tension`; Wave `Gm6` (iv6 in D; use a stream with `Gm6` after `DMaj7` if the chart doesn't have it yet) → G Dorian, reason `a minor sixth chord: Dorian`; `key: Cm`, `Cm7 | BbMaj7 | AbMaj7` → B♭ Ionian (M3, reason `♭VII of C minor: B♭ major, the notes of C Dorian`), A♭ Lydian; Footprints `F#m7b5` → F♯ Locrian via h2 (h1 gone); `RULES` no longer has h1 (the coverage test in catalogue.test.ts and rules.test.ts must still pass — adjust their expectations).
- [ ] m6 ladder: today `m6` options default Dorian with Melodic Minor at Advanced. For the tonic m6 the analysis writes Melodic Minor (≠ default) so the Melodic Minor ladder applies — check its rungs give sensible Basic/Advanced (Basic: Minor Pentatonic? report what they are; if Basic becomes something odd, add a `quality_ladders.m6."Melodic Minor"` override with Basic `["1","Dorian"]` and say so).
- [ ] Implement; update `RULES` (m2, M3, M4, remove h1); regenerate; `fixture-scales`: only these rows; commit (one commit per sub-rule is fine).

### Task 6: R3b — the diatonic diminished scales (needs Q1, Q2, Q5 answered)

**Files:** `web/engine/scales.ts` (SCALES, ALIASES), `chord_scales.json` (dim7 options; ladders for the five names), `rules.ts` (d1's scale by function), tests in `scales.test.ts`, `analysis.test.ts`, `levels.test.ts`.

- [ ] `SCALES` entries (formulas verified to spell as the figures):

```ts
  'diatonic diminished': ['1 b2 b3 b4 b5 b6 bb7 b8', 'Diatonic Dim.'],          // ascending vii°7 of X: X's V7(♭9 ♯9 ♭13) from the °7 root (N&G p. 115; M&H p. 152)
  'diatonic diminished biii': ['1 #1 b3 3 #4 #5 6 7', 'Diatonic Dim. (♭III°7)'], // M&H fig. 7.22 (Q1a) — or '1 2 b3 3 #4 #5 6 7' (Q1b, figs. 7.23–7.24)
  'diatonic diminished bvi': ['1 #1 #2 3 #4 #5 6 7', 'Diatonic Dim. (♭VI°7)'],  // M&H fig. 7.27 (Wave: B♭ B C♯ D E F♯ G A)
  'diatonic diminished i': ['1 2 b3 3 b5 5 6 7', 'Diatonic Dim. (I°7)'],        // M&H fig. 7.31, first (Q2a) — or '1 2 b3 4 b5 5 6 7' (Q2b)
  'diatonic diminished v': ['1 2 b3 4 b5 5 6 b7', 'Diatonic Dim. (V°7)'],       // M&H fig. 7.34
```

ALIASES: `'leading tone diminished': 'diatonic diminished'`. Tests in `scales.test.ts`: each spells from the figure's root to the figure's notes (C♯ → C♯ D E F G A B♭ C; E♭ → per Q1; B♭ (♭VI in D) → B♭ B C♯ D E F♯ G A; C → per Q2; G → G A B♭ C D♭ D E F).
- [ ] d1's scale by function in a major key: `vii°7 of X` → `diatonic diminished` on the °7 root; passing on ♭3 of the key → `… biii`; on ♭6 → `… bvi`; auxiliary on 1 → `… i`; on 5 → `… v`; anything else (and every non-ascending °7 in a minor key) → Q5's answer.
- [ ] `chord_scales.json`: `dim7` options keep Whole-Half as `default: true` (see the ruling), Harmonic Minor at `b2` without the `level` tag (a menu option), plus the five diatonic names as options with notes; `ladders` for each of the five names: `{ "basic": ["1", "Whole-Half Diminished"], "advanced": ["1", "Whole-Half Diminished"] }` (Basic unchanged, Advanced Whole-Half). Levels test: a row whose Standard is `Bb Diatonic Diminished bVI` → Basic and Advanced `Bb Whole-Half Diminished`.
- [ ] Wave `key: D` bar 2 → `Bb Diatonic Diminished bVI` (Standard), Whole-Half (Advanced); `Cmaj7 | C#dim7 | Dm7` → `C# Diatonic Diminished`; `Dm7 | G7 | Cdim7 | C6` → `C Diatonic Diminished i` (per Q2).
- [ ] Regenerate; list **every** °7 row in the golden diff (chart, bar, chord, function, new scale, the figure it follows or Q5); check each by hand against the figure; commit alone.

### Task 7: R5, the charts

- [ ] R5 per Q3. Test: `key: Cm`, `Dm7b5 | G7 | Cm7` → Standard G Phrygian Dominant; Advanced per Q3 (a: `G Altered`); the `7` menu lists Altered and Spanish Phrygian.
- [ ] Charts (spec §2), each edited, then `cd web && npm run analyse -- ../charts/<tune>.txt --write --save`, report read, `make golden`:
  - **Wave**: read the *Songbook Tom Jobim* pages for Wave (book pp. 109–110; find the PDF pages in `design/sources/Song-Book-Tom-Jobim-pdf.pdf` — view the images, don't trust OCR): bar 6 `Gm6`; bars 7–10 `F#7 | B7 | E7 | Bb7 A7`; carry tensions the format allows; B section as the chart has it unless the lead sheet clearly differs.
  - **The Girl from Ipanema** (book p. 61): bars 7–8 `Am7 Ab7 | Db7M(9) Gb7(#11)` (write in the chart's chord grammar, e.g. `DbMaj7`, `Gb7#11`); the bridge `F#Maj7 | B7 | F#m7 | D7 | Gm7 | Eb7 | Am7 | D7b9 | Gm7 | C7b9` (tensions as the format allows); renumber so the bridge doesn't overlap `@copy A1 A3 24`. Expected: Eb7 → E♭ Lydian Dominant (D6), D7b9 → D Phrygian Dominant, C7b9 → C Half-Whole.
  - **Solar**: bar 1 `CmMaj7` → C Melodic Minor (m1).
  - **Footprints**: leave the `F#m7b5` at Locrian (do not add `# keep:`); note it in the PR as the user's option.
  - If a songbook page is unreadable or contradicts the spec, stop and ask with the page image.

### Task 8: Docs and gates

- [ ] Docs per spec §3 (plan-analysis.md §5.3, §7.1–§7.4, §8, §9, §10.2/§10.4/§10.6 and new decision lines; docs/design.md: the rules on one page, the ladder changes and `quality_ladders`, the °7 scale family and that ♭III°7 follows M&H (fig. 7.22) where N&G p. 116 reaches it by enharmonic equivalence).
- [ ] `make test`, `make lint`, `make e2e`, `make golden` clean.
- [ ] PR description (controller): the golden diff summarised by rule id; every library chord whose scale changed, grouped by R-number (from `fixture-scales` per commit); every °7 row with its figure; the Q1–Q5 answers.

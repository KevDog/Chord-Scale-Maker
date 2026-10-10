# Functions and analysis rules: a help page

Date: 2026-10-10. Status: approved (decisions below are the user's; the last five rows and the `D8` rename added the
same day). Builds on
[2026-10-09-chart-functions-design.md](2026-10-09-chart-functions-design.md) and docs/plan-analysis.md.

## Goal

Two things a user cannot find today without reading the source:

1. **What a function is and how to write one.** A chord's fifth cell takes `V7/ii`, `subV7`, `iiø7/vi`, `D: V7/ii`
   and the like. Those spellings are not common outside analysis classes, and the editor's only guidance is the
   error message when one will not read.
2. **How the engine chose a scale, in terms a user can quote.** Every decision carries a rule id (`D4`, `m7`, `h2`)
   and a reason, but the reason alone does not say which rule fired or what would have changed it. A page that
   lists the rules, from the simplest to the most contextual, lets a user say "`m8` gave Dorian here; I expected
   `m4`" in an issue, instead of describing a sheet.

The page must not drift from the engine. Everything that can be computed from `web/engine/` is computed at
prerender time; only prose is written by hand.

## Decisions to take

| Question | Proposed |
| --- | --- |
| Where | One new page, `/functions`, linked from Help ("Editing" and "Odds and ends") and from the reason popover on the Changes sheet. Help stays the how-to; this page is the reference. |
| Flag | None. A static page under the existing CSP; no new runtime dependency. |
| Source of truth | The engine, imported directly by the page's composable at prerender. No generated JSON to keep fresh, no golden-style test for the page: the engine's own tests cover the content. |
| Reference key | A key picker (every major and minor key, default C major); the table is recomputed in the browser from the engine, since the engine ships to the browser already. Prerender C major. |
| Table layout | §1.2 is split into four groups — diatonic, secondary, substitutes and borrowings, chromatic — with a sticky sub-navigation. |
| The primed ids | `m7'` is renumbered `m9` (iii in major: Dorian) and `D3'` is renumbered `D8` (an extended dominant into a minor key), so every id is a letter and a number. `m8` stays as is. The golden fixture is regenerated. |
| Rule ids in the UI | Show the id after the reason in `ChangesNote` ("ii of the ii–V to C · rule m4"), and make it a link to the rule's row on `/functions`. Fallback decisions (`fallback: true`) say so: "rule m8, a guess — an `@key` or a function would settle it". |
| Where a disagreement goes | Both (decided after the repo went public): "Copy for an issue" copies the text, then offers the contact form or a new GitHub issue pre-filled with it. Most users will have no GitHub account, so the contact form comes first. |
| The reason note | It becomes a click-to-open panel (Headless UI `Popover`), no longer a hover tooltip: a tooltip can't hold the rule link or the copy button. Click or tap opens it; Escape or a click outside closes it. |
| Editor | The function cell's hint and its error message link to `/functions#writing` ("How to write a function"). |
| Help catch-up | "The preview controls" describes the Changes toolbar's Analysis and Guide Tones headings (from the guide tone lines work). |

## 1. What the page shows

### 1.1 Writing a function

Hand-written prose, kept short, with the grammar as the editor reads it (`FUNCTION_RE` in
`engine/analysis/functions.ts`):

```
[Key:] [sub] [♭|♯] NUMERAL [quality] [/ [♭|♯] NUMERAL]
```

- The numeral is relative to the row's key area, or to the key before a colon (`Eb: V7/ii`).
- Case follows the chord family: upper for major, dominant and sus; lower for minor, half-diminished and diminished.
  The editor corrects the case; it rejects a major quality on a lower-case numeral.
- The quality spellings accepted, and how the sheet writes them (`SUFFIXES`): a table generated from the engine,
  grouped by family — e.g. `maj7`, `Maj7`, `M7`, `maj` → `maj7`; `ø7`, `ø`, `m7b5` → `ø7`; `o7`, `o`, `dim7` → `°7`;
  `7sus4`, `7sus`, `sus` → `7sus`.
- `sub` goes only on a dominant (`subV7`, `subV7/ii`).
- After the slash, the chord the function leads to, as a degree of the key (`V7/ii`, `iiø7/vi`, `♯iv°7/V`).
- Degrees count from the tonic as in a major key, in minor keys too: `♭III` in C minor is E♭.
- The four error messages (a key that won't read, a function that won't read, `sub` on a non-dominant, a major
  quality on a lower-case numeral), produced by `parseFunction` itself on an example each, with what each means.
- What a function does and does not change: it settles the numeral and the key the rules reason in; the chord
  symbol, labels and practice presets still read the chord as written; the rules still choose a dominant's
  tensions from the key (so a function is preferred over a `# keep:` scale, as CLAUDE.md says).

### 1.2 Functions and their scales

A generated table: one row per function the rules know, in the key the picker selects (default C major; the minor
rows need a minor key, so the picker offers both modes), each row giving the function as the sheet writes it, the
chord it puts there, the scale the rules give it, the rule id, and the reason. Built by running the real pipeline,
not a lookup: for each function, a one-row chart `<chord> | <function>` with the picked `key:`, through `analyse`,
reading the `Decision`. The rows are grouped under four headings with a sticky sub-navigation: **Diatonic**,
**Secondary**, **Substitutes and borrowings**, **Chromatic**.

The rows to enumerate, so the table stays readable rather than exhaustive:

- Diatonic degrees for each family where the family is diatonic to the key (major: `Imaj7 ii7 iii7 IVmaj7 V7 vi7
  viiø7`; minor: `i7 iiø7 ♭IIImaj7 iv7 v7 V7 ♭VImaj7 ♭VII7 vii°7`).
- Secondary dominants and their related ii's: `V7/x` and `ii7/x` (or `iiø7/x` to a minor target) for every diatonic
  target x.
- Substitutes and borrowings the rules name: `subV7`, `subV7/x`, `♭VII7` (back door), `♭II maj7`, `♭VImaj7`, `♭IIImaj7`
  in major, `IV7` and `I7` (blues), `♯iv°7`, `vii°7/x`, `V7sus`.
- A chromatic example per family so the fallback rows (`m8`, `h2` without a related dominant, the passing `d1`) are
  visible and marked "guess".

Each row's chord is spelled from the function (`functionRoot`), so the table doubles as a check that a function
puts a chord where the user expects. Rows whose decision is a fallback are flagged; rows the rules cannot reach
(`rule: '?'`) are omitted and counted in a unit test, so a new quality or family that the page misses fails a test.

### 1.3 How the engine chooses a scale

The rules, hand-ordered from the least to the most contextual, with their ids, their family, the scale, and one
sentence each (the sentence may be the `reason` string's template). The ordering is by what the rule looks at,
which is how a user will recognise their case:

| Tier | Looks at | Rules |
| --- | --- | --- |
| 1 | The chord symbol alone | `D1` (pinned tensions, `alt`), `M1` (♯11), `M2` (♯5), `m1` (m(maj7)), `m2` (m6), `m3` (♭6), `s1` (sus ♭9) |
| 2 | The chart's mode | `M5`, `m6`, `h1` (modal charts: Lydian, Dorian, Locrian ♮2) |
| 3 | The chord's degree in its key | `M3` (tonic), `M4` (other major: Lydian), `m5` (tonic minor), `m7` (diatonic minor: ii Dorian, vi Aeolian, v Phrygian), `m9` (iii in major: Dorian), `D5` (blues and diatonic non-resolving: derive), `D7` (static) |
| 4 | The chords around it | `D2` (subV7), `D3` (extended dominant), `D8` (extended dominant into a minor key), `D4` (resolving dominant: derive), `D6` (chromatic non-resolving), `m4` (related ii), `h2` (related iiø7), `d1` (vii°7, auxiliary), `s2` (resolving sus), `s3` (static sus) |
| 5 | A guess (`fallback`) | `m8` (chromatic minor), `h2` without a related dominant, `d1` passing diminished |

Within a family the engine tries its rules in id order (docs/plan-analysis.md §8); the page says so and shows that
order too, as a second, compact view (the §8 block, generated from a small table in the engine rather than copied).

Dominants get a paragraph of their own: the tension slots (9/♭9/♭9♯9, 11/♯11, 13/♭13), how `derive` reads each from
the reference scale of the key, how the symbol's pins override them (`D1+D4`), and the slot-to-scale table from
§7.1, generated from `dominantScale`.

### 1.4 Reporting a disagreement

A short checklist: the chart row (chord, function, key area), the scale shown, the rule id, the scale expected and
why (a melody note, a recording, a book). A "Copy for an issue" button on the reason popover that puts exactly
that on the clipboard, with the share link of the chart. Two destinations follow: the contact form (`/contact`,
first, pre-filled as "Report a chart error" is), and a link that opens a new issue on the public GitHub repository
with the title and the copied text as its body. A link is a navigation, not a resource the page loads, so the CSP
is unchanged. If the body would make the URL too long for GitHub (a long share link), the link carries the title
only and the page says to paste the copied text.

## 2. Engine

- Export a `RULES` table from `engine/analysis/rules.ts`: `{ id, family, tier, scale, looksAt, summary }` for every
  id the functions return, and a test that every `rule` string produced over the whole library (the golden fixture)
  is in `RULES` and vice versa. This is the one new engine surface; the decisions themselves are unchanged.
- Export `dominantScale` and the `Slots` type (already pure) for the slot table.
- Export `SUFFIXES` grouped by family for the spellings table.
- Rename rule `m7'` to `m9` and `D3'` to `D8` in `rules.ts` and docs/plan-analysis.md §8; regenerate the golden fixture.
- A `functionsTable(key: Key)` in a new `engine/analysis/catalogue.ts`: the enumeration of §1.2, returning
  `{ fn, chord, scale, rule, reason, fallback }[]`, with a test that no row is `'?'` and that the C-major table has
  the textbook rows (`V7` Mixolydian, `ii7` Dorian, `V7/ii` Mixolydian ♭6 (the ♭13 is in the key), `subV7` Lydian Dominant, `♭VII7`
  Lydian Dominant, `viiø7` Locrian, `iiø7/vi` Locrian).

## 3. App

- `pages/functions.vue`, prerendered, built from the Catalyst components in `components/ui/` (tables, a
  `UiDescriptionList` if one exists, otherwise the Help page's section pattern). Sections 1.1–1.4 with anchors, so the
  rule links from the sheet land on the row.
- The key picker is a `<UiListbox>` of every key (the same list the Transpose control uses); the choice is kept in
  the URL query (`/functions?key=Eb`) so a link to a row keeps its key, and remembered via `usePreferences`.
  Recomputing the table on change is a pure engine call; no fetch.
- The sub-navigation for §1.2 is a sticky row of four anchor links under the section heading (the Help page's
  table-of-contents pattern, if it has one; otherwise `UiButton` plain variants); the active group is highlighted
  by an `IntersectionObserver`.
- `ChangesNote.vue`: the rule id after the reason, as a `NuxtLink` to `/functions#rule-m4`; the fallback wording.
- Help: two sentences and a link in "Editing" (writing a function) and "Odds and ends" (how scales are chosen);
  "The preview controls" brought up to date with the Changes toolbar's Analysis and Guide Tones headings.
- Editor: the function cell's hint and its error message carry a "How to write a function" link to
  `/functions#writing`.
- Printing: the page prints as a reference card; the tables keep their borders in print.
- e2e: the page renders, every rule id in `RULES` has an anchor, a rule link from a sheet lands on it, the copy
  button writes the expected text (clipboard permission granted in the test).

## 4. Out of scope

- Changing any rule. The page documents the rules as they are; disagreements go to the issue checklist.
- A rule editor or per-chart rule overrides.
- Internationalisation of the reasons.
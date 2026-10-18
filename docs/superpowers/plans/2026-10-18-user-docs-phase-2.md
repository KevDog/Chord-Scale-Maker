# User docs Phase 2: How it decides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/how-it-decides` page with one section per `DECISIONS` id (anchor = id), Help slimmed and regrouped around it, and the interface linking each shown choice to its section.

**Architecture:** A `DecisionSection` component renders each section's heading from the registry (title single-sourced, `data-decision` marks it); the page is prose in the owner's voice, examples drawn from the engine where cheap. Each content task flips its registry entries to `page: 'how-it-decides', anchor: <id>` first, so the existing anchor test fails until the section exists (the test cycle). Interface links use the existing `<DecisionLink>`.

**Tech Stack:** Nuxt 4 / Vue 3, Catalyst `Ui*` components, vitest + `@nuxt/test-utils` (`mountSuspended`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md` §3, §4, §5.2–5.3, §8, §9 Phase 2, §11 (rulings win). Facts for each section: `docs/design.md` §5 and §7a (subsections named per task).

**Three PRs.** PR A = Tasks 1–6 (page, content, Help, nav). PR B = Task 7 (release notes and their gate). PR C = Task 8 (interface links), which writes a release note under the new gate and passes the docs part by touching `how-it-decides.vue` or with `Docs: none — links to existing sections only`.

## Global Constraints

- One page, `/how-it-decides`; `decisionOf` gives `/<page>#<anchor>` (§11).
- Every How it decides section: *What it decides* (one sentence), *The rule* (prose, in the order the engine tries things), *An example* (concert pitch; a table where more than one step), *What you can change*, *See also* (§8).
- Owner's voice: first person, direct, dry. Describe what a user can see on the sheet, never code paths (§8).
- Chord symbols in `UiCode`; glyphs (♭ ♯ –) as Help already writes them.
- The four sheets: Changes, Scales, Arpeggios, Patterns. Help retitles to "The four sheets" only once Phase 3 adds Arpeggios; in this PR Help says "The sheets" (it mentions Changes, Scales, Patterns today).
- The level is a view preference, never written into rows; a written scale is a pin and plays at every level (CLAUDE.md design rules). Help's current "writes the scales into the chart" is wrong and goes.
- Dotted ids: `[id="guide.move"]` / `getElementById`, never `#guide.move` CSS selectors.
- Anchors never inside a `v-if` (feature-gated paragraphs `cellsOn`, `approachesOn`, `patternsOn`): a gated section keeps its heading and anchor, gating only its body.
- No inline `<script>`, no third-party origins (CSP).
- `DecisionInfo` shape unchanged: `{ id, title, page, anchor, summary }`.

## Review Focus

1. **Old deep links** (`/help#guide-lines`, `/help#controls`, `/help#practice`) from search results and chats → land on a Help section that points on. Test: Task 6 asserts `#guide-lines` still exists on Help and links to `/how-it-decides#guide.tones`.
2. **Feature flags off** (`cells`, `approaches`, `patterns` off in production builds) → the anchor test still finds `cells.line`, `approach.place`, `patterns.run`. Test: Task 4 mounts the page with those flags off and finds the anchors.
3. **Dotted fragment navigation** (`/how-it-decides#pent.auto` opened cold) → scrolls to the section, PageIndex marks the group. Test: Task 6 e2e `page.goto('/how-it-decides#pent.auto')` → `[id="pent.auto"]` in viewport.
4. **Stale section** (a section left on the page after its id leaves `DECISIONS`) → reported. Test: Task 1's reverse check.
5. **Phone width** (390 px): the example tables don't force horizontal page scroll. Test: Task 6 e2e at 390 px, `document.documentElement.scrollWidth <= 390`.

---

### Task 1: Page scaffold, DecisionSection, the reverse check

**Files:**
- Create: `web/app/components/DecisionSection.vue`, `web/app/pages/how-it-decides.vue`
- Modify: `web/app/utils/site.ts` (`PAGE_HEAD['how-it-decides']`), `web/test/docs/decisions.test.ts`
- Test: `web/test/DecisionSection.test.ts`, `web/test/docs/decisions.test.ts`

**Interfaces:**
- Produces: `<DecisionSection id="guide.move" :level="2|3">` — renders `<section aria-labelledby={id} data-decision={id} class="scroll-mt-6 space-y-4">` with `<UiSubheading :id :level class="scroll-mt-6">{{ decisionOf(id).title }}</UiSubheading>` and a default slot. Throws (via `decisionOf`) on an unknown id.
- Produces: page groups (h2, plain `UiSubheading` ids, not decisions): `scales`, `keys`, `guide-tones`, `lines`, `superimposing`, `spelling`, `ranges`. `SECTIONS` for `PageIndex` lists these groups, not every decision.
- Produces: `PAGE_HEAD['how-it-decides'] = { title: 'How it decides', description: 'Why Chord Scale Maker chose what it did: scale levels, guide tone lines, pentatonics, triad pairs, spelling and ranges, each rule with an example.' }`

- [ ] **Step 1: Write failing tests**
  - `DecisionSection.test.ts`: `mountSuspended(DecisionSection, { props: { id: 'guide.move' } })` → `find('[id="guide.move"]').text()` is `'How a line moves'`; `section` has `data-decision="guide.move"` and `aria-labelledby="guide.move"`.
  - `decisions.test.ts`: `PAGES['how-it-decides']` is the new page; add `it('every section on How it decides is in the registry')` that mounts the page, collects `[data-decision]` ids, and `console.warn`s the ones not in `DECISIONS` (warning, not failure — spec §7.1), plus `expect(ids.length).toBe(new Set(ids).size)` (no section twice: that is a failure).
- [ ] **Step 2:** `cd web && npx vitest run test/DecisionSection.test.ts test/docs` → FAIL (no component, no page).
- [ ] **Step 3:** Build the component and the page skeleton: header (eyebrow "How it decides", `UiHeading` "How it decides"), the disclaimer moved verbatim from `help.vue:13-26` (its last sentence reworded to point at the sections below and the Changes note), the seven empty group headings, `PageIndex` inline and column as on Help, `useCurrentSection`, `useSeoMeta(seoMeta(PAGE_HEAD['how-it-decides']))`. Remove the disclaimer from Help, leaving one sentence in Help's intro: "The app chooses scales and lines by rules; <UiTextLink href="/how-it-decides">How it decides</UiTextLink> says which."
- [ ] **Step 4:** Same vitest run → PASS. `make test` green.
- [ ] **Step 5:** Commit `How it decides: the page, its sections' component and the reverse check`.

### Task 2: Guide tones (moved from Help)

**Files:** Modify `how-it-decides.vue`, `help.vue`, `engine/src/decisions.ts` (6 entries).

**Interfaces:** Consumes `DecisionSection` (level 3 under group `guide-tones`).

- [ ] **Step 1:** In `decisions.ts`, set `guide.tones`, `guide.start`, `guide.move`, `guide.range`, `guide.meet`, `guide.rest` to `page: 'how-it-decides', anchor: <id>`.
- [ ] **Step 2:** `npx vitest run test/docs` → FAIL naming those six.
- [ ] **Step 3:** Move `help.vue:69-143` into the `guide-tones` group: its intro line under the group heading, each bullet becoming its `DecisionSection` (bullet text verbatim, recast into the §8 shape only where a part is missing: *What you can change* = From 3rd / From 7th, Lowest/Highest note in the Instrument group, writing a different chord). The ii–V–I table and its paragraph stay under `guide.move` as its example. `guide.range` keeps `{{ GUIDE_RANGES }}` (from `guideRanges()`). On Help, leave the `#guide-lines` stub (Task 6 writes it).
- [ ] **Step 4:** vitest → PASS.
- [ ] **Step 5:** Commit `How it decides: the guide tone line, moved from Help`.

### Task 3: Scales, keys and spelling

**Files:** Modify `how-it-decides.vue`, `engine/src/decisions.ts` (`scale.level`, `scale.unknown`, `scale.slash`, `key.area`, `spell.root`, `spell.transpose`, `spell.chord`), `web/test/docs/howItDecides.test.ts` (create).

Sources: design.md §4 "Scale level" bullet and §7a (resolve order `written` > `function` > `rules` > `default`; level ladders; m5 Aeolian at Basic; Random's pool leaves out `functional` options); §4 "Slash readings"; §7a key areas and `@key`; CLAUDE.md design rules (spelling, transposing).

- [ ] **Step 1:** Flip the seven entries. Fix two summaries (deferred review minors):
  - `scale.unknown`: `'A chord it can’t read is shown in amber, has no scale until you pick one, and rests in a line.'`
  - `spell.root`: `'Each scale takes the spelling with no double flats or sharps, no B♯, E♯, C♭ or F♭, then the fewest accidentals, then the sharp or flat side it was written on.'`
- [ ] **Step 2:** Write `howItDecides.test.ts`: `it('shows G7 at each level from the engine')` — mount the page, the `[id="scale.level"]` section's table has one row per `SCALE_LEVELS` entry except `random`, each cell equal to `scaleAtLevel('G7', level)` (Standard row: G Mixolydian). Run with `test/docs` → FAIL.
- [ ] **Step 3:** Write the seven sections. Pinned content:
  - `scale.level` (group `scales`): Basic / Standard / Advanced / Random as Help says them; **a level is a view setting, not written into the chart**; a scale you wrote (or picked) plays at every level; Random deals inside scales only, Shuffle re-deals; level and seed are remembered per chart in this browser and go with a share link. Example table: G7 at Basic, Standard, Advanced, computed with `scaleAtLevel` in the page's script (so it cannot drift). See also: `/functions#rules`.
  - `scale.unknown` (`scales`): amber chord, no scale until picked, a rest in every line, no numeral. Example: a typo `Cmj7`.
  - `scale.slash` (`scales`): the slash chord takes its options from another chord on its bass; symbol, labels and Practice presets still read the chord as written. Example: `DbMaj7/C` → C 7sus4♭9 (verify the entry in `chord_scales.json` `slash_chords` and use its exact scale name).
  - `key.area` (`keys`): how the key of the moment is found (cadences, then the chart's `key:`), where the Changes sheet writes a key change, and that a section `key:` or `@key` pins it. Example: Autumn Leaves' move to G minor (check the library chart's labels in the running app). See also `/functions#rules`.
  - `spell.root`, `spell.chord` (`spelling`): the design rule in prose; examples `b2` over B♭ → B, not C♭; the 7th of G♭7 is F♭; `D7/F#` keeps F♯ as the bass's major 3rd.
  - `spell.transpose` (`spelling`): roots on the target key's side, D♭–7 G♭7 in B♭ (even with C♭ or F♭ in the scale); C and A minor, or a side needing double accidentals, fall back to the plain rule; an instrument part never transposes the chart, only how it's written.
- [ ] **Step 4:** vitest → PASS.
- [ ] **Step 5:** Commit `How it decides: scale levels, slash chords, key areas and spelling`.

### Task 4: Lines, sheets and ranges

**Files:** Modify `how-it-decides.vue`, `engine/src/decisions.ts` (`arp.line`, `arp.sheet`, `patterns.run`, `cells.line`, `cells.system`, `approach.figures`, `approach.place`, `range.instrument`), `web/test/docs/howItDecides.test.ts`.

Sources: design.md §5 "7th chord arpeggios on Changes", "Arpeggios sheet", "Patterns sheet", "Cells line", "Approaches"; `INSTRUMENTS` for ranges.

- [ ] **Step 1:** Flip the eight entries.
- [ ] **Step 2:** Add to `howItDecides.test.ts`: `it('keeps the gated sections’ anchors with their flags off')` — mount with `cells`, `approaches`, `patterns` features off (override `runtimeConfig.public.features` the way existing flag tests do; grep `useFeature` in `web/test/`), expect `[id="cells.line"]`, `[id="approach.place"]`, `[id="patterns.run"]` each length 1. Run → FAIL.
- [ ] **Step 3:** Write the sections under group `lines` (`arp.line`, `cells.line`, `cells.system`, `approach.figures`, `approach.place`, then `arp.sheet`, `patterns.run`) and `range.instrument` under `ranges`. Pinned content:
  - `arp.line`: four chord tones (extensions dropped, a triad's root again), the ten patterns, note value by the bar's shortest chord (4/4: one chord ♩, two ♪, three or four 𝅘𝅥𝅯), a short slot turns back (6 eighths in 3/4: 1 3 5 7 5 3), each arpeggio placed nearest the last note, turning back before the range's edge. Example: Dm7 G7 in one bar of 4/4, eighths.
  - `arp.sheet`: 7th Chord over two octaves closing on the root (1 3 5 7 1 3 5 7 1); Extended stacks the scale's other notes above (9s, 11s, 13s); Up / Down / Up & down.
  - `patterns.run`: a pattern is steps (`+2 −1`) through the scale or the chord tones, run over each scale line.
  - `cells.line`, `cells.system`: Help's cells paragraph, recast; body gated by `cellsOn`, heading not.
  - `approach.figures`, `approach.place`: Help's approach paragraph plus design.md's no-room and range cases (none for the first chord, after a rest, where the chord before keeps under an eighth, or where a note leaves the range; never B♯/E♯/C♭/F♭). Body gated by `approachesOn`.
  - `range.instrument`: a table, Instrument | Written range, rendered from `INSTRUMENTS` (`noteName(lo)`–`noteName(hi)`); the Lowest/Highest note controls change it for every line; guide lines turn back at the edge, arpeggio and cell lines prefer to stay inside a comfort band a 4th above the floor and a major 3rd below the ceiling.
- [ ] **Step 4:** vitest → PASS.
- [ ] **Step 5:** Commit `How it decides: arpeggio, cell and approach lines, the sheets, ranges`.

### Task 5: Superimposing and chord picks

**Files:** Modify `how-it-decides.vue`, `engine/src/decisions.ts` (`pent.auto`, `pent.inside`, `pent.line`, `hex.auto`, `hex.group`, `hex.line`, `pick.order`).

Sources: design.md §5 "Practice selection" (Pentatonic, Hexatonic), "Pentatonic line", "Triad pair line", "Pentatonics on Changes", "Chord picks".

- [ ] **Step 1:** Flip the seven entries.
- [ ] **Step 2:** vitest → FAIL naming them.
- [ ] **Step 3:** Write under group `superimposing`. Pinned content:
  - `pent.auto`: the 12 minor pentatonics ranked by notes shared with the chord's scale, ties to the fewest fifths from the root, flat side first; Auto is the top; Built on picks a degree instead. Example: over Cmaj7 (Ionian) Auto is… compute with the engine's `pentatonicRanking` in the page script and show the top three with their shared counts.
  - `pent.inside`: `{{ PENT_INSIDE_HELP }}`; on Changes ranked against Key, the key area's ladder (rung 0–6 sharing 5 5 4 3 2 1 0).
  - `pent.line`: four-note cells leaving one note out (Leave out 1: Am plays C D E G), each starting nearest the last note, turning at the range's walls.
  - `hex.auto`: most chord tones covered, then both triads major or minor, then nearest the root by fifths; Pair *n* = triads on degrees *n* and *n*+1. Example: `G/Am` over Cmaj7.
  - `hex.group`: the four groupings, tinted apart.
  - `hex.line`: lower triad then upper (`G/Am`: G B D, then A C E from the note nearest D).
  - `pick.order`: the pick list runs inside to outside (the ranking above); Sheet's choice clears; picks survive Built on, Path, Rung, Side; a key change clears them all; never written into the chart.
- [ ] **Step 4:** vitest → PASS.
- [ ] **Step 5:** Commit `How it decides: pentatonics, triad pairs and chord picks`.

### Task 6: Help regrouped, nav, e2e

**Files:** Modify `help.vue`, `AppShell.vue`, `web/e2e/pages.spec.ts`, `web/e2e/a11y/pages.a11y.ts`, `web/e2e/library.spec.ts` (title list); Create `web/e2e/how-it-decides.spec.ts`; Test `web/test/docs/help.test.ts` (create).

**Interfaces:** Consumes `DecisionLink` (`<DecisionLink id="…">label</DecisionLink>`).

- [ ] **Step 1: Failing tests.**
  - `help.test.ts`: `[id="guide-lines"]` exists and contains `a[href="/how-it-decides#guide.tones"]`; `#sheets` heading text `'The sheets'`; `#controls` heading `'The controls'`; Help's text no longer contains `'writes the scales into the chart'`; each controls group ends with an `a[href^="/how-it-decides#"]`.
  - `how-it-decides.spec.ts`: nav has a "How it decides" link to `/how-it-decides` (desktop navbar and sidebar); `goto('/how-it-decides#pent.auto')` → `[id="pent.auto"]` in viewport; at 390 px wide `scrollWidth <= 390`.
  - `pages.a11y.ts`: add `'/how-it-decides'`. `library.spec.ts`: add `['/how-it-decides', 'How it decides · Chord Scale Maker']`.
- [ ] **Step 2:** `npx vitest run test/docs` → FAIL.
- [ ] **Step 3: Help.**
  - `#sheets` → "The sheets"; its guide-tone paragraph keeps its first two sentences and links "How a line is built" to `/how-it-decides#guide.tones`.
  - `#guide-lines` stub: the h3 stays (same id and title), one sentence: "It's moved to <DecisionLink id="guide.tones">How it decides</DecisionLink>, with the rest of the app's choices." (keeps every old deep link working).
  - `#controls` → "The controls", regrouped as `UiSubheading :level="3"` groups (no ids needed): *Reading it on your instrument* (Instrument; From key/root/note) → `range.instrument`; *Seeing the analysis* (Numerals, Scales, Guide Tones, Approach) → `guide.tones`; *Superimposing* (Superimpose, Pentatonic, Triad pair, Cells) → `pent.auto`; *Choosing a level* (Scale level rewritten: four levels in one sentence each, "a view setting, not saved into the chart", Shuffle) → `scale.level`; *How much shows* (Interface). Existing prose moves, shortened where How it decides now holds the detail.
  - `#practice`: Auto sentences link `pent.auto` / `hex.auto`; "inside to outside" links `pick.order`.
  - `#editing`: amber-chord bullet links `scale.unknown`; Transposing links `spell.transpose`.
  - `#odds`: the "Wondering why…" item leads with How it decides.
  - `SECTIONS` titles follow the retitles.
- [ ] **Step 3b: Nav.** `AppShell.vue`: "How it decides" after Help in the navbar section, the sidebar (icon `LightBulbIcon` from `@heroicons/vue/20/solid`, matching the others' set) and the footer's Site nav.
- [ ] **Step 4:** `make test`, `make docs`, `make e2e`, `make a11y` → all green. Read the built page at 390 px and 1440 px (`make preview`).
- [ ] **Step 5:** Commit `Help: regrouped controls, links into How it decides; nav entry`.
- [ ] **Step 6:** File one GH issue, "Docs gate: review minors from #398", listing: PR template implies `Docs changed:` satisfies the gate; gate rejects an en dash / no space; `rules.ts` not counted as docs by the gate (the hook counts it); `links.ts` second `#` and bare `#top`; Dependabot skip uses `github.actor`, not the PR author; pre-push builds twice when docs and app both change.
- [ ] **Step 7:** Update `docs/design.md` §5 Documentation (Phase 2: the page, `DecisionSection`, the reverse check, Help's stub). Push, open PR A with `Docs changed: how-it-decides.vue, help.vue, decisions.ts`.

### Task 7 (PR B): Release notes, and the gate requires one (spec §12)

**Files:** Create `web/app/utils/releaseNotes.ts`, `web/app/pages/release-notes.vue`, `web/test/releaseNotes.test.ts`, `web/e2e/release-notes.spec.ts`; Modify `web/build/docsGate.ts` (+ test), `.github/pull_request_template.md`, `.githooks/pre-push` (`DOCS` list), `web/app/utils/sitemap.ts`, `web/app/utils/site.ts` (`PAGE_HEAD['release-notes']`), `AppShell.vue` (footer), `help.vue` (`#odds` link), `web/e2e/a11y/pages.a11y.ts`, `docs/design.md` §5 Documentation.

**Interfaces:**
- Produces: `type ReleaseItem = Readonly<{ text: string; pr?: number }>`, `type ReleaseNote = Readonly<{ date: string; items: readonly ReleaseItem[] }>`, `RELEASE_NOTES: readonly ReleaseNote[]` (newest first), `RELEASE_NOTES_FILE = 'web/app/utils/releaseNotes.ts'`.
- Produces: `docsGate(files, body)` also requires, when user-facing, a change to `RELEASE_NOTES_FILE` or a body line `^Release notes: none (?:—|--) <reason>$`; the failure message names whichever requirement is missing.

- [ ] **Step 1: Failing tests.** `releaseNotes.test.ts`: dates `YYYY-MM-DD`, strictly descending, unique; every item's text non-empty and ends in `.`; `pr` a positive integer. `docsGate.test.ts`: user-facing + docs but no note → fails, message contains `Release notes: none — `; + note file → passes; + note escape (em dash or `--`, CRLF) → passes; docs escape alone → still fails on the note; charts-only → passes with neither. Page test: one `section` per entry, `id` = date, PR links `https://github.com/KevDog/Chord-Scale-Maker/pull/<n>`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Page: owner's voice intro, `PageIndex` by month, each date a `UiSubheading` (`id` = date, text the date written out: 18 October 2026), items as a list, `(#N)` links. Seed from merged PRs since 2026-10-04 that touch user-facing paths: a day's highlights in plain words, internal work left out.
- [ ] **Step 4:** `make test`, `make lint`, `make docs`, `make a11y`, `make e2e` → green.
- [ ] **Step 5:** Commit, push, PR B (its own note in `RELEASE_NOTES`).

### Task 8 (PR C): Links where the choice is shown

**Files:** Modify `ChangesNote.vue`, `PracticePanel.vue`, `ChordPickPopover.vue`, `PentatonicLadder.vue`, `ChartTranspose.vue`; tests beside each (`web/test/ChangesNote.test.ts`, …).

**Decision for review (D1):** spec §5.3 assumed menus with a foot item. The rail's Guide Tones, 7th Chords, Pentatonic, Triad pair, Level and Instrument controls are listboxes: a link inside `role=listbox` breaks ARIA (the a11y gate), and a link beside each group breaks the rail's two-row limit (`editor.spec.ts`). **Recommended:** no links in the rail; the explanation is one click away where the result is shown (below) and from Help's control groups (Task 6). Alternative: one "How it decides" link at the rail's end, beside the actions (one link, not per group) — say if you want it.

- [ ] **Step 1: Failing tests** (component tests, `mountSuspended`):
  - ChangesNote: a pinned (written) scale's note has `a[href="/how-it-decides#scale.level"]`; a slash-borrowed chord's has `a[href="/how-it-decides#scale.slash"]`; existing rule links unchanged.
  - PracticePanel with Pentatonic shown: `a[href="/how-it-decides#pent.auto"]`; with Hexatonic: `#hex.auto`.
  - ChordPickPopover and PentatonicLadder footers: `a[href="/how-it-decides#pick.order"]`, label "Why this order?".
  - ChartTranspose dialog description: `a[href="/how-it-decides#spell.transpose"]`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add `<DecisionLink>`s. ChangesNote decides pinned/slash from the chord's resolved scale source (the same field that chooses its "why" text today; `written` → `scale.level`, a `slash_chords` reading → `scale.slash`).
- [ ] **Step 4:** `make test`, `make e2e`, `make a11y` → green.
- [ ] **Step 5:** Commit, push, PR C with a release note and `Docs: none — links to existing How it decides sections only` (or touch the page if copy changes).

## After this

Phase 3: `/chart-format` (from Help's "The source"), `/glossary`, the shortcuts table, the Arpeggios sheet and missing features in Help (then "The four sheets"). Phase 4: `LABELS`, the key-map table, the instrument table single-sourced.

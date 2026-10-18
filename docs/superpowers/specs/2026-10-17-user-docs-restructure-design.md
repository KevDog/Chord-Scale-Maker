# User documentation: restructure, decision traceability and the PR doc check

Status: design (Phase 1 planned: `docs/superpowers/plans/2026-10-17-user-docs-phase-1.md`; §11 rulings override where they differ)
Date: 2026-10-17
Scope: `web/app/pages/help.vue`, `functions.vue`, new documentation pages, the engine's rule registry, CI and the pre-push hook

## 1. Summary

The Help page (`web/app/pages/help.vue`, ~450 lines of template) carries three kinds of content on one page: how to do something, why the app chose something, and what a term or format means. It has fallen behind the app (the Arpeggios sheet, the 7th-chord line, chord picks, scale and composer pages and Notable Recordings are absent or only glanced at), and the heuristics the app applies are documented unevenly: the guide-tone line is described in full, the analysis rules have a reference page with stable anchors, and the rest (scale levels, pentatonic ranking, triad-pair selection, enharmonic spelling, transposition spelling, slash-chord borrowing, instrument ranges) is scattered or missing.

This specification proposes:

1. Splitting the documentation into four pages by kind of question (Help, How it decides, Reference, Glossary), keeping the current URLs and the owner's voice.
2. A **decision registry** in the engine: every heuristic the app applies has a stable id, and every id has an anchor on the documentation. The interface links to that anchor wherever the choice is shown, so a user can always be pointed to the logic behind a guide tone, a scale or a pentatonic.
3. A **doc check** that is a required status check on `main`: a PR that changes user-facing behaviour must change the documentation or state why not; every registered decision must have an anchor; every internal link and fragment must resolve.

## 2. Why split the page

The current page mixes three modes of writing. A reader who wants to print a sheet reads a disclaimer about functional analysis before "The short version"; a reader who wants to know why the line swapped from the 3rd to the 7th finds the answer inside a section titled "The two sheets"; a reader who wants to know what `bars: 8` means finds it under "Editing a chart". These are different readers with different questions, and the single page serves none of them well once the app has more than a handful of features.

The split below follows the Diátaxis distinction (how-to, explanation, reference) because the site already has it latent: Help is mostly how-to, Functions and rules is reference, and the "why" notes on the Changes sheet are explanation. This is not a return to a documentation-site architecture; it is four pages, each short enough to read in one sitting, each with its own on-page index (`PageIndex`, which already exists).

## 3. Page map

URLs that exist today keep working; the new pages are added beside them. Each page keeps the current look (`UiHeading`, `UiSubheading`, `PageIndex`) and the owner's voice.

| URL | Title | Kind | Content |
|---|---|---|---|
| `/help` | Help | How-to | The short version; the three sheets (Changes, Scales, Arpeggios); the controls, grouped by task; Practice; editing a chart; saving; printing and Focus; offline; keyboard shortcuts; odds and ends. Each control that applies a heuristic ends with a link into How it decides. |
| `/how-it-decides` (new) | How it decides | Explanation | The disclaimer, as the framing for this page. One section per decision in the registry (section 5), each with: what it decides, the rule in prose, a worked example, what the user can override and how, and a link to the reference where one exists. |
| `/functions` | Functions and rules | Reference | Unchanged in scope. Remains the home of the analysis rule table (`#rule-<id>`), the function grammar and the quality spellings. |
| `/chart-format` (new) | Chart format | Reference | "The source" subsection moved out of Help and completed: header fields, `section:`, `copy:`, `bars:`, `key:` / `@key`, `time:` / `@time`, `outside:`, `kind:`, `aka:`, notes and row comments, the error list. One table of fields, one annotated example. |
| `/glossary` (new) | Glossary | Reference | Guide tone, chord-scale, key area, function, inside and outside, tension, pin (a written scale), level, chord pick, triad pair, hexatonic, superimpose, concert pitch and written pitch, turn-back. Each entry links to the section that uses it. |
| `/scales`, `/composers`, `/library` | — | Reference (existing) | Linked from Help and the Glossary; no change. |
| `/changes` (new, optional) | What changed | — | Versions are a date and a hash, so users cannot tell what is new. A short dated list, written by hand at merge time from the PR title, newest first. Phase 3; may be dropped if the maintenance cost outweighs the value. |

### Navigation

The site navigation gains one entry, "How it decides", beside Help. The reference pages are reached from Help, from How it decides and from each other, not from the top navigation, to keep it short. Help's header links to the other three documentation pages in one sentence.

## 4. Migration of the current Help page

Nothing is discarded; every current section has a destination. Section ids are kept where the content stays on Help, so existing deep links hold.

| Current section (`help.vue`) | Destination | Notes |
|---|---|---|
| Header: "A disclaimer" | `/how-it-decides` introduction | It is the honest framing for the explanation page. Help keeps one sentence: "The app chooses scales and lines by rules; How it decides says which." |
| `#quick` The short version | `/help#quick` | Unchanged. |
| `#sheets` The two sheets | `/help#sheets`, retitled "The three sheets" | Add the Arpeggios sheet. Guide-tone paragraph keeps its first two sentences and links to `/how-it-decides#guide.line`. |
| `#guide-lines` How a guide tone line is built | `/how-it-decides#guide.line` | Moved verbatim, including the ii–V–I table. Split into anchored subsections `guide.tones`, `guide.start`, `guide.move`, `guide.range`, `guide.meet`, `guide.rest`. |
| `#controls` The preview controls | `/help#controls`, retitled "The controls" | "Preview" is stale. Regroup by task rather than by menu: *Reading it on your instrument* (Instrument, From key/root/note), *Seeing the analysis* (Numerals, Scales, Guide Tones), *Superimposing* (Pentatonic, Hexatonic, their lines), *Choosing a level* (Level, Shuffle), *How much shows* (Interface). Each group ends with its How it decides link. |
| `#controls` Scale level paragraph, the sentence "Standard puts everything else back" | `/how-it-decides#level` | Rewritten: what each level reaches for, that Random deals inside scales only, that a pinned scale plays at every level, that a level is a view preference and is not written into rows (see `docs/design.md` design rules). |
| `#practice` Practice | `/help#practice` | Keep the how-to. The Pentatonic "Auto" and Hexatonic "Auto" sentences link to `pent.auto` and `hex.auto`; the "inside to outside" ordering of picks links to `pick.order`. |
| `#editing` The bars | `/help#editing` | Unchanged, plus the amber-chord sentence links to `scale.unknown`. |
| `#editing` The source | `/chart-format` | Moved and completed. Help keeps two sentences and the link. |
| `#editing` Transposing | `/help#editing` (how-to) and `/how-it-decides#spell.transpose` (why D♭–7, not C♯–7) | Split. |
| `#saving` Saving your work | `/help#saving` | Unchanged. |
| `#printing` Printing and Focus | `/help#printing` | Unchanged. |
| `#odds` Odds and ends | `/help#odds` | The "Wondering why a chord got its scale?" item becomes the lead-in to How it decides. Add: scale pages, composer pages, Notable Recordings. |
| (absent) Arpeggios sheet; 7th Chords line | `/help#sheets`, `/help#controls`; `/how-it-decides#arp.line` | New content; see `docs/design.md` §5 "Arpeggios sheet" and "7th chord arpeggios on Changes". |
| (absent) Keyboard shortcuts | `/help#shortcuts` | One table: ⌘Z, Esc, Space, Tab, arrows, `%`, ⌫, and any others the editor binds. Sourced from the editor's key map rather than typed, so the table cannot drift (see §6). |

## 5. The decision registry

### 5.1 What it is

A single exported list in the engine, `DECISIONS`, in the same spirit as `RULES` (`engine/src/analysis/rules.ts`), naming every heuristic the app applies when it chooses something for the user. The analysis rules keep their ids (`M3`, `D1`, `m9`, …) and their anchors (`/functions#rule-M3`); the registry adds the decisions that have no home today.

```ts
// engine/src/decisions.ts (pure TypeScript; no Vue or DOM imports)
export type DecisionInfo = Readonly<{
  id: string         // stable; namespaced: 'guide.move', 'pent.auto'
  title: string      // the heading on How it decides
  page: 'how-it-decides' | 'functions'   // where its anchor lives
  summary: string    // one sentence, reused by the UI as the link's title
}>
export const DECISIONS: readonly DecisionInfo[] = [ … ]
export const decisionHref = (id: string): string   // '/how-it-decides#guide.move' or '/functions#rule-M3'
```

`decisionHref` is pure string work, so it belongs in the engine (`sheet.ts` precedent: view logic that can be pure lives in the engine). The app wraps it in a `<DecisionLink id="…">` component that renders `UiTextLink` with the summary as its title and a consistent "Why?" or "How this is chosen" label.

### 5.2 The initial set

| Namespace | Id | Decides | Where the UI shows the choice today |
|---|---|---|---|
| `scale` | `rule-<id>` (existing, on `/functions`) | The scale for a chord from its function and key | The numeral/scale note on Changes (`ChangesNote.vue`); the editor's scale list ("why I chose that scale") |
| `scale` | `scale.level` | What Basic, Standard, Advanced and Random reach for; pins | Level menu |
| `scale` | `scale.unknown` | What happens to a chord the app cannot read (amber; rest in a line) | Editor |
| `scale` | `scale.slash` | A slash chord taking its options from another chord on its bass (`slash_chords`) | Editor scale list |
| `key` | `key.area` | How key areas are found and where a key change is written | Changes sheet key labels |
| `guide` | `guide.tones`, `guide.start`, `guide.move`, `guide.range`, `guide.meet`, `guide.rest` | The guide-tone line, one subsection each (current `#guide-lines` bullets) | Guide Tones menu; the line itself |
| `arp` | `arp.line` | The 7th-chord arpeggio line: order, direction, turn-backs, rhythm | 7th Chords menu |
| `pent` | `pent.auto`, `pent.inside`, `pent.line` | Which pentatonic Auto picks; the inside→outside ordering; the four-note cells and their turns | Practice caption (`Dm pent · 5 shared`); Superimpose row; Pentatonic line |
| `hex` | `hex.auto`, `hex.group`, `hex.line` | Which triad pair Auto picks; the groupings; the triad-pair line | Practice caption; Superimpose row; Triad pair line |
| `pick` | `pick.order` | The order of alternatives offered on a chord pick | Chord pick list |
| `spell` | `spell.root`, `spell.transpose`, `spell.chord` | `simplifyRoot`; the target key's side when transposing; a chord symbol following its scale's spelling and a slash bass keeping its interval | Transpose…; any staff |
| `range` | `range.instrument` | Each instrument's written range and how a line turns back at the floor or ceiling | Instrument menu; guide and arpeggio lines |

The set is the engine's current behaviour as described in `docs/design.md` §5 and §7a. Adding a heuristic to the engine means adding a row here; the check in §7 enforces that the row has an anchor.

### 5.3 Where the links go in the interface

The rule is: wherever the app shows the result of a decision, the result is one click from the explanation.

- The Changes note (`ChangesNote.vue`) already names the rule; it gains the link to `/functions#rule-<id>`, and, for a chord whose scale was pinned or borrowed, to `scale.level` or `scale.slash`.
- The Practice captions link their pentatonic or triad pair to `pent.auto` / `hex.auto`.
- The Guide Tones, 7th Chords, Pentatonic and Triad pair menus each carry a "How this line is built" item at the foot.
- The Level menu carries "What each level means".
- Transpose… carries "How it spells the new key".
- The Instrument menu carries "Written ranges", linking to `range.instrument`.

Menu items are the lowest-cost affordance that works under the hashed CSP and needs no new component; a `?` icon per control was considered and rejected as visual noise on a toolbar that already has an Interface setting to hide controls.

## 6. Single-sourcing

The Help page already imports what it quotes (`guideRanges()`, `PENT_INSIDE_HELP`), so those cannot drift. The principle is extended:

- Control labels used in the documentation come from the same constants the toolbar uses (one `LABELS` export in `web/app/utils/`), so renaming a control renames it in Help.
- The keyboard shortcut table renders from the editor's key map.
- The instrument table on `/how-it-decides#range.instrument` renders from `INSTRUMENTS`.
- The "What changed" page, if built, reads a `docs/changelog.md` so the content is reviewable in a PR like any other doc.

## 7. The doc check (required before merge)

CI runs on pull requests only and `engine` and `e2e` are required checks on `main` (`.github/workflows/ci.yml`). A third required check, `docs`, is added. It has three parts; the first two are automatic tests, the third is a gate on the PR itself.

### 7.1 Anchor coverage test

`web/test/docs/decisions.test.ts` (vitest, in `make test`): for every entry in `DECISIONS`, the page it names contains an element with that id. Implemented by rendering the page component with `@vue/test-utils` and querying `#<id>`, or, if rendering a full page is heavy, by reading the prerendered HTML from `.output/public/` after `npm run build` (the `engine` job already builds). The reverse direction is a warning, not a failure: an anchor on How it decides with no registry entry is reported so stale sections are noticed.

The analysis rules already have the equivalent in spirit (`RULES` drives the table); the test covers them too, so a rule added without a row in the table fails.

### 7.2 Link check

`web/build/checkLinks.ts`, run as `npm run check:links` after the build: walk `.output/public/**/*.html`, collect every internal `href`, and assert each path exists in the output and each `#fragment` exists in its target page. External links are not fetched (network is not needed and would be flaky). This catches a renamed section id anywhere on the site, not only on the documentation pages.

### 7.3 Docs-touched gate

A step in the `changes` job computes `needs_docs` and `has_docs`:

- `needs_docs` is true when the diff against the base touches user-facing behaviour: `engine/src/**` (excluding `__tests__/`), `engine/chord_scales.json`, `web/app/components/**`, `web/app/composables/**`, `web/app/pages/song/**`. Charts-only PRs (`charts_only == true`), dependency bumps and `docs/**` changes do not set it.
- `has_docs` is true when the diff touches `web/app/pages/help.vue`, `how-it-decides.vue`, `functions.vue`, `chart-format.vue`, `glossary.vue`, `docs/changelog.md`, or `engine/src/decisions.ts`.

The `docs` job fails when `needs_docs && !has_docs` unless the PR body contains a line matching `^Docs: none — .+` (a reason is mandatory; the dash is an em dash or two hyphens). The failure message names the files that triggered the gate and quotes the escape line. A PR template (`.github/pull_request_template.md`) adds a "Docs" section with the two options so the line is written deliberately, not discovered from a red check.

Dependabot PRs are excluded by actor.

### 7.4 Pre-push hook

`.githooks/pre-push` already runs `make a11y` when a push touches `web/app/`. It is extended with a `make docs` target (the anchor test and the link check) that runs when a push touches the documentation pages, `engine/src/decisions.ts` or `engine/src/analysis/rules.ts`. Both remain skippable with `--no-verify`; the required check on `main` is the authority.

### 7.5 Branch protection

The `docs` job is added to the required status checks for `main`, alongside `engine` and `e2e`. Because the workflow always runs (a docs-only PR skips the heavy jobs by condition and reports success), the same pattern applies: the `docs` job runs its gate on every PR and its tests only when `code == true`.

## 8. Writing guidance for the new pages

- Keep the voice. The current page's register (first person, direct, dry) is a strength; the restructure changes where things live, not how they are said.
- Every section on How it decides has the same shape: *What it decides* (one sentence), *The rule* (prose, in the order the engine tries things), *An example* (a concrete chord or progression, concert pitch, in a table where there is more than one step), *What you can change* (the pin, the pick, the level, the function), *See also* (the reference anchor).
- Prefer a worked example to an adjective. "Advanced reaches for bebop, Lydian and altered colours" tells less than one line showing G7 at each of the three levels.
- Do not restate the engine's code paths; describe the behaviour a user can observe and verify on the sheet.
- Glyphs go through `proseGlyphs` as elsewhere; chord symbols in `UiCode`.

## 9. Phases

1. **Registry and check first.** `DECISIONS`, `decisionHref`, the anchor test, the link check, the `docs` CI job and the gate, with the registry initially pointing every entry at the existing Help and Functions anchors. This makes the check real before any content moves, and the first content PR must satisfy it.
2. **How it decides.** Create the page; move the guide-tone section and the disclaimer; write `scale.level`, `pent.auto`, `hex.auto`, `pick.order`, `spell.*`, `range.instrument`, `arp.line`, `key.area`, `scale.slash`, `scale.unknown`. Add the menu links (§5.3). Retitle Help's sections and regroup the controls.
3. **Reference pages.** `/chart-format` from "The source"; `/glossary`; the shortcuts table; the Arpeggios sheet and the missing features in Help. Optionally `/changes`.
4. **Single-sourcing pass.** `LABELS`, the key map table, the instrument table.

Each phase is a PR that passes the check it introduces. The design doc (`docs/design.md` §2 repository layout and a new §5 "Documentation" entry) is updated in phase 1.

## 10. Open questions

- Should `/how-it-decides` be one page or one page per namespace (`/how-it-decides/guide-tones`)? One page is proposed: the content is perhaps three screens per namespace and the `PageIndex` handles navigation. Revisit if it passes roughly 2,500 words.
- Should the escape line (`Docs: none — …`) also be accepted as a PR label (`no-docs`)? A line in the body is proposed because it travels with the squash commit; a label does not.
- "What changed" is the only page that needs a human to write something at merge time on every user-facing PR. If that proves a chore, drop the page and rely on the PR titles.

## 11. Rulings (2026-10-17)

The owner's answers to §10 and to gaps found while planning Phase 1. Where they differ from the sections above, these win.

- **One page.** `/how-it-decides` is a single page; `decisionHref` gives `/<page>#<anchor>`.
- **Escape line in the body only.** No `no-docs` label.
- **What changed is dropped.** No `/changes` page and no `docs/changelog.md`; PR titles serve.
- **More ids.** The registry adds what the app gained after this spec was drafted: `cells.line`, `cells.system` (the Cells line, #298), `approach.figures`, `approach.place` (approaches, #298, #381), `arp.sheet` (the Arpeggios sheet) and `patterns.run` (the Patterns sheet). The sheets are now four (Changes, Scales, Arpeggios, Patterns).
- **Entries carry an anchor.** `DecisionInfo` gains `anchor`, and `page` gains `help`, so Phase 1 entries point at today's Help sections (`help#guide-lines`) until Phase 2 moves each to `how-it-decides#<id>`.
- **Where the checks run.** The link check runs in the `engine` job after its build (no second build). The gate is its own workflow, `docs.yml`, also triggered on `edited`, so adding the escape line re-runs it without re-running `engine` and `e2e`. Required checks on `main` today are changes, engine, e2e and a11y (ruleset "Main"); adding `docs` is the owner's step after Phase 1 merges.

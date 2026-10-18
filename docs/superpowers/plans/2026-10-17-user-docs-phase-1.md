# User docs Phase 1: decision registry and doc check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every heuristic the app applies gets a stable id with a documented anchor, and a PR that changes user-facing behaviour cannot merge without touching the docs or saying why not.

**Architecture:** A pure registry `DECISIONS` in the engine (beside `RULES`) with `decisionHref`; a vitest test that each id's anchor exists on its page; a build-time link checker over the prerendered site; a `docs` workflow whose gate reads the PR's changed files and body. No content moves in this phase: every entry points at an existing Help or Functions anchor.

**Tech Stack:** TypeScript (strict), vitest + `@nuxt/test-utils` (`mountSuspended`), Node 24 running `.ts` directly (as `web/build/check-headers.ts` does), GitHub Actions, POSIX sh.

**Spec:** `docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md` (§5, §7, §9 Phase 1, §11 Rulings)

## Global Constraints

- `engine/` stays pure: no Vue, DOM or app imports (lint enforces).
- Registry ids are namespaced `<namespace>.<name>`, lowercase, e.g. `guide.move`; analysis rules keep their own ids and anchors `/functions#rule-<id>` and are not copied into `DECISIONS`.
- `/how-it-decides` will be one page (§11): hrefs are `/<page>#<anchor>`, never a sub-path.
- Escape line, PR body only (no label): `^Docs: none (—|--) .+` (reason mandatory).
- No `docs/changelog.md`; the What changed page is dropped (§11).
- Runtime `dependencies` unchanged; the checker and gate are build-time only.
- The link checker never fetches external URLs.

## Review Focus

1. **Escape line added after the PR opens** — editing the body must re-run the gate. `pull_request` defaults omit `edited`, and adding it to `ci.yml` would rerun engine/e2e on every body edit, so the gate lives in its own workflow (Task 5).
2. **Body shapes** — null body (no description), CRLF line endings, `--` for the dash, the line not first, an empty reason (`Docs: none — `) must fail. Tested in Task 5.
3. **Dotted ids** — `#guide.move` is not a valid CSS id selector; tests use `getElementById` / `[id="…"]`, and the link checker compares fragments literally after `decodeURIComponent` (Tasks 3, 4).
4. **URL shapes in the checker** — `/`, `/help`, `/help/`, `/song/x?key=Bb#a`, `&amp;` in hrefs, links to assets (`/og/x.png`, `/sitemap.xml`), and `/api/…` (server, not in the output) (Task 4).
5. **Feature-gated Help paragraphs** (`v-if="cellsOn"`, `approachesOn`, `patternsOn`) — registry entries point at ungated section anchors only, so the anchor test passes with flags off (Task 3 asserts with the flags at their test defaults).

---

### Task 1: Commit the spec with the rulings

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md`

(Done in the planning PR; listed so the executor knows §11 exists.) Status is `design`; §11 records the user's rulings of 2026-10-17: one page; body line only; What changed dropped; `cells.*`, `approach.*`, `patterns.*` ids added; link check in the `engine` job and the gate in its own `docs` workflow.

---

### Task 2: The registry (`engine/src/decisions.ts`)

**Files:**
- Create: `engine/src/decisions.ts`
- Create: `engine/src/__tests__/decisions.test.ts`
- Modify: `engine/src/index.ts` (export), `engine/src/__tests__/__snapshots__/api.test.ts.snap` (via `-u`)

**Interfaces:**
- Produces:
  ```ts
  export type DocPage = 'help' | 'how-it-decides' | 'functions'
  export type DecisionInfo = Readonly<{ id: string; title: string; page: DocPage; anchor: string; summary: string }>
  export const DECISIONS: readonly DecisionInfo[]          // declared `as const satisfies readonly DecisionInfo[]`
  export type DecisionId = (typeof DECISIONS)[number]['id'] | `rule-${string}`
  export const decisionHref: (id: DecisionId) => string    // '/help#guide-lines', '/functions#rule-M3'
  export const decisionOf: (id: DecisionId) => Readonly<{ href: string; title: string; summary: string }>
  ```
  `decisionOf` of `rule-M3` takes `title` = `Rule M3`, `summary` = that rule's `summary` from `RULES`.

**The initial set** (id → `page#anchor`). `anchor` is where the content lives today; Phase 2 moves each to `how-it-decides#<id>`.

| Ids | Now at |
|---|---|
| `scale.level` | `help#controls` |
| `scale.unknown`, `spell.root`, `spell.transpose`, `spell.chord` | `help#editing` |
| `scale.slash`, `key.area` | `functions#rules` |
| `guide.tones`, `guide.start`, `guide.move`, `guide.range`, `guide.meet`, `guide.rest`, `range.instrument` | `help#guide-lines` |
| `arp.line`, `pent.line`, `hex.line`, `cells.line`, `cells.system`, `approach.figures`, `approach.place` | `help#controls` |
| `pent.auto`, `pent.inside`, `hex.auto`, `hex.group`, `pick.order` | `help#practice` |
| `arp.sheet`, `patterns.run` | `help#sheets` |

New ids beyond the spec: `cells.line` (a four-note cell per two beats, read through the chord's scale), `cells.system` (cells A and B in turn, each ending a step from the next), `approach.figures` (the figures and their spelling: diatonic steps from the scale shown, no B♯/E♯/C♭/F♭), `approach.place` (beats given up by the chord before; none on the first chord, after a rest, across a gap, under an eighth, or out of range), `arp.sheet` (the Arpeggios sheet: 7th Chord over two octaves, Extended stacking 7–9–11–13, `placeRun`), `patterns.run` (a pattern's moves over scale or chord tones, direction). Titles and summaries: write them from `help.vue` and `docs/design.md` §5 in the Help page's voice; one sentence each, ending in a full stop.

- [ ] **Step 1: Write the failing test** `engine/src/__tests__/decisions.test.ts`

  ```ts
  it('has unique namespaced ids, none shadowing a rule', () => {
    const ids = DECISIONS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-z]+(-[a-z]+)*$/)
  })
  it('holds the spec’s set and the rulings’ additions', () => {
    for (const id of ['scale.level', 'scale.unknown', 'scale.slash', 'key.area', 'guide.tones', 'guide.start', 'guide.move', 'guide.range', 'guide.meet', 'guide.rest', 'arp.line', 'pent.auto', 'pent.inside', 'pent.line', 'hex.auto', 'hex.group', 'hex.line', 'pick.order', 'spell.root', 'spell.transpose', 'spell.chord', 'range.instrument', 'cells.line', 'cells.system', 'approach.figures', 'approach.place', 'arp.sheet', 'patterns.run'])
      expect(DECISIONS.map((d) => d.id), id).toContain(id)
  })
  it('gives each a title and a one-sentence summary', () => {
    for (const d of DECISIONS) { expect(d.title, d.id).not.toBe(''); expect(d.summary, d.id).toMatch(/^[A-Z].*\.$/) }
  })
  it('links a decision to its page and anchor', () => {
    expect(decisionHref('guide.move')).toBe('/help#guide-lines')
    expect(decisionHref('key.area')).toBe('/functions#rules')
  })
  it('links an analysis rule to its row on Functions', () => {
    expect(decisionHref('rule-M3')).toBe('/functions#rule-M3')
    expect(decisionOf('rule-M3').summary).toBe(RULES.find((r) => r.id === 'M3')!.summary)
  })
  it('refuses an unknown rule', () => expect(() => decisionHref('rule-Z9')).toThrow('unknown decision: rule-Z9'))
  ```
  (`M3` must be a real `RULES` id; check `engine/src/analysis/rules.ts` and use one that exists.)

- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/decisions.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `engine/src/decisions.ts` per the Interfaces block; import `RULES` from `./analysis`. Unknown id → `throw new Error(\`unknown decision: ${id}\`)`. Header comment pointing at the spec and at `web/test/docs/decisions.test.ts`.
- [ ] **Step 4:** Export `DECISIONS, decisionHref, decisionOf, type DecisionId, type DecisionInfo, type DocPage` from `engine/src/index.ts`; `npx vitest run -u src/__tests__/api.test.ts`; review the snapshot diff (three names added).
- [ ] **Step 5:** `make test` → PASS.
- [ ] **Step 6:** Commit `engine/src/decisions.ts engine/src/__tests__/decisions.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap`: "The decision registry: every heuristic has an id and an anchor".

---

### Task 3: Anchor coverage and `<DecisionLink>`

**Files:**
- Create: `web/test/docs/decisions.test.ts`, `web/app/components/DecisionLink.vue`, `web/test/DecisionLink.test.ts`

**Interfaces:**
- Consumes: `DECISIONS`, `decisionOf`, `DecisionId` (Task 2).
- Produces: `<DecisionLink id="guide.move">` → `UiTextLink` with `href` = `decisionOf(id).href`, `title` = its summary; default slot, fallback label `How this is chosen`.

- [ ] **Step 1: Failing tests.**
  `web/test/docs/decisions.test.ts`: a map `PAGES: Record<DocPage, Component | null>` = `{ help: Help, functions: Functions, 'how-it-decides': null }`; mount each non-null page once with `mountSuspended`; for every `d` in `DECISIONS`: `expect(PAGES[d.page], d.id).not.toBeNull()` and `expect(wrapper.findAll(\`[id="${d.anchor}"]\`), d.id).toHaveLength(1)`. (Rules: `functionsPage.test.ts` already asserts one `rule-<id>` row per `RULES` entry; leave it.)
  `web/test/DecisionLink.test.ts`: `mountSuspended(DecisionLink, { props: { id: 'guide.move' } })` → the `a` has `href="/help#guide-lines"`, a `title` equal to `decisionOf('guide.move').summary`, text `How this is chosen`; with slot `Why?` the text is `Why?`.
- [ ] **Step 2:** `cd web && npx vitest run test/docs test/DecisionLink.test.ts` → anchor test PASS (anchors exist), DecisionLink FAIL (no component). Then temporarily set one entry's anchor to `nope`, see the anchor test FAIL naming the id, revert.
- [ ] **Step 3:** Implement `DecisionLink.vue` (`<script setup lang="ts">`, prop `id: DecisionId`).
- [ ] **Step 4:** `make test` and `make lint` → PASS.
- [ ] **Step 5:** Commit: "Each decision's anchor is checked on its page; DecisionLink links to it".

---

### Task 4: Link checker

**Files:**
- Create: `web/build/links.ts`, `web/build/links.test.ts`, `web/build/check-links.ts`
- Modify: `web/package.json` (script), `.github/workflows/ci.yml` (`engine` job)

**Interfaces:**
- Produces: `brokenLinks(pages: ReadonlyMap<string, string>, files: ReadonlySet<string>): string[]` in `links.ts`. `pages`: output-relative path of each `.html` → its HTML; `files`: every output-relative file path. Returns `"<page>: <href> (<missing page|missing #fragment>)"`, sorted.

Rules: only `<a … href="…">`; decode `&amp;`; skip `http:`, `https:`, `//`, `mailto:`, `tel:`, `javascript:`, and `/api/`; strip `?query`; `#frag` alone targets the same page; a path resolves to the first of `p`, `p/index.html`, `p.html` (trailing slash stripped, `/` → `index.html`) present in `files`; a fragment must match some `id="…"` in the target page's HTML after `decodeURIComponent`; a fragment on a non-HTML target is not checked.

- [ ] **Step 1: Failing tests** in `links.test.ts`, each a two- or three-page fixture:
  `passes a link to a page and an id on it` (`/help#guide-lines` → `help/index.html` with `id="guide-lines"`); `passes /, /help/ and a query` (`/song/x?key=Bb`); `passes a same-page fragment` (`#quick`); `passes a dotted id` (`/how-it-decides#guide.move`); `passes an asset` (`/og/x.png` in `files`); `skips external links and /api/`; `decodes &amp;` (`/library?a=1&amp;b=2`); `reports a missing page` → `['index.html: /nope (missing page)']`; `reports a missing fragment` → `['index.html: /help#gone (missing #gone)']`.
- [ ] **Step 2:** `cd web && npx vitest run build/links.test.ts` → FAIL.
- [ ] **Step 3:** Implement `brokenLinks` (regex over `<a\b[^>]*\bhref="([^"]*)"` and `\bid="([^"]*)"` is enough for our own prerendered HTML).
- [ ] **Step 4:** `check-links.ts`: walk `.output/public`, build `pages`/`files`, print problems and `process.exit(1)` if any, else print `links: N pages, ok`. Header comment like `check-headers.ts`. Script `"check:links": "node build/check-links.ts"`.
- [ ] **Step 5:** `cd web && npm run build && npm run check:links` → ok. If it reports real broken links on the site, fix them in this task (each is a bug the checker exists to catch) and list them in the PR.
- [ ] **Step 6:** `ci.yml` `engine` job: `- run: npm run check:links` right after `- run: npm run build`, with a one-line comment. (Ruling: no second build in a separate job.)
- [ ] **Step 7:** `make test`, `make lint` → PASS. Commit: "A link checker over the prerendered site: every internal link and fragment resolves".

---

### Task 5: The docs gate and its workflow

**Files:**
- Create: `web/build/docsGate.ts`, `web/build/docsGate.test.ts`, `web/build/check-docs.ts`, `.github/workflows/docs.yml`, `.github/pull_request_template.md`

**Interfaces:**
- Produces: in `docsGate.ts`
  ```ts
  export const NEEDS_DOCS: readonly RegExp[]   // ^engine/src/(?!__tests__/), ^engine/chord_scales\.json$, ^web/app/components/, ^web/app/composables/, ^web/app/pages/song/
  export const HAS_DOCS: readonly RegExp[]     // ^web/app/pages/(help|how-it-decides|functions|chart-format|glossary)\.vue$, ^engine/src/decisions\.ts$
  export type GateResult = Readonly<{ ok: true; why: string } | { ok: false; triggers: readonly string[]; message: string }>
  export const docsGate: (files: readonly string[], body: string | null) => GateResult
  ```
  `why`: `'no user-facing change'`, `'docs changed'`, or `'Docs: none — <reason>'`. `message` names up to 10 triggering files and quotes the escape line format.

- [ ] **Step 1: Failing tests** `docsGate.test.ts`:
  `passes a charts-only PR` (`engine/charts/x.txt`, `engine/fixtures/golden.json`); `passes engine tests alone` (`engine/src/__tests__/a.test.ts`); `passes a behaviour change with Help changed`; `passes a decisions.ts change alone`; `fails a component change with no docs` (`triggers` = `['web/app/components/X.vue']`, `message` contains `Docs: none — `); `passes with the escape line, em dash or two hyphens, not first, CRLF` (body `'Fixes #1\r\n\r\nDocs: none -- internal refactor\r\n'`); `fails an empty reason` (`'Docs: none — '`); `fails a null body`; `fails the line indented or lower-case` (`'docs: none — x'`).
- [ ] **Step 2:** `cd web && npx vitest run build/docsGate.test.ts` → FAIL.
- [ ] **Step 3:** Implement `docsGate`.
- [ ] **Step 4:** `check-docs.ts`: changed files from stdin (one per line), body from `PR_BODY`; prints `docs: ok (<why>)` or the message, exit 1 on failure. Imports only `./docsGate.ts` (runs with no `npm ci`).
- [ ] **Step 5:** `.github/workflows/docs.yml`, job id and name `docs`:
  - `on: pull_request: types: [opened, synchronize, reopened, edited]`; `permissions: contents: read`; concurrency group `docs-${{ github.event.pull_request.number }}`, cancel in progress.
  - `if: github.actor != 'dependabot[bot]'` (a skipped required check reports success).
  - checkout (same pinned SHA as `ci.yml`, `fetch-depth: 0`), setup-node (same pin, `node-version: '24'`, no cache), then
    `git diff --name-only "origin/$BASE_REF...HEAD" | node web/build/check-docs.ts` with `env: BASE_REF: ${{ github.base_ref }}`, `PR_BODY: ${{ github.event.pull_request.body }}` (env, never interpolated into the script).
  - Top comment: why it's a separate workflow (Review Focus 1).
- [ ] **Step 6:** `.github/pull_request_template.md`: a `## Docs` section with the two options (`Docs changed: <pages>` / `Docs: none — <reason>`) and one line on when each applies.
- [ ] **Step 7:** Local dry run: `git diff --name-only origin/main...HEAD | PR_BODY='' node web/build/check-docs.ts` → exits 1 naming the components/engine files of this branch; with `PR_BODY='Docs: none — tooling only'` → `docs: ok`.
- [ ] **Step 8:** `make test`, `make lint` → PASS. Commit: "The docs gate: a user-facing change needs a docs change or a reason".

---

### Task 6: `make docs`, the pre-push hook, and the design doc

**Files:**
- Modify: `Makefile`, `.githooks/pre-push`, `docs/design.md` (§2 layout; new §5 "Documentation"), `CLAUDE.md` (Working here)

- [ ] **Step 1:** `Makefile` target `docs:` with comment: `cd web && npx vitest run test/docs && npm run build && npm run check:links`.
- [ ] **Step 2:** `.githooks/pre-push`: collect a second list, `git diff --name-only "$base" "$local_sha" -- web/app/pages/help.vue web/app/pages/functions.vue web/app/pages/how-it-decides.vue web/app/pages/chart-format.vue web/app/pages/glossary.vue engine/src/decisions.ts engine/src/analysis/rules.ts`; run `make docs` when it is non-empty (or `unknown`), then `make a11y` when the interface list is; replace `exec make a11y` with sequential calls that exit non-zero on the first failure. Update the header comment.
- [ ] **Step 3:** Verify: a scratch commit touching only `engine/src/decisions.ts` → `.githooks/pre-push` fed `refs/heads/x <sha> refs/heads/x <origin/main sha>` on stdin runs `make docs` and not `make a11y`; one touching only `web/app/components/X.vue` runs only `make a11y`. Drop the scratch commit.
- [ ] **Step 4:** `docs/design.md`: §2 adds `engine/src/decisions.ts`, `web/build/links.ts`/`check-links.ts`, `web/build/docsGate.ts`/`check-docs.ts`, `.github/workflows/docs.yml`; new §5 "Documentation" entry: the registry, `decisionHref`/`DecisionLink`, the three checks, the escape line, the spec link.
- [ ] **Step 5:** `CLAUDE.md` Working here: one bullet — adding a heuristic adds a `DECISIONS` row; user-facing PRs touch the docs pages or carry `Docs: none — <reason>`; `make docs`.
- [ ] **Step 6:** `make test`, `make lint` → PASS. Commit: "make docs and the pre-push hook run the doc checks; design doc".
- [ ] **Step 7:** PR body says `Docs changed: engine/src/decisions.ts` (the registry is docs infrastructure) and asks the user to add `docs` to ruleset "Main"'s required checks after merge (their call; not done by the agent).

---

## After this

- **Phase 2 — How it decides:** create `/how-it-decides`; move the disclaimer and the guide-tone section; one section per `DECISIONS` id with anchor `= id`; flip each entry's `page`/`anchor`; add the reverse warning (an anchor on the page with no registry entry); add the menu links (§5.3) with `<DecisionLink>`; retitle Help's sections and regroup the controls. Fix the stale Scale level copy ("writes the scales into the chart" contradicts the design rule that a level is a view preference).
- **Phase 3 — Reference pages:** `/chart-format`, `/glossary`, shortcuts table, the Arpeggios/Patterns sheets and missing features in Help.
- **Phase 4 — Single-sourcing:** `LABELS`, the key map table, the instrument table.

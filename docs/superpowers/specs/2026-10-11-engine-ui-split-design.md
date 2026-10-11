# Splitting the engine and the UI: design

Date: 2026-10-11. Status: **draft for review**. Written overnight without the user, so every decision is marked
**Assumed (confirm)** until the user confirms it. Plan: [2026-10-11-engine-ui-split.md](../plans/2026-10-11-engine-ui-split.md).

The request, in the user's words: "Separating the project into two repos/projects, one for the analysis engine and
one for the UI. You can plan and spec this one."

## Open questions for the user

Most consequential first. Each links to its row in [Decisions](#decisions); the spec and the plan follow the
assumed answer.

1. **Two packages in this repo now, or two GitHub repos now?** Assumed: one repo with two npm workspace packages
   (`engine/` and `web/`), with a separate engine repo later, when a trigger in [Phase 2](#phase-2-two-repos-conditional)
   appears. The evidence (44% of recent code PRs change both sides; a one-week-old, single-author project) argues
   against separate repos today. → **D1**
2. **What is the split for?** Assumed: a hard boundary and two projects that can each be read, tested and reasoned
   about alone, with no second consumer of the engine yet. If there is a consumer in view (a CLI, an API, another
   site, outside contributors to the analysis), Phase 2 moves earlier. → **D1**, **D9**
3. **Who owns `charts/`?** Assumed: the engine package. The analyser writes the charts, and the golden and analysis
   fixtures and 15 engine test files read them. The site only displays them. Cost: once there are two repos, a new
   chart reaches the site only with an engine release. → **D2**
4. **Layout.** Assumed: a new top-level `engine/` package; `web/` stays where it is, so Vercel's root directory
   doesn't change. → **D3**
5. **CI check names.** Assumed: keep the jobs `engine` and `e2e`, so the `protect main` ruleset needs no edit; the
   `engine` job now runs both packages' lint, typecheck and tests. → **D6**
6. **Package name.** Assumed: `@chord-scale-maker/engine`, private, version `0.0.0`. Publishing it later needs the
   npm scope `chord-scale-maker` (a free npm organisation). → **D7**
7. **Public API.** Assumed: keep `index.ts` exporting everything it does today, and add a snapshot test of the
   exported names so any change to the surface shows up in review. → **D8**
8. **How a separate engine would be published (Phase 2 only).** Assumed: the public npm registry, with trusted
   publishing from GitHub Actions and SemVer from `0.1.0`. → **D9**
9. **Which repo keeps the history, issues and Vercel link (Phase 2 only).** Assumed: the current repo becomes the
   app repo; the engine repo is a new repo cut with `git filter-repo`. The public repo's history is never
   rewritten. → **D10**
10. **Dev tools per package.** Assumed: each package declares its own dev tools (TypeScript, Vitest, ESLint) at the
    same exact versions, so the engine can leave without changes. → **D13**

## Summary

Make the engine its own npm workspace package, `@chord-scale-maker/engine`, in a top-level `engine/` folder that owns
the engine's code, its data (`chord_scales.json`, `charts/`, `fixtures/`) and its tools (the analyser, the golden test,
`fixture-scales`, `guide-lines`). The Nuxt app in `web/` depends on it by package name, and the package's `exports`
map is the only way in. The repo, its PR flow, its CI check names and its Vercel project stay as they are. A separate
engine repo (Phase 2) is specified but not scheduled: it costs two PRs, a release and a version bump for every change
that spans both sides, which is close to half of them today, and nothing needs it yet.

## Understanding

- **Asked for:** one project for the analysis engine and one for the UI, as a spec and a plan to review in the
  morning. Nothing is built, pushed or published tonight.
- **Not said, assumed:** the purpose is a clear boundary and separately workable projects, not a second consumer.
  The site's behaviour, URLs, security posture and deploys must not change. Every existing check (unit, golden,
  e2e, header check, `npm audit --omit=dev`) must keep running and keep gating merges.
- **Success:** the engine builds, lints, typechecks and tests on its own, from its own folder; the app reaches the
  engine only through the package's public entry; `fixtures/golden.json` and `fixtures/analysis.json` come through
  byte for byte; the deployed site is unchanged; and moving the engine to its own repo later is a mechanical step,
  not a redesign.

## Evidence

Everything below was read from the code at `0814306` (main).

### E1. The boundary today

- **Engine → app: none.** No file under `web/engine/` imports from `app/`, `server/`, `build/`, Vue, VexFlow or any
  package. Its only import outside itself is the JSON file `../../chord_scales.json`, in `qualities.ts` and
  `levels.ts`. Its tsconfig (`tsconfig.engine.json`) has `lib: ["ES2023"]` and no DOM. `share.ts` uses
  web-standard globals that Node also has (`Blob`, `CompressionStream`, `btoa`).
- **App → engine: the index only.** 48 files (34 in `app/`, 14 in `test/`) import from `~~/engine`, the folder's
  `index.ts`. No app or test file reaches into a module path.
- **Deep imports exist only in the tools:** `scripts/analyse.ts` imports `../engine/analysis` (`analyse`,
  `applyAnalysis`, `ambiguities`, `contextLine`: not in the index), and `scripts/guideLines.ts` imports
  `../engine/keySignature`. Both scripts are engine tools (below), so these become internal imports.
- **Two places read across the boundary by file path:**
  - `app/utils/library.ts`: `import.meta.glob('../../../charts/*.txt', { query: '?raw', eager: true })`.
  - `e2e/functions.spec.ts` reads the source text of `../engine/analysis/rules.ts` to list the rule ids, because
    "the engine can't be imported here (its JSON import needs a bundler)".
- **Engine tests read repo data** by two kinds of path: `new URL('../../../charts/', import.meta.url)` and
  cwd-relative `readFileSync('../charts/…')` (the cwd is `web/`). With the two JSON imports in `qualities.ts` and
  `levels.ts`, that is 33 lines in 19 files, fixed in the plan's Task 3.

### E2. The engine's public API, as the app uses it

The index re-exports 23 modules (`export *`, about 200 top-level exports) plus 18 chosen names from `analysis/`;
`notes.ts` re-exports five more (`chartKeyOf`, `functionChoices`, `FunctionChoice`, `Key`, and `sameFunction`). The
app and its tests import **107** names:

| Module | Names the app imports (†: tests only) |
| --- | --- |
| `chart.ts` | `ChartDoc`, `Diagnostic`, `MetaKey`, `Parsed`, `Row`, `chartHeading`, `chartMeta`, `expandRows`, `isFatal`, `isValidKey`, `keyLabel`, `parseChart`, `serializeChart` |
| `edit.ts` | `RowField`, `cellError`, `insertRowAfter`, `removeLine`, `sameChart`, `setKeyLine`, `setMeta`, `setRowChord`, `setRowField` |
| `notes.ts` | `RowNote`, `insertKeyChange`, `rowNotes` |
| `sheet.ts` | `ModeChoice`, `StaffModel`, `buildSheet`, `noteText`, `pageSubtitle`, `toVexKey` |
| `changes.ts` | `ChangesBar`, `ChangesChord`, `ChangesLine`, `buildChanges`, `changesLinesPerPage` |
| `guideTones.ts` | `GuideNote`, `GuideShow`, `NO_GUIDES`, `guidesOn` |
| `keySignature.ts` | `signatureAccidentals` |
| `practice.ts` | `PRESETS`, `PRESET_LABELS`, `PracticeBox`, `PracticeSelection`, `Preset`, `compareKeys`, `litKeys`, `practiceBoxes`, `practiceSelectionFrom` |
| `levels.ts` | `LEVEL_LABELS`, `LevelState`, `SCALE_LEVELS`, `ScaleLevel`, `isScaleLevel`, `relevel` |
| `instruments.ts` | `INSTRUMENTS`, `InstrumentName`, `instrumentLabel`, `isInstrumentName` |
| `part.ts` | `CONCERT`†, `MODES`, `Mode`, `Part`, `Pitched`, `partFor` |
| `pitch.ts` | `LETTERS`, `Letter`†, `Spelled`, `accText`, `enharmonics`, `glyphs`, `proseGlyphs`, `rootName` |
| `scales.ts` | `SCALES`, `parseScale`, `samePitchScale` |
| `qualities.ts` | `ScaleOption`, `resolveQuality` |
| `chord.ts` | `ChordToken`, `parseChord` |
| `transpose.ts` | `TRANSPOSE_KEYS`, `transposeChart` |
| `share.ts` | `ShareView`, `encodeShare`, `decodeShare` |
| `limits.ts`, `util.ts` | `LIMITS`; `chunk`, `isSyncCopy` |
| `analysis/` | `FunctionChoice`, `chartKeyOf`, `functionChoices`, `Key`, `parseKey`, `FUNCTION_GROUPS`, `FunctionGroup`, `functionsTable`, `CATALOGUE_KEYS`†, `parseFunction`, `sameFunction`, `spellings`, `FUNCTION_ERRORS`†, `RULES`, `RuleInfo`, `TIERS`, `dominantScaleTable`, `ruleParts` |

So the app uses about half the exported surface. The rest serves the engine's own tools and tests (`guideToneLines`,
`voiceLead`, `resolveScale`, …).

### E3. Who uses which data

| Data | Read by the engine | Read by the app | Written by |
| --- | --- | --- | --- |
| `chord_scales.json` (16 KB) | `qualities.ts`, `levels.ts` (bundled in), tests, golden | only through the engine | hand edits |
| `charts/*.txt` (242 charts, 1.1 MB) | 15 test files, golden and analysis fixtures, `analyse`, `guide-lines` | `library.ts` (raw text, build time); `test/library.test.ts` | the analyser (`--write --save`), hand edits |
| `fixtures/golden.json` (2.6 MB), `fixtures/analysis.json` (0.8 MB) | the golden tests, `fixture-scales` | never | `make golden` |
| `data/quotes.json` | never | `build/quotes.ts` (navbar), `build/quotes.test.ts` | hand edits |

Neither fixture contains a file path, so they don't change when the files move.

### E4. How often a change spans both sides

Of the last 60 merged PRs, 50 touched code. **22 of those 50 (44%) changed both** the engine side (engine, its
data or its tools) and the app side, among them #100 analysis rules, #99 function labels, #89 the functions page,
#87 guide tone lines, #85 key signatures, #83 chart functions and #64 the Changes sheet. 14 were engine-only and 14
app-only. Across all 353 non-merge commits: 49 both, 102 engine-only, 125 app-only. The repo is a week old
(first commit 2026-10-04) with 453 commits, one author and three milestone tags (`v1-launch`, `v2`, `v2-changes`).
docs/design.md §12.11 records the same lesson from the retired Python CLI: "keeping two engines in step doubled
every change."

### E5. Build, deploy and security facts

- **Vercel** (project `chord-scale-maker`, read from its settings): root directory `web`, "include source files
  outside the root directory" on, framework Nuxt, Node 24.x, production branch `main`, a Git-integration preview
  deploy per PR. `web/vercel.json` sets `buildCommand: "nuxt build"`, which overrides a stale dashboard setting
  (`npm run generate`, a script that no longer exists).
- **Runtime dependencies** are only what ships to browsers (`vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`,
  `@fontsource-variable/jost`). CI gates on `npm audit --omit=dev --audit-level=high`. `overrides` (`simple-git`)
  sits in `web/package.json`. The engine has no dependencies at all.
- **`vite-node`**, which runs `npm run analyse`, `guide-lines` and `fixture-scales`, is not declared anywhere: it
  arrives transitively through `nuxt` → `@nuxt/vite-builder` (6.0.0). Without Nuxt, the engine must declare it.
- **CSP** (`build/csp.ts`, run on each prerendered page): no inline scripts of our own, no `eval`, no third-party
  origins except the About video's frame. The engine is plain bundled code; moving it changes none of this.
- **Version** (`build/version.ts`): the commit's date and short hash, shown in the footer and sent with each
  contact-form email and issue report. Decision §12.10: "Revisit SemVer only if the engine is published as a
  package."

### E6. CI and the ruleset

- One workflow, `.github/workflows/ci.yml`, on pull requests only. A `changes` job decides whether anything besides
  `docs/**` and `*.md` changed; then `engine` (npm ci, lint, typecheck, test, build, `check:headers`, audit) and
  `e2e` (Playwright against the production build, all flags on) run with `working-directory: web` and cache on
  `web/package-lock.json`.
- The `protect main` ruleset (read with `gh api`) requires the status checks **`engine`** and **`e2e`** from GitHub
  Actions, merge commits only, PRs required, no force pushes, no deletion.
- Dependabot watches npm in `/web` and Actions in `/`.

### E7. History

- The engine has lived at `web/engine/` since it was ported (2026-10-04). Before that the engine was the Python CLI
  at the root (`jazz_scales.py`, `tests/`, `tools/export_fixtures.py`), retired after `v1-launch`.
- `chord_scales.json`, `charts/` and `fixtures/` have always been at the root.
- `design/tailwind-plus/`, `design/leadsheets/` and `design/sources/` are git-ignored and have never been
  committed on any ref (`git log --all` over those paths is empty), so no history rewrite can bring them back.
- The largest objects are the successive versions of `fixtures/golden.json` (about 2.6 MB each).

## Approaches

### A. Keep one package; enforce the boundary with lint rules

Add `no-restricted-imports` rules (the engine may not import app code, Vue or VexFlow; the app may import only
`~~/engine`), and move nothing.

- **For:** no churn. Today's boundary is already clean (E1).
- **Against:** it doesn't give two projects. The engine still can't be tested, typechecked or linted without Nuxt,
  its data sits at the root next to the app's, and it still borrows `vite-node` from Nuxt. It does nothing to make a
  later split easier.

### B. Two packages in one repo (npm workspaces) — recommended

A root `package.json` with `workspaces: ["engine", "web"]`. `engine/` holds the engine's code, data, fixtures and
tools as the package `@chord-scale-maker/engine`; `web/` depends on it by name.

- **For:** two real projects, each with its own manifest, tests, typecheck and lint, and a boundary enforced by
  the package's `exports` map, not by convention. A change that spans both is still one branch, one PR, one CI run,
  one e2e run against the change, and one Vercel preview. Ruleset, Vercel project and deploys stay as they are.
  Everything the engine owns ends up under one folder, so a later move to its own repo is one `git filter-repo` run.
- **Against:** one more manifest; the lockfile moves to the root; about 310 paths move (mostly `git mv`, plus 48
  import lines and 33 path lines); Vercel has to install from the workspace root (it supports npm workspaces; the
  PR's preview deploy proves it).

### C. Two repos now

An engine repo that publishes a package, and the current repo as the app, depending on a released version. The
package can be delivered three ways:

| Delivery | How it works | Cost here |
| --- | --- | --- |
| Public npm registry | `npm publish` from the engine repo's CI (trusted publishing, no token) | Needs a build step (the engine is TypeScript source with a JSON import, which Node can't load without a bundler) and an npm scope. The cleanest for consumers; Dependabot bumps it. |
| GitHub Packages | publish to `npm.pkg.github.com` | Installs need a token even for public packages, so Vercel and every contributor need a PAT and an `.npmrc`. The scope must be the GitHub owner (`@kevdog`). Rejected. |
| Git dependency | `"…": "github:KevDog/<engine>#v0.3.0"`, built by a `prepare` script on install | No registry and no token, but slower installs (dev tools installed to build), weaker `npm audit` and Dependabot coverage, and the build runs inside Vercel's install. |

- **For:** independent histories, issues and release cadences; an engine anyone could install.
- **Against, today:** every spanning change (44% of code PRs, E4) becomes an engine PR, a release, then an app PR
  that bumps the version; the app's e2e can't test an engine change until it is released (or pinned to a branch
  commit); a new chart reaches the site only with an engine release; two rulesets, two Dependabot setups, two CI
  configs; SemVer for an API whose output changes with almost every analysis PR. There is no second consumer to
  pay for any of it.

### Recommendation

**B now; C later only if a trigger appears** ([Phase 2](#phase-2-two-repos-conditional)). The evidence argues against
separate repos now: the boundary is already clean, so B gets nearly all of the separation C would, while C's costs
fall on exactly the changes this project makes most often. B is also the first half of C, so nothing is wasted if
C comes later.

## Decisions

| # | Question | Decision | Status | Alternatives | Why |
| --- | --- | --- | --- | --- | --- |
| D1 | Repo shape | One repo, two npm workspace packages (B). Separate repos (C) only when a Phase 2 trigger appears. | **Assumed (confirm)** | A: lint rules only. C: two repos now. | E4: 44% of code PRs span both; one author; no second consumer. B gives the boundary at no cost to the PR flow and prepares C. |
| D2 | Owner of `charts/` | The engine package (`engine/charts/`). The app reads them through the package. | **Assumed (confirm)** | The app (`web/charts/`), with the engine's tests reading across. A third package, `library`. | The analyser writes them; the fixtures and 15 engine test files read them; "make a chart" is all engine commands. The app only displays them. A third package adds a manifest for no gain. |
| D3 | Layout | `engine/` at the root, holding `src/` (today's `web/engine/`), `scripts/`, `charts/`, `fixtures/`, `chord_scales.json`. `web/` stays. | **Assumed (confirm)** | `packages/engine` + `apps/web`: conventional, but moves Vercel's root directory and every app path. | Smallest diff. Vercel's root directory stays `web`. |
| D4 | Workspace tool | npm workspaces. | **Assumed (confirm)** | pnpm or Yarn workspaces; Turborepo on top. | The project uses npm; two packages need no task runner; Vercel and Dependabot support npm workspaces. |
| D5 | What the engine package ships | TypeScript source: `exports` points at `src/index.ts`; no build step. | **Assumed (confirm)** | Build a `dist/` now (as Phase 2 needs). | Vite (Nuxt, Vitest, vite-node) compiles linked workspace sources already; a build step is only needed for publishing. YAGNI. |
| D6 | CI job names | Keep `engine` and `e2e`. `engine` runs lint, typecheck and test for both packages, then the app's build, header check and audit. | **Assumed (confirm)** | Separate `engine` and `web` jobs, adding `web` to the ruleset (a settings change the user makes). | The ruleset needs no edit; the name `engine` is already a misnomer for a job that builds the app, so nothing new is lost. |
| D7 | Package name | `@chord-scale-maker/engine`, `private: true`, version `0.0.0`. The app's package keeps its name (`jazz-scales-web`). | **Assumed (confirm)** | `@kevdog/…` (the scope GitHub Packages would require); unscoped `chord-scale-engine`. | Reads as what it is; private now, so the scope costs nothing until Phase 2. Renaming later touches 48 import lines. |
| D8 | Public API | Keep `index.ts` as it is (no narrowing). Add a snapshot test of the index's runtime export names. | **Assumed (confirm)** | Narrow the index to the 107 names the app uses (E2) now. | No behaviour change in a restructuring PR; the snapshot makes any later change to the surface visible in review, which Phase 2's SemVer needs. Narrowing is a separate, later decision. |
| D9 | Phase 2 delivery | Public npm, trusted publishing from GitHub Actions, SemVer from `0.1.0`, built with Vite library mode + `tsc` declarations. | **Assumed (confirm)** | Git dependency on tags; GitHub Packages (rejected: token for every install). | Normal installs, `npm audit` and Dependabot coverage; no long-lived token. |
| D10 | Phase 2 repos | The current repo becomes the app repo and keeps its history, issues, PRs, ruleset and Vercel link. A new engine repo is cut from a fresh clone with `git filter-repo`, keeping the pre-move paths. The public repo's history is never rewritten. | **Assumed (confirm)** | `git subtree split --prefix=engine` (loses all history before the move); making the current repo the engine repo (moves the Vercel link and issues). | filter-repo keeps the engine's whole history, including the Python CLI's; the site keeps everything it is attached to. |
| D11 | Docs | Stay at the root in Phase 1; `design.md` updated in place. Split only in Phase 2. | **Assumed (confirm)** | Move engine docs into `engine/docs/` now. | Docs PRs skip CI by the `docs/**` rule; moving them now churns links for no gain. |
| D12 | `data/quotes.json` | Stays where it is, owned by the app. | **Assumed (confirm)** | Move into `web/`. | Not engine data; in Phase 2 the app keeps the current repo, so it never moves. |
| D13 | Dev tools | Each package declares its own dev tools at the same exact versions (`typescript`, `vitest`, `@types/node`, `eslint`); the engine adds `vite-node` 6.0.0 and `@nuxt/eslint-config` 1.17.0. npm hoists one copy. | **Assumed (confirm)** | Shared tools in the root `devDependencies`. | The engine's manifest stays complete, so it can leave the repo unchanged. Drift risk: see [Risks](#risks). |
| D14 | Root commands | The Makefile stays the interface: `make test` and `make lint` cover both packages; `make golden` runs in the engine. | Follows from D1 | — | CLAUDE.md and the habits around it keep working. |

## Architecture (Phase 1)

```text
package.json              # NEW: private root, workspaces ["engine", "web"], engines, overrides
package-lock.json         # moved from web/
engine/                   # NEW package @chord-scale-maker/engine
  package.json            # exports, scripts (test, typecheck, lint, golden, analyse, guide-lines, fixture-scales)
  tsconfig.json           # today's tsconfig.engine.json, over src/ and scripts/
  vitest.config.ts        # node environment, src/**/*.test.ts
  eslint.config.mjs       # @nuxt/eslint-config's createConfigForNuxt + the boundary rule
  chord_scales.json       # moved from the root
  charts/*.txt            # moved from the root
  fixtures/               # golden.json, analysis.json, moved from the root
  scripts/                # analyse.ts, fixtureScales.ts, guideLines.ts, moved from web/scripts/
  src/                    # today's web/engine/, unchanged inside (index.ts, analysis/, __tests__/)
web/                      # the Nuxt app, Vercel root directory (unchanged)
  package.json            # + dependency "@chord-scale-maker/engine": "*"; engine scripts removed
  tsconfig.build.json     # was tsconfig.engine.json, now over build/ only
  vitest.config.ts        # projects "node" (build/, server/) and "app"
  …                       # app/, server/, build/, e2e/, test/ as today
data/quotes.json          # app (unchanged)
docs/                     # unchanged location
```

Dependency direction: `web` → `@chord-scale-maker/engine` → nothing. The engine never imports the app (today, and
enforced by its lint rule and by having no dependencies to import).

### The engine package

```json
{
  "name": "@chord-scale-maker/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./src/index.ts",
    "./charts/*": "./charts/*",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "golden": "UPDATE_GOLDEN=1 vitest run src/__tests__/golden.test.ts src/__tests__/analysis.fixture.test.ts",
    "analyse": "vite-node scripts/analyse.ts --",
    "guide-lines": "vite-node scripts/guideLines.ts --",
    "fixture-scales": "vite-node scripts/fixtureScales.ts --"
  },
  "devDependencies": { "@nuxt/eslint-config": "1.17.0", "@types/node": "26.6.4", "eslint": "10.12.0", "typescript": "5.9.3", "vite-node": "6.0.0", "vitest": "5.0.3" },
  "engines": { "node": "24.x" }
}
```

- **`exports` is the boundary.** With `moduleResolution: "Bundler"` (Nuxt's and the engine's), TypeScript and Vite
  honour `exports`, so `@chord-scale-maker/engine/src/analysis` doesn't resolve: the app gets the index, the raw
  charts and the manifest, nothing else.
- **Source, not a build** (D5). The workspace link resolves to `engine/src/index.ts`, outside `node_modules`, so
  Vite compiles it like app code, JSON import included. `nuxt.config.ts` adds the package to `build.transpile` so
  Nitro's server bundle inlines it during prerendering rather than treating it as external.
- **No dependencies.** The engine is bundled into the browser JS, so it is a runtime `dependency` of the app by the
  project's rule ("runtime dependencies are only what ships to browsers"). It adds nothing to `npm audit
  --omit=dev`, because it is a local link with no dependencies of its own.
- **Lint boundary:** `no-restricted-imports` in `engine/eslint.config.mjs` forbids `vue`, `@vue/*`, `vexflow`,
  `#app`, `#imports`, `~/…` and `~~/…`, so "no Vue/DOM imports" is checked, not only stated. `lib: ["ES2023"]` keeps
  DOM types out.

### The app's side

- 48 files: `from '~~/engine'` becomes `from '@chord-scale-maker/engine'`. Nothing else in them changes.
- **The chart library** (`app/utils/library.ts`) globs `#charts/*.txt` instead of `../../../charts/*.txt`.
  `nuxt.config.ts` defines the alias `#charts` as the engine package's `charts/` folder, found with
  `createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json')`. Vite's `import.meta.glob`
  accepts alias paths, and the alias keeps working wherever the package lives (the workspace now, `node_modules` in
  Phase 2).
- **`make dev` watching** (`watchRepoData`) watches the engine's `charts/` and `chord_scales.json` through the same
  resolved folder. `server.fs.allow: ['..']` stays: it covers `engine/` and `data/`.
- **`e2e/functions.spec.ts`** reads `src/analysis/rules.ts` from the resolved package folder instead of
  `../engine/analysis/rules.ts`. (Phase 2's built package can be imported directly, and this read goes away.)
- **Typecheck:** `tsconfig.engine.json` becomes `tsconfig.build.json` (`build/**` only); `tsconfig.e2e.json` extends
  it. `nuxt typecheck` still checks the engine's source through the app's imports.
- **Vitest:** the project `engine` becomes `node` (`build/**`, `server/**`); `app` is unchanged.

## Package boundary and API

- **The public API is the index**, exactly as today (D8): the 23 modules' exports and the analysis names the index and `notes.ts` re-export. The
  table in E2 is the part the app depends on.
- **A snapshot test** (`engine/src/__tests__/api.test.ts`) records the sorted list of the index's runtime export
  names. Adding, removing or renaming an export fails it until the snapshot is updated (`vitest -u`), so the change
  is visible in review. Types aren't runtime values; they're covered by `nuxt typecheck`.
- **Internal-only imports** stay inside the package: the analyser CLI's `analysis/` imports and `guideLines.ts`'s
  `keySignature` import become `../src/…` paths.
- **Narrowing** the index to what the app uses is out of scope here; it belongs with Phase 2's first release, if
  that comes.

## Data ownership

| Data | Owner | Location after Phase 1 | How the other side gets it |
| --- | --- | --- | --- |
| `chord_scales.json` | engine | `engine/chord_scales.json` | bundled into the engine code by its JSON import; the app never reads it directly |
| `charts/*.txt` | engine (D2) | `engine/charts/` | exported as `@chord-scale-maker/engine/charts/*`; the app globs them via `#charts` at build time |
| `fixtures/*.json` | engine | `engine/fixtures/` | not used by the app |
| `data/quotes.json` | app | `data/quotes.json` (unchanged) | not used by the engine |
| `docs/` | shared | unchanged (D11) | — |
| `design/brand/` (committed), `design/tailwind-plus/`, `design/leadsheets/`, `design/sources/` (ignored) | app / research | unchanged | — |

**Where the tools belong:** the golden test and its fixture builder (`src/__tests__/goldenFixture.ts`), the analysis
fixture, `analyse`, `fixture-scales` and `guide-lines` all go to the engine. They read only engine code and engine
data. `icons.mjs` stays in `web/scripts/`.

**`fixture-scales` across the move:** it reads `git show <ref>:fixtures/golden.json`, a path from the repo root.
After the move the file is `engine/fixtures/golden.json`, but a ref from before the move (main, until the move is
merged) has it at `fixtures/golden.json`. The script asks for `<ref>:./fixtures/…` (relative to its cwd, `engine/`)
and falls back to `<ref>:../fixtures/…`, so it compares against refs on both sides of the move.

## Versioning and releases

- **Phase 1:** no change. The commit is the release (decision §12.10); the footer, the contact email and the issue
  report carry `2026.10.11 · abc1234`, which identifies both packages because they share the commit. The engine stays
  `0.0.0` and private. Milestones stay annotated tags.
- **Phase 2** (D9): the engine takes SemVer from `0.1.0`, released by pushing a tag `v0.x.y` in the engine repo, which
  runs a publish workflow (build, test, `npm publish --provenance` by trusted publishing). The rule for a version:
  - **major** (after 1.0): an export removed or its signature changed;
  - **minor**: a new export, or any change to `golden.json` or `analysis.json` (an answer changed: a scale choice, a
    spelling, a reason);
  - **patch**: no fixture change.

  Before 1.0, breaking changes go in minors, as SemVer allows. The app pins the engine exactly (the project already
  pins every version) and Dependabot proposes each release as a PR, which runs the app's e2e. The footer, contact
  email and issue report add the engine version (`· engine 0.4.1`), read from the package's `package.json` at build
  time.

## Build, runtime dependencies and CSP

- The production build is unchanged in kind: Nuxt prerenders every page, the engine is compiled into the same
  bundles, and `build/csp.ts` hashes the same two Nuxt inline scripts. No inline scripts, `eval` or origins are
  added; `check:headers` and the e2e CSP assertions keep proving it.
- Runtime `dependencies` of `web` gain only `@chord-scale-maker/engine` (a workspace link with no dependencies).
  CLAUDE.md's list of runtime dependencies gains it, with that note. `npm audit --omit=dev --audit-level=high` runs at
  the root and covers both workspaces.
- `overrides` must move to the root `package.json`: npm only honours `overrides` in the root manifest of a workspace.

## CI/CD and the ruleset

- **Phase 1** (D6): same workflow, same three jobs, same names. Changes:
  - `npm ci` at the root, with `cache-dependency-path: package-lock.json`;
  - `engine`: `npm run lint --workspaces`, `npm run typecheck --workspaces`, `npm test --workspaces`, then
    `npm run build -w web`, `npm run check:headers -w web`, and both audits at the root;
  - `e2e`: Playwright install and `npm run e2e` in `web/` (unchanged steps, new install location);
  - `changes` and its docs-only rule: unchanged.
  - The ruleset needs no edit: the checks are still named `engine` and `e2e`.
- **Dependabot:** the npm entry moves from `/web` to `/` (the workspace root, where the lockfile is). Dependabot
  updates workspace manifests from the root lockfile.
- **Phase 2:** the engine repo gets its own `ci.yml` (`engine` job: lint, typecheck, test, golden check, a build
  that must import under plain Node) and a `release.yml` (on `v*` tags). The app repo's `engine` job is renamed `app`
  and the ruleset's required checks change to `app` and `e2e`, a settings change the user makes at cutover.

## Vercel

- **Phase 1:** the project's root directory stays `web` and "include source files outside the root directory" stays
  on (it already is, for `charts/` and `chord_scales.json`; now it covers `engine/` and the root lockfile). Vercel
  detects the npm workspace from the root lockfile and installs from the root. The PR's preview deploy is the proof.
  If it doesn't install from the root, `web/vercel.json` gets `"installCommand": "npm ci --prefix .."`, tried in that
  preview. The stale dashboard Build Command (`npm run generate`) stays overridden by `vercel.json`; tidying it is
  optional.
- **Phase 2:** the Vercel project stays linked to the current repo (now the app repo). Installs fetch the engine
  from the public npm registry with no token. If the app moves to the repo root at that point, the root directory
  setting changes too (a dashboard change at cutover).

## Licensing and visibility

- The repo is public and MIT (`LICENSE`, © 2026 Kevin Stevens). The engine package declares `"license": "MIT"`. In
  Phase 2 both repos are public and MIT, and the engine repo gets a copy of `LICENSE`.
- The licensed Tailwind Plus kits (`design/tailwind-plus/`), the lead sheets and the research sources stay
  git-ignored, and have never been committed (E7). Both repos' `.gitignore` files carry those rules in Phase 2. The
  filter-repo path list for the engine names only engine paths, so it can't pick up `design/` at all.
- The Catalyst ports in `web/app/components/ui/` stay in the app, as today; the engine contains none of them. The
  split doesn't change their status.
- The charts are chords only, transcribed from sources kept out of the repo; their status doesn't change either.

## How a change that spans both sides flows

**Phase 1** (a new analysis rule plus its UI, like #100 or #83):

1. One branch. Engine first, test-first: the rule's test in `engine/src/__tests__/`, the rule, then
   `npm run analyse -w engine -- --all --force --save`, `make golden`, and read both diffs (unchanged habit).
2. The UI in `web/`, with its app tests, against the engine on the same branch (the workspace link).
3. `make test`, `make lint`, `make e2e` locally; one PR; CI runs `engine` and `e2e` over both packages; Vercel's
   preview shows both together. One merge deploys both.

**Phase 2:**

1. Engine PR in the engine repo (rule, tests, golden), merged; tag `v0.x.0`; the release workflow publishes.
2. During development, the app uses the engine branch locally (`npm install ../chord-scale-engine` or `npm link`),
   never committed.
3. App PR: bump the engine version (or merge Dependabot's PR), add the UI; CI and e2e run against the release.
4. If the app work shows the engine needs a change, back to step 1: a new engine release, a new bump.

## History preservation

- **Phase 1:** files move with `git mv` in commits that change nothing else, so `git log --follow` and blame follow
  them. Nothing is rewritten.
- **Phase 2** (D10): the engine repo comes from a fresh clone, rewritten with `git filter-repo`, keeping every path
  the engine has ever lived at, renamed into the package layout:

  ```sh
  git clone https://github.com/KevDog/Chord-Scale-Maker.git chord-scale-engine && cd chord-scale-engine
  git filter-repo \
    --path engine/ \
    --path web/engine/ --path web/scripts/analyse.ts --path web/scripts/fixtureScales.ts --path web/scripts/guideLines.ts \
    --path chord_scales.json --path charts/ --path fixtures/ \
    --path jazz_scales.py --path tests/ --path tools/ \
    --path LICENSE --path docs/plan-analysis.md --path docs/research/ \
    --path-rename engine/: --path-rename web/engine/:src/ --path-rename web/scripts/:scripts/
  ```

  Post-move paths (`engine/src/…`) and pre-move paths (`web/engine/…`) land on the same new paths (`src/…`), so one
  file's history is continuous across the move. The Python CLI's history comes along as deleted files. Tags are
  rewritten to the filtered commits; they're kept, since `v1-launch` and `v2-changes` mark engine milestones too.
  `git subtree split --prefix=engine` was rejected: it keeps only the commits after the move.
- The app repo is the current repo, unrewritten: Phase 2 deletes `engine/` in an ordinary PR. Its history keeps the
  engine's past, which costs nothing and breaks no links, PRs or tags.

## Migration steps (Phase 1)

The plan has the exact files and commands; in outline, each step a commit that leaves `make test` green:

1. **Root workspace** with `web` as its only member: root `package.json`, lockfile and `overrides` moved to the
   root, `.gitignore` for `node_modules/` at any depth.
2. **Rename the import** `~~/engine` → `@chord-scale-maker/engine` in 48 files, with a temporary Nuxt alias pointing
   at `web/engine`, so the import change reviews apart from the move.
3. **Move the engine** to `engine/` with `git mv` (sources, tests, tools, data), fix the 33 data paths and the
   tools' paths, add the package's manifest, tsconfig, Vitest and ESLint configs, add it to the workspaces, replace
   the temporary alias with the real dependency, add the `#charts` alias and `build.transpile`, and split the app's
   tsconfig and Vitest projects. The fixtures must be byte-identical.
4. **Guards:** the export snapshot test and the engine's boundary lint rule.
5. **Tooling:** Makefile, CI workflow, Dependabot.
6. **Docs:** CLAUDE.md, README.md, docs/design.md (§1, §2, §7, §10, §12), docs/README.md.
7. **Verify:** `make test`, `make lint`, `make e2e`, `make preview`, `check:headers`, both audits, `fixture-scales`
   against main; then, after the user pushes, CI and the Vercel preview.

## Phase 2: two repos (conditional)

Not scheduled. Start it when one of these is true:

- something other than this site needs the engine (a CLI, an API, another app, a notebook);
- people want to work on the analysis without the app (outside contributors, a different review cadence);
- the engine's release cadence should differ from the site's (for example, the site stays on a known engine while
  the rules churn).

Steps, each in the plan's Part B: make the engine importable under plain Node (Vite library build with the JSON
inlined, `tsc` declarations, `exports` pointing at `dist/`); show the engine version in the app; cut the engine repo
with filter-repo; set up its CI, release workflow, ruleset and npm trusted publishing; switch the app to the
published package; remove `engine/` from the app repo; rename the app's `engine` job to `app` and update the
ruleset; split the docs.

## Acceptance criteria (Phase 1)

- `git diff --stat -M main` shows `fixtures/golden.json` and `fixtures/analysis.json` as 100% renames.
- `npm test -w engine`, `npm run typecheck -w engine` and `npm run lint -w engine` pass from `engine/` with no Nuxt
  involvement (`grep -r nuxt engine/src engine/scripts` finds nothing).
- No file in `web/` imports the engine except as `@chord-scale-maker/engine`; `grep -rnE "~~/engine|from '(\.\./)+engine" web/app web/test web/e2e`
  finds nothing.
- `make test`, `make lint`, `make e2e` pass; the test counts match the baseline plus two (the library
  test and the API snapshot).
- `npm run fixture-scales -w engine -- main` prints "no scale changed".
- `npm run check:headers -w web` passes; `npm audit --omit=dev --audit-level=high` passes at the root.
- CI's `engine` and `e2e` pass on the PR, and the Vercel preview serves the library (242 charts), the editor and the
  functions page.

## Risks

| Risk | Mitigation |
| --- | --- |
| Vercel doesn't install from the workspace root. | The PR's preview deploy shows it before merge; fallback `installCommand` in `web/vercel.json` (above). |
| Nitro treats the linked engine as an external during prerender. | `build.transpile: ['@chord-scale-maker/engine']`; `make preview` and the e2e build prove it locally. |
| `import.meta.glob` doesn't take the `#charts` alias. | The app test "includes the repo charts" fails at once. Fallback: the relative glob `../../../engine/charts/*.txt`, with a note for Phase 2. |
| Moving the lockfile re-resolves transitive versions. | Move the existing lockfile, then `npm install`; check that `npm ls` shows the same versions for the runtime dependencies and for nuxt, vite and vitest; review the lockfile diff for version changes, not just moved keys. |
| Dev tool versions drift between the two manifests (D13). | Dependabot's grouped minor/patch PR updates both manifests; a version mismatch shows as a second copy in `npm ls`. |
| `fixture-scales` compares the wrong paths across the move. | The fallback path above; the plan runs it against main before merge. |
| The engine's own ESLint config differs from `withNuxt` and reports new findings. | Run it in Task 3; fix findings in the engine or add the rule's off-switch with a comment, never weaken the shared rules for the app. |
| Hidden cwd assumptions in engine tests (`readFileSync('../charts/…')`). | The plan rewrites all 33 path lines and greps for leftovers; the tests fail loudly if one is missed. |

## Out of scope

- Creating GitHub repos, publishing anything, or editing the ruleset or Vercel settings (Phase 2, and the user's
  call).
- Narrowing the engine's API, renaming modules, or any behaviour change in the engine or the app.
- Moving the app to `apps/web`, or the docs into packages.
- A task runner (Turborepo, Nx), pnpm, or changesets.
- Changes to the chart format, the analysis rules or the fixtures' content.

# Engine / UI split: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: waiting on the user.** D1, D2 and D3 are decided (2026-10-11): **two packages, one repo; Part A is the work;
> the engine owns `charts/`; `engine/` at the root, `web/` unchanged.** The other decisions are **Assumed (confirm)**; don't start until the user has answered the spec's remaining "Open
> questions". A step tagged **[Dn]** depends on assumed decision Dn; if the user decides otherwise, change that step
> before running it. **Part B** runs only when a Phase 2 trigger appears: an API experience, or others using the engine
> for their own work.

**Goal:** make the analysis engine its own npm workspace package, `@chord-scale-maker/engine` in `engine/`, owning its
code, data and tools, with the Nuxt app in `web/` depending on it by name. No behaviour, URL, security or deploy
change.

**Architecture:** a root `package.json` with `workspaces: ["engine", "web"]`. The engine ships TypeScript source
through an `exports` map (`.` → `src/index.ts`, `./charts/*`, `./package.json`), which is the only way in. The app
imports `@chord-scale-maker/engine`, globs the library through a `#charts` alias resolved from the package, and keeps
its Vercel root directory (`web`). CI keeps its job names (`engine`, `e2e`).

**Tech Stack:** npm workspaces (npm 11, Node 24), TypeScript 5.9.3 strict, Vitest 5.0.3, vite-node 6.0.0, Nuxt 4.5.2,
ESLint 10 with `@nuxt/eslint-config` 1.17.0, Playwright 1.63, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-11-engine-ui-split-design.md`

## Global Constraints

- Work in a worktree on a branch from main; commit per task; stage files by name or directory, never `git add -A`
  or `git add .`; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't push, open a PR, create repos, publish, or change GitHub or Vercel settings unless the user says so.
- No behaviour change: `fixtures/golden.json` and `fixtures/analysis.json` must come through **byte for byte**
  (`shasum -a 256` equal to the Task 0 baseline). If either changes, stop and report.
- `engine/` imports nothing from the app, Vue, VexFlow or any package; its tsconfig keeps `lib: ["ES2023"]` (no DOM).
- The app imports the engine only as `@chord-scale-maker/engine` (no `~~/engine`, no `../engine`, no subpaths
  except `@chord-scale-maker/engine/package.json` for path resolution).
- Runtime `dependencies` of `web` stay what ships to browsers: today's five plus `@chord-scale-maker/engine`.
  `npm audit --omit=dev --audit-level=high` must pass at the root.
- Exact versions everywhere (the project pins); dev tools in `engine/package.json` use the same versions as
  `web/package.json` [D13].
- Pages keep running under the hashed CSP (`web/build/csp.ts`): no inline scripts, `eval` or new origins.
- The CI checks stay named `engine` and `e2e` (the `protect main` ruleset requires them) [D6].
- The licensed kits in `design/tailwind-plus/` (and `design/leadsheets/`, `design/sources/`) stay git-ignored and
  are never staged.
- macOS: `sed -i ''` (BSD sed). Commands run from the repo root unless a step says otherwise.

## Review Focus

1. **A fresh checkout on Vercel:** the deploy installs from the workspace root and builds `web/` with nothing that
   only exists locally (an untracked file, a `node_modules` left over from before). *Task 7 builds a fresh clone.*
2. **The library silently shrinking:** the `#charts` glob matching fewer files (or none) would still pass the
   "includes autumn_leaves" test. *Task 3 adds a test that the library has every chart in `engine/charts/`.*
3. **`fixture-scales` across the move:** comparing against a ref from before the move (main, until this merges) must
   find `fixtures/…` at the root, and against a later ref `engine/fixtures/…`. *Task 3 runs it both ways.*
4. **Tools writing to the old places:** `make golden` or the analyser creating a new root `fixtures/`, `charts/` or
   `chord_scales.json`. *Task 3 checks the root stays clear after running both.*
5. **`make dev` live reload of a chart:** editing a chart in `engine/charts/` must update the library without a
   restart, as it does today. *Task 7 checks it by hand.*

---

## Part A — two packages in one repo (recommended)

### Task 0: Baseline (no commit)

**Files:** none changed. Notes go in `$TMPDIR/csm-split/` (outside the repo).

- [ ] **Step 1: Set up and run everything once on main**

```bash
mkdir -p "$TMPDIR/csm-split"
make setup && make test && make lint 2>&1 | tee "$TMPDIR/csm-split/baseline-test.txt"
```

Expected: all pass. Write down the two "Tests  N passed" counts (projects `engine` and `app` in one run).

- [ ] **Step 2: Record the fixtures' hashes and the installed versions**

```bash
shasum -a 256 fixtures/golden.json fixtures/analysis.json | tee "$TMPDIR/csm-split/fixtures.sha"
cd web && npm query '*' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log([...new Set(JSON.parse(s).map(p=>p.name+'@'+p.version))].sort().join('\n')))" > "$TMPDIR/csm-split/versions-before.txt"; cd ..
wc -l "$TMPDIR/csm-split/versions-before.txt"
```

Expected: two hashes; a few hundred `name@version` lines.

---

### Task 1: Root workspace (web only) and the install location

**Files:**
- Create: `package.json` (root)
- Move: `web/package-lock.json` → `package-lock.json`
- Modify: `web/package.json` (remove `overrides`), `.gitignore`, `Makefile` (`setup`), `.github/workflows/ci.yml`
  (`npm ci` location, cache path), `.github/dependabot.yml` (npm directory)

**Interfaces:**
- Produces: a workspace root where `npm ci` installs everything; later tasks add `"engine"` to `workspaces`.

- [ ] **Step 1: Create the root manifest** [D4]

`package.json`:

```json
{
  "name": "chord-scale-maker",
  "private": true,
  "workspaces": ["web"],
  "engines": {
    "node": "24.x"
  },
  "overrides": {
    "simple-git": "^4.0.2"
  }
}
```

- [ ] **Step 2: Remove `overrides` from `web/package.json`**

Delete these lines (npm honours `overrides` only in the root manifest):

```json
  "overrides": {
    "simple-git": "^4.0.2"
  }
```

and the comma after the `engines` block before them, so the file stays valid JSON.

- [ ] **Step 3: Move the lockfile and reinstall from the root**

```bash
git mv web/package-lock.json package-lock.json
rm -rf web/node_modules
npm install
npm ci
```

Expected: `npm ci` succeeds; `nuxt prepare` runs as web's `postinstall`; `node_modules/` now exists at the root.

- [ ] **Step 4: Check no installed version moved**

```bash
npm query '*' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log([...new Set(JSON.parse(s).map(p=>p.name+'@'+p.version))].sort().join('\n')))" > "$TMPDIR/csm-split/versions-after-1.txt"
diff "$TMPDIR/csm-split/versions-before.txt" "$TMPDIR/csm-split/versions-after-1.txt"
```

Expected: the only difference is an added line for the root package (`chord-scale-maker@…`). If any other version
changed: `git show HEAD:web/package-lock.json > package-lock.json`, run `npm install --prefer-dedupe`, and diff again;
if versions still move, stop and report.

- [ ] **Step 5: Ignore `node_modules/` at any depth**

In `.gitignore`, replace the line `web/node_modules/` with:

```gitignore
node_modules/
```

- [ ] **Step 6: Install from the root in the Makefile**

In `Makefile`, replace:

```make
setup:
	cd web && npm ci
```

with:

```make
setup:
	npm ci
```

- [ ] **Step 7: Install from the root in CI**

In `.github/workflows/ci.yml`, in **both** the `engine` and `e2e` jobs:

- change `cache-dependency-path: web/package-lock.json` to `cache-dependency-path: package-lock.json`;
- replace the step `- run: npm ci` with:

```yaml
      - run: npm ci
        working-directory: .
```

- [ ] **Step 8: Point Dependabot at the workspace root**

In `.github/dependabot.yml`, in the `npm` entry, change `directory: /web` to `directory: /`.

- [ ] **Step 9: Run the suite**

Run: `make test && make lint`
Expected: PASS, same test counts as Task 0.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json web/package.json .gitignore Makefile .github/workflows/ci.yml .github/dependabot.yml
git commit -F - <<'EOF'
Workspace: an npm workspace root (web its only member), the lockfile and overrides at the root

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Import the engine by its package name

A pure rename, reviewed apart from the move: the app's 48 importing files switch from `~~/engine` to
`@chord-scale-maker/engine`, resolved for now by a Nuxt alias pointing at `web/engine/` (Task 3 replaces the alias
with the real package).

**Files:**
- Modify: `web/nuxt.config.ts` (temporary alias); the 48 files that import `~~/engine` (34 under `web/app/`, 14 under
  `web/test/`)

**Interfaces:**
- Produces: every app import reads `from '@chord-scale-maker/engine'` [D7].

- [ ] **Step 1: Add the temporary alias**

In `web/nuxt.config.ts`, inside `defineNuxtConfig({ … })`, after `css: ['~/assets/css/main.css'],` add:

```ts
  // temporary (engine/UI split, Task 2): the engine's package name, until the engine moves to its own package
  alias: { '@chord-scale-maker/engine': fileURLToPath(new URL('./engine', import.meta.url)) },
```

- [ ] **Step 2: Rename the imports**

```bash
grep -rl "~~/engine" web/app web/test | xargs sed -i '' "s#'~~/engine'#'@chord-scale-maker/engine'#g"
grep -rn "~~/engine" web || echo "none left"
grep -rl "@chord-scale-maker/engine" web/app web/test | wc -l
```

Expected: "none left"; `48`.

- [ ] **Step 3: Typecheck, test, lint**

Run: `make test && make lint`
Expected: PASS, same counts as Task 0. (`nuxt typecheck` resolves the name through the alias's generated tsconfig
paths; the app's Vitest project through Nuxt's Vite config.)

- [ ] **Step 4: Commit**

```bash
git add web/nuxt.config.ts web/app web/test
git commit -F - <<'EOF'
App: import the engine as @chord-scale-maker/engine (a temporary alias to web/engine)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Move the engine into its own package

**Files:**
- Move (`git mv`): `web/engine/` → `engine/src/`; `chord_scales.json` → `engine/chord_scales.json`; `charts/` →
  `engine/charts/`; `fixtures/` → `engine/fixtures/`; `web/scripts/{analyse,fixtureScales,guideLines}.ts` →
  `engine/scripts/`; `web/tsconfig.engine.json` → `web/tsconfig.build.json`
- Create: `engine/package.json`, `engine/tsconfig.json`, `engine/vitest.config.ts`, `engine/eslint.config.mjs`
- Modify: `engine/src/qualities.ts`, `engine/src/levels.ts` (JSON path); 17 files in `engine/src/__tests__/` (data
  paths); `engine/scripts/*.ts` (paths; `fixtureScales.ts` ref fallback); `package.json` (workspaces);
  `web/package.json`; `web/nuxt.config.ts`; `web/app/utils/library.ts`; `web/e2e/functions.spec.ts`;
  `web/tsconfig.build.json`; `web/tsconfig.e2e.json`; `web/vitest.config.ts`; `Makefile` (`test`, `lint`, `golden`)
- Test: `web/test/library.test.ts`

**Interfaces:**
- Consumes: the import name from Task 2.
- Produces: package `@chord-scale-maker/engine` with `exports` `"."` → `./src/index.ts`, `"./charts/*"`,
  `"./package.json"`; scripts `test`, `typecheck`, `lint`, `golden`, `analyse`, `guide-lines`, `fixture-scales`;
  the Nuxt alias `#charts` (the package's `charts/` folder); root scripts `test`, `typecheck`, `lint`.

- [ ] **Step 1: Write the failing library test** (Review Focus 2) [D2]

In `web/test/library.test.ts`, add `import { readdirSync } from 'node:fs'` and
`import { isSyncCopy } from '@chord-scale-maker/engine'` to the imports, and this test inside `describe('library')`:

```ts
  it('includes every chart in the engine package, and nothing else', () => {
    const files = readdirSync(new URL('../../engine/charts/', import.meta.url)).filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    expect(files.length).toBeGreaterThan(200)
    expect(LIBRARY.map((c) => `${c.slug}.txt`).sort()).toEqual([...files].sort())
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd web && npx vitest run test/library.test.ts`
Expected: FAIL with `ENOENT … engine/charts`.

- [ ] **Step 3: Move the files** [D3]

```bash
mkdir -p engine/scripts
git mv web/engine engine/src
git mv chord_scales.json engine/chord_scales.json
git mv charts engine/charts
git mv fixtures engine/fixtures
git mv web/scripts/analyse.ts web/scripts/fixtureScales.ts web/scripts/guideLines.ts engine/scripts/
git mv web/tsconfig.engine.json web/tsconfig.build.json
test ! -e charts && test ! -e fixtures && test ! -e chord_scales.json && echo "root clear"
```

Expected: "root clear". `web/scripts/` keeps only `icons.mjs`.

- [ ] **Step 4: Fix the data paths in the engine**

```bash
sed -i '' "s#'\.\./\.\./chord_scales\.json'#'../chord_scales.json'#" engine/src/qualities.ts engine/src/levels.ts
cd engine/src/__tests__
sed -i '' -E "s#'\.\./\.\./\.\./#'../../#g; s#\`\.\./\.\./\.\./#\`../../#g; s#'\.\./charts#'charts#g; s#\`\.\./charts/#\`charts/#g; s#'\.\./chord_scales\.json'#'chord_scales.json'#g" *.ts
cd ../../..
grep -rnE "\.\./\.\./\.\./|'\.\./charts|\`\.\./charts|'\.\./chord_scales|'\.\./\.\./chord_scales" engine/src || echo "no old paths"
```

Expected: "no old paths". The `new URL('../../…', import.meta.url)` paths now lead from `engine/src/__tests__/` to
`engine/`; the cwd-relative ones (`readFileSync('charts/…')`) assume the cwd is `engine/`, which Vitest's root is.
(The string `'../../charts/so_what 12.txt'` in `util.test.ts` is test data for `isSyncCopy`; it still ends in a sync
copy name.)

- [ ] **Step 5: Fix the tools' paths**

```bash
cd engine/scripts
sed -i '' "s#'\.\./engine/#'../src/#g; s#'\.\./engine'#'../src'#g; s#resolve(import.meta.dirname, '\.\./\.\.')#resolve(import.meta.dirname, '..')#" analyse.ts guideLines.ts fixtureScales.ts
cd ../..
grep -nE "\.\./engine|'\.\./\.\.'" engine/scripts/*.ts || echo "no old paths"
```

Expected: "no old paths". `REPO` in each script is now `engine/`, so `join(REPO, 'charts')` is `engine/charts`.

- [ ] **Step 6: Let `fixture-scales` read refs from both sides of the move** (Review Focus 3)

In `engine/scripts/fixtureScales.ts`, replace:

```ts
const atRef = (file: string): Json => JSON.parse(execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })) as Json
```

with:

```ts
const show = (path: string): string =>
  execFileSync('git', ['show', `${ref}:${path}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
/** the file at the ref: in engine/ since the engine became its own package, at the repo root before (`./` and `../` are relative to the cwd, engine/) */
const atRef = (file: string): Json => {
  let text: string
  try {
    text = show(`./${file}`)
  } catch {
    text = show(`../${file}`)
  }
  return JSON.parse(text) as Json
}
```

- [ ] **Step 7: Create the engine's manifest** [D5, D7, D13]

`engine/package.json`:

```json
{
  "name": "@chord-scale-maker/engine",
  "version": "0.0.0",
  "private": true,
  "description": "The Chord Scale Maker engine: chart parsing, harmonic analysis, scales, spelling, guide tones, sheet models",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./charts/*": "./charts/*",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "golden": "UPDATE_GOLDEN=1 vitest run src/__tests__/golden.test.ts src/__tests__/analysis.fixture.test.ts",
    "analyse": "vite-node scripts/analyse.ts --",
    "guide-lines": "vite-node scripts/guideLines.ts --",
    "fixture-scales": "vite-node scripts/fixtureScales.ts --"
  },
  "devDependencies": {
    "@nuxt/eslint-config": "1.17.0",
    "@types/node": "26.6.4",
    "eslint": "10.12.0",
    "typescript": "5.9.3",
    "vite-node": "6.0.0",
    "vitest": "5.0.3"
  },
  "engines": {
    "node": "24.x"
  }
}
```

- [ ] **Step 8: Create the engine's tsconfig**

`engine/tsconfig.json`:

```jsonc
{
  // The engine, its tests and its tools: pure TypeScript, no DOM (lib ES2023), Node types for the tests and tools.
  // Same strictness as Nuxt's generated config, which also checks this code through the app's imports.
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts"]
}
```

(`scripts/` was not typechecked before; the three scripts were checked clean with these options while writing this
plan.)

- [ ] **Step 9: Create the engine's Vitest config**

`engine/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// pure TypeScript, no Nuxt: the cwd is engine/, which the tests' readFileSync('charts/…') paths assume
export default defineConfig({ test: { name: 'engine', include: ['src/**/*.test.ts'], environment: 'node' } })
```

- [ ] **Step 10: Create the engine's ESLint config**

`engine/eslint.config.mjs`:

```js
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// the same base rules as the app's (withNuxt, which Nuxt generates with features.standalone), without a Nuxt build
export default createConfigForNuxt({ features: { standalone: true } })
```

(The boundary rule comes in Task 4.)

- [ ] **Step 11: Add the engine to the workspaces and as the app's dependency**

In the root `package.json`, set `"workspaces": ["engine", "web"]` and add, after `"workspaces"`:

```json
  "scripts": {
    "test": "npm test --workspaces",
    "typecheck": "npm run typecheck --workspaces",
    "lint": "npm run lint --workspaces"
  },
```

In `web/package.json`:
- add `"@chord-scale-maker/engine": "*",` as the first entry of `"dependencies"` (it ships to browsers);
- delete the scripts `golden`, `analyse`, `guide-lines` and `fixture-scales`;
- change `typecheck` to `"nuxt typecheck && tsc -p tsconfig.build.json && tsc -p tsconfig.e2e.json"`.

Then:

```bash
npm install
ls -l node_modules/@chord-scale-maker/engine
```

Expected: a symlink to `../../engine`.

- [ ] **Step 12: Point the app at the package**

In `web/nuxt.config.ts`:

1. Add to the imports at the top:

```ts
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
```

2. Replace the `watchRepoData` comment and function with:

```ts
/** the engine package's folder (engine/ in the workspace): its charts/ is the library */
const ENGINE_DIR = dirname(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))

/** dev: the engine's charts/ and chord_scales.json sit outside Vite's root, so it doesn't watch them by itself
 *  (quotes.json is watched by its own plugin) */
const watchRepoData = (): Plugin => ({
  name: 'watch-repo-data',
  configureServer(server) {
    server.watcher.add([join(ENGINE_DIR, 'charts'), join(ENGINE_DIR, 'chord_scales.json')])
  },
})
```

3. Replace the temporary alias from Task 2 (both lines) with:

```ts
  // the library's charts, from the engine package (app/utils/library.ts)
  alias: { '#charts': join(ENGINE_DIR, 'charts') },
  // the engine is TypeScript source in a workspace package: compile it into the server bundle too (prerendering)
  build: { transpile: ['@chord-scale-maker/engine'] },
```

4. Change the comment above `server: { fs: { allow: ['..'] } }` to:

```ts
    // the engine package (engine/, beside web/: its source, chord_scales.json, charts) and the navbar quotes (../data)
```

- [ ] **Step 13: Glob the library through the alias**

In `web/app/utils/library.ts`, replace:

```ts
/** build-time: every chart in the repo's charts/ folder, as raw text */
const files = import.meta.glob<string>('../../../charts/*.txt', { query: '?raw', import: 'default', eager: true })
```

with:

```ts
/** build-time: every chart in the engine package's charts/ folder (the #charts alias, nuxt.config.ts), as raw text */
const files = import.meta.glob<string>('#charts/*.txt', { query: '?raw', import: 'default', eager: true })
```

If Step 18 shows Vite can't glob through the alias, use `'../../../engine/charts/*.txt'` instead and note it in the
commit message (the spec's Risks row).

- [ ] **Step 14: Read the rule ids from the package in the e2e test**

In `web/e2e/functions.spec.ts`, replace the first line and the `RULE_IDS` block:

```ts
import { readFileSync } from 'node:fs'
```

```ts
// the engine can't be imported here (its JSON import needs a bundler), so read the ids from the RULES table's source
const RULE_IDS = Array.from(
  (readFileSync(new URL('../engine/analysis/rules.ts', import.meta.url), 'utf8').split('export const RULES')[1] ?? '').matchAll(/^\s*\{ id: '([^']+)'/gm),
  (m) => m[1] as string,
)
```

with:

```ts
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
```

```ts
// the engine can't be imported here (its JSON import needs a bundler), so read the ids from the RULES table's source,
// found through the package (engine/ in the workspace)
const ENGINE = pathToFileURL(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))
const RULE_IDS = Array.from(
  (readFileSync(new URL('src/analysis/rules.ts', ENGINE), 'utf8').split('export const RULES')[1] ?? '').matchAll(/^\s*\{ id: '([^']+)'/gm),
  (m) => m[1] as string,
)
```

- [ ] **Step 15: Split the app's tsconfig and Vitest projects**

`web/tsconfig.build.json` (moved in Step 3): replace the leading comment and `include`:

```jsonc
{
  // The build helpers and their tests (build/), outside Nuxt (the app's tsconfigs come from .nuxt/ via tsconfig.json).
  // Same strictness as Nuxt's generated config, plus Node types for the tests.
```

```jsonc
  "include": ["build/**/*.ts"]
```

`web/tsconfig.e2e.json`: change `"extends": "./tsconfig.engine.json"` to `"extends": "./tsconfig.build.json"`.

`web/vitest.config.ts`: replace the engine project and its comment (`// pure TypeScript, no Nuxt` and the
`{ test: { name: 'engine', … } },` line) with:

```ts
      // pure TypeScript, no Nuxt: the build helpers and the server's checks
      { test: { name: 'node', include: ['build/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' } },
```

- [ ] **Step 16: Make the Makefile cover both packages** [D14]

In `Makefile`, replace the `test`, `lint` and `golden` recipes:

```make
test:
	npm run typecheck && npm test
lint:
	npm run lint
```

```make
# rewrite engine/fixtures/golden.json and analysis.json from the engine after an intended change; review their diffs
golden:
	npm run golden -w engine
```

- [ ] **Step 17: Run the engine on its own**

```bash
npm test -w engine
npm run typecheck -w engine
npm run lint -w engine
grep -rn "nuxt" engine/src engine/scripts || echo "no nuxt"
```

Expected: tests PASS (the Task 0 `engine`-project count minus the `build/` and `server/` tests, which now run in
web's `node` project); typecheck clean; "no nuxt". If lint reports findings the app's `withNuxt` config didn't, fix
them in the engine code when they're real; if a rule only differs because there's no Nuxt build, turn it off in
`engine/eslint.config.mjs` with a comment saying why. Never weaken `web/eslint.config.mjs`.

- [ ] **Step 18: Run the app**

```bash
npm run typecheck -w web
cd web && npx vitest run && cd ..
npm run lint -w web
grep -rnE "~~/engine|from '(\.\./)+engine" web/app web/test web/e2e web/server web/build web/nuxt.config.ts || echo "no old imports"
```

Expected: PASS, including the new library test from Step 1; "no old imports".

- [ ] **Step 19: Check the fixtures are untouched and the tools write in the right places** (Review Focus 4)

```bash
npm run golden -w engine
shasum -a 256 engine/fixtures/golden.json engine/fixtures/analysis.json
cat "$TMPDIR/csm-split/fixtures.sha"
npm run analyse -w engine -- charts/autumn_leaves.txt
npm run guide-lines -w engine -- --check
git status --porcelain engine/fixtures engine/charts
test ! -e fixtures && test ! -e charts && test ! -e chord_scales.json && test ! -e web/fixtures && echo "root clear"
```

Expected: the same two hashes as Task 0; an analysis report for Autumn Leaves; the guide-lines check passes; empty
`git status` output for the fixtures and charts; "root clear".

- [ ] **Step 20: Compare scales against main, from before the move** (Review Focus 3)

Run: `npm run fixture-scales -w engine -- main`
Expected: "no scale changed", exit 0 (this reads `main:fixtures/…` through the `../` fallback).

- [ ] **Step 21: Run everything through the Makefile**

Run: `make test && make lint`
Expected: PASS. Total tests = Task 0 total + 1 (the library test).

- [ ] **Step 22: Commit**

```bash
git add engine/package.json engine/tsconfig.json engine/vitest.config.ts engine/eslint.config.mjs engine/src engine/scripts engine/chord_scales.json engine/charts engine/fixtures
git add package.json package-lock.json Makefile web/package.json web/nuxt.config.ts web/app/utils/library.ts web/e2e/functions.spec.ts web/tsconfig.build.json web/tsconfig.e2e.json web/vitest.config.ts web/test/library.test.ts
git status --short | grep -v '^[RAM] ' || echo "nothing unstaged"
git commit -F - <<'EOF'
Engine: its own workspace package, @chord-scale-maker/engine, with its data (chord_scales.json, charts, fixtures) and tools

The app imports it by name; the library globs #charts from the package. Fixtures unchanged byte for byte.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

Expected before committing: "nothing unstaged" (deleted-by-move paths show as `R`).

- [ ] **Step 23: Compare scales against the new commit**

Run: `npm run fixture-scales -w engine -- HEAD`
Expected: "no scale changed" (this reads `HEAD:engine/fixtures/…` through the `./` path).

---

### Task 4: Guard the boundary

**Files:**
- Create: `engine/src/__tests__/api.test.ts`, `engine/src/__tests__/__snapshots__/api.test.ts.snap` (written by
  Vitest)
- Modify: `engine/eslint.config.mjs`

**Interfaces:**
- Consumes: the package from Task 3.
- Produces: a snapshot of the index's runtime export names [D8]; the lint rule that keeps Vue, VexFlow and app code
  out of `engine/src/`.

- [ ] **Step 1: Write the export snapshot test**

`engine/src/__tests__/api.test.ts`:

```ts
/**
 * The package's public surface: the runtime names its index exports (types are checked by the app's typecheck).
 * A change here is a change to what the app, and any later consumer, can use: update it on purpose
 * (`npx vitest run -u src/__tests__/api.test.ts`) and review the snapshot's diff.
 */
import { expect, it } from 'vitest'
import * as engine from '..'

it('exports the same names', () => {
  expect(Object.keys(engine).sort()).toMatchSnapshot()
})
```

- [ ] **Step 2: Run it to write the snapshot**

Run: `cd engine && npx vitest run src/__tests__/api.test.ts && cd ..`
Expected: PASS, "1 snapshot written"; `engine/src/__tests__/__snapshots__/api.test.ts.snap` lists the names.

- [ ] **Step 3: See it catch a change**

```bash
echo "export const __probe = 1" >> engine/src/index.ts
cd engine && npx vitest run src/__tests__/api.test.ts; cd ..
git checkout -- engine/src/index.ts
```

Expected: FAIL, the snapshot diff shows `+ "__probe"`. After the checkout the test passes again.

- [ ] **Step 4: Add the boundary rule**

Replace `engine/eslint.config.mjs` with:

```js
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// the same base rules as the app's (withNuxt, which Nuxt generates with features.standalone), without a Nuxt build
export default createConfigForNuxt({ features: { standalone: true } }).append({
  // the engine is pure TypeScript: no Vue, no VexFlow, no DOM, no app code (docs/design.md §3)
  files: ['src/**/*.ts', 'scripts/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['vue', '@vue/*', 'vexflow', '#app', '#imports', '~/*', '~~/*', '@chord-scale-maker/*'],
            message: 'The engine imports nothing from the app, Vue or VexFlow.',
          },
        ],
      },
    ],
  },
})
```

- [ ] **Step 5: See the rule catch an import, and check TypeScript linting is on**

```bash
printf "import { ref } from 'vue'\nexport const probe = ref(1)\n" > engine/src/lintProbe.ts
cd engine && npx eslint src/lintProbe.ts; echo "exit $?"
npx eslint --print-config src/index.ts | grep -c '@typescript-eslint/' ; cd ..
rm engine/src/lintProbe.ts
```

Expected: the probe reports `no-restricted-imports` with the message above and `exit 1`; the count is greater than 0
(the TypeScript rules apply to the engine's `.ts` files).

- [ ] **Step 6: Run the engine's checks**

Run: `npm test -w engine && npm run lint -w engine`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/src/__tests__/api.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap engine/eslint.config.mjs
git commit -F - <<'EOF'
Engine: guard the boundary (a snapshot of the exported names, a lint rule against app, Vue and VexFlow imports)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: CI checks both packages

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `lint`, `typecheck`, `test` (Task 3); web scripts `build`, `check:headers`, `e2e`.
- Produces: the same jobs, `changes`, `engine`, `e2e`, with the same names [D6].

- [ ] **Step 1: Run the `engine` job's steps over the workspace**

In `.github/workflows/ci.yml`, in the `engine` job, replace the steps after `- run: npm ci` (with its
`working-directory: .`) so the job's steps read:

```yaml
      - run: npm ci
        working-directory: .
      # both packages: the engine (engine/) and the app (web/)
      - run: npm run lint
        working-directory: .
      - run: npm run typecheck
        working-directory: .
      - run: npm test
        working-directory: .
      - run: npm run build
      # what Vercel will serve: headers on pages and assets, CSP meta on every page
      - run: npm run check:headers
      # gate on what ships to browsers (vue, vexflow, the engine); build tooling advisories are reported, not blocking
      - run: npm audit --omit=dev --audit-level=high
        working-directory: .
      - run: npm audit --audit-level=high || true
        working-directory: .
```

(`build` and `check:headers` keep the job's default `working-directory: web`.) Replace the workflow's comment lines 2–3:

```yaml
# pull requests only (checks run locally first; the merge needs no second run). engine and e2e are required checks on
# main, so the workflow always runs: a docs-only change skips them by condition, which reports success
```

with:

```yaml
# pull requests only (checks run locally first; the merge needs no second run). engine (both packages' lint, typecheck
# and tests, then the site's build, headers and audit) and e2e are required checks on main, so the workflow always
# runs: a docs-only change skips them by condition, which reports success
```

- [ ] **Step 2: Leave `e2e` and `changes` as they are**

The `e2e` job already installs at the root (Task 1) and runs Playwright in `web/`. Check by reading it: its steps are
`checkout`, `setup-node` (cache path `package-lock.json`), `npm ci` (root), `npx playwright install --with-deps
chromium`, `npm run e2e`, and the report upload from `web/playwright-report`.

- [ ] **Step 3: Validate the workflow file**

Run: `node -e "const y=require('yaml').parse(require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log(Object.keys(y.jobs).join(' '))"`
Expected: `changes engine e2e` (the `yaml` package is already installed, through the lint tooling).

- [ ] **Step 4: Run the job's commands locally, in order**

```bash
npm ci && npm run lint && npm run typecheck && npm test
npm run build -w web && npm run check:headers -w web
npm audit --omit=dev --audit-level=high
```

Expected: all PASS; the audit reports no high advisories.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -F - <<'EOF'
CI: the engine check covers both packages (lint, typecheck, tests), then the site's build, headers and audit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/design.md`, `docs/README.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: the layout and commands from Tasks 1–5.

- [ ] **Step 1: Rewrite the paths that moved**

```bash
sed -i '' -E 's#web/engine/#engine/src/#g; s#web/scripts/(analyse|fixtureScales|guideLines)\.ts#engine/scripts/\1.ts#g; s#`(charts/|fixtures/)#`engine/\1#g' CLAUDE.md README.md docs/design.md
grep -nE "web/engine|web/scripts/(analyse|fixture|guide)|\`charts/|\`fixtures/" CLAUDE.md README.md docs/design.md || echo "none left"
```

Expected: "none left". Read the diff: every changed line names a path. The historical `docs/plan-*.md` files are
left as they are (docs/README.md says the code and design.md win where they differ).

- [ ] **Step 2: CLAUDE.md**

1. Replace the bullet that now begins `` - `engine/src/` is the engine, pure TypeScript. `` (three lines) with:

```markdown
- Two npm workspace packages: `engine/` (`@chord-scale-maker/engine`: the engine in `engine/src/`, pure TypeScript,
  with its data `chord_scales.json`, `charts/`, `fixtures/` and its tools in `engine/scripts/`) and `web/` (the Nuxt
  app). The app imports the engine only as `@chord-scale-maker/engine`; `engine/src/index.ts` is its public API, and
  `engine/src/__tests__/api.test.ts` snapshots the exported names. `engine/fixtures/golden.json` freezes its answers
  over a wide input set (`engine/src/__tests__/goldenFixture.ts`); after an intended change to the engine,
  `chord_scales.json` or `charts/`, run `make golden` and review the fixture's diff. The golden test fails until then.
```

2. In the next bullet, change `Keep `engine/src/` free of Vue/DOM imports` to
   ``Keep `engine/` free of Vue/DOM imports (its lint rule enforces it)``.
3. Replace the runtime-dependencies bullet with:

```markdown
- Runtime `dependencies` are only what ships to browsers (`vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`,
  `@fontsource-variable/jost`, and the workspace's own `@chord-scale-maker/engine`, which has no dependencies);
  CI gates on `npm audit --omit=dev`. The lockfile and `overrides` are in the root `package.json`.
```

4. In "Typical requests", replace `` then `cd web && npm run analyse --
  ../charts/<tune>.txt --write --save` `` with `` then `cd engine && npm run analyse --
  charts/<tune>.txt --write --save` ``, and `` (`npm run analyse -- ../charts/<tune>.txt --ambiguous`) `` with
  `` (`cd engine && npm run analyse -- charts/<tune>.txt --ambiguous`) ``, and in the analysis-rule bullet
  `` `npm run analyse -- --all --force --save` `` with `` `cd engine && npm run analyse -- --all --force --save` ``.

- [ ] **Step 3: README.md**

1. Replace the analyser command block:

```sh
cd engine && npm run analyse -- charts/<tune>.txt --write --save
```

2. Replace the Makefile block's two changed lines:

```sh
make setup     # once: npm ci at the root (installs both packages: engine/ and web/)
make test      # typecheck and unit tests (vitest), both packages
```

and `make golden    # rewrite engine/fixtures/golden.json after an intended engine change` (already rewritten by
Step 1; check).

3. After the paragraph "The web app lives in `web/` …" (line 10), add:

```markdown
The engine — chart parsing, harmonic analysis, scales and spelling, guide tones, the sheet models — is its own
package, `@chord-scale-maker/engine` in `engine/`, with the chart library, `chord_scales.json`, its fixtures and the
analyser. It is pure TypeScript with no dependencies; the app imports it by name.
```

- [ ] **Step 4: docs/design.md**

1. §1 diagram: replace `charts/*.txt ───────┐` with `engine/charts/*.txt ┐` and `chord_scales.json ──┼─> build (Vite
   raw import) ┤` with `engine/chord_scales.json ┼─> build (Vite raw import) ┤`, keeping the box characters aligned;
   in the paragraph above it, change "from `charts/*.txt`" to "from `engine/charts/*.txt` (the engine package)".
2. §2 tree: replace the first four entries (`chord_scales.json`, `data/quotes.json`, `charts/*.txt`,
   `fixtures/golden.json`) with:

```text
package.json              # npm workspaces (engine, web), overrides; package-lock.json beside it
engine/                   # @chord-scale-maker/engine (specs/2026-10-11-engine-ui-split-design.md)
  chord_scales.json       # qualities, aliases, default/alternate scales, slash readings
  charts/*.txt            # chart library (concert pitch)
  fixtures/               # golden.json, analysis.json: the engine's frozen answers (`make golden`)
  scripts/                # analyse.ts, fixtureScales.ts, guideLines.ts (npm run analyse | fixture-scales | guide-lines)
  package.json, tsconfig.json, vitest.config.ts, eslint.config.mjs (the boundary rule)
data/quotes.json          # quotes for the navbar (web only)
```

   then move the block from `  engine/                 # pure TS, no Vue/DOM imports` through
   `    __tests__/            # vitest, incl. the golden fixture` out of `web/` to just after the `engine/` entry's
   config line, rename its first line to `  src/                    # pure TS, no Vue/DOM imports; index.ts is the
   public API`, and its last line's comment to `# vitest, incl. the golden fixture and the export snapshot`.
   Change `web/                      # Nuxt app (Vercel root directory)` to
   `web/                      # Nuxt app (Vercel root directory); imports @chord-scale-maker/engine`, and in the
   `web/` config line change `vitest.config.ts (engine + app projects)` to `vitest.config.ts (node + app projects)`
   and `tsconfig.engine.json` to `tsconfig.build.json`.
3. Replace the paragraph under the tree ("Vercel builds from `web/` with …") with:

```markdown
Vercel builds from `web/` with "include files outside root directory" enabled, so the engine package (`engine/`)
and `data/` are in the build; it installs from the workspace root (the root `package-lock.json`). The library comes
from the engine package through the `#charts` alias (`nuxt.config.ts`), and `make dev` watches the engine's charts
and `chord_scales.json`, since they sit outside Vite's root.
```

4. §7 "Loading": replace `` `import.meta.glob('../../../charts/*.txt', { query: '?raw', eager: true })` `` with
   `` `import.meta.glob('#charts/*.txt', { query: '?raw', eager: true })` (`#charts` is the engine package's
   `charts/`) ``.
5. §7a: change "**The CLI:** `npm run analyse --" to "**The CLI** (in `engine/`): `npm run analyse --".
6. §10 CI bullet: replace

```markdown
  - The jobs: lint, typecheck (`nuxt typecheck` plus the engine and e2e tsconfigs),
    vitest, `nuxt build`, the header check, `npm audit --omit=dev` (gating), and an e2e job.
```

   with

```markdown
  - The jobs: lint, typecheck (the engine's `tsc`, `nuxt typecheck`, the build and e2e tsconfigs) and vitest for
    both packages, then `nuxt build`, the header check, `npm audit --omit=dev` (gating), and an e2e job.
```
7. §12: add a decision:

```markdown
12. **Two packages, one repo.** The engine is the workspace package `@chord-scale-maker/engine` (`engine/`), with its
    data and tools; the app depends on it by name, through its `exports` map. A separate engine repo waits for a
    reason to exist: a second consumer, outside work on the analysis, or a release cadence of its own
    ([spec](superpowers/specs/2026-10-11-engine-ui-split-design.md), Phase 2). Until then a change that spans both
    is one PR, and the commit is still the release (decision 10).
```

- [ ] **Step 5: docs/README.md and docs/roadmap.md**

In `docs/README.md`, add a row after the `design.md` row:

```markdown
| [superpowers/specs/2026-10-11-engine-ui-split-design.md](superpowers/specs/2026-10-11-engine-ui-split-design.md) | The engine as its own package (built), and the conditions and steps for a separate engine repo (not scheduled). |
```

In `docs/roadmap.md`, under `## Next`, add:

```markdown
### A separate engine repo (conditional)

The engine is its own workspace package. Moving it to its own repo, published to npm, waits for a trigger: something
other than this site needs it, people want to work on the analysis without the app, or its releases should follow
their own cadence ([spec](superpowers/specs/2026-10-11-engine-ui-split-design.md), Phase 2; plan Part B).
```

- [ ] **Step 6: Check the docs**

```bash
grep -rnE "cd web && npm run (analyse|golden)|\.\./charts/|web/engine|tsconfig\.engine" CLAUDE.md README.md docs/design.md docs/README.md docs/roadmap.md || echo "clean"
```

Expected: "clean".

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md README.md docs/design.md docs/README.md docs/roadmap.md
git commit -F - <<'EOF'
Docs: the engine package (layout, commands, the boundary, decision 12) and the conditional repo split

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Verify, as Vercel and a newcomer would see it

**Files:** none changed (a fresh clone in `$TMPDIR`).

- [ ] **Step 1: The full local suite**

```bash
make setup && make test && make lint && make e2e
npm run check:headers -w web
npm audit --omit=dev --audit-level=high
npm run fixture-scales -w engine -- main
```

Expected: all PASS; e2e with no CSP violations; "no scale changed". Total unit tests = Task 0 + 2 (the library test,
the API snapshot).

- [ ] **Step 2: A fresh clone builds** (Review Focus 1)

```bash
rm -rf "$TMPDIR/csm-split/clone"
git clone --quiet --branch "$(git branch --show-current)" "$(git rev-parse --show-toplevel)" "$TMPDIR/csm-split/clone"
cd "$TMPDIR/csm-split/clone" && npm ci && npm test -w engine && npm run build -w web
ls web/.output/public/index.html web/.output/public/song/index.html
grep -o 'song?chart=[a-z0-9_]*' web/.output/public/index.html | sort -u | wc -l
ls engine/charts/*.txt | wc -l
cd -
```

Expected: install, engine tests and build pass from the committed files alone; both pages exist; the two counts are
equal (242 at the time of writing: the prerendered library links every chart).

- [ ] **Step 3: `make preview` shows the site as before**

Run `make preview`, open http://localhost:3000: the library lists 242 charts (scroll to the end or search "a"), a
chart opens on the Changes sheet, the Scales sheet draws, `/functions` lists the rules, and the browser console
shows no CSP errors. Stop the server.

- [ ] **Step 4: `make dev` reloads a chart edit** (Review Focus 5)

Run `make dev`, open http://localhost:3000, then in another terminal append a comment line to
`engine/charts/autumn_leaves.txt` (`echo '# reload check' >> engine/charts/autumn_leaves.txt`). Expected: the page
reloads (or the library entry updates) without restarting the server. Undo with
`git checkout -- engine/charts/autumn_leaves.txt`, and stop the server.

- [ ] **Step 5: Hand over**

Report to the user: the commits, the test counts against Task 0, and that the branch is ready to push. When the user
says to push: open the PR; wait for `gh pr checks <n> --watch` to exit 0 (both `engine` and `e2e`); check Vercel's
preview deploy built (if its install fails because it ran in `web/`, add `"installCommand": "npm ci --prefix .."` to
`web/vercel.json`, push, and re-check); open the preview and repeat Step 3's checks there. Merge only on green.

---

## Part B — two repos (only if D1 changes, or a Phase 2 trigger appears)

Part B starts from main with Part A merged. Steps marked **(user)** need the user's accounts or settings and are
done by the user or with their explicit go-ahead.

### Task 8: Make the engine importable under plain Node [D9]

From this task on, the app in the workspace uses the built engine (`dist/`): after an engine change, run
`npm run build -w engine` (the root `prepare` script also builds on `npm install`). Part B goes on to Task 10 promptly,
so this costs little.

**Files:**
- Create: `engine/vite.config.ts`, `engine/tsconfig.dist.json`, `engine/src/__tests__/dist.test.ts`
- Modify: `engine/package.json` (`exports`, `files`, `scripts`, `devDependencies`, drop `private`), root
  `package.json` (a `prepare` script), `.gitignore` (`engine/dist/`), `web/e2e/functions.spec.ts`

**Interfaces:**
- Produces: `engine/dist/index.js` (ESM, `chord_scales.json` inlined) and `engine/dist/index.d.ts`; `exports` `"."`
  → `{ "types": "./dist/index.d.ts", "default": "./dist/index.js" }`.

- [ ] **Step 1: Write the failing test that plain Node can import the build**

`engine/src/__tests__/dist.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'

// the published package must load without a bundler (no TypeScript, JSON inlined)
it('dist/index.js imports under plain Node and parses a chart', () => {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', "import('./dist/index.js').then((m) => console.log(m.parseChart('title: T\\nA | 1 | Cm7').value.lines.length))"], { encoding: 'utf8' })
  expect(Number(out.trim())).toBeGreaterThan(0)
})
```

Run: `cd engine && npx vitest run src/__tests__/dist.test.ts`
Expected: FAIL (`Cannot find module … dist/index.js`).

- [ ] **Step 2: Add the build**

`engine/vite.config.ts`:

```ts
import { defineConfig } from 'vite'

// the published package: one ESM file with chord_scales.json inlined, readable (not minified), with a source map
export default defineConfig({
  build: { lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' }, outDir: 'dist', emptyOutDir: true, target: 'es2023', minify: false, sourcemap: true },
})
```

`engine/tsconfig.dist.json`:

```jsonc
{
  // declarations for the published package
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "declaration": true, "emitDeclarationOnly": true, "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/__tests__/**"]
}
```

In `engine/package.json`: remove `"private": true`; set `"version": "0.1.0"`; set

```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./charts/*": "./charts/*",
    "./package.json": "./package.json"
  },
  "files": ["dist", "charts", "chord_scales.json", "LICENSE", "README.md"],
```

add the script `"build": "vite build && tsc -p tsconfig.dist.json"` and change `"test"` to
`"npm run build && vitest run"`; add `"vite"` to `devDependencies` at the version `npm ls vite` shows (8.3.2 at the
time of writing). In the root `package.json` scripts add `"prepare": "npm run build -w engine"`. In `.gitignore` add
`engine/dist/`. Remove `build: { transpile: … }` from `web/nuxt.config.ts` (the app now gets compiled JS).

- [ ] **Step 3: Run the test, then everything**

Run: `npm install && cd engine && npx vitest run src/__tests__/dist.test.ts && cd .. && make test && make lint`
Expected: PASS. If `tsc -p tsconfig.dist.json` fails on the JSON import in a declaration, give the exported value an
explicit type in `qualities.ts`/`levels.ts` so no declaration refers to the JSON file.

- [ ] **Step 4: Import the rules directly in the e2e test**

In `web/e2e/functions.spec.ts`, replace the `ENGINE`/`RULE_IDS` block and the `createRequire`, `pathToFileURL` and
`readFileSync` imports (if `readFileSync` has no other use) with:

```ts
import { RULES } from '@chord-scale-maker/engine'

const RULE_IDS = RULES.map((r) => r.id)
```

Run: `make e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/vite.config.ts engine/tsconfig.dist.json engine/src/__tests__/dist.test.ts engine/package.json package.json package-lock.json .gitignore web/nuxt.config.ts web/e2e/functions.spec.ts
git commit -F - <<'EOF'
Engine: a build that loads under plain Node (ESM, JSON inlined, declarations), ready to publish as 0.1.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 9: Show the engine's version in the site

**Files:**
- Modify: `web/build/version.ts`, `web/build/version.test.ts`, `web/nuxt.config.ts`

**Interfaces:**
- Produces: `withEngine(version: string, engine: string): string` in `web/build/version.ts`;
  `runtimeConfig.public.version` becomes e.g. `2026.10.20 · 1e2bea5 · engine 0.4.1` (footer, contact email and issue
  report all read it).

- [ ] **Step 1: Write the failing test**

In `web/build/version.test.ts`, add `withEngine` to the import from `./version` and:

```ts
describe('withEngine', () => {
  it('adds the engine release to the site version', () => {
    expect(withEngine('2026.10.20 · 1e2bea5', '0.4.1')).toBe('2026.10.20 · 1e2bea5 · engine 0.4.1')
  })
  it('leaves a version alone when the engine has none', () => {
    expect(withEngine('2026.10.20 · 1e2bea5', '')).toBe('2026.10.20 · 1e2bea5')
  })
})
```

Run: `cd web && npx vitest run build/version.test.ts`
Expected: FAIL (`withEngine` is not exported).

- [ ] **Step 2: Implement it**

Append to `web/build/version.ts`:

```ts
/** the site's version plus the engine release it was built with, once the engine is published on its own */
export const withEngine = (version: string, engine: string): string => (engine ? `${version} · engine ${engine}` : version)
```

In `web/nuxt.config.ts`, add `import { buildVersion, withEngine } from './build/version'` (replacing the
`buildVersion` import) and read the engine's manifest beside `ENGINE_DIR`:

```ts
const ENGINE_VERSION = (JSON.parse(readFileSync(join(ENGINE_DIR, 'package.json'), 'utf8')) as { version: string }).version
```

(with `import { readFileSync } from 'node:fs'`), then set
`version: withEngine(buildVersion(process.env), ENGINE_VERSION),`.

- [ ] **Step 3: Run and commit**

Run: `make test`
Expected: PASS.

```bash
git add web/build/version.ts web/build/version.test.ts web/nuxt.config.ts
git commit -F - <<'EOF'
Version: the engine release beside the site's commit (footer, contact email, issue report)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 10: Cut the engine repo [D10]

**Files:** a new repository, `chord-scale-engine`, outside this one.

- [ ] **Step 1: Install git-filter-repo**

Run: `brew install git-filter-repo && git filter-repo --version`
Expected: a version number.

- [ ] **Step 2: Rewrite a fresh clone to the engine's paths**

```bash
cd "$TMPDIR" && rm -rf chord-scale-engine
git clone https://github.com/KevDog/Chord-Scale-Maker.git chord-scale-engine && cd chord-scale-engine
git filter-repo \
  --path engine/ \
  --path web/engine/ --path web/scripts/analyse.ts --path web/scripts/fixtureScales.ts --path web/scripts/guideLines.ts \
  --path chord_scales.json --path charts/ --path fixtures/ \
  --path jazz_scales.py --path tests/ --path tools/ \
  --path LICENSE --path docs/plan-analysis.md --path docs/research/ \
  --path-rename engine/: --path-rename web/engine/:src/ --path-rename web/scripts/:scripts/
ls
git log --oneline --follow -- src/scales.ts | tail -3
git log --all --oneline -- 'design/*' | wc -l
```

Expected: `ls` shows `charts chord_scales.json docs fixtures LICENSE package.json scripts src` (plus config files);
`src/scales.ts`'s history reaches back to the port (2026-10-04); the `design/` count is `0`.

- [ ] **Step 3: Add what a standalone repo needs**

Create in the new repo:
- `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`, `* [0-9].*`, and the research rules `design/leadsheets/`,
  `design/sources/`, `design/tailwind-plus/` (kept so a copied folder can't be committed by accident);
- `package-lock.json`: `npm install`;
- `.github/workflows/ci.yml` (the action SHAs are the app workflow's at the time; copy them from there):

```yaml
name: ci
on:
  pull_request:
permissions:
  contents: read
concurrency:
  group: ci-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      # builds dist/, then the unit tests, the golden and analysis fixtures, and the plain-Node import test
      - run: npm test
      - run: npm audit --omit=dev --audit-level=high
```

- `.github/workflows/release.yml`:

```yaml
name: release
# a pushed tag v0.x.y publishes that version to npm (trusted publishing: no token; provenance attached)
on:
  push:
    tags: ['v*']
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: test "v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"
      - run: npm test
      - run: npm publish --provenance --access public
```
- `.github/dependabot.yml`: npm at `/` and github-actions at `/`, weekly, minor/patch grouped, the TypeScript-major
  ignore copied from the app's;
- `README.md` (what the engine is, the API entry, the chart format section moved from the app's README, the
  analyser and golden commands) and `CLAUDE.md` (the app's design rules and the engine half of "Typical requests").

Run: `npm ci && npm run lint && npm run typecheck && npm test`
Expected: PASS. Commit with the trailer.

- [ ] **Step 4 (user): Create the repo, ruleset and publisher**

The user creates `KevDog/chord-scale-engine` (public, MIT), pushes, adds a `protect main` ruleset requiring the
`engine` check (merge commits only, PRs required, no force push, no deletion), creates the npm organisation
`chord-scale-maker`, and configures trusted publishing for `@chord-scale-maker/engine` from
`KevDog/chord-scale-engine`'s `release.yml`. Then tag and push `v0.1.0`, and check `npm view
@chord-scale-maker/engine version` prints `0.1.0`.

### Task 11: Switch the app to the published engine

**Files:**
- Delete: `engine/`
- Modify: root `package.json` (`workspaces: ["web"]`, remove `prepare`), `web/package.json`
  (`"@chord-scale-maker/engine": "0.1.0"`), `package-lock.json`, `Makefile` (remove `golden`),
  `.github/workflows/ci.yml` (job `engine` renamed `app`), `web/test/library.test.ts` (read the charts folder through
  the package), `CLAUDE.md`, `README.md`, `docs/design.md`

- [ ] **Step 1: Read the library test's charts through the package**

In `web/test/library.test.ts`, replace `new URL('../../engine/charts/', import.meta.url)` with
`new URL('charts/', pathToFileURL(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json')))`
and add `import { createRequire } from 'node:module'` and `import { pathToFileURL } from 'node:url'`.

- [ ] **Step 2: Replace the workspace package with the release**

```bash
git rm -r -q engine
# root package.json: "workspaces": ["web"], delete the "prepare" script
# web/package.json: "@chord-scale-maker/engine": "0.1.0"
npm install
ls node_modules/@chord-scale-maker/engine/dist/index.js node_modules/@chord-scale-maker/engine/charts | head -3
make test && make lint && make e2e
```

Expected: the installed package has `dist/` and `charts/`; everything passes, including the library test (all charts
through `#charts`, now in `node_modules`). If the glob finds no files under `node_modules`, add a generated module to
the engine instead (`charts/index.js` exporting `{ [slug]: text }`, built by the engine's `build` script), import it
in `library.ts`, release `0.1.1`, and bump.

- [ ] **Step 3: CI, Makefile, docs**

In `.github/workflows/ci.yml`, rename the job `engine:` to `app:` and drop `--workspaces`-only wording from its
comments. In `Makefile`, delete the `golden` target and its line in `.PHONY`. In `CLAUDE.md`, `README.md` and
`docs/design.md`, replace the engine-package sections with a pointer to the engine repo and the rule "change the
engine there, release, then bump here (Dependabot proposes each release)". Keep `ISSUE_REPO` in
`web/app/utils/issueReport.ts` as the app repo (one inbox; transfer analysis issues to the engine repo by hand).

- [ ] **Step 4: Commit, then (user) update the ruleset at merge**

```bash
git add package.json package-lock.json web/package.json web/test/library.test.ts Makefile .github/workflows/ci.yml CLAUDE.md README.md docs/design.md
git commit -F - <<'EOF'
App: use the published engine (@chord-scale-maker/engine 0.1.0); the engine now lives in its own repo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

**(user)** In the `protect main` ruleset, replace the required check `engine` with `app` when this PR is ready (the
PR's `app` check must pass first), and confirm Vercel's preview built with the engine from npm.

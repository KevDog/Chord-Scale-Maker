# `csm add`: the admin CLI and its first verb (#402)

From the #401 research: one repo-only admin CLI, `csm`, that collects the scattered scripts. This spec covers the
package and `csm add` (one song from iReal Pro). Bulk import (#403), `csm check` (#404) and the flag envs (#405) come
later and reuse this package.

## Package
- New workspace `cli/` (`@chord-scale-maker/cli`), private, `type: module`, dev dependencies only (nothing ships to
  browsers; `npm audit --omit=dev` is unaffected). Root `workspaces`: `["engine", "web", "cli"]`, so CI's
  `npm test` / `lint` / `typecheck --workspaces` covers it with no workflow change.
- `bin: { "csm": "./bin/csm.mjs" }`: a stub that runs `src/main.ts` through `vite-node`. From the repo root:
  `npx csm add …`.
- Imports only `@chord-scale-maker/engine` (its public API) and `node:*`. Arguments: `node:util` `parseArgs`.
- Same tsconfig strictness and eslint base as `engine/`.
- Files: `src/args.ts` (parsing, song picking, the slug), `src/add.ts` (the step sequence, its effects injected),
  `src/main.ts` (wiring: real fs, real `make`, process exit). Tests in `src/__tests__/`.

## Engine: `prepareChart`
One new public export (`engine/src/prepare.ts`; `api.test.ts` gains the name):

```ts
prepareChart(text: string, overrides: Partial<Record<MetaKey, string>>): {
  chart: string            // overrides set (setMeta), then the analysis saved (applyAnalysis, save: true)
  gaps: readonly string[]  // tuneGaps: these fail make test
  advice: readonly string[] // tuneAdvice
  ambiguities: readonly string[] // what a function, an @key or a context: could settle
}
```
Pure; the date for the analysis header is a parameter (`date: string`), not read from the clock.

## `csm add`
```
csm add <irealb:// link | export.html> [--list] [--song <n | title>] [--force] [--print]
        [--composer …] [--form …] [--style …] [--kind tune|form|exercise] [--aka …] [--recording …] [--source …]
```
1. Read the input (a link, else a file), `decodeIReal`; decode diagnostics → stderr; no songs → exit 1.
2. `--list`: the playlist's songs, numbered; exit 0.
3. Pick the song (`--song`, required when several); `irealToChart`; its diagnostics → stderr.
4. `prepareChart` with the header flags as overrides.
5. `--print`: print the chart, then the report (gaps, ambiguities, advice); write nothing; exit 0.
6. Else write `engine/charts/<slug>.txt`; an existing file without `--force` → exit 1 before writing.
7. Report ambiguities. Gaps → list each with the flag that fixes it (`no composer: → --composer "…"`),
   exit 1, no golden or og (the file stays written so a rerun with `--force` and the flag fixes it).
8. No gaps → `make golden`, then `make og` (child processes, output streamed); a failure → exit with its code.
9. Print the advice and the next step: review `git diff engine/fixtures web/public/og`, commit.

Exit codes: 0 done; 1 bad input, a refused overwrite, gaps, or a failed step; 2 usage.

## Removed / updated
- `engine/scripts/importIreal.ts`, `importIrealArgs.ts` and the `import-ireal` npm script go; `parseImportArgs`'s
  and `pickSong`'s tests move to `cli/`.
- CLAUDE.md "Make a chart" and "Import from iReal" name `npx csm add`; the iReal spec's CLI section points here.

## Testing (TDD)
- Engine: `prepareChart`: overrides land in the header; gaps and advice listed; reasons saved; ambiguities listed.
- CLI `args`: options, usage errors, song picking, slugs.
- CLI `add`, effects injected (`read`, `exists`, `write`, `run`, `out`): gaps → no `run`; `--print` → no `write`;
  existing file → refused without `--force`; clean → `run('golden')` then `run('og')`; a failed `run` → its code.
- Smoke: `main` on an `irealLink` fixture with `--print`.

## Not in this PR
`--playlist` (#403), MusicXML (#261), `csm check` (#404).

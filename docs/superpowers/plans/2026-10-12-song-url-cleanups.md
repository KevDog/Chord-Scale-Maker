# Song URL review leftovers (#178–#185): cleanup plan

> **For agentic workers:** one small PR; work the checklist in order, `make test` after each item, `make lint` and `make e2e` at the end. Close each issue from the PR (`Closes #…`). Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name.

**Goal:** clear the shippable minors from the final review of #173/#175. No behaviour change except #178 (a stray `?mine` dropped from a library chart's address).

**Spec:** none (each issue states its fix); verified still present on `main` 2026-10-12.

## Checklist

- [ ] **#185 `sitemap.ts`: `.map(tunePath)` passes index args.** `web/app/utils/sitemap.ts`: `chartSlugsOf(files).map((slug) => tunePath(slug))`. Covered by `web/test/sitemap.test.ts` (unchanged, stays green).

- [ ] **#184 `library.ts` ends with a blank line.** Remove the trailing extra `\n` from `web/app/utils/library.ts` (the file ends in one newline).

- [ ] **#182 `OLD_NAME_KEY` accepts shapes nothing writes.** `web/app/utils/myCharts.ts:98`: tie the mode suffix to practice keys:
  ```ts
  const OLD_NAME_KEY = /^(?:(csm-practice:)(?!mine:)([a-z0-9]+(?:_[a-z0-9]+)+)(:[a-z]+)|(csm-level:)(?!mine:)([a-z0-9]+(?:_[a-z0-9]+)+))$/
  ```
  and read the groups as `prefix = m[1] ?? m[4]`, `name = m[2] ?? m[5]`, `mode = m[3] ?? ''`. Test first in the `migrateChartNames` tests (`web/test/myCharts.test.ts` or wherever they live: `grep -rl migrateChartNames web/test`): `csm-practice:round_midnight:root` and `csm-level:round_midnight` move; `csm-practice:round_midnight` (no mode) and `csm-level:round_midnight:root` stay where they are.

- [ ] **#183 migration's index rewrite drops malformed entries.** No change: the issue records that it's the same normalised write as every other index write (`myCharts.ts:78`, `:84`), no new loss path. Add one line to `migrateChartNames`' doc comment ("the index is rewritten as readIndex reads it, as every index write is") and close the issue as noted.

- [ ] **#178 `/song/<name>?mine=x` keeps an unused `?mine`.** `web/app/pages/song/[[slug]].vue:66`: redirect when a library chart's address carries `mine` too:
  ```ts
  if (findChart(slug()) && (route.path !== songPath(slug()) || route.query.mine !== undefined))
    await navigateTo({ path: songPath(slug()), hash: route.hash }, { replace: true })
  ```
  Test first in `web/test/features.test.ts` (it mocks `navigateTo`): `/song/f-blues?mine=x` calls `navigateTo({ path: '/song/f-blues', hash: '' }, { replace: true })`.

- [ ] **#179 unit test for the `?chart=` redirect.** Same file: `/song?chart=f-blues` calls `navigateTo({ path: '/song/f-blues', hash: '' }, { replace: true })` (follow the file's existing mount-and-assert pattern for the mocked `navigate`).

- [ ] **#180 e2e: pin the Open and My charts hrefs.** `web/e2e/library.spec.ts`: before clicking `Open Autumn Leaves in the editor`, `await expect(page.getByRole('link', { name: 'Open Autumn Leaves in the editor' })).toHaveAttribute('href', '/song/autumn-leaves')`. In the My charts test that opens an edited library chart (`web/e2e/my-charts.spec.ts`), assert the list link's `href` is `/song/<name>` (`MyChartsList.vue` `openHref`) before clicking it.

- [ ] **#181 e2e: two overlapping noindex/canonical tests.** `web/e2e/library.spec.ts`: fold "a library chart's practice sheets live at /song/<name>" into "the editor is noindex, its canonical never carries a share link, and its tab names the chart" (keep its `staves(page)).toHaveCount(6)` line there) and delete the duplicate.

- [ ] `make test`, `make lint`, `make e2e`; one PR, "Song URL review minors", body `Closes #178, closes #179, closes #180, closes #181, closes #182, closes #183, closes #184, closes #185`.

# Analytics: routes and events: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** page views carry Vercel routes (sent manually on each Nuxt navigation); six anonymous custom events behind the `analyticsEvents` flag.

**Architecture:** the same-origin `analytics-before-send.js` gains the `window.va` queue stub; the script tag disables auto-tracking; a client plugin sends `pageview` with `{ route, path }`; a typed `track()` util sends events, gated on the flag and on `window.va` (present only in production builds).

**Tech Stack:** Nuxt 4, TypeScript (strict), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-analytics-routes-events-design.md` (issue #149).

## Global Constraints

- CSP unchanged; no inline script; no new dependency; production builds only (`analyticsScripts` already returns `[]` elsewhere).
- Events: ≤ 2 data properties, values ≤ 255 chars, from closed lists or library slugs; `song` is a slug or `own`.
- New flag `analyticsEvents` (off); add `NUXT_PUBLIC_FEATURES_ANALYTICS_EVENTS=true` to `web/package.json`'s `e2e` script.
- `make test` after each task; `make lint`, `make e2e` at the end. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name.

## Review Focus

- **Double page views** (auto-track not actually disabled): one `pageview` per navigation — Task 1 Step 1 checks the script; Task 4 e2e counts.
- **A shared link's chart title leaking** into `song`: `own` unless the text equals a library chart — Task 3 test.
- **Instrument flipping** inflating events: once per song page visit — Task 3 test and e2e.
- **The initial sheet or instrument** sending an event on load: only changes count — Task 4 e2e (no events before interaction).
- **Analytics blocked** (ad blockers, `window.va` undefined): nothing throws — Task 2 test.

---

### Task 1: verify the script, then route page views

**Files:** Modify `web/build/analytics.ts`, `web/public/analytics-before-send.js`; Create `web/app/plugins/analytics.client.ts`, `web/app/utils/analyticsRoute.ts`; Test `web/test/analytics.test.ts` (extend if it exists: `grep -l analyticsScripts web/test`), `web/test/analyticsRoute.test.ts`.

**Interfaces:** Produces `vercelRoute(pattern: string): string`.

- [ ] **Step 1: Re-check** the manual-tracking switch (verified 2026-10-12: the script reads `currentScript.dataset.disableAutoTrack`, i.e. `data-disable-auto-track`; with it off the script sends no first page view and doesn't patch `pushState`; `va('pageview', { route, path })` sets both): `curl -s https://www.chordscalemaker.com/_vercel/insights/script.js | grep -o 'disable[-A-Za-z]*' | sort -u` (and look for how `pageview` with `route` is read: `grep -o 'route[^,]\{0,40\}'`). Expected: `data-disable-auto-track`. If the name differs, use what the script reads and note it in the commit message. If the script can't take a route, stop and report.

- [ ] **Step 2: Failing tests** — `analyticsRoute.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { vercelRoute } from '~/utils/analyticsRoute'

describe('vercelRoute', () => {
  it("writes Nuxt's route patterns the way Vercel groups them", () => {
    expect(vercelRoute('/song/:slug?')).toBe('/song/[slug]')
    expect(vercelRoute('/tunes/:slug')).toBe('/tunes/[slug]')
    expect(vercelRoute('/')).toBe('/')
    expect(vercelRoute('/about')).toBe('/about')
    expect(vercelRoute('/:path(.*)*')).toBe('/[...path]')
  })
})
```
and in the analytics build test: the production script entry has `'data-disable-auto-track': '1'` (both the default and the base-path variants).

- [ ] **Step 3:** FAIL. **Step 4: Implement**

`analyticsRoute.ts`:
```ts
/** a Nuxt route pattern as Vercel Web Analytics groups routes: /song/:slug? -> /song/[slug], a catch-all -> [...name] */
export const vercelRoute = (pattern: string): string =>
  pattern.replace(/:(\w+)\([^)]*\)\*/g, '[...$1]').replace(/:(\w+)\??/g, '[$1]')
```
`analytics.ts`: add `'data-disable-auto-track'?: '1'` to `AnalyticsScript` and set it on both insights entries; update the doc comment (pages are sent by `plugins/analytics.client.ts`, with routes).
`analytics-before-send.js`: before the `beforeSend` push:
```js
// the queue stub @vercel/analytics would add inline: calls made before the script loads wait in vaq
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments) }
```
`plugins/analytics.client.ts`:
```ts
import { vercelRoute } from '~/utils/analyticsRoute'

/** one page view per page shown, with its route (the script's own tracking is off: build/analytics.ts) */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:finish', () => {
    const va = (window as { va?: (...a: unknown[]) => void }).va
    const pattern = useRoute().matched.at(-1)?.path
    if (va && pattern) va('pageview', { route: vercelRoute(pattern), path: location.pathname })
  })
})
```
- [ ] **Step 5:** PASS; `make test`. **Step 6:** commit, "Analytics: page views with their routes (#149)".

---

### Task 2: the typed `track` util

**Files:** Create `web/app/utils/analytics.ts`; Modify `web/nuxt.config.ts` (flag `analyticsEvents: false` with a comment naming the spec), `web/app/composables/useFeature.ts`, `web/package.json` (e2e env); Test `web/test/analyticsEvents.test.ts`.

**Interfaces:**
```ts
export type AnalyticsEvent =
  | { name: 'Share created'; data: { song: string } }
  | { name: 'Shared link opened'; data: { song: string } }
  | { name: 'Sheet chosen'; data: { sheet: SheetKind } }
  | { name: 'Instrument chosen'; data: { instrument: InstrumentName } }
  | { name: 'Printed'; data: { sheet: SheetKind; song: string } }
  | { name: 'Transposed'; data: { song: string; to: string } }
export function sendEvent(e: AnalyticsEvent, on: boolean, w?: { va?: (...a: unknown[]) => void }): void
export function songOf(target: SaveTarget | undefined, text: string, shared?: boolean): string
```

- [ ] **Step 1: Failing tests**:

```ts
import { describe, expect, it, vi } from 'vitest'
import { sendEvent, songOf } from '~/utils/analytics'

describe('sendEvent', () => {
  it('sends only with the flag on and the script present', () => {
    const va = vi.fn()
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, false, { va })
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, true, {})
    expect(va).not.toHaveBeenCalled()
    sendEvent({ name: 'Sheet chosen', data: { sheet: 'scales' } }, true, { va })
    expect(va).toHaveBeenCalledWith('event', { name: 'Sheet chosen', data: { sheet: 'scales' } })
  })
  it('never sends more than two properties or a value over 255 characters', () => {
    const va = vi.fn()
    sendEvent({ name: 'Transposed', data: { song: 'x'.repeat(300), to: 'Eb' } }, true, { va })
    const data = va.mock.calls[0]?.[1].data as Record<string, string>
    expect(Object.keys(data).length).toBeLessThanOrEqual(2)
    expect(Object.values(data).every((v) => v.length <= 255)).toBe(true)
  })
  it("doesn't throw if the call fails", () => {
    expect(() => sendEvent({ name: 'Printed', data: { sheet: 'changes', song: 'own' } }, true, { va: () => { throw new Error('blocked') } })).not.toThrow()
  })
})

describe('songOf', () => {
  const lib = { kind: 'library', slug: 'autumn-leaves', libraryText: 'A | 1 | Cm7\n' } as const
  it('names a library chart as published, else own', () => {
    expect(songOf(lib, lib.libraryText)).toBe('autumn-leaves')
    expect(songOf(lib, 'A | 1 | Cm9\n')).toBe('own')
    expect(songOf({ kind: 'mine', id: 'x' }, 'title: My Secret Tune\n')).toBe('own')
  })
  it('names a shared chart only when its text is a library chart', () => {
    expect(songOf(undefined, 'title: My Secret Tune\nA | 1 | C\n', true)).toBe('own')
  })
})
```
Add one more `songOf(undefined, <the text of LIBRARY[0]>, true)` → `LIBRARY[0].slug` (import `LIBRARY` from `~/utils/library`).

- [ ] **Step 2:** FAIL. **Step 3: Implement** `web/app/utils/analytics.ts`:

```ts
import type { InstrumentName } from '@chord-scale-maker/engine'
import type { SaveTarget } from '~/composables/useSavedChart'
import { LIBRARY } from '~/utils/library'
import type { SheetKind } from '~/utils/sheets'

/** Vercel Web Analytics custom events (docs/superpowers/specs/2026-10-12-analytics-routes-events-design.md): closed values, ≤ 2 properties (Pro) */
export type AnalyticsEvent = /* as in Interfaces */

/** send one event when events are on and the analytics script is there (production builds); never throws */
export function sendEvent(e: AnalyticsEvent, on: boolean, w: { va?: (...a: unknown[]) => void } = window as never): void {
  if (!on || !w.va) return
  const data = Object.fromEntries(Object.entries(e.data).slice(0, 2).map(([k, v]) => [k, String(v).slice(0, 255)]))
  try {
    w.va('event', { name: e.name, data })
  } catch {
    /* analytics is never worth an error */
  }
}

/** the chart as analytics may name it: a library slug when it's that chart as published, else own */
export function songOf(target: SaveTarget | undefined, text: string, shared = false): string {
  if (target?.kind === 'library') return text === target.libraryText ? target.slug : 'own'
  return shared ? (LIBRARY.find((c) => c.text === text)?.slug ?? 'own') : 'own'
}
```
Flag, `Feature` union and e2e env as in Global Constraints.

- [ ] **Step 4:** PASS; `make test`. **Step 5:** commit, "track: typed, anonymous analytics events behind analyticsEvents (#149)".

---

### Task 3: send the events

**Files:** Modify `web/app/components/EditorView.vue` (and the song page for `Shared link opened` if the shared view is only known there: `web/app/pages/song/[[slug]].vue`), `web/app/pages/privacy.vue`.

**Interfaces:** consumes Task 2.

- [ ] **Step 1:** In `EditorView.vue` setup: `const eventsOn = useFeature('analyticsEvents')`; `const song = (): string => songOf(props.saveTarget, editor.text.value, props.shared !== undefined)`; `const send = (e: AnalyticsEvent) => sendEvent(e, eventsOn)`. Then:
  - `openShare()` (`:559`), after the link is made: `send({ name: 'Share created', data: { song: song() } })`.
  - `onMounted`: `if (props.shared) send({ name: 'Shared link opened', data: { song: song() } })`.
  - `watch(sheet, (s) => send({ name: 'Sheet chosen', data: { sheet: s } }))` (a watch doesn't fire for the initial value).
  - instrument: `let instrumentSent = false; watch(() => prefs.instrument.value, (i) => { if (!instrumentSent) { instrumentSent = true; send({ name: 'Instrument chosen', data: { instrument: i } }) } })`; reset `instrumentSent` when the chart changes (watch `props.saveTarget`, or wherever the editor restarts on a new chart: the Song URL spec says the editor restarts on a different chart, so the component remounts and the `let` resets on its own; confirm and leave a comment).
  - `print()` (`:613`): `send({ name: 'Printed', data: { sheet: sheet.value, song: song() } })`.
  - where a transpose is applied (grep `Transposed` for the status message's handler): `send({ name: 'Transposed', data: { song: song(), to: <the target key as written> } })`. For `song`, use the chart before transposing (a transposed library chart is no longer "as published").
- [ ] **Step 2:** `privacy.vue`: after the Web Analytics sentence, `<template v-if="eventsOn"> It also counts a few anonymous actions (which sheet, instrument, printing, transposing, sharing), never your chart's contents.</template>` with `const eventsOn = useFeature('analyticsEvents')`.
- [ ] **Step 3:** `make test`, `make lint`. **Step 4:** commit, "Send the six analytics events (#149)".

---

### Task 4: browser tests and design notes

**Files:** Create `web/e2e/analytics.spec.ts`; Modify `docs/design.md` (analytics section: routes, the plugin, events, the flag, cost note).

- [ ] **Step 1: e2e**

```ts
import { chooseInstrument, chooseSheet, expect, test } from './fixtures'

type Call = [string, Record<string, unknown>]
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = []
    ;(window as unknown as { va: unknown; vaCalls: unknown[] }).vaCalls = calls
    ;(window as unknown as { va: unknown }).va = (...a: unknown[]) => calls.push(a)
  })
})
const calls = async (page: import('@playwright/test').Page): Promise<Call[]> => page.evaluate(() => (window as unknown as { vaCalls: Call[] }).vaCalls)
const events = async (page: import('@playwright/test').Page) => (await calls(page)).filter(([k]) => k === 'event').map(([, e]) => e)

test('one page view per page, with its route', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect.poll(async () => (await calls(page)).filter(([k]) => k === 'pageview')).toEqual([['pageview', { route: '/song/[slug]', path: '/song/autumn-leaves' }]])
})

test('actions send one anonymous event each, none on load', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
  expect(await events(page)).toEqual([])
  await chooseSheet(page, 'Scales')
  await chooseInstrument(page, 'Tenor')
  await chooseInstrument(page, 'Trombone')
  await expect.poll(() => events(page)).toEqual([
    { name: 'Sheet chosen', data: { sheet: 'scales' } },
    { name: 'Instrument chosen', data: { instrument: 'tenor-sax' } },
  ])
})
```
(`tenor-sax` is Tenor Sax's `InstrumentName`; check `chooseInstrument`'s match for 'Tenor' picks it.) Add: a share (open Share → `Share created` with `autumn-leaves`), and opening that link in a fresh context after editing a chord → `Shared link opened` with `own`, and `JSON.stringify(await events(visitor))` doesn't contain the chart's title.
- [ ] **Step 2:** `make e2e` green. **Step 3:** `docs/design.md`. **Step 4:** commit, "Browser tests and design notes for analytics routes and events (#149)".
- [ ] **Step 5 (after merge, by the owner):** in the Vercel dashboard, check Pages and Routes after a day; turn `analyticsEvents` on only after the move to Pro.

# Send a chart to the library: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** from the editor, a user sends a chart for the library (or suggests changes to a library chart); the owner gets an email with it attached as `<slug>.txt`, and an optional credit.

**Architecture:** the contact form carries an optional `chart` block; the server validates it and attaches the text to the Resend email. A pure app util decides which editor actions show and hands the chart to `/contact` through sessionStorage. A new chart header `contributor:` credits the sender on the tune page.

**Tech Stack:** TypeScript (strict), Nuxt 4 / Nitro, Vue 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-chart-submissions-design.md` (issue #153).

**Refreshed against main (2026-10-18).** The code moved since the plan was written; where it forces a change, the
smallest one that keeps the spec:

- The tune page is `web/app/pages/song/[[slug]].vue`, and a library song's prerendered parts come from `songHead`
  (`web/app/utils/songHead.ts`): `songHead` passes `contributor` through, and the page shows the credit line after
  `SongRecording`.
- **Report a chart error** is no longer a button under the editor: it is an item of the rail's More menu
  (`MoreMenu.vue`, `moreMenuItems` in `web/app/utils/moreMenu.ts`). The two new entry points are More menu items
  too: `MoreAction` gains `'send' | 'suggest'`, `MoreMenuState` an optional `chart: ChartActions` (absent: report
  only, as today), and `moreMenuItems` lists `send`/`suggest`/`report` as it says.
- Chart text is written in section blocks now (`section: A` then `1 | Cm7`), not `A | 1 | Cm7` rows: the tests use
  the current format.
- There is no Catalyst checkbox in `web/app/components/ui/`: Task 4 ports one (`UiCheckbox`, a label around a native
  checkbox styled as Catalyst's), with a test.
- The flag list for the browser builds is the `e2e` and `a11y` scripts' env in `web/package.json`.
- The docs gate (`web/build/docsGate.ts`): behind a flag that is off, the PR says `Docs: none — …` and
  `Release notes: none — …`.

## Global Constraints

- Behind a new flag `chartSubmissions` (off; e2e builds with it on); with it off nothing changes.
- No new endpoint, no storage, no new dependency; dry run (local builds, e2e) sends nothing.
- Chart text ≤ `LIMITS.maxChars` (20,000); title one line ≤ 120 chars ("Untitled" when empty); slug `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` ≤ 80; `credit` boolean else false.
- `CONTACT_LIMITS.maxBytes` + 90,000.
- Copy: "Send to the library", "Suggest these changes", "A chart for the library: <title>", "Suggested changes to <title>", "Credit me as <name> on the tune page", "By sending, you agree I may add this chart to the library, edit it, and publish it on the site.", "Chart contributed by <name>".
- Subjects: `Chord Scale Maker: chart for the library: <title>` / `Chord Scale Maker: suggested changes to <slug>`.
- `make test` green after each task; `make lint`, `make e2e` at the end. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name.

## Review Focus

- **Non-ASCII chart text** (♭, ♯, "Ça c'est…" titles): base64 must encode UTF-8, not Latin-1 (`btoa` throws) — Task 2 test with `B♭7` and an accented title.
- **A chart over 20,000 characters** (a pasted file): the form shows the server's chart error, doesn't fail silently — Task 2 test; Task 4 shows `errors.chart` on the card.
- **Remove, then send**: a plain message with no `chart` in the body — Task 5 e2e.
- **Report a chart error still works with the flag off** and on a published library chart — Task 3 test of `submissionAction`.
- **Header injection through the title** (`\r\nBcc:`): the subject stays one line — Task 2 test.

---

### Task 1: the `contributor:` header

**Files:** Modify `engine/src/chart.ts` (`MetaKey`, `META_KEYS`, the file comment), `engine/src/tune.ts`, `web/app/utils/songHead.ts`, `web/app/pages/song/[[slug]].vue`, `README.md` (chart format table); Test `engine/src/__tests__/tune.test.ts`, `engine/src/__tests__/chart.test.ts`, `web/test/songHead.test.ts`.

**Interfaces:** Produces `TuneSummary.contributor: string`.

- [ ] **Step 1: Failing tests** — `tune.test.ts`:

```ts
  it('names the contributor, when the chart has one', () => {
    expect(tuneSummary('title: T\ncontributor: Bill Evans\nsection: A\n1 | Cm7\n').contributor).toBe('Bill Evans')
    expect(tuneSummary('title: T\nsection: A\n1 | Cm7\n').contributor).toBe('')
  })
```
`chart.test.ts` (in the meta/round-trip describe):

```ts
  it('reads and keeps a contributor: line', () => {
    const text = 'title: T\ncontributor: Bill Evans\nsection: A\n1 | Cm7\n'
    expect(parseChart(text).value.lines[1]).toEqual({ kind: 'meta', key: 'contributor', value: 'Bill Evans' })
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })
```
(`serializeChart` from `../chart`). `songHead.test.ts`: a library chart's head has `contributor: ''` (none has the header).

- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/tune.test.ts src/__tests__/chart.test.ts` → FAIL.
- [ ] **Step 3:** add `'contributor'` to `MetaKey` and at the end of `META_KEYS`; extend the file comment ("contributor: credits who sent the chart"); in `TuneSummary` add `/** who sent the chart, credited on its tune page */ contributor: string` and in `tuneSummary` `contributor: metaValue(doc, 'contributor'),`. `songHead` returns `contributor: summary.contributor`; in `song/[[slug]].vue` after `<SongRecording>`: `<UiText v-if="song?.contributor" class="mt-6 text-sm/6! print:hidden">Chart contributed by {{ song.contributor }}</UiText>`. README: add a `contributor:` row to the header table.
- [ ] **Step 4:** PASS; `make test`; `make golden` shows no diff (no chart has the header).
- [ ] **Step 5:** commit, "contributor: header, credited on the tune page (#153)".

---

### Task 2: the server takes a chart

**Files:** Modify `web/server/utils/contactMessage.ts`, `web/server/api/contact.post.ts`; Test `web/server/utils/contactMessage.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export type ContactChart = Readonly<{ text: string; title: string; slug: string | null; credit: boolean }>
  export type ContactMessage = Readonly<{ name; email; message; attachment: ContactAttachment | null; chart: ContactChart | null }>
  export const CHART_LIMITS = { title: 120, slug: 80, filename: 60 } as const
  export function checkChart(v: unknown): ContactChart | null | string
  export function chartFilename(c: ContactChart): string
  ```
  `ContactField` (keyof `ContactMessage`) thereby includes `'chart'`. `contactEmail` returns `attachments` with the chart first.

- [ ] **Step 1: Failing tests** (append; import the new names):

```ts
const chart = { text: 'title: Bb Blues\nA | 1 | B♭7\n', title: 'Bb Blues', credit: true }

describe('checkChart', () => {
  it('takes none, or a chart with its title, slug and credit', () => {
    expect(checkChart(undefined)).toBeNull()
    expect(checkChart(chart)).toEqual({ ...chart, slug: null })
    expect(checkChart({ ...chart, slug: 'f-blues', credit: 'yes' })).toEqual({ ...chart, slug: 'f-blues', credit: false })
    expect(checkChart({ ...chart, title: ' Eve\r\nBcc: x ' })).toMatchObject({ title: 'Eve Bcc: x' })
    expect(checkChart({ ...chart, title: '' })).toMatchObject({ title: 'Untitled' })
  })

  it('turns away an empty or oversized chart and a bad slug', () => {
    expect(checkChart({ ...chart, text: '  ' })).toBe('The chart is empty.')
    expect(checkChart({ ...chart, text: 'x'.repeat(20_001) })).toBe('The chart can be at most 20000 characters.')
    expect(checkChart({ ...chart, slug: '../etc' })).toBe("The chart couldn't be read. Please try again.")
  })

  it('is reported with the other fields', () => {
    const r = checkContact({ ...ok, chart: { ...chart, text: '' } }, now)
    expect(r.ok === false && !r.spam && r.errors.chart).toBe('The chart is empty.')
    expect(checkContact({ ...ok, chart }, now)).toMatchObject({ ok: true, value: { chart: { ...chart, slug: null } } })
  })
})

describe('chartFilename', () => {
  it("names a suggestion by its slug, a new chart by its title", () => {
    expect(chartFilename({ ...chart, slug: 'autumn-leaves' })).toBe('autumn-leaves.txt')
    expect(chartFilename({ ...chart, title: "'Round Midnight", slug: null })).toBe('round-midnight.txt')
    expect(chartFilename({ ...chart, title: 'Ça c’est bon!', slug: null })).toBe('ca-cest-bon.txt')
    expect(chartFilename({ ...chart, title: '♭♯', slug: null })).toBe('chart.txt')
    expect(chartFilename({ ...chart, title: 'x'.repeat(100), slug: null })).toBe(`${'x'.repeat(60)}.txt`)
  })
})

describe('contactEmail with a chart', () => {
  const base = { name: 'Bill', email: 'bill@example.com', message: 'A chart for the library: Bb Blues', attachment: null }
  it('attaches the chart as UTF-8 text and names the credit', () => {
    const e = contactEmail({ ...base, chart: { ...chart, slug: null } })
    expect(e.subject).toBe('Chord Scale Maker: chart for the library: Bb Blues')
    expect(e.attachments[0]?.filename).toBe('bb-blues.txt')
    expect(new TextDecoder().decode(Uint8Array.from(atob(e.attachments[0]?.content ?? ''), (c) => c.charCodeAt(0)))).toBe(chart.text)
    expect(e.text).toContain('Credit: Bill')
    expect(e.text).toContain('Attached: bb-blues.txt')
  })
  it('subjects a suggestion by slug, without credit when unticked', () => {
    const e = contactEmail({ ...base, chart: { ...chart, slug: 'autumn-leaves', credit: false } })
    expect(e.subject).toBe('Chord Scale Maker: suggested changes to autumn-leaves')
    expect(e.text).toContain('Credit: none')
  })
})
```
Update existing `contactEmail(...)` calls in the file to pass `chart: null`.

- [ ] **Step 2:** `cd web && npx vitest run server/utils/contactMessage.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `contactMessage.ts` (import `LIMITS` from `@chord-scale-maker/engine`):

```ts
export const CHART_LIMITS = { title: 120, slug: 80, filename: 60 } as const
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
const oneLine = (s: string): string => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()

export type ContactChart = Readonly<{ text: string; title: string; slug: string | null; credit: boolean }>

/** null for no chart, the chart, or what is wrong with it */
export function checkChart(v: unknown): ContactChart | null | string {
  if (v === undefined || v === null) return null
  const c = (typeof v === 'object' ? v : {}) as Record<string, unknown>
  const text = typeof c.text === 'string' ? c.text : ''
  if (!text.trim()) return 'The chart is empty.'
  if (text.length > LIMITS.maxChars) return `The chart can be at most ${LIMITS.maxChars} characters.`
  const slug = c.slug === undefined || c.slug === null ? null : c.slug
  if (slug !== null && (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > CHART_LIMITS.slug)) return "The chart couldn't be read. Please try again."
  const title = oneLine(typeof c.title === 'string' ? c.title : '').slice(0, CHART_LIMITS.title) || 'Untitled'
  return { text, title, slug, credit: c.credit === true }
}

/** the attachment's name: a suggestion's slug, else the title as library charts are named ('Round Midnight -> round-midnight) */
export function chartFilename(c: ContactChart): string {
  const stem = c.slug ?? (c.title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, CHART_LIMITS.filename).replace(/-+$/, '') || 'chart')
  return `${stem}.txt`
}

/** UTF-8 text as base64 (btoa alone takes only Latin-1) */
const utf8Base64 = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
```
For long charts, `String.fromCharCode(...bytes)` can exceed the argument limit: build the binary string in chunks of 8192 bytes. Then:
- `ContactMessage` gains `chart: ContactChart | null`; `checkContact` calls `checkChart(b.chart)` like `checkAttachment` (`errors.chart` on a string, `chart: null` in that case).
- `CONTACT_LIMITS.maxBytes`: `16_000 + 90_000 + Math.ceil(ATTACHMENT_LIMITS.bytes / 3) * 4`.
- `contactEmail`: subject `m.chart ? (m.chart.slug ? \`Chord Scale Maker: suggested changes to ${m.chart.slug}\` : \`Chord Scale Maker: chart for the library: ${oneLine(m.chart.title)}\`) : \`Chord Scale Maker: message from ${name}\``; files = `[...(m.chart ? [{ filename: chartFilename(m.chart), content: utf8Base64(m.chart.text) }] : []), ...(m.attachment ? [{ filename: m.attachment.filename, content: m.attachment.content }] : [])]`; text = message, then `m.chart ? \`\nCredit: ${m.chart.credit ? name : 'none'}\` : ''`, the signature, one `Attached: <filename>` line per file, the footer.
- `contact.post.ts`: no change beyond types (it passes `mail.attachments` already); update its doc comment ("…and a chart for the library").

- [ ] **Step 4:** PASS; `make test`. **Step 5:** commit, "Contact form: take a chart for the library and attach it (#153)".

---

### Task 3: which action shows, and the handoff

**Files:** Create `web/app/utils/chartSubmission.ts`; Modify `web/nuxt.config.ts` (flag), `web/app/composables/useFeature.ts` (`Feature`), `web/package.json` (`NUXT_PUBLIC_FEATURES_CHART_SUBMISSIONS=true` in the `e2e` and `a11y` scripts); Test `web/test/chartSubmission.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export const CHART_SUBMISSION_KEY = 'csm-chart-submission'
  export type ChartSubmission = Readonly<{ text: string; title: string; slug?: string; mode: 'new' | 'suggest' }>
  export type ChartActions = Readonly<{ send: boolean; suggest: boolean; report: boolean }>
  export function submissionAction(target: SaveTarget | undefined, text: string, on: boolean): ChartActions
  export function submissionMessage(s: ChartSubmission): string
  export function chartSubmissionFrom(raw: string | null): ChartSubmission | null // parse sessionStorage, untrusted
  ```

- [ ] **Step 1: Failing tests**:

```ts
import { describe, expect, it } from 'vitest'
import { chartSubmissionFrom, submissionAction, submissionMessage } from '~/utils/chartSubmission'

const lib = { kind: 'library', slug: 'autumn-leaves', libraryText: 'section: A\n1 | Cm7\n' } as const

describe('submissionAction', () => {
  it('reports a library chart as published, and suggests changes once it is edited', () => {
    expect(submissionAction(lib, lib.libraryText, true)).toEqual({ send: false, suggest: false, report: true })
    expect(submissionAction(lib, 'section: A\n1 | Cm9\n', true)).toEqual({ send: false, suggest: true, report: false })
  })
  it('sends your own and shared charts, beside the report', () => {
    for (const t of [{ kind: 'mine', id: 'x' } as const, { kind: 'new', id: 'y', savedKind: 'new' } as const, undefined])
      expect(submissionAction(t, 'section: A\n1 | C\n', true)).toEqual({ send: true, suggest: false, report: true })
  })
  it('only reports with the flag off', () => {
    expect(submissionAction(lib, 'section: A\n1 | Cm9\n', false)).toEqual({ send: false, suggest: false, report: true })
  })
})

describe('the handoff', () => {
  it('pre-fills the first line', () => {
    expect(submissionMessage({ text: '', title: 'T', mode: 'new' })).toBe('A chart for the library: T\n\n')
    expect(submissionMessage({ text: '', title: 'T', slug: 't', mode: 'suggest' })).toBe('Suggested changes to T\n\n')
  })
  it('reads only a well-formed submission', () => {
    expect(chartSubmissionFrom(JSON.stringify({ text: 'A | 1 | C\n', title: 'T', mode: 'new' }))).toEqual({ text: 'A | 1 | C\n', title: 'T', mode: 'new' })
    for (const raw of [null, '{', '{"text":1}', JSON.stringify({ text: 'x', title: 'T', mode: 'other' })]) expect(chartSubmissionFrom(raw)).toBeNull()
  })
})
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `chartSubmission.ts`:

```ts
import type { SaveTarget } from '~/composables/useSavedChart'

/** a chart handed from the editor to the contact form (sessionStorage), to send for the library */
export const CHART_SUBMISSION_KEY = 'csm-chart-submission'
export type ChartSubmission = Readonly<{ text: string; title: string; slug?: string; mode: 'new' | 'suggest' }>
export type ChartActions = Readonly<{ send: boolean; suggest: boolean; report: boolean }>

/** the editor's actions for this chart: a library chart as published is reported; edited, its changes suggested; any other chart sent */
export function submissionAction(target: SaveTarget | undefined, text: string, on: boolean): ChartActions {
  if (!on) return { send: false, suggest: false, report: true }
  if (target?.kind === 'library') return text === target.libraryText ? { send: false, suggest: false, report: true } : { send: false, suggest: true, report: false }
  return { send: true, suggest: false, report: true }
}

export const submissionMessage = (s: ChartSubmission): string =>
  `${s.mode === 'suggest' ? 'Suggested changes to' : 'A chart for the library:'} ${s.title}\n\n`

export function chartSubmissionFrom(raw: string | null): ChartSubmission | null {
  try {
    const o = JSON.parse(raw ?? '') as Record<string, unknown>
    if (typeof o.text !== 'string' || typeof o.title !== 'string' || (o.mode !== 'new' && o.mode !== 'suggest')) return null
    return { text: o.text, title: o.title, mode: o.mode, ...(typeof o.slug === 'string' ? { slug: o.slug } : {}) }
  } catch {
    return null
  }
}
```
Flag: `chartSubmissions: false, // send a chart to the library from the editor (docs/superpowers/specs/2026-10-12-chart-submissions-design.md)` in `nuxt.config.ts`; add `'chartSubmissions'` to `Feature`; turn it on in `web/package.json`'s `e2e` and `a11y` scripts.

The More menu (`web/app/utils/moreMenu.ts`, test `web/test/moreMenu.test.ts`): `MoreAction` gains `'send' | 'suggest'`; `MoreMenuState` gains `chart?: ChartActions`; `moreMenuItems` ends with `send` and `suggest` where `chart` says, then `report` unless `chart.report` is false (no `chart`: `report`, as today). Tests: a new chart lists `send` before `report`; an edited library chart lists `suggest` and no `report`.

- [ ] **Step 4:** PASS; `make test`. **Step 5:** commit, "submissionAction: which chart action the editor offers (#153)".

---

### Task 4: the editor and the contact page

**Files:** Modify `web/app/components/EditorView.vue`, `web/app/components/MoreMenu.vue`, `web/app/pages/contact.vue`, `web/app/pages/privacy.vue`; Create `web/app/components/ui/Checkbox.vue`; Test `web/test/Checkbox.test.ts` (the flag is off in unit tests, so the editor's entry points are covered by Task 5).

**Interfaces:** consumes Tasks 2–3.

- [ ] **Step 1: Editor** — in `EditorView.vue` script:

```ts
const actions = computed(() => submissionAction(props.saveTarget, editor.text.value, useFeature('chartSubmissions')))

/** hand the chart to the contact form, to send for the library (a library chart's: its changes) */
function sendChart(): void {
  editor.flush()
  const t = props.saveTarget
  const submission: ChartSubmission = t?.kind === 'library'
    ? { text: editor.text.value, title: editor.heading.value.title, slug: t.slug, mode: 'suggest' }
    : { text: editor.text.value, title: editor.heading.value.title, mode: 'new' }
  sessionStorage.setItem(CHART_SUBMISSION_KEY, JSON.stringify(submission))
  navigateTo('/contact')
}
```
(call `useFeature` once at setup, like `playerRange`). The More menu: `moreItems` passes `chart: actions.value`; `onMore` sends `'send'` and `'suggest'` to `sendChart` (the `else` stays `reportError`). `MoreMenu.vue`'s `ITEMS` gains `send: { label: 'Send to the library', icon: PaperAirplaneIcon }` and `suggest: { label: 'Suggest these changes', icon: PaperAirplaneIcon }`.

`UiCheckbox` (`components/ui/Checkbox.vue`): a `<label>` holding a visually hidden native checkbox (`v-model` through `defineModel<boolean>()`), Catalyst's box drawn with `has-checked:`/`has-focus-visible:` in the note colour, and the label text in the slot. Test: clicking the label toggles the model; the checkbox is named by the slot text.

- [ ] **Step 2: Contact page** — script additions:

```ts
const chart = ref<ChartSubmission | null>(null)
const credit = ref(false)
const lines = computed(() => chart.value?.text.trimEnd().split('\n').length ?? 0)
const fileName = computed(() => (chart.value ? chartFilename({ text: '', title: chart.value.title, slug: chart.value.slug ?? null, credit: false }) : ''))
```
(`chartFilename` imported from `../../server/utils/contactMessage`, as the page already imports `CONTACT_LIMITS`, so the name shown is the name sent.) In `onMounted`, before the chart-report block:

```ts
  const submission = chartSubmissionFrom(sessionStorage.getItem(CHART_SUBMISSION_KEY))
  sessionStorage.removeItem(CHART_SUBMISSION_KEY)
  if (submission) {
    chart.value = submission
    form.message = submissionMessage(submission)
  }
```
In `send`, the body: `{ ...form, startedAt, attachment: attachment.value?.attachment, ...(chart.value ? { chart: { text: chart.value.text, title: chart.value.title, slug: chart.value.slug, credit: credit.value } } : {}) }`. In `reset`: `chart.value = null; credit.value = false`. Template, before `<FileDrop>`:

```vue
          <div v-if="chart" class="space-y-3 rounded-lg p-4 ring-1 ring-zinc-950/10 dark:ring-white/10">
            <div class="flex items-start justify-between gap-4">
              <UiText><strong>{{ chart.title }}</strong> · {{ lines }} lines, attached as {{ fileName }}</UiText>
              <UiButton plain class="text-sm!" @click="chart = null">Remove</UiButton>
            </div>
            <UiCheckbox v-model="credit" name="credit">Credit me as {{ form.name.trim() || 'you' }} on the tune page</UiCheckbox>
            <UiErrorMessage v-if="errors.chart">{{ errors.chart }}</UiErrorMessage>
          </div>
``` Before the submit row: `<UiText v-if="chart" class="text-sm/6!">By sending, you agree I may add this chart to the library, edit it, and publish it on the site.</UiText>`.

- [ ] **Step 3: Privacy** — in `privacy.vue`'s contact form paragraph add: "A chart you send from the editor is emailed with your message, as a text file."

- [ ] **Step 4:** `make test`, `make lint`; `make dev`, try both entry points, Remove, and a send (dry run locally). **Step 5:** commit, "Send to the library and Suggest these changes, through the contact form (#153)".

---

### Task 5: browser tests and design notes

**Files:** Create `web/e2e/chart-submission.spec.ts`; Modify `docs/design.md` (contact form section §9, the chart format list, flags list).

- [ ] **Step 1: e2e**

```ts
import { expect, moreAction, openEditor, test, typeChord, writeChart } from './fixtures'

test('a new chart is sent to the library, with credit', async ({ page }) => {
  await writeChart(page, 'title: Bb Blues\nkey: Bb\n\nsection: A\n1 | Bb7\n2 | Eb7\n')
  await moreAction(page, 'Send to the library')
  await expect(page).toHaveURL(/\/contact/)
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(/^A chart for the library: Bb Blues/)
  await expect(page.getByText('attached as bb-blues.txt')).toBeVisible()
  await page.getByLabel('Name').fill('Bill Evans')
  await page.getByLabel('Email').fill('bill@example.com')
  await page.getByRole('checkbox', { name: 'Credit me as Bill Evans on the tune page' }).check()
  await page.waitForTimeout(2600) // the server treats an instant submit as a bot
  const request = page.waitForRequest('**/api/contact')
  await page.getByRole('button', { name: 'Send message' }).click()
  const { chart } = (await request).postDataJSON() as { chart: { text: string; title: string; credit: boolean; slug?: string } }
  expect(chart).toMatchObject({ title: 'Bb Blues', credit: true })
  expect(chart.text).toContain('2 | Eb7')
  expect(chart.slug).toBeUndefined()
  await expect(page.getByRole('status')).toContainText('your message is on its way')
})

test('an edited library chart suggests its changes in place of the report', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Report a chart error' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Suggest these changes' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await openEditor(page)
  await typeChord(page, 'A1', 1, 'Cm7', 'Cm9')
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Report a chart error' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Suggest these changes' }).click()
  await expect(page.getByText('attached as autumn-leaves.txt')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(/^Suggested changes to Autumn Leaves/)
  await page.getByLabel('Name').fill('Bill')
  await page.getByLabel('Email').fill('bill@example.com')
  await page.waitForTimeout(2600)
  const request = page.waitForRequest('**/api/contact')
  await page.getByRole('button', { name: 'Send message' }).click()
  expect((await request).postDataJSON()).toMatchObject({ chart: { slug: 'autumn-leaves', credit: false } })
})

test('Remove sends a plain message', async ({ page }) => {
  await writeChart(page, 'title: T\n\nsection: A\n1 | Cm7\n')
  await moreAction(page, 'Send to the library')
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByLabel('Name').fill('Bill')
  await page.getByLabel('Email').fill('bill@example.com')
  await page.waitForTimeout(2600)
  const request = page.waitForRequest('**/api/contact')
  await page.getByRole('button', { name: 'Send message' }).click()
  expect((await request).postDataJSON()).not.toHaveProperty('chart')
})
```
- [ ] **Step 2:** `make e2e` → green (the existing "Report a chart error" test in `pages.spec.ts` must still pass); `make a11y` (the contact page with a chart: add it to the axe scans in `web/e2e/a11y/`).
- [ ] **Step 3: `docs/design.md`:** in the contact form section, the chart block (limits, the attachment name rule, the subjects, credit); `contributor:` in the chart format; `chartSubmissions` in the flags list.
- [ ] **Step 4:** commit `web/e2e/chart-submission.spec.ts docs/design.md`, "Browser tests and design notes for chart submissions (#153)".

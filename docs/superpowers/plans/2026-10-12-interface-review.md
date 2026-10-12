# Interface review: the sheet leads: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. UI tasks: load the `interface-design` skill and state its component checkpoint (intent, hierarchy, palette, depth, surfaces, type, spacing) before writing markup; verify each task with screenshots at 1280 and 390 px, light and dark (`make preview`, then Playwright or a browser).

**Goal:** the sheet is the page's focal point: one heading, a quiet control rail, one stand surface and one paper, one accent; a steady header; a library that works on phones; a sticky Help index; the system written down.

**Architecture:** tokens first (`main.css` + `.interface-design/system.md`), then surfaces, then a `ToggleButton` and button roles, then the song page (heading, rail, More menu, phone rail), then the header, library and content pages. Each task ships on its own.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind v4 (`@theme` in `web/app/assets/css/main.css`), Catalyst-in-Vue (`web/app/components/ui/`), Headless UI, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-interface-review-design.md` (issue #200).

**Prerequisites:** #198 (one URL per tune) and #189 (Scales lines) merged; rebase on them.

## Global Constraints

- One hue (the navy-tinted zinc + note scales); lightness changes only. One accent: `--color-accent`. Solid navy (`color="note"`) only for a view's single primary action.
- Depth by shadow (`--shadow-paper`, `--shadow-raised`); borders for dividers and inputs only.
- Radius: 6 px controls, 10 px paper/panels, 14 px dialogs.
- 4 px spacing base; rail gaps 8 px, padding 12 px; rail→paper 16 px; paper padding 24 px (16 px < sm).
- Print output unchanged (letter pages, 12 staves a page, the Changes' lines a page): every task re-runs `print.spec.ts`.
- CSP unchanged; no new dependency (Headless UI's Menu/Dialog are already in via Catalyst).
- New flag `compactRail` (off; add `NUXT_PUBLIC_FEATURES_COMPACT_RAIL=true` to `web/package.json`'s e2e script).
- `make test` after each task; `make lint`, `make e2e` before each PR. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name. PRs reference #200; the last closes it.

## Review Focus

- **Print**: removing cards and moving the heading must not change printed pages — `print.spec.ts` page counts, every task.
- **Keyboard and screen readers in the rail and More menu**: focus order rail → paper; the menu is a Headless UI `Menu` (arrow keys, Esc); the page has exactly one `<h1>` — Task 5 and 6 e2e.
- **Sticky rail covering the sheet editor's popovers** (chord editor, bar toolbar): z-order below them; scroll-into-view leaves room for the rail (`scroll-margin-top`) — Task 6 e2e taps a chord near the top while stuck.
- **Focus mode** hides the rail and paper chrome as today — Task 6 re-runs the focus test.
- **Dark mode contrast** of the toggle-on tint (note-200 on note-300/15 over zinc-950 ≥ 4.5:1) — Task 3 states the measured ratio in the commit.

---

### Task 1: the system, written down, and its tokens

**Files:** Create `.interface-design/system.md`; Modify `web/app/assets/css/main.css`.

- [ ] **Step 1:** write `.interface-design/system.md` from the spec's System section (direction and feel, surfaces, depth recipes, radius scale, accent rule, button roles with measurements, type tiers, spacing, the rail and paper recipes) — the values verbatim.
- [ ] **Step 2:** add to `@theme`:
  ```css
  --color-stand: var(--color-zinc-100);
  --color-paper: #ffffff;
  --color-raised: #ffffff;
  --shadow-paper: 0 0 0 1px rgb(8 17 31 / 0.06), 0 1px 2px -1px rgb(8 17 31 / 0.08), 0 4px 12px rgb(8 17 31 / 0.05);
  --shadow-raised: 0 0 0 1px rgb(8 17 31 / 0.06), 0 8px 24px rgb(8 17 31 / 0.12);
  --radius-control: 6px;
  --radius-paper: 10px;
  --radius-dialog: 14px;
  ```
  and under `html.dark`: `--color-stand: var(--color-zinc-950); --color-paper: var(--color-zinc-900); --color-raised: var(--color-zinc-800); --shadow-paper: 0 0 0 1px rgb(255 255 255 / 0.08); --shadow-raised: 0 0 0 1px rgb(255 255 255 / 0.1);`. Add `h1, h2, h3 { text-wrap: balance }` in `@layer base`.
- [ ] **Step 3:** `make test`, `make lint` (nothing uses the tokens yet: no visual change). **Step 4:** commit, "Interface system: tokens and system.md (#200)".

---

### Task 2: surfaces (C)

**Files:** Modify `web/app/components/ui/StackedLayout.vue` (a `bare` prop), `web/app/components/AppShell.vue` (pass `bare` on `/song`), `web/app/components/SheetPages.vue`, `web/app/components/EditorView.vue` (drop the `bg-note-100` panel); Test e2e `print.spec.ts` (unchanged, must pass).

- [ ] **Step 1:** `StackedLayout`: the content wrapper's card classes (`lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 …`) apply only without `bare`; the outer ground becomes `bg-stand`. Content pages' card → `bg-paper shadow-paper rounded-[--radius-paper]`.
- [ ] **Step 2:** `AppShell`: `<UiStackedLayout :bare="route.path.startsWith('/song')">`.
- [ ] **Step 3:** `SheetPages`: outer div → `rounded-[--radius-paper] bg-paper p-4 shadow-paper sm:p-6 print:…` (print classes kept); remove the extra inner bordered page wherever the Changes/Scales sheets add one (grep `ring-1` inside `ChangesSheet.vue`/`ScaleSheet.vue` wrappers).
- [ ] **Step 4:** `EditorView.vue:50`: the tinted panel's classes → `space-y-4` (no background, ring or radius; keep the `[&_[data-slot=text]]` colour overrides only if still needed on `stand`).
- [ ] **Step 5:** screenshots before/after (song desktop/phone, light/dark; Help); `make e2e` (print counts unchanged). **Step 6:** commit, "One stand surface, one paper (#200)".

---

### Task 3: button roles and ToggleButton (B)

**Files:** Create `web/app/components/ToggleButton.vue`; Modify `SegmentedControl.vue`, `PreviewControls.vue`, `EditorView.vue`, `pages/index.vue`, `PracticePanel.vue`; Test `web/test/ToggleButton.test.ts`.

**Interfaces:** `<ToggleButton v-model="on" :title>label</ToggleButton>` — a `<button type="button" :aria-pressed="on">`.

- [ ] **Step 1: Failing test**:
  ```ts
  import { mountSuspended } from '@nuxt/test-utils/runtime'
  import { describe, expect, it } from 'vitest'
  import ToggleButton from '~/components/ToggleButton.vue'

  describe('ToggleButton', () => {
    it('is a pressed-state button that flips its model', async () => {
      const w = await mountSuspended(ToggleButton, { props: { modelValue: false, 'onUpdate:modelValue': (v: boolean) => w.setProps({ modelValue: v }) }, slots: { default: 'Numerals' } })
      const b = w.get('button')
      expect(b.attributes('aria-pressed')).toBe('false')
      await b.trigger('click')
      expect(b.attributes('aria-pressed')).toBe('true')
      expect(b.attributes('type')).toBe('button')
    })
  })
  ```
- [ ] **Step 2:** FAIL. **Step 3:** `ToggleButton.vue`:
  ```vue
  <template>
    <button
      type="button"
      :aria-pressed="model"
      :class="[
        'inline-flex items-center gap-x-2 rounded-[--radius-control] px-3 py-1.5 text-sm/6 font-semibold ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50',
        model
          ? 'bg-note-100 text-note-800 ring-note-300 dark:bg-note-300/15 dark:text-note-200 dark:ring-note-300/40'
          : 'bg-transparent text-zinc-700 ring-zinc-950/10 hover:bg-zinc-950/[2.5%] dark:text-zinc-300 dark:ring-white/15 dark:hover:bg-white/5',
      ]"
      @click="model = !model"
    ><slot /></button>
  </template>

  <script setup lang="ts">
  /** an on/off control (Numerals, Scales, Intervals): outline when off, the accent tint when on (.interface-design/system.md) */
  const model = defineModel<boolean>({ required: true })
  </script>
  ```
  `SegmentedControl`: checked → the same tint (`has-checked:bg-note-100 has-checked:text-note-800 has-checked:ring-note-300`, dark equivalents), replacing `note-500`/`note-300` fills.
- [ ] **Step 4: Roles.** `PreviewControls.vue`: Numerals, Scales, Intervals → `<ToggleButton>` (keep `:disabled`/titles/lock logic; `aria-pressed` now comes from the component). `EditorView.vue`: Transpose, Focus, Share, Save as a copy, Download → `outline`; Print stays `color="note"` (the primary); Shuffle → `outline`; Edit → `ToggleButton` (`aria-expanded` kept). `index.vue`: New chart stays primary; Open chart…, Request a chart stay outline. Dialogs: confirm stays primary, cancel plain.
- [ ] **Step 5:** contrast check (WebAIM or a computed ratio) for toggle-on text in both modes, noted in the commit; screenshots; `make test`, `make e2e` (selectors use names: unchanged). **Step 6:** commit, "Button roles: one primary, outline actions, ToggleButton for on/off (#200)".

---

### Task 4: a steady header (D)

**Files:** Modify `web/app/components/HeaderQuote.vue`, `AppShell.vue`; Test `web/e2e/pages.spec.ts`.

- [ ] **Step 1: Failing e2e**:
  ```ts
  test('the header is the same height whatever the quote', async ({ page }) => {
    const heights = new Set<number>()
    for (const path of ['/', '/help', '/about', '/contact', '/functions']) {
      await page.goto(path)
      heights.add(Math.round((await page.getByRole('banner').boundingBox())?.height ?? 0))
    }
    expect(heights.size).toBe(1)
  })
  ```
- [ ] **Step 2:** `HeaderQuote.vue`: `<figure :title="`“${quote.quote}” — ${quote.author}`" class="min-w-0 truncate text-sm/5 …">` with the quote and author on one line (`<span class="italic">“…”</span> <span class="text-zinc-500">— author</span>`), `truncate`; AppShell: `class="max-w-xl max-xl:hidden"`; the navbar row `h-16`.
- [ ] **Step 3:** `make e2e`; screenshots of the longest quote (Jelly Roll Morton) at 1280 and 1536. **Step 4:** commit, "Header: the quote on one line; the navbar never changes height (#200)".

---

### Task 5: one heading (A, part 1)

**Files:** Modify `SheetPages.vue` (`headingLevel?: 1 | 2`), `ChangesSheet.vue`/`ScaleSheet.vue` (pass it through), `EditorView.vue` (remove the title block; move the save status), `SheetHeading.vue` (the editable heading: same level); Test e2e `library.spec.ts`.

- [ ] **Step 1: Failing e2e**: on `/song/autumn-leaves`, `page.getByRole('heading', { level: 1 })` has count 1 and text "Autumn Leaves"; the save-status text is visible under it; with the editor open the editable heading is the `<h1>`.
- [ ] **Step 2:** `SheetPages`: the on-screen title renders `<component :is="headingLevel === 1 ? 'h1' : 'h2'">` (print header unchanged). `EditorView`: delete the `UiHeading` + Edit row and the byline (`:5-9`); the status line (`saveText` / shared note / copy error) renders in a new `#status` slot of `SheetPages` under the subtitle, `text-sm text-zinc-500`. The Edit toggle moves to the rail (Task 6); until then keep it at the rail's current position.
- [ ] **Step 3:** `make e2e` (fix any test that looked for the old `<h1>` or byline by text). **Step 4:** commit, "The sheet's heading is the page's only heading (#200)".

---

### Task 6: the rail and the More menu (A, part 2)

**Files:** Create `web/app/components/SheetRail.vue`, `web/app/components/MoreMenu.vue`, `web/app/utils/moreMenu.ts`; Modify `EditorView.vue`, `PreviewControls.vue` (its groups become the rail's left side); Test `web/test/moreMenu.test.ts`, e2e (the 12 selectors that move: `grep -n "Report a chart error\|Save as a copy\|Download\|Revert to library" web/e2e/*.ts`).

**Interfaces:** `moreMenuItems(state: { saved: boolean; edited: boolean; shared: boolean; fatal: boolean }): readonly ('copy' | 'download' | 'revert' | 'report')[]`.

- [ ] **Step 1: Failing unit test** (`moreMenu.test.ts`): a library chart as published → `['download', 'report']`; edited → `['copy', 'download', 'revert', 'report']`; shared → `['download', 'report']`; `fatal` → no `copy` or `download`.
- [ ] **Step 2:** FAIL. **Step 3:** `moreMenu.ts` implements it (pure). `MoreMenu.vue`: `UiDropdown` + `UiDropdownButton plain aria-label="More actions"` (EllipsisHorizontalIcon) + `UiDropdownMenu` items from `moreMenuItems`, each emitting its action. `SheetRail.vue`: a `<div role="toolbar" aria-label="Sheet controls">` with two slots (`left`, `right`), `flex flex-wrap items-end gap-2 p-3`; sticky from `lg`: `lg:sticky lg:top-0 lg:z-20`, a 1 px sentinel above it observed by an `IntersectionObserver` toggles `data-stuck`, styled `data-stuck:bg-raised data-stuck:shadow-raised data-stuck:rounded-[--radius-paper]` (no shadow at rest). Sheet popovers (chord editor, bar toolbar) keep a z-index above 20; add `scroll-margin-top: 5rem` on the sheet's chord buttons.
- [ ] **Step 4:** `EditorView`: right side = Edit (`ToggleButton`), Share (outline), Focus (outline), Print (primary), `<MoreMenu>`; the old actions row and the lone "Report a chart error" row go. Left side = `PreviewControls`' groups (Work on, Instrument, Level, the sheet's toggles/Line or Intervals/Spell Scale, Transpose). Practice panel stays below the rail.
- [ ] **Step 5:** update e2e: open "More actions" before clicking Save as a copy / Download / Revert / Report (a `moreAction(page, name)` helper in `fixtures.ts`); add: the rail is stuck (`data-stuck`) after scrolling 800 px at 1280; tapping a chord in the second system while stuck opens its editor fully visible.
- [ ] **Step 6:** screenshots; `make e2e` (focus mode, print, sheet editing). **Step 7:** commit, "A control rail above the sheet, with a More menu (#200)".

---

### Task 7: the rail on phones (A, part 3)

**Files:** Modify `SheetRail.vue`, `EditorView.vue`, `web/nuxt.config.ts` + `useFeature.ts` (`compactRail`), `web/package.json` (e2e env); Create `web/app/components/ControlsDialog.vue`; Test e2e `web/e2e/phone.spec.ts`.

- [ ] **Step 1: Failing e2e** (390×844, flag on in e2e): on `/song/autumn-leaves` the sheet's `<h1>` top is < 400; a "Controls" button opens a dialog with Level, Analysis/Line (or Intervals/Spell Scale), Transpose; changing the instrument from the rail redraws the sheet; no horizontal scroll (`scrollWidth ≤ 390`).
- [ ] **Step 2:** below `md` with the flag on, `SheetRail` shows Work on, Instrument, `Controls` (outline, AdjustmentsHorizontalIcon), Print, More; `ControlsDialog.vue` (`UiDialog`, title "Sheet controls") renders the remaining groups (the same components, bound to the same refs). Flag off: today's wrapping rail.
- [ ] **Step 3:** `make e2e`; screenshots at 390 and 768. **Step 4:** commit, "Phones: the music on the first screen, controls in a sheet (behind compactRail) (#200)".

---

### Task 8: the library (E)

**Files:** Create `web/app/utils/libraryIndex.ts`; Modify `web/app/utils/library.ts` (`details` built), `web/app/pages/index.vue`; Test `web/test/libraryIndex.test.ts`, `web/test/library.test.ts`, e2e `library.spec.ts`.

**Interfaces:** `libraryDetails(s: { style: string; keyLabel: string; form: string }): string` (`[style, keyLabel, form].filter(Boolean).join(' · ')`); `letterIndex(charts: readonly { slug: string; title: string }[]): readonly { letter: string; slug: string }[]` (first chart per initial letter, A–Z, `#` for digits/symbols, in title order; leading `'` ignored: "'Round Midnight" files under R).

- [ ] **Step 1: Failing tests**: `libraryDetails({ style: 'Ballad', keyLabel: 'E♭ minor', form: 'AABC' })` → `'Ballad · E♭ minor · AABC'`; empty parts drop. `letterIndex` on `["'Round Midnight", 'A Night in Tunisia', 'Africa', 'Blue Trane', '502 Blues']` → `[{ '#', '502-blues' }, { 'A', … }, { 'B', … }, { 'R', 'round-midnight' }]` (match the library's own sort; check how `LIBRARY` orders titles and follow it).
- [ ] **Step 2:** FAIL. **Step 3:** implement; `LibraryChart` gains `details` (from `tuneSummary(text)`), used by the table's Details column in place of `subtitle`.
- [ ] **Step 4:** `index.vue`: heading "Library", no eyebrow; the "Library" subheading only when My charts shows; an A–Z `<nav aria-label="Jump to letter">` of links (`#letter-R`), hidden while `query` is non-empty; each first row of a letter gets `id="letter-R"` and `scroll-margin-top`. Below `sm`: a `<ul>` list (title link 15px/600; composer · details muted, one line, `truncate`) instead of the table (`max-sm:hidden` / `sm:hidden`).
- [ ] **Step 5:** e2e: at 390 no horizontal scroll and each row shows its composer; clicking "R" scrolls "'Round Midnight" into view; searching hides the A–Z bar. **Step 6:** screenshots; commit, "Library: one label, an A–Z index, built details, a list on phones (#200)".

---

### Task 9: sticky "On this page" (F)

**Files:** Modify `web/app/pages/help.vue` (and `functions.vue`, `privacy.vue` if they have sections; add the same nav where a page has 4+ sections); Create `web/app/composables/useCurrentSection.ts`; Test `web/test/useCurrentSection.test.ts` (the pure "which section is current" rule), e2e `pages.spec.ts`.

- [ ] **Step 1: Failing tests**: the rule `currentSection(tops: { id; top }[], offset)` → the last section whose top ≤ offset (else the first); e2e at 1280: after scrolling to "Printing and Focus", the index (`nav[aria-label="On this page"]`) is still in the viewport and marks that link `aria-current="true"`.
- [ ] **Step 2:** FAIL. **Step 3:** `lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12`; the nav moves to the right column, `lg:sticky lg:top-24 lg:self-start`, links stacked, current one `text-accent font-semibold`; below `lg` it stays inline at the top. `useCurrentSection` observes the section headings (IntersectionObserver) and exposes the current id.
- [ ] **Step 4:** `make e2e`; screenshots. **Step 5:** commit, "Help: a sticky On this page index (#200)".

---

### Task 10: wrap up (G)

- [ ] **Step 1:** update `.interface-design/system.md` with what shipped (the rail, ToggleButton, paper, More menu recipes with measurements); `docs/design.md` §UI points at it.
- [ ] **Step 2:** a final screenshot set (1280/390, light/dark: library, song Changes, song Scales, editing, Help) attached to the last PR, which `Closes #200`.
- [ ] **Step 3:** decide with the owner whether to turn `compactRail` on.

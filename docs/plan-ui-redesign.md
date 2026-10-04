# UI redesign with Catalyst and Application UI: plan

Status: **implemented** on branch `ui-redesign`. The repo is now private, and every other recommendation in section 1 is accepted: kits git-ignored under `design/tailwind-plus/`, Catalyst ported to Vue, StackedLayout, zinc + teal, and the scale picker in a Dialog. After they're made, this becomes a task-by-task plan with
verified code, as in phases 1–4, built in a scratch copy first and then executed by subagents.

## 0. What's in `web/app/assets/`

| Kit | Contents | Usable as-is? |
|---|---|---|
| `catalyst-ui-kit/` | 27 components in TSX and JSX, plus a Next.js demo. **React only**: `@headlessui/react` v2, `motion` and `clsx`. | No. It has to be ported to Vue. |
| `application-ui-v4/` | 364 blocks in each of HTML, React and **Vue**. The Vue blocks use `@headlessui/vue` and `@heroicons/vue`. | Yes. The Vue blocks are ready-made Vue 3 SFC examples. |

Two facts shape the approach:

1. **Catalyst's styling depends on Headless UI React v2's `data-*` state attributes** (`data-hover`, `data-focus`,
   `data-active`, `data-disabled`, `data-checked`, `data-open`). The latest Vue Headless UI (1.7.23) doesn't emit them.
   *As built:* rather than rewriting the selectors, a `v-interactive` directive sets `data-hover`, `data-focus` and
   `data-active` on the element (skipping disabled ones), and Headless UI Vue slot props are mapped to `data-*`
   attributes, so Catalyst's class strings are kept verbatim. `motion` is only used by the navbar and sidebar's animated "current"
   indicator; we drop the animation.
2. **The kits now break the build.** Inside `web/app/` they're in scope for Nuxt's type-check (559 errors from the
   React and Vue blocks) and for ESLint (it crashes on them). They have to move out of `web/app/` before anything else.
   They aren't committed yet, so CI is unaffected for now.

## 1. Decisions needed

1. **Licence and a public repo.** Tailwind Plus is a commercial licence, and `KevDog/Chord-Scale-Maker` is **public**.
   - Committing the raw kits (≈1,300 files) would redistribute them. That's almost certainly not allowed; check https://tailwindcss.com/plus/license.
   - Proposal: keep the kits **out of git**. Move them to a git-ignored `design/tailwind-plus/` at the repo root, or outside the repo, and commit only the components we port and adapt for this app.
   - Please confirm against the licence terms, or make the repo private.
2. **Where the kits live:** a git-ignored `design/tailwind-plus/` in the repo, or a folder outside the repo? → recommend the git-ignored folder, so the path is stable for development.
3. **Approach:** **A)** port the Catalyst primitives to Vue and compose screens from them, using Application UI blocks
   as layout references; or **B)** Application UI Vue blocks only (no port, but less consistent and more copy-paste markup).
   → recommend **A**. Catalyst gives one consistent set of primitives (Button, Input, Select, Listbox, Dialog, Table, Navbar…) that every screen reuses.
4. **App shell:** Catalyst **StackedLayout** (a top navbar; on mobile, a menu opens as a drawer) or **SidebarLayout**
   (a left sidebar)? → recommend **Stacked**. There are only two pages (Library, Editor), and the editor needs full width.
5. **Palette:** Catalyst is built on **zinc** neutrals with a per-button colour. Switch our slate neutrals to zinc and keep
   **teal** as the accent (`<Button color="teal">`)? → recommend yes. It's Catalyst's native look and stays "cool".
   Dark mode and the light default stay as they are.
6. **Scale picker:** today "Other…" opens an inline picker in the grid row. Move it to a Catalyst **Dialog**: a
   root Listbox, a scale Listbox, and Set/Cancel. → recommend yes; it's roomier and accessible, and it tidies the grid.

## 2. Target design (with recommendations 3A–6)

- **Shell:** StackedLayout. The navbar has the brand, Library, New chart, and a theme toggle (icon button; sun/moon heroicons); on mobile it collapses into a drawer menu. Footer link: request a chart.
- **Library:**
  - Catalyst `Heading` and `Text`.
  - A search `Input` with a magnifier icon (InputGroup).
  - Charts in a Catalyst `Table`, with title, subtitle and an "Open" link per row.
  - Application UI *empty-state* for no matches.
  - A "New chart" `Button color="teal"`.
- **Editor:**
  - A page heading (Application UI *page-headings* "with actions"): the chart title, plus Print and New chart actions.
  - **Grid:** a dense Catalyst `Table`. Cells are `Input`s (with the `GridCell` validation kept and `data-invalid` styling). The scale cell is a Catalyst **Listbox** whose options show each alternate's note as a description. The `@copy` row uses a `Badge`, invalid lines a compact `Alert`/inline error, and row actions are plain icon `Button`s (plus/trash).
  - **Text:** a Catalyst `Textarea` (mono). Diagnostics appear below as a list with error and warning `Badge`s.
  - **Preview toolbar:** a `Fieldset` with an Instrument `Listbox` (grouped), a "Start on" `Select`, and a mode segmented control (Application UI *button-groups*), plus Print.
  - **Preview pages:** cards as now, restyled. The print styles are unchanged: 12 per page, 0.5in top margin, always light.
- **Not-found page:** Catalyst `Heading`, `Text` and `Button`.

## 3. Components to port (Catalyst → Vue, in `web/app/components/ui/`)

Needed: `Button` (solid/outline/plain plus colours, as a link or a button), `Link` (wraps `NuxtLink`), `Input`
(+ InputGroup), `Textarea`, `Select`, `Fieldset`/`Field`/`Label`/`Description`/`ErrorMessage`, `Listbox`
(+ options with descriptions, on `@headlessui/vue`), `Dialog` (`@headlessui/vue`), `Table` (+ dense/striped),
`Badge`, `Heading`/`Subheading`, `Text`/`TextLink`/`Code`, `Divider`, `Navbar`/`NavbarItem`, `StackedLayout`.

Not needed now: Sidebar/SidebarLayout, AuthLayout, Avatar, Checkbox, Radio, Switch, Combobox, Pagination,
DescriptionList, Dropdown, Alert. These can be ported later as needed.

Rules for the port:
- **Style and layout:** keep Catalyst's class strings except for the state selectors (section 0), and keep its colour CSS variables (`--btn-bg` and so on).
- **API:** props mirror Catalyst's (`color`, `outline`, `plain`, `dense`, …) so its docs stay usable as reference.
- **Engine and boundaries:** no new runtime dependencies beyond `@headlessui/vue` and `@heroicons/vue`. Both ship to browsers, so they go in `dependencies` and fall under the `npm audit --omit=dev` gate. Nothing with inline `<script>`, `eval` or third-party origins, because pages must keep running under the hashed CSP.
- **Tests:** each component gets a unit test covering its variants, the rendered element (link vs button), the a11y attributes, and keyboard use for Listbox and Dialog.

## 4. Phases (each one a PR)

1. **Housekeeping.** Move the kits to `design/tailwind-plus/` (git-ignored). Ignore `.DS_Store`. Add `@headlessui/vue` and `@heroicons/vue`. Switch the palette tokens to zinc + teal.
2. **Primitives.** Port the section 3 components, with unit tests, plus a dev-only `/ui` page that shows each component in every variant, in light and dark. It's excluded from the static build, and it's for review.
3. **Shell, library and not-found page** on the new components.
4. **Editor:** grid, text, toolbar, the scale Dialog, and preview restyling. This is the largest phase.
5. **Polish:** accessibility pass (contrast AA, focus order, screen-reader labels), mobile layout, and dark-mode review; screenshots in light, dark and mobile for sign-off.

## 5. Verification (every phase)

- **Unit tests and checks:** the existing 101 unit tests still pass, updated where markup changes; new component tests; lint and typecheck.
- **E2E:**
  - The 13 Playwright tests still pass. They select by label and role, so they should survive most of the markup changes. The CSP-violation trap stays on.
  - Print still gives 8 pages for the existing cases.
  - New E2E coverage for the scale Dialog and the Listbox keyboard flow.
- **Visual check:** screenshots (light, dark, 400px mobile, print) reviewed before each PR.
- **Size:** the bundle-size change is reported in each PR (Headless UI Vue adds roughly 30–40 KB gzip to pages that use it).

## 6. Risks

- **Porting fidelity:** the hover/focus/active looks come from rewritten selectors, so compare against the Catalyst demo (`design/tailwind-plus/catalyst-ui-kit/demo`) side by side.
- **Listbox inside the grid:** 29+ Listboxes in a table could be heavy. If so, use the Catalyst-styled native `Select` in rows and the Listbox only in the Dialog and the toolbar.
- **Print:** the redesign must not touch the print styles. The print E2E tests guard this.

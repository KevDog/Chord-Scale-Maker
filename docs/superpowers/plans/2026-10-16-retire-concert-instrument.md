# Retire the Concert Instrument Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `concert` instrument preset; Piano becomes the default, and every stored preference or share link that still says `concert` reads as Piano.

**Architecture:** `INSTRUMENTS` (engine) loses one key, so `InstrumentName` shrinks and the typechecker finds every site that names it. The two places that read an instrument name from outside (the `csm-instrument` preference and a share link's `view.instrument`) each map `concert` to `piano` before validating. The page subtitle names the instrument on every sheet, Piano included, so `instrumentLabel()` loses its empty-string case.

**Tech Stack:** TypeScript (engine, pure), Nuxt/Vue (web), vitest, Playwright.

**Spec:** GitHub issue #332 (follows #331, "Widen piano range to F3–E6", still open). No design doc; the issue's Problem, Proposal and Tasks are the spec.

## Global Constraints

- Charts stay concert pitch; only the instrument *choice* named "Concert" goes. Prose that says "concert pitch" stays.
- `engine/` stays free of Vue/DOM imports; its public API is `engine/src/index.ts` (names snapshotted in `api.test.ts`).
- The plan quotes today's piano range, C4–C6 (MIDI 60–84, centre 70). If #331 has landed first, piano is F3–E6 (53–88) and stands alone in `guideRanges()` ("piano F3–E6; flute C4–C6; …"): substitute wherever a test below quotes the range. ⚠️ #331's hi of 88 exceeds `CAPS.treble.hi` (86, two ledger lines) and fails `instruments.test.ts`'s cap test; resolve that in #331, not here.
- Group heading in the Instrument dropdown stays **Concert Pitch (C)** (`GROUP_LABELS` in `web/app/utils/instrumentChoices.ts`).
- `make test` (typecheck + vitest), `make lint`, `make golden` green before the PR; `make e2e` for Task 6; `make a11y` runs on push (web/app touched).
- Commit messages name the issue: `(#332)`.

## Review Focus

1. A browser whose `csm-instrument` is `concert` opens Piano, not the fallback (Task 3 pins it).
2. An old share link whose view says `instrument: 'concert'` opens Piano rather than the visitor's own instrument (Task 2 pins it).
3. A first visit (nothing stored, no link) shows "Piano" in the page subtitle and "Piano" on the Instrument button (Task 6, editor.spec).
4. The help page's guide range sentence no longer names a "concert" range (Task 4 pins it).
5. Printing with Piano still fits 12 staves a page (Task 6, print.spec, both start modes).

---

### Task 1: Engine: drop `concert`, label every instrument, rewrite the C descriptions

**Files:**
- Modify: `engine/src/instruments.ts:25-55`
- Test: `engine/src/__tests__/instruments.test.ts`

**Interfaces:**
- Produces: `INSTRUMENTS` with 15 keys (no `concert`); `InstrumentName` without `'concert'`; `instrumentLabel(name: InstrumentName): string` never returns `''` ("Piano", "Tenor Sax (Bb)").

- [ ] **Step 1: Update the tests to the 15-instrument world**

In `engine/src/__tests__/instruments.test.ts`:
- `labels every instrument for the page subtitle`: drop the `concert: ''` entry and the "concert -> ''" comment.
- `gives every instrument the range the spec lists`: drop `concert: [60, 81, 69]`.
- `recognises instrument names safely`: `expect(isInstrumentName('concert')).toBe(false)` and `toHaveLength(15)`.
- Add:

```ts
it('describes each C treble instrument in its own words, flute standing in for violin and oboe', () => {
  const c = Object.entries(INSTRUMENTS).filter(([, i]) => i.clef === 'treble' && i.trans === 'C')
  expect(c.map(([n]) => n)).toEqual(['piano', 'vibes', 'flute', 'guitar'])
  for (const [name, i] of c) expect(i.description, name).not.toMatch(/same as/)
  expect(INSTRUMENTS.flute.description).toMatch(/violin/)
  expect(INSTRUMENTS.flute.description).toMatch(/oboe/)
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd engine && npx vitest run src/__tests__/instruments.test.ts`
Expected: FAIL (16 keys, `concert` still labels `''`, "same as concert" descriptions).

- [ ] **Step 3: Edit `engine/src/instruments.ts`**

- Delete the `concert` row of `INSTRUMENTS`.
- Descriptions, exact copy:
  - `piano`: `concert pitch, treble clef: the right hand`
  - `vibes`: `concert pitch, treble clef`
  - `flute`: `concert pitch, treble clef; also oboe, violin and any other treble C instrument`
  - `guitar`: `concert pitch, treble clef (sounds an octave lower)`
- `instrumentLabel`: remove the `if (name === 'concert') return ''` line and the `concert -> ""` part of its doc comment.
- Leave `CAPS`, `TRANSPOSITIONS`, `CLEF_START`, `CLEF_ROOT_LOW` alone. `RANGES.treble` in `voiceLeading.ts` (the `CONCERT` *part*'s default range, C4–A5) stays: the `CONCERT` part is the engine's and the tests' concert-pitch part, not an instrument choice.

- [ ] **Step 4: Run the engine suite**

Run: `cd engine && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS (the `api.test.ts` snapshot lists names, not keys; it should not change).

- [ ] **Step 5: Commit**

```bash
git add engine/src/instruments.ts engine/src/__tests__/instruments.test.ts
git commit -m "Engine: retire the concert instrument; piano, vibes, flute, guitar described (#332)"
```

### Task 2: Engine: share links that say `concert` read as `piano`

**Files:**
- Modify: `engine/src/share.ts:105`
- Test: `engine/src/__tests__/share.test.ts`

**Interfaces:**
- Consumes: `isInstrumentName` (Task 1's `INSTRUMENTS`).
- Produces: `shareViewFrom(v: unknown): ShareView | undefined` maps `instrument: 'concert'` to `'piano'`; any other unknown instrument is still dropped.

- [ ] **Step 1: Write the failing test** (in the `keep only the view fields they know` describe, next to the `kazoo` case)

```ts
it("read an old link's concert instrument as piano (#332)", () => {
  expect(shareViewFrom({ instrument: 'concert', mode: 'root' })).toEqual({ instrument: 'piano', mode: 'root' })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd engine && npx vitest run src/__tests__/share.test.ts`
Expected: FAIL: `{ mode: 'root' }` (the name is unknown, so dropped).

- [ ] **Step 3: Implement in `engine/src/share.ts`**

Before the `instrument` spread in `shareViewFrom`, resolve `const instrument = o.instrument === 'concert' ? 'piano' : o.instrument` and validate that with `isInstrumentName`. One-line comment: `// #332: links made before the concert choice was retired`.

- [ ] **Step 4: Run it to see it pass**

Run: `cd engine && npx vitest run src/__tests__/share.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add engine/src/share.ts engine/src/__tests__/share.test.ts
git commit -m "Share links: a concert instrument reads as piano (#332)"
```

### Task 3: Web: Piano is the default; a stored `concert` reads as Piano

**Files:**
- Modify: `web/app/composables/usePreferences.ts:18`
- Test: `web/test/usePreferences.test.ts`

**Interfaces:**
- Produces: `usePreferences().instrument: Ref<InstrumentName>` defaulting to `'piano'`.

- [ ] **Step 1: Update and add tests**

In `web/test/usePreferences.test.ts`:
- `defaults to concert pitch spelled from the chart's key…`: rename to `defaults to piano spelled from the chart's key, with interval labels on`; expect `['piano', 'key', true]`.
- `ignores stored values it does not recognise`: expect `['piano', 'key']`.
- Add:

```ts
it('reads a stored concert instrument as piano, the choice that replaced it (#332)', () => {
  localStorage.setItem('csm-instrument', 'concert')
  expect(prefs().instrument.value).toBe('piano')
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd web && npx vitest run test/usePreferences.test.ts`
Expected: FAIL (typecheck may already reject `'concert'` as the fallback; the three assertions fail at runtime).

- [ ] **Step 3: Implement**

In `usePreferences.ts`, the `instrument` line becomes a `storedRef<InstrumentName>('csm-instrument', parse, 'piano')` whose parse maps `'concert'` to `'piano'` before `isInstrumentName`. Comment: `// #332: 'concert', the retired choice, reads as piano`.

- [ ] **Step 4: Run to see them pass**

Run: `cd web && npx vitest run test/usePreferences.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/usePreferences.ts web/test/usePreferences.test.ts
git commit -m "Preferences: Piano is the default instrument; a stored concert reads as piano (#332)"
```

### Task 4: Web: every other site that named the Concert choice

**Files:**
- Modify: `web/app/pages/help.vue:146-148`, `web/app/pages/ui.vue:69`, `web/app/components/ScaleSheet.vue:22`, `web/app/components/ChangesSheet.vue:75`, `web/app/utils/instrumentChoices.ts:35`
- Test: `web/test/instrumentChoices.test.ts`, `web/test/issueReport.test.ts:67`, `web/test/ChangesNote.test.ts:9`, `web/test/PreviewControls.test.ts:6,152`

**Interfaces:**
- Consumes: Task 1's `INSTRUMENTS` and `InstrumentName`.
- No new exports. `instrumentLabel`, `issuePart` and `instrumentOption` keep their signatures.

- [ ] **Step 1: Update the unit tests**

- `instrumentChoices.test.ts`: `formats dropdown labels in title case`: replace the `concert` line with `expect(instrumentOption('alto-sax')).toBe('Alto Sax')`. `guideRanges`: the expected string starts `'piano and flute C4–C6; vibes G3–D6; guitar A3–A5; …'` (no `concert C4–A5;` prefix; see Global Constraints if #331 landed).
- `issueReport.test.ts:67`: `expect(issuePart('piano')).toEqual({ name: 'Piano', transposes: false })`.
- `ChangesNote.test.ts:9`: the `CONTEXT` part's name is `'Piano'`.
- `PreviewControls.test.ts:6,152`: `instrument: 'piano'`.

- [ ] **Step 2: Run the web typecheck and these tests to see what fails**

Run: `cd web && npx nuxi typecheck && npx vitest run test/instrumentChoices.test.ts test/issueReport.test.ts test/ChangesNote.test.ts test/PreviewControls.test.ts`
Expected: typecheck errors only where `'concert'` is still typed as an `InstrumentName` (none expected in app code after Task 3; the test edits above clear the test ones); `guideRanges` assertion passes once Task 1 is in (no code change needed).

- [ ] **Step 3: Update the copy and comments**

- `help.vue` Instrument entry, exact copy: `Charts are always written in concert pitch, and the sheet is transposed for you: trumpet, clarinet, tenor and soprano in B♭, alto and bari in E♭, horn in F, and trombone, tuba and bass in bass clef. Piano, vibes, guitar and flute read concert; for oboe, violin or any other treble C instrument, choose Flute. Piano until you choose; your choice is remembered.`
- `ui.vue:69`: delete the `concert` demo option (the group's demo keeps Piano).
- `ScaleSheet.vue:22` and `ChangesSheet.vue:75` prop comments: `'' while editing in concert pitch` (the only remaining empty-label case is `EditorView.vue:191`'s `sheetEditor ? '' : …`).
- `instrumentChoices.ts:35` doc comment example: `"piano and flute C4–C6; vibes G3–D6; …"`.

- [ ] **Step 4: Run the whole web suite and lint**

Run: `make test && make lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/pages/help.vue web/app/pages/ui.vue web/app/components/ScaleSheet.vue web/app/components/ChangesSheet.vue web/app/utils/instrumentChoices.ts web/test/instrumentChoices.test.ts web/test/issueReport.test.ts web/test/ChangesNote.test.ts web/test/PreviewControls.test.ts
git commit -m "Web: no Concert instrument; Piano default in copy and tests (#332)"
```

### Task 5: Docs

**Files:**
- Modify: `README.md:107`, `docs/design.md:699-701`, `docs/design.md:990-992`

- [ ] **Step 1: README instruments table**

Row 1 becomes `| Piano, vibes, flute, guitar (violin, oboe: choose Flute) | treble | C |`.

- [ ] **Step 2: design.md**

- §5 Instrument choice: `15 presets` (was 16); add: `Piano is the default (#332 retired the "Concert" choice: a stored or linked \`concert\` reads as \`piano\`); the subtitle names the instrument on every sheet.`
- `usePreferences()` bullet: after "falls back to the default", add `(the instrument's is \`piano\`; the retired \`concert\` reads as \`piano\`)`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/design.md
git commit -m "Docs: Piano default, Concert choice retired (#332)"
```

### Task 6: e2e: Piano everywhere the tests chose or assumed Concert

**Files:**
- Modify: `web/e2e/print.spec.ts:8-9`, `web/e2e/interface.spec.ts:78`, `web/e2e/editor.spec.ts:123,126,128`, and any spec whose pitch assertions move (found in Step 2)

**Interfaces:**
- Consumes: the Instrument dropdown's option "Piano" (`chooseInstrument(page, 'Piano')`), subtitle format `pageSubtitle(subtitle, 'Piano', heading)` → `"C – Piano (Spelled from C)"`.

- [ ] **Step 1: Edit the known sites**

- `print.spec.ts`: `['Concert', null]` → `['Piano', null]`, `['Concert', 'C']` → `['Piano', 'C']`.
- `interface.spec.ts:78`: store `'piano'` (the test is about *having* a preference; Task 3 covers the migration).
- `editor.spec.ts`: the three subtitles become `'C – Piano (Spelled from C)'`, `'C – Piano (Spelled from E♭)'`, `'C – Piano (Spelled from the Root)'`.
- Add to `editor.spec.ts`, after the subtitle test:

```ts
test('a first visit is a Piano sheet, and says so', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Instrument' })).toContainText('Piano')
  await expect(page.locator('section header p').first()).toContainText('Piano')
})
```

- [ ] **Step 2: Run the browser suite**

Run: `make e2e`
Expected: the edited specs pass. Guide tone, arpeggio and pentatonic line assertions that were tuned to the concert range (C4–A5, centre A4) may now fail under piano's (C4–C6, centre B♭4): list each failure.

- [ ] **Step 3: Fix each moved assertion by hand**

For each failure from Step 2: read the asserted pitch, confirm the new note lies within piano's written range and is the nearest candidate to its centre (`rangeOf(part)` in `docs/design.md` §5, "written range"), then update the expectation. A failure whose new value does not fit that rule is a bug, not a test to edit: stop and report it.

- [ ] **Step 4: Rerun to green**

Run: `make e2e`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/e2e
git commit -m "e2e: Piano is the default instrument (#332)"
```

### Task 7: Golden fixture and the final gate

**Files:**
- Possibly modify: `engine/fixtures/golden.json`

- [ ] **Step 1: Regenerate the golden fixture**

Run: `make golden && git diff --stat engine/fixtures/golden.json`
Expected: no diff (the fixture builds with the `CONCERT` *part*, which is unchanged). A diff means an engine answer moved: read it before committing, and report it in the PR.

- [ ] **Step 2: The whole gate**

Run: `make test && make lint && make a11y`
Expected: all PASS.

- [ ] **Step 3: Commit (only if Step 1 produced a diff) and open the PR**

```bash
git add engine/fixtures/golden.json && git commit -m "Golden: piano default (#332)"
gh pr create --title "Retire the Concert instrument choice; Piano is the default (#332)" --body "Closes #332. …"
```

PR body: the Review Focus list above as what to check, and whether #331 landed first (which piano range this ships with).

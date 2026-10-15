# Interface levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An *Interface* setting (Essentials / Intermediate / Everything) that hides song-page controls by audience, without moving or changing any of them.

**Architecture:** A pure table in `web/app/utils/interface.ts` (control id → lowest level that shows it) plus pure
`shows`, `hiddenSettings` and `initialLevel`. A module-level ref in `composables/useInterface.ts`, initialised once by a
client plugin, holds the viewer's level; components add `shows('<id>') &&` to existing `v-if`s. A new feature flag
`interfaceLevels` (off) makes `shows` always true, so nothing changes until it is turned on.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript strict, Vitest (`environment: 'nuxt'`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-interface-levels-design.md`

## Global Constraints

- Only visibility changes: no control moves, restyles or changes behaviour; no engine change.
- Levels: `essentials` | `intermediate` | `everything`, each a superset of the one before. Labels: Essentials, Intermediate, Everything.
- Preference key `csm-interface`; never in share links; the viewer's level always wins.
- First visit: Essentials, unless any `csm-*` key already exists → Everything. The chosen default is written at once.
- Feature flags gate existence; the level only hides. New flag `interfaceLevels: false` in `nuxt.config.ts`; e2e builds with all flags on.
- Hidden settings still render; the notice reads `This sheet uses <Level> settings` with `Show controls` and `Reset`; never shown when nothing is hidden.
- Form editing (repeats, endings, segno, coda, jumps, new section here, paste, write out) is Intermediate.
- The switch lives only in the More actions menu (no rail hint).
- No inline `<script>`, no `eval` (CSP).

## Review Focus

1. A fresh visitor whose first page writes a `csm-*` key (recent charts, theme) before the level is decided → must still start at Essentials: the plugin decides before any page runs (Task 2 test).
2. Flag off → every control shows and nothing is written to `csm-interface` (Task 2 test).
3. A chart over a size limit (`editor.fatal`) at Essentials → the Source still shows (only the text can fix it) (Task 4).
4. A share link with Advanced level opened at Essentials → sheet renders Advanced, notice offers Intermediate; Reset returns to Standard without touching stored prefs (Task 5 test, Task 7 e2e).
5. A stored value from an unknown level string (`csm-interface=pro`) → treated as unset (Task 1 test).

## File structure

- Create `web/app/utils/interface.ts`: levels, tiers, `shows`, `hiddenSettings`, `initialLevel`, `levelLabel`.
- Create `web/test/interface.test.ts`.
- Create `web/app/composables/useInterface.ts`: the level ref, `initInterface()`, `useInterface()`.
- Create `web/app/plugins/interface.client.ts`: calls `initInterface()`.
- Create `web/test/useInterface.test.ts`.
- Create `web/app/components/InterfaceNotice.vue`, `web/test/InterfaceNotice.test.ts`.
- Modify `web/nuxt.config.ts`, `web/app/composables/useFeature.ts`, `web/test/features.test.ts` (flag).
- Modify `PreviewControls.vue`, `EditorView.vue`, `PracticePanel.vue`, `SheetBarToolbar.vue`, `ChangesSheet.vue`,
  `ChangesSystem.vue`, `ChordChoices.vue`, `SheetChordEditor.vue`, `MoreMenu.vue`, `pages/help.vue`.
- Modify `web/e2e/fixtures.ts`; create `web/e2e/interface.spec.ts`.

---

### Task 1: The pure tier table

**Files:**
- Create: `web/app/utils/interface.ts`
- Test: `web/test/interface.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type InterfaceLevel = 'essentials' | 'intermediate' | 'everything'
  export const INTERFACE_LEVELS: readonly InterfaceLevel[]
  export const isInterfaceLevel: (s: string) => s is InterfaceLevel
  export const levelLabel: (l: InterfaceLevel) => string
  export type ControlId = keyof typeof CONTROL_TIERS
  export function shows(level: InterfaceLevel, id: ControlId): boolean
  export type ViewSettings = Readonly<{ sheet: SheetKind; scaleLevel: ScaleLevel; numerals: boolean; scaleNames: boolean; lineMode: LineMode; spell: Spell; practice: PracticeSelection | null; pentatonics: boolean }>
  export type HiddenSetting = 'scale-level' | 'numerals' | 'scale-names' | 'line' | 'spell' | 'practice' | 'pentatonics'
  export function hiddenSettings(level: InterfaceLevel, v: ViewSettings): Readonly<{ settings: readonly HiddenSetting[]; needs: InterfaceLevel }> | null
  export function initialLevel(stored: string | null, keys: readonly string[]): InterfaceLevel
  ```

- [ ] **Step 1: Write the failing tests** (`web/test/interface.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { CONTROL_TIERS, hiddenSettings, initialLevel, INTERFACE_LEVELS, isInterfaceLevel, levelLabel, shows, type ViewSettings } from '~/utils/interface'

const DEFAULTS: ViewSettings = { sheet: 'changes', scaleLevel: 'standard', numerals: true, scaleNames: true, lineMode: 'off', spell: 'key', practice: null, pentatonics: false }

describe('interface levels', () => {
  it('orders the levels and names them', () => {
    expect(INTERFACE_LEVELS).toEqual(['essentials', 'intermediate', 'everything'])
    expect(INTERFACE_LEVELS.map(levelLabel)).toEqual(['Essentials', 'Intermediate', 'Everything'])
    expect(isInterfaceLevel('intermediate')).toBe(true)
    expect(isInterfaceLevel('pro')).toBe(false)
  })

  it('follows the spec tier tables', () => {
    expect(CONTROL_TIERS).toEqual({
      'scale-level': 'intermediate',
      analysis: 'intermediate',
      line: 'intermediate',
      spell: 'intermediate',
      practice: 'intermediate',
      'scale-choice': 'intermediate',
      'form-editing': 'intermediate',
      why: 'intermediate',
      pentatonics: 'everything',
      'practice-pentatonic': 'everything',
      'key-change': 'everything',
      'function-choice': 'everything',
      source: 'everything',
    })
  })

  it('shows a control from its tier up', () => {
    expect(shows('essentials', 'line')).toBe(false)
    expect(shows('intermediate', 'line')).toBe(true)
    expect(shows('intermediate', 'pentatonics')).toBe(false)
    expect(shows('everything', 'pentatonics')).toBe(true)
  })
})

describe('hiddenSettings', () => {
  it('is null when every setting is at its default', () => {
    expect(hiddenSettings('essentials', DEFAULTS)).toBeNull()
  })

  it('names settings away from their defaults whose controls are hidden, and the lowest level that shows them all', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, scaleLevel: 'advanced', numerals: false })).toEqual({ settings: ['scale-level', 'numerals'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, lineMode: 'guide', pentatonics: true })).toEqual({ settings: ['line', 'pentatonics'], needs: 'everything' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, lineMode: 'guide', pentatonics: true })).toEqual({ settings: ['pentatonics'], needs: 'everything' })
    expect(hiddenSettings('everything', { ...DEFAULTS, pentatonics: true })).toBeNull()
  })

  it('counts only what the current sheet uses', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', numerals: false, lineMode: 'guide' })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'changes', spell: 'root', practice: { preset: 'chordTones' } })).toBeNull()
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', spell: 'root' })).toEqual({ settings: ['spell'], needs: 'intermediate' })
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'arpeggios', scaleLevel: 'advanced', spell: 'root' })).toBeNull()
  })

  it('puts a pentatonic practice selection at Everything', () => {
    expect(hiddenSettings('essentials', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'chordTones' } })).toEqual({ settings: ['practice'], needs: 'intermediate' })
    expect(hiddenSettings('intermediate', { ...DEFAULTS, sheet: 'scales', practice: { preset: 'pentatonic', rank: 2 } })).toEqual({ settings: ['practice'], needs: 'everything' })
  })
})

describe('initialLevel', () => {
  it('keeps a stored level', () => expect(initialLevel('intermediate', ['csm-interface'])).toBe('intermediate'))
  it('starts a new browser at Essentials', () => expect(initialLevel(null, ['other-site-key'])).toBe('essentials'))
  it('starts a browser that already has preferences at Everything', () => expect(initialLevel(null, ['csm-instrument'])).toBe('everything'))
  it('treats an unknown stored value as unset', () => {
    expect(initialLevel('pro', ['csm-interface'])).toBe('essentials')
    expect(initialLevel('pro', ['csm-interface', 'csm-level:x'])).toBe('everything')
  })
})
```


- [ ] **Step 2: Run, expect FAIL** — `cd web && npx vitest run test/interface.test.ts` → cannot resolve `~/utils/interface`.

- [ ] **Step 3: Implement** (`web/app/utils/interface.ts`)

```ts
import { isPentatonicSelection, type PracticeSelection, type ScaleLevel } from '@chord-scale-maker/engine'
import type { LineMode } from '~/utils/sheetLine'
import type { Spell } from '~/utils/scaleChoices'
import type { SheetKind } from '~/utils/sheets'

/** the Interface setting (#273, docs/superpowers/specs/2026-10-14-interface-levels-design.md): which controls show; each level a superset of the one before */
export type InterfaceLevel = 'essentials' | 'intermediate' | 'everything'
export const INTERFACE_LEVELS: readonly InterfaceLevel[] = ['essentials', 'intermediate', 'everything']
export const isInterfaceLevel = (s: string): s is InterfaceLevel => (INTERFACE_LEVELS as readonly string[]).includes(s)
const LABELS: Readonly<Record<InterfaceLevel, string>> = { essentials: 'Essentials', intermediate: 'Intermediate', everything: 'Everything' }
export const levelLabel = (l: InterfaceLevel): string => LABELS[l]

/** the lowest level that shows each control above Essentials; a control not here shows at every level */
export const CONTROL_TIERS = {
  'scale-level': 'intermediate', // Level and Shuffle
  analysis: 'intermediate', // Numerals, Scales toggles
  line: 'intermediate', // Line modes, guide line, arpeggio pattern
  spell: 'intermediate', // Spell Scale
  practice: 'intermediate', // the Practice panel
  'scale-choice': 'intermediate', // a chord's scale: the scale label picker, ChordChoices' Scale section
  'form-editing': 'intermediate', // Repeat a section, Write out, endings, segno, coda, Jump, New section here, Paste bars
  why: 'intermediate', // the "why" notes on numerals and scales, ChordChoices' why
  pentatonics: 'everything', // Analysis: Pentatonics and its sub-controls, the ladder
  'practice-pentatonic': 'everything', // the Practice panel's Pentatonic preset
  'key-change': 'everything', // Key change here
  'function-choice': 'everything', // the numeral label picker, ChordChoices' Function section
  source: 'everything', // Show/Hide source, Source, Chart text
} as const satisfies Readonly<Record<string, Exclude<InterfaceLevel, 'essentials'>>>
export type ControlId = keyof typeof CONTROL_TIERS

const rank = (l: InterfaceLevel): number => INTERFACE_LEVELS.indexOf(l)
export const shows = (level: InterfaceLevel, id: ControlId): boolean => rank(level) >= rank(CONTROL_TIERS[id])

/** the sheet's settings a control governs: what decides the notice */
export type ViewSettings = Readonly<{ sheet: SheetKind; scaleLevel: ScaleLevel; numerals: boolean; scaleNames: boolean; lineMode: LineMode; spell: Spell; practice: PracticeSelection | null; pentatonics: boolean }>
export type HiddenSetting = 'scale-level' | 'numerals' | 'scale-names' | 'line' | 'spell' | 'practice' | 'pentatonics'

/** each setting away from its default on this sheet, and the level its control needs */
function setAway(v: ViewSettings): readonly (readonly [HiddenSetting, InterfaceLevel])[] {
  const changes = v.sheet === 'changes'
  const scales = v.sheet === 'scales'
  return [
    ...((changes || scales) && v.scaleLevel !== 'standard' ? [['scale-level', 'intermediate'] as const] : []),
    ...(changes && !v.numerals ? [['numerals', 'intermediate'] as const] : []),
    ...(changes && !v.scaleNames ? [['scale-names', 'intermediate'] as const] : []),
    ...(changes && v.lineMode !== 'off' ? [['line', 'intermediate'] as const] : []),
    ...(scales && v.spell !== 'key' ? [['spell', 'intermediate'] as const] : []),
    ...(scales && v.practice ? [['practice', isPentatonicSelection(v.practice) ? 'everything' : 'intermediate'] as const] : []),
    ...(changes && v.pentatonics ? [['pentatonics', 'everything'] as const] : []),
  ]
}

/** the settings in force whose controls this level hides, and the lowest level that shows them all; null when none */
export function hiddenSettings(level: InterfaceLevel, v: ViewSettings): Readonly<{ settings: readonly HiddenSetting[]; needs: InterfaceLevel }> | null {
  const hidden = setAway(v).filter(([, needs]) => rank(needs) > rank(level))
  if (!hidden.length) return null
  const needs = INTERFACE_LEVELS[Math.max(...hidden.map(([, n]) => rank(n)))] as InterfaceLevel
  return { settings: hidden.map(([s]) => s), needs }
}

/** a stored level; else Everything for a browser that already holds preferences (no returning player loses a control), else Essentials */
export function initialLevel(stored: string | null, keys: readonly string[]): InterfaceLevel {
  if (stored !== null && isInterfaceLevel(stored)) return stored
  return keys.some((k) => k.startsWith('csm-') && k !== 'csm-interface') ? 'everything' : 'essentials'
}
```

- [ ] **Step 4: Run, expect PASS** — `cd web && npx vitest run test/interface.test.ts`.
- [ ] **Step 5: Commit** — `git add web/app/utils/interface.ts web/test/interface.test.ts && git commit -m "Interface levels: the tier table"`

### Task 2: The flag, the composable and its plugin

**Files:**
- Modify: `web/nuxt.config.ts` (features block), `web/app/composables/useFeature.ts:5`, `web/test/features.test.ts:15`
- Create: `web/app/composables/useInterface.ts`, `web/app/plugins/interface.client.ts`
- Test: `web/test/useInterface.test.ts`

**Interfaces:**
- Consumes: `initialLevel`, `shows`, `InterfaceLevel`, `ControlId` (Task 1); `readStored`, `writeStored`, `storedKeys` (`utils/storage.ts`).
- Produces:
  ```ts
  export function initInterface(): void          // once, at app start (client)
  export function useInterface(): { level: Ref<InterfaceLevel>; shows: (id: ControlId) => boolean; on: boolean }
  ```
  `level` is shared (module-level); setting it writes `csm-interface`. `on` is the flag. With the flag off, `shows` is always true and `level` reads `everything`.

- [ ] **Step 1: Add the flag** — in `nuxt.config.ts` features: `interfaceLevels: false, // hide controls by audience: Essentials / Intermediate / Everything (docs/superpowers/specs/2026-10-14-interface-levels-design.md)`; add `'interfaceLevels'` to the `Feature` union; add `interfaceLevels: false` to the expected object in `features.test.ts`.

- [ ] **Step 2: Write the failing tests** (`web/test/useInterface.test.ts`)

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initInterface, useInterface } from '~/composables/useInterface'

describe('useInterface', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => (useRuntimeConfig().public.features.interfaceLevels = false))

  it('flag off: shows everything and stores nothing', () => {
    initInterface()
    const ui = useInterface()
    expect(ui.shows('pentatonics')).toBe(true)
    expect(localStorage.getItem('csm-interface')).toBeNull()
  })

  it('a new browser starts at Essentials, written at once', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    const ui = useInterface()
    expect(ui.level.value).toBe('essentials')
    expect(ui.shows('line')).toBe(false)
    expect(localStorage.getItem('csm-interface')).toBe('essentials')
  })

  it('decided once: a csm-* key written later does not change it', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    localStorage.setItem('csm-recent', '[]')
    initInterface()
    expect(useInterface().level.value).toBe('essentials')
  })

  it('a browser with preferences starts at Everything', () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    localStorage.setItem('csm-instrument', 'tenor-sax')
    initInterface()
    expect(useInterface().level.value).toBe('everything')
  })

  it('a chosen level is remembered', async () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    initInterface()
    useInterface().level.value = 'intermediate'
    await nextTick()
    expect(localStorage.getItem('csm-interface')).toBe('intermediate')
    expect(useInterface().shows('line')).toBe(true)
  })
})
```

- [ ] **Step 3: Run, expect FAIL** — `cd web && npx vitest run test/useInterface.test.ts`.

- [ ] **Step 4: Implement**

`web/app/composables/useInterface.ts`:
```ts
import { type ControlId, type InterfaceLevel, initialLevel, isInterfaceLevel, shows as tierShows } from '~/utils/interface'

const KEY = 'csm-interface'
/** the viewer's level, shared by every control (the song page is client-only) */
const level = ref<InterfaceLevel>('everything')
watch(level, (v) => {
  if (useFeature('interfaceLevels')) writeStored(KEY, v)
})

/** decide the level from this browser before any page writes a preference (plugins/interface.client.ts); with the flag off, nothing */
export function initInterface(): void {
  if (!useFeature('interfaceLevels')) return void (level.value = 'everything')
  const stored = readStored(KEY)
  const next = initialLevel(stored, storedKeys())
  level.value = next
  if (stored !== next) writeStored(KEY, next)
}

/** the Interface setting (#273): which controls show; the flag off shows all */
export function useInterface() {
  const on = useFeature('interfaceLevels')
  return { level, on, shows: (id: ControlId): boolean => !on || tierShows(level.value, id) }
}
```
(Drop the unused `isInterfaceLevel` import if lint complains.)

`web/app/plugins/interface.client.ts`:
```ts
/** the Interface level is decided at start, before a page can write a csm-* preference (useInterface) */
export default defineNuxtPlugin(() => initInterface())
```

- [ ] **Step 5: Run, expect PASS**; also `npx vitest run test/features.test.ts`.
- [ ] **Step 6: Commit** — `git add web/nuxt.config.ts web/app/composables/useFeature.ts web/app/composables/useInterface.ts web/app/plugins/interface.client.ts web/test/features.test.ts web/test/useInterface.test.ts && git commit -m "Interface levels: flag, composable, start-up default"`

### Task 3: Rail and Practice panel controls

**Files:**
- Modify: `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue` (Level slot, PracticePanel `v-if`, `pentatonic` prop), `web/app/components/PracticePanel.vue`
- Test: `web/test/PreviewControls.test.ts`, `web/test/PracticePanel.test.ts`

**Interfaces:** Consumes `useInterface().shows` (Task 2).

- [ ] **Step 1: Failing tests.** In `PreviewControls.test.ts` add (follow the file's existing mount helper and props):

```ts
describe('interface levels', () => {
  afterEach(() => {
    useRuntimeConfig().public.features.interfaceLevels = false
    useInterface().level.value = 'everything'
  })
  it('Essentials hides Level, Analysis, Line and Spell Scale', async () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    useInterface().level.value = 'essentials'
    const changes = await mountControls({ sheet: 'changes' }) // existing helper, slot level given
    expect(changes.text()).not.toMatch(/Level|Analysis|Line/)
    const scales = await mountControls({ sheet: 'scales' })
    expect(scales.text()).not.toContain('Spell Scale')
    expect(scales.text()).toContain('Intervals')
  })
  it('Intermediate shows them but not Pentatonics', async () => {
    useRuntimeConfig().public.features.interfaceLevels = true
    useRuntimeConfig().public.features.pentatonics = true
    useInterface().level.value = 'intermediate'
    const w = await mountControls({ sheet: 'changes' })
    expect(w.text()).toMatch(/Level[\s\S]*Analysis[\s\S]*Line/)
    expect(w.text()).not.toContain('Pentatonics')
  })
})
```
In `PracticePanel.test.ts`: with flag on and level `intermediate`, `pentatonic: true` → no Pentatonic preset button; at `everything` → present.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** — add `const { shows } = useInterface()` in each component, then:
  - `PreviewControls.vue`: Level field `v-if="$slots.level && shows('scale-level')"`; Analysis field `v-if="(!lockLabels && shows('analysis')) || (pentatonicsOn && shows('pentatonics'))"`; inner Numerals/Scales div `v-if="!lockLabels && shows('analysis')"`; Pentatonics toggle and its sub-controls `pentatonicsOn && shows('pentatonics') && …`; Line field `v-if="shows('line')"`; Spell Scale `v-if="sheet === 'scales' && shows('spell')"`.
  - `EditorView.vue`: PracticePanel `v-if="practiceOn && shows('practice') && sheet === 'scales' && !editor.fatal.value"`.
  - `PracticePanel.vue`: `presets` filter `p !== 'pentatonic' || (props.pentatonic && shows('practice-pentatonic'))`.
- [ ] **Step 4: Run, expect PASS** — `npx vitest run test/PreviewControls.test.ts test/PracticePanel.test.ts`.
- [ ] **Step 5: Commit** — "Interface levels: rail and Practice panel".

### Task 4: Editing and notes on the sheet

**Files:**
- Modify: `SheetBarToolbar.vue`, `ChangesSheet.vue` (Repeat a section button), `ChangesSystem.vue` (label pickers, ChangesNote), `ChordChoices.vue` (`parts`), `SheetChordEditor.vue`, `EditorView.vue` (Source button/menu item/pane)
- Test: `SheetBarToolbar.test.ts`, `ChordChoices.test.ts`, `ChangesSystem.test.ts`, `EditorView.test.ts`

- [ ] **Step 1: Failing tests** (flag on; reset level to `everything` in `afterEach`):
  - `SheetBarToolbar`: at `essentials`, buttons `+ before`, `+ after`, `Split`, `Delete` present; no `More actions for` button; on a repeat's bar no `Write out`. At `intermediate`: ⋯ present, opening it shows `1st ending` but not `Key change here`. At `everything`: `Key change here` present.
  - `ChordChoices` (part `all`): at `essentials` no `Scale`/`Function` headings and no why; at `intermediate` Scale and why, no Function; at `everything` all three.
  - `ChangesSystem` while editing: at `essentials` the numeral and scale are plain text (no popover button); at `intermediate` the scale label is a button, the numeral is not; not editing at `essentials`, no ChangesNote button.
  - `EditorView`: at `essentials` no `Source` button; with a fatal chart the source pane still shows.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** (`const { shows } = useInterface()` in each):
  - `SheetBarToolbar.vue`: wrap the `repeatOf` Write out button `v-if="shows('form-editing')"`; ⋯ dropdown `v-if="shows('form-editing') || (shows('key-change') && chordLine !== null)"`; Key change item `v-if="chordLine !== null && shows('key-change')"`; endings, marks, Jump, New section here, Paste bars items inside `<template v-if="shows('form-editing')">`. If `repeatOf && !shows('form-editing')` the toolbar has no items: put `v-if="!repeatOf || shows('form-editing')"` on the outer `div.print:hidden`.
  - `ChangesSheet.vue`: Repeat a section button `v-if="shows('form-editing')"`.
  - `ChangesSystem.vue`: numeral `SheetLabelPicker v-else-if="editing !== undefined && shows('function-choice') && doc && …"`; scale `SheetLabelPicker v-else-if="editing !== undefined && shows('scale-choice') && doc && …"`; both `ChangesNote` branches and `notesOn` uses in `:class`/`:title`: replace `notesOn` with a computed `notesShown = computed(() => notesOn && shows('why'))`. Rename-section marker stays (E).
  - `ChordChoices.vue`: `parts` computed filters `function` by `shows('function-choice')`, `scale` by `shows('scale-choice')`, `why` by `shows('why')`. `SheetChordEditor.vue`: unchanged (ChordChoices renders nothing when empty; check that its root `div v-if="row"` is still fine with no parts).
  - `EditorView.vue`: `sourceShown = computed(() => (shows('source') && prefs.source.value) || editor.fatal.value)`; the Show/Hide source menu item and the banner's Source button `v-if="shows('source')"` (keep their other conditions).
- [ ] **Step 4: Run, expect PASS**, then the whole app suite `cd web && npx vitest run --project app`.
- [ ] **Step 5: Commit** — "Interface levels: editing and sheet notes".

### Task 5: The notice

**Files:**
- Create: `web/app/components/InterfaceNotice.vue`, `web/test/InterfaceNotice.test.ts`
- Modify: `EditorView.vue` (compute the hidden settings, place the notice under `PreviewControls`, before the `transposed` status)

**Interfaces:**
- `InterfaceNotice` props `{ needs: InterfaceLevel }`, emits `show`, `reset`. Text: `This sheet uses {{ levelLabel(needs) }} settings`, buttons `Show controls`, `Reset`; `role="status"`, `print:hidden`.
- EditorView:
  ```ts
  const ui = useInterface()
  const hidden = computed(() => ui.on ? hiddenSettings(ui.level.value, { sheet: sheet.value, scaleLevel: scaleLevel.level.value, numerals: prefs.numerals.value, scaleNames: prefs.scaleNames.value, lineMode: prefs.lineMode.value, spell: prefs.spell.value, practice: selection.value, pentatonics: pentatonicsOn && prefs.pentatonics.value }) : null)
  function resetHidden(): void {
    for (const s of hidden.value?.settings ?? []) RESETS[s]()
  }
  const RESETS: Readonly<Record<HiddenSetting, () => void>> = {
    'scale-level': () => (scaleLevel.level.value = 'standard'),
    numerals: () => (prefs.numerals.value = true),
    'scale-names': () => (prefs.scaleNames.value = true),
    line: () => (prefs.lineMode.value = 'off'),
    spell: () => (prefs.spell.value = 'key'),
    practice: () => practice.setSelection(mode.value, null),
    pentatonics: () => (prefs.pentatonics.value = false),
  }
  ```
  `@show="ui.level.value = hidden!.needs"`. (Check `useScaleLevel`'s returned `level` is a writable ref, and the name of the current sheet ref in EditorView; adapt names, not behaviour.) A share link's prefs are visit-only refs (`linkPreferences`), so Reset there doesn't touch storage; stored prefs reset for good.

- [ ] **Step 1: Failing tests** — `InterfaceNotice.test.ts`: renders `This sheet uses Intermediate settings`; clicking each button emits. `EditorView.test.ts`: flag on, `essentials`, mounted with `shared: { level: 'advanced', seed: 1 }` → notice shows `Intermediate`; click Reset → notice gone and `localStorage.getItem('csm-level:…')` unchanged/absent; with `shared` at defaults → no notice; flag off → no notice.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — "Interface levels: the notice".

### Task 6: The switch and Help

**Files:**
- Modify: `web/app/components/MoreMenu.vue`, `web/app/pages/help.vue`
- Test: create `web/test/MoreMenu.test.ts`

- [ ] **Step 1: Failing test** — flag on: opening More actions shows `Interface` and three items `Essentials`, `Intermediate`, `Everything`, the current one with `aria-checked="true"` (role `menuitemradio`); clicking `Intermediate` sets `useInterface().level.value`. Flag off: no Interface items.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** in `MoreMenu.vue`, before the action items:
```vue
<template v-if="ui.on">
  <div class="col-span-full px-3.5 pt-1 pb-0.5 text-xs/5 font-medium text-zinc-500 sm:px-3 dark:text-zinc-400" aria-hidden="true">Interface</div>
  <UiDropdownItem v-for="l in INTERFACE_LEVELS" :key="l" role="menuitemradio" :aria-checked="ui.level.value === l" @click="ui.level.value = l">
    <CheckIcon v-if="ui.level.value === l" data-slot="icon" /><span v-else data-slot="icon" aria-hidden="true" />{{ levelLabel(l) }}
  </UiDropdownItem>
  <div role="separator" class="col-span-full mx-3.5 my-1 h-px border-0 bg-zinc-950/5 sm:mx-3 dark:bg-white/10" />
</template>
```
(`const ui = useInterface()`, import `CheckIcon` from `@heroicons/vue/16/solid`, `INTERFACE_LEVELS, levelLabel` from `~/utils/interface`. If `UiDropdownItem` doesn't pass `role`/`aria-checked` through, add `v-bind="$attrs"` passthrough in `ui/DropdownItem.vue` matching Catalyst.)
Help: under "The preview controls" add a short `UiText`: *Interface (in ⋯ More actions) chooses how many controls show: Essentials for the sheet, instrument, transposing, printing and editing chords; Intermediate adds the scale level, analysis rows, lines, spelling, Practice and choosing a chord's scale; Everything adds pentatonics, functions and key changes, and the chart's source. A sheet set up with hidden controls says so above it, with Show controls and Reset.* Wrap in `v-if="useFeature('interfaceLevels')"`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — "Interface levels: switch in More actions, Help".

### Task 7: e2e

**Files:**
- Modify: `web/e2e/fixtures.ts`
- Create: `web/e2e/interface.spec.ts`

- [ ] **Step 1: Fixture option** — e2e builds have every flag on, so existing specs need Everything:
```ts
export const test = base.extend<{ expectedConsoleError: RegExp | null; interfaceLevel: 'essentials' | 'intermediate' | 'everything' | null; problems: string[] }>({
  interfaceLevel: ['everything', { option: true }],
  // …existing problems fixture: add `interfaceLevel` to its parameters and, before `use`:
  //   if (interfaceLevel) await page.addInitScript((l) => { try { if (localStorage.getItem('csm-interface') === null) localStorage.setItem('csm-interface', l) } catch {} }, interfaceLevel)
})
```
Run `cd web && make -C .. e2e` (or `npx playwright test`) once: everything still passes. If a spec asserts on the full set of `localStorage` keys, account for `csm-interface`.

- [ ] **Step 2: `interface.spec.ts`** (use an existing library slug, e.g. `autumn-leaves`, and the share-link helper the my-charts spec uses for `#s=` links):
  - `test.describe` with `test.use({ interfaceLevel: 'essentials' })`: on the Changes sheet the rail has Work on, Instrument, Transposition and no `Level`, `Line`, `Analysis`; switching to Scales shows no `Practice` legend and no `Spell Scale`; More actions → `Intermediate` → `Level` and `Line` appear; reload → still there.
  - `intermediate`: `Pentatonics` toggle absent; Scales sheet `Practice` present without a `Pentatonic` preset.
  - `everything`: `Pentatonics` present.
  - `interfaceLevel: null` (a new browser): `Level` absent; with `localStorage.setItem('csm-instrument', 'concert')` via `addInitScript` before first load: `Level` present.
  - Share link with `view: { level: 'advanced', seed: 1 }` at `essentials`: status `This sheet uses Intermediate settings`; `Show controls` → `Level` shows Advanced, notice gone; on a fresh load `Reset` → notice gone.
- [ ] **Step 3: Run** `npx playwright test e2e/interface.spec.ts`, expect PASS.
- [ ] **Step 4: Commit** — "Interface levels: e2e".

### Task 8: Verify and open the PR

- [ ] `make test`, `make lint`, `make e2e` — all green.
- [ ] Update `docs/design.md` with a short Interface levels section (flag, tiers by reference to the spec).
- [ ] Push `interface-levels`, `gh pr create` (closes #273; note the flag starts off).

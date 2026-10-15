# Interface levels: Essentials, Practice, Everything (#273)

**Status:** accepted 2026-10-14, pending user testing with real players before the tiers are final.

## Goal

The app has grown a control for every practice idea: scale levels, analysis rows, guide-tone and arpeggio lines,
pentatonic ladders and paths, practice presets, functions, form editing. A player who opens a tune to get its scales
for their horn meets all of it at once. An **Interface** setting with three levels hides controls by audience.

## Constraint

Only visibility changes. No control moves, changes its look or behaviour, or loses function; no engine change; the
sheet a chart and its settings produce is the same at every level. A level is a filter over the controls that exist.

## Decisions (2026-10-14)

- **Three levels**, each a superset of the one before:
  - **Essentials**: a student with a tune and light editing. Choose the sheet and instrument, transpose, print, share,
    save, and edit chords, bars and sections. All three sheets: Changes, Scales and Arpeggios.
  - **Practice**: a player building vocabulary. Adds the scale level, analysis rows, lines, scale spelling, the Practice panel, choosing a chord's scale, and the "why" notes.
  - **Everything**: today's interface. Adds pentatonics and hexatonics, functions and key areas, the chart source, and
    form editing beyond sections.
- **Named Interface, not Level.** The rail's Level control already offers Basic / Standard / Advanced for the scale
  level (`engine/src/levels.ts`); a second "Basic/Advanced" would be confusing.
- **The viewer's level always wins.** A share link or a stored preference never changes it. The chart itself (chords,
  functions, `@key` areas, repeats) renders the same at every level.
- **Hidden settings stay in force, with a notice.** If a setting whose control is hidden at the current level differs
  from its default (from a share link, a stored preference, or a per-chart key), the sheet still renders it, and a
  one-line notice sits above the sheet: *This sheet uses Practice settings · Show controls · Reset*. Show controls
  raises the level to the lowest one that shows them; Reset returns those settings to their defaults for this visit
  (a share link) or for good (a stored preference). The notice is never shown when nothing is hidden.
- **Feature flags still gate existence.** A level only hides what a flag has already let in. New flagged features say
  which level they belong to in their spec.
- **Default level.** New visitors start at Essentials. A browser that already holds any `csm-*` preference when this
  ships starts at Everything, so no returning player loses a control they use.
- **Where the switch lives.** An *Interface* radio group at the top of the More actions menu (the ⋯ button beside
  Print, `MoreMenu.vue`), present on every sheet and on phones (it stays in the compact rail). Help gains a short section. Preference `csm-interface`
  (`essentials` | `practice` | `everything`), never in share links.

## The tiers

Built from the control inventory of 2026-10-14 (every control in `web/app/`). **E** Essentials, **P** Practice,
**A** Everything. Controls not listed (site navigation, home, library, My charts, help, contact, theme) are E.

### Rail

| Control | Tier | Default when hidden |
| --- | --- | --- |
| Work on: Changes, Scales, Arpeggios | E | |
| Instrument | E | |
| Transpose… (and its dialog) | E | |
| Show: Intervals (Scales, Arpeggios) | E | on |
| Level (scale level) and Shuffle | P | Standard |
| Analysis: Numerals, Scales | P | on |
| Analysis: Pentatonics / Overlay and every sub-control (basis, rank or Built on, path, rung, side, step) | A | off |
| Line: Off / Guide Tones / 7th Chords, guide line, arpeggio pattern | P | off |
| Line: Pentatonic cells (#284), Triad pair line | A | (follows the overlay) |
| Arpeggio: notes, direction (Arpeggios sheet) | E | |
| Spell Scale | P | From key |
| Edit / Done, Save to My charts, Share, Focus, Print, More actions (⋯) | E | |
| More actions: Save as a copy, Download, Revert, Report a chart error | E | |
| More actions: Interface (new) | E | |
| Controls dialog (phones) | E | holds whatever the level shows |

### Practice panel (Scales sheet)

| Control | Tier | Default when hidden |
| --- | --- | --- |
| The panel: presets Chord tones, Guide tones, Tensions, All; Clear; Notes to practise boxes | P | no selection |
| Presets Pentatonic and Hexatonic, with their rank / Built on, Pair and Grouping controls | A | no selection |

### Editing (sheet editor, phone chart pane and tap sheet)

| Control | Tier |
| --- | --- |
| Chord field and its keys (Tab, arrows, Space, Enter, Esc), tap-mode chord sheet's Chord input | E |
| + bar, + before, + after, Split, Delete; Undo, Redo, Save, Done editing | E |
| Heading fields: title, subtitle, key, time, composer, style, form | E |
| Add a section, Rename section | E |
| Repeat a section, New section here, Write out, 1st/2nd ending, Segno, Coda, Jump…, Paste bars… | P |
| Scale choice on a chord (label picker's Scale section, Unpin, Any scale search) | P |
| Key change here (`@key`) | A |
| Function choice (Function radio, Other function, Accept guess, How to write a function) | A |
| Source text: Show/Hide source, Source button, Chart text, its help tip | A |

At Essentials the bar toolbar's ⋯ menu shows only what is left (none of its items are E, so the ⋯ itself hides), and
the tap-mode sheet shows the Chord input without Chord choices.

### Notes on the sheet (Changes)

| Control | Tier |
| --- | --- |
| "Why" popover on a numeral or scale (and its Report issue) | P |
| Pentatonic ladder popover and its picks | A |

At Essentials the Numerals and Scales rows still print (they are on by default); they are just not buttons.

## The notice: what counts as a hidden setting

A setting is *hidden-and-set* when its control is above the current level and its value is not the default in the
tables above:

- from a share link: `level`/`seed` (not Standard), `numerals`/`scaleNames` (off), `line`,
  `mode`/`start` (not From key), `practice`;
- from preferences: the same global keys, `csm-pentatonics` (on), and per chart `csm-level:*`, `csm-practice:*`,
  `csm-pent-path:*`, `csm-pent-picks:*`.

The notice names the lowest level that shows all of them. A chart whose *text* uses higher-tier features (functions,
`@key`, repeats) does not trigger it: the chart is content, not a setting.

## Implementation sketch (web only)

- `web/app/utils/interface.ts`: `InterfaceLevel`, `INTERFACE_LEVELS`, a `CONTROL_TIERS` table (control id → level)
  and pure `shows(level, id)`, `hiddenSettings(level, view, prefs)` returning the ids set away from their defaults and
  the level that shows them. Unit-tested against the tables above.
- `composables/useInterface.ts`: the `csm-interface` preference, its first-visit default, and `shows(id)`.
- Components wrap each control's existing `v-if` with `shows('<id>') &&`; nothing else changes in them.
- `InterfaceNotice.vue` above the sheet; the More actions menu's radio group; help section.
- e2e builds start at Everything (as today's tests expect), with one spec per level checking which controls show,
  and the notice for a share link carrying Practice settings opened at Essentials.

## Out of scope

- Moving, regrouping or restyling controls; a different layout per level.
- Per-control show/hide customisation.
- Carrying the level in share links.

## Open questions

1. **Names.** Essentials / Practice / Everything describe the audience and stay clear of the scale Level's Basic /
   Standard / Advanced. Alternatives: Play / Practice / Study.
2. **Form editing at Practice.** Repeats and endings are P on the view that a student types chords into an existing
   form; a student entering a new tune may want them at E.
3. **The More actions menu as the home of the switch.** Discoverable enough, or does a first-visit hint belong on the rail?
4. **User testing.** Watch a few players at each level (a student at Essentials, a working player at Practice) before
   the tier table is final; move controls between tiers from what they reach for.

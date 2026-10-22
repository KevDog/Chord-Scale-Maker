# Edit alternate changes in the sheet editor (#469)

Follow-up to [alternate changes](2026-10-21-alternate-changes-design.md) (#215), which reads `alt BAR | chord …`
rows from chart text and draws them, but leaves a chart with alternates editable only in its Source
(`sheetEditing` is off for it, `docs/design.md` "Alternate changes").

## Intent

A player copying a lead sheet's alternates (the New Real Book's parenthesised chords and "may be played" boxes)
onto their own chart (edited, copy or new) does it bar by bar on the Changes sheet, the way they write the main
chords, without touching the Source. Once a bar has an alternate, they can reharmonise further from the Alternate
view, and set its chords' scales and functions with the usual chord editor.

**Success:** a chart gains, edits and loses alternates entirely from the sheet; every sheet edit on a chart with
alternates keeps both sets intact; Download/Open, Share, Revert and undo treat alt rows like any other line.

## Goals

1. **The alt line is editable (Standard view).** While the editor is shown on the Changes sheet with Standard
   playing, the small alternate line above the bars is an editing line: every written bar shows a faint `+ alt`
   target where it has no alternate, and its alternate chords where it has one. Clicking either opens an inline
   chord field above that bar; Tab / ← → move along the alt line the way they move along the main one
   (Tab = bar, ← → = chord, per the sheet editor). Enter or Tab commits; Esc cancels.
   - The field takes the same text as a main bar (same parser, `%`, same refusals and messages).
   - Committing chords writes that bar's `alt` rows (replacing any it had). Committing empty removes them.
   - Committing chords **identical to the bar's standard chords** removes the bar's alt rows (a bar is an
     alternate only where it differs).
   - The line is shown while editing even if `Other changes` is off, and even on a chart with no alternates yet
     (that is how the first one is added). Outside editing it follows `Other changes` as today.
2. **Alternate view edits split bars off.** With Changes set to Alternate, the big chords are the alternate set
   (as drawn today). Retyping the chords of a bar that has **no** alternate makes it one: the typed chords become
   its `alt` rows and its standard rows are untouched. Retyping a bar that already has one replaces its `alt` rows;
   retyping it back to its standard chords removes them (goal 1's rule).
3. **Scale and function on alternates.** Tapping a big chord in Alternate view opens the usual chord editor
   (`ChordChoices`: scale, pin, function). On an alternate bar it writes that chord's `alt` row; on a shared bar
   it writes the shared (standard) row, because the chord hasn't changed. The small alt line takes chords only.
4. **Bar structure is shared.** `+ before`, `+ after`, Split, Delete, Paste bars…, New section here…, endings,
   marks, metre, Jump, key change, Write out and Rename act on the chart's bars in either view: an inserted bar
   moves later `alt` rows along with the main rows; a deleted bar drops its `alt` rows; a split carries `alt`
   rows into the new section with their bars renumbered; Write out of a `copy:` section writes out the `alt`
   rows it carried too. Inserted / pasted bars have no alternates.
5. **The Alternate view's small line** shows the Standard chords, read-only. Standard is edited from Standard.
6. **First and last alternate.** Adding the first `alt` row brings the Changes control and the `Other changes`
   toggle (as `hasAlternates` already does); removing the last takes them away and the chart plays standard.
   Removing the last while Alternate is playing drops back to Standard without a stored change of preference
   beyond what `useChangesSet` already does for a chart with none.
7. **Round trip and housekeeping.** Every edit is a pure `ChartDoc → ChartDoc` in the engine and serialises to
   ordinary `alt` rows. `sameChart` (unsaved / Revert / "edited" detection) canonicalises `alt` rows' scales as it
   does rows'. Undo/redo covers alt edits as single steps. Picks and practice per set carry over edits as today.
8. **Sheet editing is on for charts with alternates**, and the Source is no longer forced on for them
   (`sourceOffered` drops its `hasAlternates` clause).

9. **Held bars and redundancy.** The format and `changesFor` stay as they are: an `alt` row's chord carries
   through the following bars that have no row of their own, as any row's does. The alt line draws what the
   Alternate set plays there. A bar whose alternate should hold a chord where Standard has one gets that chord
   written again (`%` in the alt field copies the Alternate set's bar before). **An alt bar is redundant when
   removing its `alt` rows leaves the Alternate set playing the same chords, scales and functions there**; that
   is the "same as standard" rule of goals 1 and 2, checked only when an alt edit is committed (alt line or
   Alternate view), never as a cleanup after Standard or structural edits (no silent deletion).
10. **Repeats.** A `copy:` section's bars show their carried alternates read-only on the alt line, with no
    `+ alt` targets, as the main line treats them; Write out makes them editable.

11. **Phones (below md).** No alt-line targets: the small line stays as drawn today. A phone adds and edits
    alternates from the Alternate view by tapping a chord (the chord sheet; goals 2–3), and removes one by
    retyping the bar back to standard.

## Non-goals

- A dialog for a span of bars ("Alternate bars…", option C): not now.
- Editing scales/functions from the small alt line.
- More than one alternate set, or naming sets.
- Alternates in the Scales or Arpeggios sheets' editing (they have none; they play the chosen set as today).
- Editing the Standard set from the Alternate view.
- Changing how alternates are drawn, printed, shared or stored.

## Anti-goals

- An edit in either view silently dropping or duplicating the other set's rows (the bug that kept editing off).
- Alt rows that merely repeat the standard chords.
- A new gesture to learn for the main chords: the main line behaves exactly as now.

## Constraints

- Engine stays pure (no Vue/DOM); all doc edits live in `engine/src/` (`edit.ts`, `alternates.ts`) with tests
  first (TDD), exported from `index.ts` with the `api.test.ts` snapshot updated. Golden fixtures should not move
  (no library chart text changes); if they do, that is a bug.
- The `alternates` flag is on; with it off, a chart with `alt` rows still plays standard only. Sheet editing with
  the flag off: allowed, edits touch main rows and must keep `alt` rows intact (goal 4); the alt line is not shown.
- UI from `web/app/components/ui/`; hashed CSP; a11y: the alt line's targets are buttons with labels
  ("Alternate for A bar 6"), keyboard reachable; `make a11y` clean.
- Docs: Help (editing alternates), `docs/design.md` "Alternate changes" (replace the "Sheet editing is off"
  bullet), a `releaseNotes.ts` item. "Same as standard removes it" is a choice the app makes for the user → a
  `DECISIONS` row.

## Decided by the user

- Gesture B (an always-editable alt line while editing), not a toolbar button or a span dialog.
- Scale and function for alternate chords via the usual chord editor in Alternate view.
- In Alternate view, retyping a shared bar makes it an alternate (it does not change the standard chord).
- Phones: Alternate view only, no alt-line targets (goal 11).

## My calls (Claude), open to veto

- Chords equal to standard → no alternate (goal 1).
- A scale/function edit on a shared bar in Alternate view writes the shared row (goal 3).
- Bar structure shared across both sets in either view (goal 4).
- The Alternate view's small line is read-only Standard (goal 5).
- The alt line shows while editing regardless of `Other changes` (goal 1).
- No format change for held alternates; redundancy judged on the Alternate set's result, at commit only (goal 9).
- Repeats read-only on the alt line (goal 10).

## Left to the builder

- Shape of the engine API: e.g. a set-aware `setBarChords(doc, section, bar, chords, set)` (or `setAltBarChords`)
  plus teaching the bar-shifting helpers (`tidyBars`, the insert/delete/split/paste/write-out paths) about
  `altRow`; or editing `changesFor`'s played doc and merging back by line index (the line-count invariant helps
  for in-place edits, not for structural ones). Prefer whichever keeps each op one pure function with tests.
- Where alt rows sit in a section's block when added (next to their bar's main rows is natural and reads well
  in the Source).
- How the inline alt field is drawn in `ChangesSystem.vue` (reuse the main line's field and focus model).
- PR split; a likely one: (1) engine ops + tests, (2) sheet editing on for alternates with structural edits
  safe and the Alternate view's goals 2–3, (3) the editable alt line, docs, release note.
